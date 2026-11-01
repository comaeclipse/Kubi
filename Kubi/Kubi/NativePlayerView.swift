import SwiftUI
import WebKit
import Combine

// The player loads YouTube's embed page as the top-level page, so it is
// first-party and WKWebView keeps YouTube's visitor and sign-in cookies for it.
// Embedded in kubi.kids it is a third-party frame, the cookies are stripped,
// and every play looks like a brand-new visitor to YouTube's bot check.
// YouTube refuses embeds that don't say who is embedding them (error 152/153),
// so the request names Kubi as the referrer.
private let embedReferrer = "https://kubi.kids/"

struct PlaybackRequest: Identifiable, Equatable {
    let videoId: String
    let title: String
    let startSeconds: Double

    var id: String { videoId }

    // YouTube ids are 11 URL-safe base64 characters. Anything else is refused
    // before it is spliced into the player page.
    static func isValidVideoId(_ id: String) -> Bool {
        id.range(of: "^[A-Za-z0-9_-]{11}$", options: .regularExpression) != nil
    }
}

struct PlaybackProgress {
    let videoId: String
    let seconds: Double
    let duration: Double
}

// Pause, end, close and backgrounding all report immediately, so this only
// bounds how much resume position a crash can lose.
private let reportInterval: TimeInterval = 60
private let controlsHideDelay: Duration = .seconds(4)

@MainActor
final class PlayerModel: ObservableObject {
    @Published var isReady = false
    @Published var isPlaying = false
    @Published var isEnded = false
    @Published var currentTime: Double
    @Published var duration: Double = 0
    @Published var errorMessage: String?
    @Published var needsSignIn = false

    let request: PlaybackRequest
    var isScrubbing = false

    fileprivate weak var webView: WKWebView?
    private let onProgress: (PlaybackProgress) -> Void
    private var lastReport = Date()

    init(request: PlaybackRequest, onProgress: @escaping (PlaybackProgress) -> Void) {
        self.request = request
        self.onProgress = onProgress
        self.currentTime = request.startSeconds
    }

    func togglePlay() {
        if isEnded {
            restart()
        } else if isPlaying {
            call("pauseVideo()")
        } else {
            call("playVideo()")
        }
    }

    func restart() {
        call("seekTo(0, true)")
        call("playVideo()")
        isEnded = false
        currentTime = 0
    }

    // While dragging, seek without buffering so YouTube only shows preview
    // frames; the final seek on release is the one that actually loads.
    func seek(to seconds: Double, allowSeekAhead: Bool) {
        currentTime = seconds
        call("seekTo(\(seconds), \(allowSeekAhead))")
    }

    func reportProgress() {
        guard isReady, currentTime.isFinite, duration.isFinite else { return }
        lastReport = Date()
        onProgress(PlaybackProgress(
            videoId: request.videoId,
            seconds: currentTime,
            duration: duration
        ))
    }

    // Reloads the player where it left off, e.g. after signing in to YouTube.
    func prepareForReload() {
        isReady = false
        isPlaying = false
        errorMessage = nil
        needsSignIn = false
    }

    private func call(_ method: String) {
        webView?.evaluateJavaScript("player && player.\(method);")
    }

    fileprivate func handle(_ message: [String: Any]) {
        if !isScrubbing, let time = message["time"] as? Double {
            currentTime = time
        }
        if let total = message["duration"] as? Double, total > 0 {
            duration = total
        }

        switch message["type"] as? String {
        case "ready":
            isReady = true
        case "state":
            switch message["state"] as? Int {
            case 1: // playing
                isPlaying = true
                isEnded = false
                errorMessage = nil
            case 2: // paused
                isPlaying = false
                reportProgress()
            case 0: // ended
                isPlaying = false
                isEnded = true
                currentTime = duration
                reportProgress()
            default:
                break
            }
        case "time":
            if isPlaying, Date().timeIntervalSince(lastReport) >= reportInterval {
                reportProgress()
            }
        case "error":
            isPlaying = false
            let reason = (message["reason"] as? String ?? "").lowercased()
            needsSignIn = reason.contains("bot") || reason.contains("sign in")
            errorMessage = needsSignIn
                ? "YouTube wants you to sign in before it will play videos here."
                : Self.describeError(message["code"] as? Int)
        default:
            break
        }
    }

