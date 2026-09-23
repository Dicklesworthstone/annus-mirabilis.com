import Observation
import SafariServices
import UIKit
import WebKit

/// One reader's web view and what the app knows about it: the page it shows,
/// where to reopen, and the Handoff activity that lets Safari on another
/// device open the same page (App plan §6, §8.6).
@MainActor
@Observable
final class EditionSession {
    let catalog: EditionCatalog
    let webView: WKWebView
    /// Handoff: a browsing activity carrying the page's website address.
    let handoff: NSUserActivity

    private(set) var currentURL: URL?
    private(set) var title: String?

    @ObservationIgnored private let store: ReaderLocationStore
    @ObservationIgnored private let navigator: EditionNavigator
    @ObservationIgnored private let exposesRouteForTests: Bool
    @ObservationIgnored private var observations: [NSKeyValueObservation] = []

    init(catalog: EditionCatalog, store: ReaderLocationStore, exposesRouteForTests: Bool = false) {
        self.catalog = catalog
        self.store = store
        self.exposesRouteForTests = exposesRouteForTests
        self.navigator = EditionNavigator(catalog: catalog)
        self.webView = EditionSession.makeWebView(catalog: catalog, navigator: navigator)
        self.handoff = NSUserActivity(activityType: NSUserActivityTypeBrowsingWeb)
        handoff.isEligibleForHandoff = true
        handoff.isEligibleForSearch = false
        handoff.isEligibleForPublicIndexing = false
        webView.userActivity = handoff

        observations.append(
            webView.observe(\.url, options: [.initial, .new]) { [weak self] webView, _ in
                MainActor.assumeIsolated { self?.didChange(url: webView.url) }
            })
        observations.append(
            webView.observe(\.title, options: [.new]) { [weak self] webView, _ in
                MainActor.assumeIsolated { self?.title = webView.title.flatMap { $0.isEmpty ? nil : $0 } }
            })
    }

    /// The page on the website, for sharing and Handoff.
    var canonicalURL: URL? { currentURL.flatMap(SiteURL.canonical(for:)) }

    func load(_ url: URL) {
        webView.load(URLRequest(url: url))
    }

    /// Called for every change of page, including a jump to an anchor.
    func didChange(url: URL?) {
        currentURL = url
        handoff.webpageURL = canonicalURL
        handoff.title = title
        handoff.needsSave = true
        guard let url, let location = ReaderLocation(editionURL: url, catalog: catalog) else { return }
        store.save(location)
        if exposesRouteForTests {
            webView.accessibilityValue = location.display
        }
    }

    /// Print, or save as PDF, the page as the edition's print styles set it.
    func printPage() {
        let info = UIPrintInfo.printInfo()
        info.outputType = .general
        info.jobName = title ?? "Annus Mirabilis"
        let controller = UIPrintInteractionController.shared
        controller.printInfo = info
        controller.printFormatter = webView.viewPrintFormatter()
        controller.present(animated: true)
    }

    /// The system find bar, searching the page's text.
    func findOnPage() {
        webView.findInteraction?.presentFindNavigator(showingReplace: false)
    }

    private static func makeWebView(catalog: EditionCatalog, navigator: EditionNavigator) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(EditionSchemeHandler(catalog: catalog), forURLScheme: EditionCatalog.scheme)
        configuration.websiteDataStore = .default()
        configuration.mediaTypesRequiringUserActionForPlayback = .all
        configuration.allowsInlineMediaPlayback = true
        configuration.dataDetectorTypes = []
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = navigator
        webView.uiDelegate = navigator
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
        return webView
    }
}

/// Link policy, downloads, new windows and process recovery for the web view.
@MainActor
final class EditionNavigator: NSObject, WKNavigationDelegate, WKUIDelegate {
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
            guard var presenter = webView.window?.rootViewController else { return .cancel }
            while let next = presenter.presentedViewController {
                presenter = next
            }
            presenter.present(SFSafariViewController(url: external), animated: true)
            return .cancel
        case .refuse:
            return .cancel
        }
    }
}
