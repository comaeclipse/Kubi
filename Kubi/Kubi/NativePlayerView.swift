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
    @Published var isFullscreen = false

    let request: PlaybackRequest
    var isScrubbing = false
    var onToggleFullscreen: () -> Void = {}
    var onSignIn: () -> Void = {}
    var onReload: () -> Void = {}

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

    func pause() {
        call("pauseVideo()")
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

// Matches the web placeholder's rounded-xl corners.
private let inlineCornerRadius: CGFloat = 12
private let fullscreenAnimation: TimeInterval = 0.25

// Plays one video in a native view laid over the web page's player box. Inline,
// the view lives inside the page's scroll view at the box's page coordinates, so
// it scrolls with the page. Fullscreen moves the same view, still playing, onto
// the window.
@MainActor
final class InlinePlayerController: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
    let model: PlayerModel
    var videoId: String { model.request.videoId }

    private weak var hostWebView: WKWebView?
    private let container = UIView()
    private let playerWebView: WKWebView
    private let controls: UIHostingController<PlayerControlsView>
    private var inlineFrame: CGRect?
    private var isCovered = false
    private var backgroundObserver: AnyCancellable?

    init(
        request: PlaybackRequest,
        hostWebView: WKWebView,
        onProgress: @escaping (PlaybackProgress) -> Void,
        onSignIn: @escaping () -> Void
    ) {
        model = PlayerModel(request: request, onProgress: onProgress)
        self.hostWebView = hostWebView

        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        // Shared with the main web view and the YouTube sign-in sheet, so the
        // cookies YouTube sets here build up a normal history across plays.
        configuration.websiteDataStore = .default()
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
        playerWebView = WKWebView(frame: .zero, configuration: configuration)
        controls = UIHostingController(rootView: PlayerControlsView(model: model))
        super.init()

        playerWebView.configuration.userContentController.add(
            WeakScriptMessageHandler(self),
            name: "player"
        )
        playerWebView.isOpaque = false
        playerWebView.backgroundColor = .black
        playerWebView.scrollView.isScrollEnabled = false
        // The SwiftUI controls on top take every tap; nothing reaches YouTube's
        // links, logo or "More videos" inside the player.
        playerWebView.isUserInteractionEnabled = false
        playerWebView.navigationDelegate = self

        container.backgroundColor = .black
        container.clipsToBounds = true
        container.layer.cornerRadius = inlineCornerRadius
        controls.view.backgroundColor = .clear
        // Inline, the box sits mid-page and owes nothing to the screen edges.
        controls.safeAreaRegions = []
        for view in [playerWebView, controls.view!] {
            view.frame = container.bounds
            view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            container.addSubview(view)
        }

        model.webView = playerWebView
        model.onSignIn = onSignIn
        model.onReload = { [weak self] in self?.reload() }
        model.onToggleFullscreen = { [weak self] in self?.toggleFullscreen() }
        backgroundObserver = NotificationCenter.default
            .publisher(for: UIApplication.didEnterBackgroundNotification)
            .sink { [weak self] _ in self?.model.reportProgress() }

        load()
    }

    // `frame` is the web box in page coordinates. Without one (a page from
    // before inline playback) there is nowhere to sit, so play fullscreen.
    func update(frame: CGRect?, covered: Bool) {
        if let frame { inlineFrame = frame }
        if !model.isFullscreen {
            if inlineFrame == nil {
                enterFullscreen(animated: false)
            } else {
                placeInline()
            }
        }
        setCovered(covered)
    }

    // Reloads where it left off, e.g. after signing in to YouTube.
    func reload() {
        model.prepareForReload()
        load()
    }

    func close() {
        model.reportProgress()
        backgroundObserver = nil
        playerWebView.configuration.userContentController.removeScriptMessageHandler(forName: "player")
        playerWebView.navigationDelegate = nil
        playerWebView.stopLoading()
        playerWebView.loadHTMLString("", baseURL: nil)
        container.removeFromSuperview()
    }

    private func load() {
        var request = URLRequest(url: embedURL(videoId: videoId, startSeconds: model.currentTime))
        request.setValue(embedReferrer, forHTTPHeaderField: "Referer")
        playerWebView.load(request)
    }

    private func placeInline() {
        guard let scrollView = hostWebView?.scrollView, let frame = inlineScrollFrame() else { return }
        if container.superview !== scrollView {
            scrollView.addSubview(container)
        }
        container.autoresizingMask = []
        container.frame = frame
    }

    // Page coordinates are CSS pixels; the scroll view's content is scaled by
    // its zoom.
    private func inlineScrollFrame() -> CGRect? {
        guard let inlineFrame, let scrollView = hostWebView?.scrollView else { return nil }
        let zoom = scrollView.zoomScale
        return CGRect(
            x: inlineFrame.minX * zoom,
            y: inlineFrame.minY * zoom,
            width: inlineFrame.width * zoom,
            height: inlineFrame.height * zoom
        )
    }

    // A dialog or menu over the box (the time-limit lockout among them) must
    // win, so the player pauses and gets out of the way until it closes.
    private func setCovered(_ covered: Bool) {
        guard covered != isCovered else { return }
        isCovered = covered
        if covered {
            model.pause()
            if model.isFullscreen { exitFullscreen() }
        }
        container.isHidden = covered
    }

    private func toggleFullscreen() {
        if model.isFullscreen {
            exitFullscreen()
        } else {
            enterFullscreen(animated: true)
        }
    }

    private func enterFullscreen(animated: Bool) {
        guard let window = hostWebView?.window else { return }
        let start = container.superview?.convert(container.frame, to: window) ?? window.bounds
        window.addSubview(container)
        container.frame = start
        container.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        model.isFullscreen = true
        controls.safeAreaRegions = .all

        let expand = {
            self.container.frame = window.bounds
            self.container.layer.cornerRadius = 0
        }
        if animated {
            UIView.animate(withDuration: fullscreenAnimation, animations: expand)
        } else {
            expand()
        }
    }

    private func exitFullscreen() {
        guard let window = container.window,
              let scrollView = hostWebView?.scrollView,
              let frame = inlineScrollFrame() else { return }
        model.isFullscreen = false
        controls.safeAreaRegions = []
        container.autoresizingMask = []

        UIView.animate(withDuration: fullscreenAnimation) {
            self.container.frame = scrollView.convert(frame, to: window)
            self.container.layer.cornerRadius = inlineCornerRadius
        } completion: { _ in
            guard !self.model.isFullscreen else { return }
            self.placeInline()
        }
    }

    // MARK: WKScriptMessageHandler

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.frameInfo.isMainFrame,
              let body = message.body as? [String: Any] else { return }
        model.handle(body)
    }

    // MARK: WKNavigationDelegate

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        // YouTube's helper frames load freely. The page itself never leaves the
        // embed, whatever YouTube's scripts try.
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