    private static func describeError(_ code: Int?) -> String {
        switch code {
        case 100:
            return "This video is no longer on YouTube."
        case 101, 150:
            return "This video's owner doesn't allow it to play outside YouTube."
        default:
            return "YouTube couldn't play this video."
        }
    }
}

struct NativePlayerView: View {
    @StateObject private var model: PlayerModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var showControls = true
    @State private var hideTask: Task<Void, Never>?
    @State private var isSigningIn = false
    @State private var playerGeneration = 0

    init(request: PlaybackRequest, onProgress: @escaping (PlaybackProgress) -> Void) {
        _model = StateObject(wrappedValue: PlayerModel(request: request, onProgress: onProgress))
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            PlayerWebView(model: model)
                .id(playerGeneration)
                .ignoresSafeArea()

            // Taps land here, never on YouTube's own links inside the player.
            Color.clear
                .contentShape(Rectangle())
                .onTapGesture(perform: handleTap)

            if let errorMessage = model.errorMessage {
                errorView(errorMessage)
            } else if model.isEnded {
                endScreen
            } else if !model.isReady {
                ProgressView()
                    .controlSize(.large)
                    .tint(.white)
            } else if !model.isPlaying {
                bigPlayButton
            }

            controls
                .opacity(showControls || !model.isPlaying ? 1 : 0)
                .animation(.easeInOut(duration: 0.25), value: showControls)
                .allowsHitTesting(showControls || !model.isPlaying)
        }
        // Always black behind the video, so the controls need dark styling to
        // show, the seek bar's track in particular.
        .environment(\.colorScheme, .dark)
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
        .onChange(of: model.isPlaying) { _, playing in
            if playing {
                scheduleHide()
            } else {
                hideTask?.cancel()
                showControls = true
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active { model.reportProgress() }
        }
        .sheet(isPresented: $isSigningIn, onDismiss: reloadPlayer) {
            YouTubeSignInView()
        }
    }

    private var controls: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button(action: close) {
                    Image(systemName: "xmark")
                        .font(.title3.weight(.semibold))
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Close")

                Text(model.request.title)
                    .font(.headline)
                    .lineLimit(1)

                Spacer()

                Button {
                    isSigningIn = true
                } label: {
                    Image(systemName: "person.crop.circle")
                        .font(.title3)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Sign in to YouTube")
            }
            .padding(.horizontal)
            .padding(.top, 8)
            .padding(.bottom, 24)
            .background(LinearGradient(colors: [.black.opacity(0.8), .clear], startPoint: .top, endPoint: .bottom))

            Spacer()

            HStack(spacing: 12) {
                Button(action: model.togglePlay) {
                    Image(systemName: model.isPlaying ? "pause.fill" : "play.fill")
                        .font(.title2)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel(model.isPlaying ? "Pause" : "Play")

                Button(action: model.restart) {
                    Image(systemName: "arrow.counterclockwise")
                        .font(.title3)
                        .frame(width: 44, height: 44)
                }
                .accessibilityLabel("Start over")

                Slider(
                    value: Binding(
                        get: { model.currentTime },
                        set: { model.seek(to: $0, allowSeekAhead: false) }
                    ),
                    in: 0...max(model.duration, 1),
                    onEditingChanged: { editing in
                        model.isScrubbing = editing
                        if editing {
                            hideTask?.cancel()
                        } else {
                            model.seek(to: model.currentTime, allowSeekAhead: true)
                            scheduleHide()
                        }
                    }
                )
                .tint(.red)
                .disabled(!model.isReady)

                Text("\(formatTime(model.currentTime)) / \(formatTime(model.duration))")
                    .font(.footnote.monospacedDigit())
                    .foregroundStyle(.white.opacity(0.8))
            }
            .padding(.horizontal)
            .padding(.top, 24)
            .padding(.bottom, 8)
            .background(LinearGradient(colors: [.clear, .black.opacity(0.8)], startPoint: .top, endPoint: .bottom))
        }
        .foregroundStyle(.white)
    }

