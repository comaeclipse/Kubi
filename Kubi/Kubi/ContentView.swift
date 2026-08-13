import SwiftUI
import WebKit
import Combine

private let kubiURL = URL(string: "https://kubi.kids/")!

@MainActor
final class WebViewModel: ObservableObject {
    @Published var isLoading = true
    @Published var errorMessage: String?

    fileprivate weak var webView: WKWebView?

    func reload() {
        errorMessage = nil
        if let webView {
            webView.reload()
        }
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
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let model: WebViewModel

        init(model: WebViewModel) {
            self.model = model
        }

        @objc func refresh(_ sender: UIRefreshControl) {
            model.webView?.reload()
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            model.isLoading = true
            model.errorMessage = nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            finishLoading(webView)
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

            if let scheme = url.scheme?.lowercased(), scheme != "http" && scheme != "https" {
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
