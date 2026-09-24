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
    @ObservationIgnored private let themeStore: PageThemeStore?
    /// DEBUG UI tests only: the route, and the pasteboard, are exposed for assertions.
    let exposesRouteForTests: Bool
    @ObservationIgnored private var observations: [NSKeyValueObservation] = []

    /// `ephemeralWebStorage` gives the page a non-persistent WebKit store. UI tests use it
    /// (with -AMStateSuite) so a theme or note set in one test never reaches the next, and
    /// nothing has to be deleted to start clean. A reader's launch never sets it.
    init(
        catalog: EditionCatalog, store: ReaderLocationStore, exposesRouteForTests: Bool = false,
        ephemeralWebStorage: Bool = false, readerData: ReaderDataStore? = nil, themeStore: PageThemeStore? = nil
    ) {
        self.catalog = catalog
        self.store = store
        self.exposesRouteForTests = exposesRouteForTests
        self.navigator = EditionNavigator(catalog: catalog)
        let router = BridgeRouter()
        router.store = readerData
        self.router = router
        self.themeStore = themeStore
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
        router.onShare = { [weak self] url in
            self?.presentShareSheet(for: url)
        }
        navigator.onSavedFile = { [weak self] file in
            self?.presentShareSheet(for: file)
        }
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
        // The reader's last theme, painted before the page loads, so a dark choice never starts light.
        if let saved = themeStore?.load() { applyTheme(saved) }
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

    /// The page's theme (App plan §8.7). While the reader has not chosen one, the
    /// page reports "system" and the app sets nothing: the page, the band behind the
    /// status bar and the status bar all follow the device together. Once the reader
    /// chooses, the window follows that choice, which the page then keeps whatever
    /// the device does.
    func didReceiveTheme(_ theme: String) {
        applyTheme(theme)
        themeStore?.save(theme)
    }

    private func applyTheme(_ theme: String) {
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

    /// The page's own report of where it is, sent by the bridge script when the
    /// document is ready and on every anchor change.
    func didReceiveRoute(route: String, anchor: String?, title: String) {
        bridgeRoute = route + (anchor.map { "#\($0)" } ?? "")
        if !title.isEmpty { self.title = title }
        if exposesRouteForTests {
            webView.accessibilityValue = bridgeRoute
        }
    }

    /// The share sheet for a page of the website when the page asks for one (`share.request`),
    /// or for a file the page saved. The page-actions menu shares through SwiftUI's ShareLink.
    func presentShareSheet(for url: URL) {
        guard var presenter = webView.window?.rootViewController else { return }
        while let next = presenter.presentedViewController {
            presenter = next
        }
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = webView
        sheet.popoverPresentationController?.sourceRect = CGRect(
            x: webView.bounds.midX, y: webView.bounds.midY, width: 1, height: 1)
        presenter.present(sheet, animated: true)
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
final class EditionNavigator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private let catalog: EditionCatalog
    /// Receives a file the page saved (its own export of notes, data or a notebook).
    var onSavedFile: ((URL) -> Void)?
    private var destinations: [ObjectIdentifier: URL] = [:]

    init(catalog: EditionCatalog) {
        self.catalog = catalog
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async
        -> WKNavigationActionPolicy
    {
        guard let url = navigationAction.request.url else { return .cancel }
        if Self.isPageExport(url, shouldDownload: navigationAction.shouldPerformDownload) {
            return .download
        }
        return follow(url, in: webView)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse) async
        -> WKNavigationResponsePolicy
    {
        // Nothing opens inside the reader that it cannot show (App plan §6.4); a file the page
        // itself saves is handed to the share sheet instead of being dropped.
        if navigationResponse.canShowMIMEType { return .allow }
        guard let url = navigationResponse.response.url, Self.isPageExport(url, shouldDownload: true) else {
            return .cancel
        }
        return .download
    }

    /// A file the edition itself makes (a Blob behind a download link): the site's own
    /// "Download all of it (JSON)" and the notebook's exports. Nothing from elsewhere.
    static func isPageExport(_ url: URL, shouldDownload: Bool) -> Bool {
        guard shouldDownload else { return false }
        if url.scheme == "blob" {
            return url.absoluteString.hasPrefix("blob:\(EditionCatalog.scheme)://\(EditionCatalog.host)/")
        }
        return false
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String)
        async -> URL?
    {
        // A fresh folder in the app's temporary directory; the system clears it, the reader
        // chooses where the file goes from the share sheet.
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent("exports", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        guard (try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)) != nil else {
            return nil
        }
        let name = Self.safeFilename(suggestedFilename)
        let destination = folder.appendingPathComponent(name, isDirectory: false)
        destinations[ObjectIdentifier(download)] = destination
        return destination
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let file = destinations.removeValue(forKey: ObjectIdentifier(download)) else { return }
        onSavedFile?(file)
    }

    func download(_ download: WKDownload, didFailWithError error: any Error, resumeData: Data?) {
        destinations.removeValue(forKey: ObjectIdentifier(download))
    }

    /// The page's suggested name, reduced to a plain file name.
    static func safeFilename(_ suggested: String) -> String {
        let last = (suggested as NSString).lastPathComponent
        let cleaned = String(
            last.unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) || "-_. ".unicodeScalars.contains($0) }
        )
        .trimmingCharacters(in: .whitespaces)
        return cleaned.isEmpty || cleaned.hasPrefix(".") ? "annus-mirabilis-export" : cleaned
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