    private var bigPlayButton: some View {
        Button(action: model.togglePlay) {
            Image(systemName: "play.fill")
                .font(.title)
                .foregroundStyle(.white)
                .frame(width: 68, height: 48)
                .background(.red, in: RoundedRectangle(cornerRadius: 12))
        }
        .accessibilityLabel("Play")
    }

    // Covers YouTube's end-of-video recommendations.
    private var endScreen: some View {
        ZStack {
            Color.black.opacity(0.85).ignoresSafeArea()
            Button(action: model.restart) {
                VStack(spacing: 12) {
                    Image(systemName: "arrow.counterclockwise")
                        .font(.largeTitle)
                        .frame(width: 64, height: 64)
                        .background(.white.opacity(0.15), in: Circle())
                    Text("Start over")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.7))
                }
                .foregroundStyle(.white)
            }
        }
    }

    private func errorView(_ message: String) -> some View {
        ZStack {
            Color.black.opacity(0.85).ignoresSafeArea()
            VStack(spacing: 16) {
                Text(message)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                HStack {
                    if model.needsSignIn {
                        Button("Sign in to YouTube") { isSigningIn = true }
                            .buttonStyle(.borderedProminent)
                    } else {
                        Button("Try Again", action: reloadPlayer)
                            .buttonStyle(.borderedProminent)
                    }
                    Button("Close", action: close)
                        .buttonStyle(.bordered)
                        .tint(.white)
                }
            }
            .padding()
        }
    }

    private func handleTap() {
        if showControls, model.isReady {
            model.togglePlay()
        } else {
            showControls = true
        }
        scheduleHide()
    }

    private func scheduleHide() {
        hideTask?.cancel()
        guard model.isPlaying else { return }
        hideTask = Task {
            try? await Task.sleep(for: controlsHideDelay)
            guard !Task.isCancelled, !model.isScrubbing else { return }
            showControls = false
        }
    }

    private func close() {
        model.reportProgress()
        dismiss()
    }

    private func reloadPlayer() {
        model.prepareForReload()
        playerGeneration += 1
    }

    private func formatTime(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds > 0 else { return "0:00" }
        let total = Int(seconds)
        return "\(total / 60):" + String(format: "%02d", total % 60)
    }
}

private struct PlayerWebView: UIViewRepresentable {
    let model: PlayerModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        // Shared with the main web view and the YouTube sign-in sheet, so the
        // cookies YouTube sets here build up a normal history across plays.
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(context.coordinator, name: "player")
        configuration.userContentController.addUserScript(WKUserScript(
            source: hideYouTubeChromeScript,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: false
        ))
        configuration.userContentController.addUserScript(WKUserScript(
            source: playerBridgeScript,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.isScrollEnabled = false
        // The SwiftUI controls on top take every tap; nothing reaches YouTube's
        // links, logo or "More videos" inside the player.
        webView.isUserInteractionEnabled = false
        webView.navigationDelegate = context.coordinator

        model.webView = webView
        var request = URLRequest(url: embedURL(videoId: model.request.videoId, startSeconds: model.currentTime))
        request.setValue(embedReferrer, forHTTPHeaderField: "Referer")
        webView.load(request)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "player")
        webView.navigationDelegate = nil
        webView.stopLoading()
        webView.loadHTMLString("", baseURL: nil)
    }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        private let model: PlayerModel

