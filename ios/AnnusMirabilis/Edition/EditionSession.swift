import Observation
import SafariServices
import SwiftUI
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
    /// Whether the digest-checked bridge script was injected into this web view.
    let bridgeInstalled: Bool
    /// The last route the page itself reported through the bridge: its readiness signal.
    private(set) var bridgeRoute: String?
    /// The page's own theme, as the page reports it; nil until it does.
    private(set) var pageColorScheme: ColorScheme?

    @ObservationIgnored private let store: ReaderLocationStore
    @ObservationIgnored private let navigator: EditionNavigator
    @ObservationIgnored private let router: BridgeRouter
    @ObservationIgnored private let exposesRouteForTests: Bool
    @ObservationIgnored private var observations: [NSKeyValueObservation] = []

    /// `ephemeralWebStorage` gives the page a non-persistent WebKit store. UI tests use it
    /// (with -AMStateSuite) so a theme or note set in one test never reaches the next, and
    /// nothing has to be deleted to start clean. A reader's launch never sets it.
    init(
        catalog: EditionCatalog, store: ReaderLocationStore, exposesRouteForTests: Bool = false,
        ephemeralWebStorage: Bool = false
    ) {
        self.catalog = catalog
        self.store = store
        self.exposesRouteForTests = exposesRouteForTests
        self.navigator = EditionNavigator(catalog: catalog)
        let router = BridgeRouter()
        self.router = router
        let bridgeSource = catalog.verifiedBridgeScript()
        self.bridgeInstalled = bridgeSource != nil
        self.webView = EditionSession.makeWebView(
            catalog: catalog, navigator: navigator, router: router, bridgeSource: bridgeSource,
            ephemeralWebStorage: ephemeralWebStorage)
        self.handoff = NSUserActivity(activityType: NSUserActivityTypeBrowsingWeb)
        handoff.isEligibleForHandoff = true
        handoff.isEligibleForSearch = false
        handoff.isEligibleForPublicIndexing = false
        webView.userActivity = handoff
        router.onTheme = { [weak self] theme in
            self?.didReceiveTheme(theme)
        }
        router.onRoute = { [weak self] route, anchor, title in
            self?.didReceiveRoute(route: route, anchor: anchor, title: title)
        }

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
    }

    /// The page's own report of where it is, sent by the bridge script when the
    /// document is ready and on every anchor change.
    /// The page's theme (App plan §8.7). While the reader has not chosen one, the
    /// page reports "system" and the app sets nothing: the page, the band behind the
    /// status bar and the status bar all follow the device together. Once the reader
    /// chooses, the window follows that choice, which the page then keeps whatever
    /// the device does.
    func didReceiveTheme(_ theme: String) {
        switch theme {
        case "kramgasse-night": pageColorScheme = .dark
        case "annalen": pageColorScheme = .light
        default: pageColorScheme = nil
        }
        let paper = UIColor(named: "LaunchBackground") ?? .systemBackground
        let band =
            pageColorScheme.map { scheme in
                paper.resolvedColor(with: UITraitCollection(userInterfaceStyle: scheme == .dark ? .dark : .light))
            } ?? paper
        webView.backgroundColor = band
        webView.scrollView.backgroundColor = band
        webView.underPageBackgroundColor = band
    }

    func didReceiveRoute(route: String, anchor: String?, title: String) {
        bridgeRoute = route + (anchor.map { "#\($0)" } ?? "")
        if !title.isEmpty { self.title = title }
        if exposesRouteForTests {
            webView.accessibilityValue = bridgeRoute
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

    private static func makeWebView(
        catalog: EditionCatalog, navigator: EditionNavigator, router: BridgeRouter, bridgeSource: String?,
        ephemeralWebStorage: Bool
    ) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        // The bridge exists only when its script matched the recorded digest (App plan §7).
        if let bridgeSource {
            configuration.userContentController.addUserScript(
                WKUserScript(source: bridgeSource, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))
            configuration.userContentController.addScriptMessageHandler(
                router, contentWorld: .page, name: BridgeProtocol.handlerName)
        }
        configuration.setURLSchemeHandler(EditionSchemeHandler(catalog: catalog), forURLScheme: EditionCatalog.scheme)
        configuration.websiteDataStore = ephemeralWebStorage ? .nonPersistent() : .default()
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