// WKUserContentController holds its handlers strongly, and the controller owns
// the web view that owns the content controller.
private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var target: WKScriptMessageHandler?

    init(_ target: WKScriptMessageHandler) {
        self.target = target
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        target?.userContentController(userContentController, didReceive: message)
    }
}

struct PlayerControlsView: View {
    @ObservedObject var model: PlayerModel
    @State private var showControls = true
    @State private var hideTask: Task<Void, Never>?

    var body: some View {
        ZStack {
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
        .onChange(of: model.isPlaying) { _, playing in
            if playing {
                scheduleHide()
            } else {
                hideTask?.cancel()
                showControls = true
            }
        }
    }

    private var controls: some View {
        VStack(spacing: 0) {
            if model.isFullscreen {
                HStack(spacing: 12) {
                    Text(model.request.title)
                        .font(.headline)
                        .lineLimit(1)

                    Spacer()

                    Button(action: model.onSignIn) {
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
            }

            Spacer()

            HStack(spacing: 8) {
                Button(action: model.togglePlay) {
                    Image(systemName: model.isPlaying ? "pause.fill" : "play.fill")
                        .font(.title3)
                        .frame(width: 40, height: 40)
                }
                .accessibilityLabel(model.isPlaying ? "Pause" : "Play")

                Button(action: model.restart) {
                    Image(systemName: "arrow.counterclockwise")
                        .frame(width: 40, height: 40)
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

                Button(action: model.onToggleFullscreen) {
                    Image(systemName: model.isFullscreen
                          ? "arrow.down.right.and.arrow.up.left"
                          : "arrow.up.left.and.arrow.down.right")
                        .frame(width: 40, height: 40)
                }
                .accessibilityLabel(model.isFullscreen ? "Exit full screen" : "Full screen")
            }
            .padding(.horizontal, 8)
            .padding(.top, 24)
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
            Color.black.opacity(0.85)
            Button(action: model.restart) {
                VStack(spacing: 12) {
                    Image(systemName: "arrow.counterclockwise")
                        .font(.title)
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
            Color.black.opacity(0.85)
            VStack(spacing: 12) {
                Text(message)
                    .font(.callout)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white)
                if model.needsSignIn {
                    Button("Sign in to YouTube", action: model.onSignIn)
                        .buttonStyle(.borderedProminent)
                } else {
                    Button("Try Again", action: model.onReload)
                        .buttonStyle(.borderedProminent)
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

    private func formatTime(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds > 0 else { return "0:00" }
        let total = Int(seconds)
        return "\(total / 60):" + String(format: "%02d", total % 60)
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
struct YouTubeSignInView: View {
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
