import SafariServices
import SwiftUI
import UIKit
import WebKit

/// The bundled edition in one web view (App plan §6.3). Every face, reading,
/// equation and instrument is the website's own code; this view only hosts it.
struct EditionWebView: UIViewRepresentable {
    let catalog: EditionCatalog
    let startURL: URL

    func makeCoordinator() -> Coordinator {
        Coordinator(catalog: catalog)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(EditionSchemeHandler(catalog: catalog), forURLScheme: EditionCatalog.scheme)
        configuration.websiteDataStore = .default()
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        configuration.allowsInlineMediaPlayback = true
        configuration.dataDetectorTypes = []
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.isFindInteractionEnabled = true
        #if DEBUG
            webView.isInspectable = true
        #endif
        // The page's own paper colour until the first paint, in both themes,
        // so a dark-mode launch never flashes white.
        let paper = UIColor(named: "LaunchBackground") ?? .systemBackground
        webView.isOpaque = false
        webView.backgroundColor = paper
        webView.scrollView.backgroundColor = paper
        webView.underPageBackgroundColor = paper
        webView.accessibilityIdentifier = "edition-web-view"
        webView.load(URLRequest(url: startURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let catalog: EditionCatalog

        init(catalog: EditionCatalog) {
            self.catalog = catalog
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async
            -> WKNavigationActionPolicy
        {
            guard let url = navigationAction.request.url else { return .cancel }
            return follow(url, in: webView)
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse) async
            -> WKNavigationResponsePolicy
        {
            // No downloads inside the reader (App plan §6.4).
            navigationResponse.canShowMIMEType ? .allow : .cancel
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            // A link that asks for a new window follows the same policy in this one.
            if let url = navigationAction.request.url, follow(url, in: webView) == .allow {
                webView.load(URLRequest(url: url))
            }
            return nil
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            // The system reclaimed the page's process; bring back the same page.
            webView.reload()
        }

        private func follow(_ url: URL, in webView: WKWebView) -> WKNavigationActionPolicy {
            switch EditionLinkPolicy.decide(url, catalog: catalog) {
            case .allow:
                return .allow
            case .openInEdition(let local):
                webView.load(URLRequest(url: local))
                return .cancel
            case .openOutside(let external):
                present(external, from: webView)
                return .cancel
            case .refuse:
                return .cancel
            }
        }

        private func present(_ url: URL, from webView: WKWebView) {
            guard var presenter = webView.window?.rootViewController else { return }
            while let next = presenter.presentedViewController {
                presenter = next
            }
            presenter.present(SFSafariViewController(url: url), animated: true)
        }
    }
}
