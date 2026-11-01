import SwiftUI
import WebKit
import Combine

private let kubiURL: URL = {
    #if DEBUG
    // `-KubiURL <url>` starts somewhere else on the site, for trying things
    // on pages that don't need a Kubi sign-in.
    if let override = UserDefaults.standard.string(forKey: "KubiURL"),
       let url = URL(string: override) {
        return url
    }
    #endif
    return URL(string: "https://kubi.kids/")!
}()

@MainActor
final class WebViewModel: ObservableObject {
    @Published var isLoading = true
    @Published var errorMessage: String?
    @Published var isSigningIn = false

    fileprivate weak var webView: WKWebView?
    fileprivate var player: InlinePlayerController?

    func reload() {
        errorMessage = nil
        if let webView {
            webView.reload()
        }
    }

    func signInFinished() {
        player?.reload()
    }

    // The web player saves this against the signed-in profile, the same way it
    // saves progress from its own embed.
    func report(_ progress: PlaybackProgress) {
        let detail: [String: Any] = [
            "videoId": progress.videoId,
            "seconds": progress.seconds,
            "duration": progress.duration,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: detail),
              let json = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('kubi-native-player', { detail: \(json) }));"
        )
    }
}

struct ContentView: View {
    @StateObject private var model = WebViewModel()

    var body: some View {
        ZStack {
            KubiWebView(model: model)

            if model.isLoading {
                ProgressView()
                    .controlSize(.large)
                    .padding(20)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
            }

            if let errorMessage = model.errorMessage {
                ContentUnavailableView {
                    Label("Kubi is unavailable", systemImage: "wifi.exclamationmark")
                } description: {
                    Text(errorMessage)
                } actions: {
                    Button("Try Again") {
                        model.reload()
                    }
                    .buttonStyle(.borderedProminent)
                }
                .padding()
                .background(Color(uiColor: .systemBackground))
            }
        }
        .sheet(isPresented: $model.isSigningIn, onDismiss: model.signInFinished) {
            YouTubeSignInView()
        }
    }
}

private struct KubiWebView: UIViewRepresentable {
    @ObservedObject var model: WebViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(context.coordinator, name: "kubiPlayer")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic

        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(
            context.coordinator,
            action: #selector(Coordinator.refresh(_:)),
            for: .valueChanged
        )
        webView.scrollView.refreshControl = refreshControl

        model.webView = webView
        webView.load(URLRequest(url: kubiURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        private let model: WebViewModel

        init(model: WebViewModel) {
            self.model = model
        }

        @objc func refresh(_ sender: UIRefreshControl) {
            model.webView?.reload()
        }

        // The web player drives the native one, all keyed by YouTube id:
        //   play   {videoId, title, startSeconds, frame, covered}
        //   layout {videoId, frame, covered}  when its box moves or is covered
        //   close  {videoId}                  when the watch page goes away
        // `frame` is the box in page coordinates.
        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.frameInfo.isMainFrame,
                  message.frameInfo.securityOrigin.host == kubiURL.host,
                  let body = message.body as? [String: Any],
                  let videoId = body["videoId"] as? String,
                  PlaybackRequest.isValidVideoId(videoId) else { return }

            let frame = Self.frame(from: body["frame"])
            let covered = body["covered"] as? Bool ?? false

            switch body["type"] as? String {
            case "play":
                if model.player?.videoId != videoId {
                    startPlayer(PlaybackRequest(
                        videoId: videoId,
                        title: body["title"] as? String ?? "",
                        startSeconds: body["startSeconds"] as? Double ?? 0
                    ))
                }
                model.player?.update(frame: frame, covered: covered)
            case "layout":
                guard model.player?.videoId == videoId else { return }
                model.player?.update(frame: frame, covered: covered)
            case "close":
                guard model.player?.videoId == videoId else { return }
                closePlayer()
            default:
                break
            }
        }

        private func startPlayer(_ request: PlaybackRequest) {
            closePlayer()
            guard let webView = model.webView else { return }
            model.player = InlinePlayerController(
                request: request,
                hostWebView: webView,
                onProgress: { [weak model] in model?.report($0) },
                onSignIn: { [weak model] in model?.isSigningIn = true }
            )
        }

        private func closePlayer() {
            model.player?.close()
            model.player = nil
        }

        private static func frame(from value: Any?) -> CGRect? {
            guard let frame = value as? [String: Any],
                  let x = frame["x"] as? Double,
                  let y = frame["y"] as? Double,
                  let width = frame["width"] as? Double,
                  let height = frame["height"] as? Double,
                  width > 0, height > 0 else { return nil }
            return CGRect(x: x, y: y, width: width, height: height)
        }

        // A new page replaces the one the player was laid over. A watch page
        // asks for its player again once it loads.
        func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
            closePlayer()
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            model.isLoading = true
            model.errorMessage = nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            finishLoading(webView)
            #if DEBUG
            // `-KubiPlayVideo <youtube id>` lays a player near the top of any
            // page, for trying it without a watch page handing a video over.
            if model.player == nil,
               let videoId = UserDefaults.standard.string(forKey: "KubiPlayVideo"),
               PlaybackRequest.isValidVideoId(videoId) {
                startPlayer(PlaybackRequest(videoId: videoId, title: "Test video", startSeconds: 0))
                let width = webView.bounds.width - 32
                model.player?.update(
                    frame: CGRect(x: 16, y: 120, width: width, height: width * 9 / 16),
                    covered: false
                )
            }
            #endif
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            show(error, in: webView)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            show(error, in: webView)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            // Keep target="_blank" flows, including checkout and legal pages,
            // inside the app so users do not lose their authenticated session.
            if let request = navigationAction.request as URLRequest? {
                webView.load(request)
            }
            return nil
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            // Let the web content and its embeds navigate freely. The YouTube
            // player renders its video inside nested about:srcdoc / about:blank
            // iframes; treating those as external links (and cancelling them)
            // stops videos from ever loading. Only hand a URL off to another app
            // when the MAIN frame itself opens a genuinely external scheme such
            // as mailto:, tel:, or an itms-apps:// App Store link.
            let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? true
            let webSchemes: Set<String> = ["http", "https", "about", "blob", "data"]
            if isMainFrame,
               let scheme = url.scheme?.lowercased(),
               !webSchemes.contains(scheme) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        private func finishLoading(_ webView: WKWebView) {
            webView.scrollView.refreshControl?.endRefreshing()
            model.isLoading = false
            model.errorMessage = nil
        }

        private func show(_ error: Error, in webView: WKWebView) {
            webView.scrollView.refreshControl?.endRefreshing()
            model.isLoading = false

            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled { return }
            model.errorMessage = "Check your internet connection and try again."
        }
    }
}

#Preview {
    ContentView()
}