        init(model: PlayerModel) {
            self.model = model
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.frameInfo.isMainFrame,
                  let body = message.body as? [String: Any] else { return }
            model.handle(body)
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            // YouTube's helper frames load freely. The page itself never leaves
            // the embed, whatever YouTube's scripts try.
            let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? true
            let url = navigationAction.request.url
            if isMainFrame,
               url?.host != "www.youtube.com" || url?.path.hasPrefix("/embed/") != true {
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}

private func embedURL(videoId: String, startSeconds: Double) -> URL {
    let start = startSeconds.isFinite ? max(0, Int(startSeconds)) : 0
    var components = URLComponents(string: "https://www.youtube.com/embed/\(videoId)")!
    components.queryItems = [
        URLQueryItem(name: "start", value: String(start)),
        URLQueryItem(name: "autoplay", value: "1"),
        URLQueryItem(name: "controls", value: "0"),
        URLQueryItem(name: "disablekb", value: "1"),
        URLQueryItem(name: "modestbranding", value: "1"),
        URLQueryItem(name: "rel", value: "0"),
        URLQueryItem(name: "iv_load_policy", value: "3"),
        URLQueryItem(name: "fs", value: "0"),
        URLQueryItem(name: "playsinline", value: "1"),
    ]
    return components.url!
}

// Runs in the embed page and reports the player's state to the app. The page's
// #movie_player element speaks the same API as the IFrame API's YT.Player, and
// the app drives it as `player`.
private let playerBridgeScript = """
(function () {
  if (!location.pathname.startsWith("/embed/")) return;
  function post(message) {
    window.webkit.messageHandlers.player.postMessage(message);
  }
  function snapshot(type) {
    return {
      type: type,
      time: window.player.getCurrentTime(),
      duration: window.player.getDuration()
    };
  }
  function attach() {
    var element = document.getElementById("movie_player");
    if (!element || typeof element.getCurrentTime !== "function") {
      setTimeout(attach, 100);
      return;
    }
    window.player = element;
    element.addEventListener("onStateChange", function (state) {
      var message = snapshot("state");
      message.state = state;
      post(message);
    });
    element.addEventListener("onError", function (code) {
      // The bot check arrives as an ordinary error code; only its on-screen
      // text tells it apart, and that renders just after the event.
      setTimeout(function () {
        var reason = document.querySelector(".ytp-error-content-wrap-reason");
        post({ type: "error", code: code, reason: reason ? reason.textContent : "" });
      }, 300);
    });
    post(snapshot("ready"));
    element.playVideo();
    setInterval(function () { post(snapshot("time")); }, 250);
  }
  attach();
})();
"""

// Runs inside the YouTube embed frame and hides the links and overlays that
// would lead a kid out to YouTube. Taps can't reach them anyway; this keeps
// them from being shown at all.
private let hideYouTubeChromeScript = """
(function () {
  if (!location.pathname.startsWith("/embed/")) return;
  var style = document.createElement("style");
  style.textContent = [
    ".ytp-chrome-top", ".ytp-watermark", ".ytp-youtube-button",
    ".ytp-pause-overlay", ".ytp-show-cards-title", ".ytp-ce-element",
    ".ytp-endscreen-content", ".ytp-paid-content-overlay"
  ].join(", ") + " { display: none !important; }";
  document.documentElement.appendChild(style);
})();
"""

// Signing in to YouTube in Safari doesn't reach the app, which keeps its own
// cookies. Signing in here does: the player shares this web view's data store.
private struct YouTubeSignInView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            SignInWebView(onSignedIn: { dismiss() })
                .ignoresSafeArea(edges: .bottom)
                .navigationTitle("Sign in to YouTube")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                }
        }
    }
}

private struct SignInWebView: UIViewRepresentable {
    let onSignedIn: () -> Void

    private static let signInURL = URL(
        string: "https://accounts.google.com/ServiceLogin?service=youtube&continue=https://www.youtube.com/"
    )!

    func makeCoordinator() -> Coordinator {
        Coordinator(onSignedIn: onSignedIn)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.load(URLRequest(url: Self.signInURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        private let onSignedIn: () -> Void

        init(onSignedIn: @escaping () -> Void) {
            self.onSignedIn = onSignedIn
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard navigationAction.targetFrame?.isMainFrame ?? true,
                  let url = navigationAction.request.url,
                  let host = url.host?.lowercased() else {
                decisionHandler(.allow)
                return
            }

            // YouTube's /signin hop stores its cookies; the redirect after it
            // would land on the YouTube home page, so stop there instead.
            if host == "www.youtube.com" || host == "m.youtube.com" {
                if url.path.hasPrefix("/signin") {
                    decisionHandler(.allow)
                } else {
                    decisionHandler(.cancel)
                    onSignedIn()
                }
                return
            }

            // Keep the sheet on Google's and YouTube's sign-in pages.
            let allowed = ["google.com", "youtube.com", "gstatic.com"]
            if allowed.contains(where: { host == $0 || host.hasSuffix("." + $0) }) {
                decisionHandler(.allow)
            } else {
                decisionHandler(.cancel)
            }
        }
    }
}
