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
    /// The type size the app asks the page for, mapped from the reader's system text size.
    private(set) var typeSize: Int?
    /// The type size the page reports it shows: the app's, or one the reader chose in the page.
    private(set) var pageTypeSize: Int?
    /// The last website address the app opened in Safari rather than in the edition.
    private(set) var lastSafariLink: URL?

    @ObservationIgnored private let store: ReaderLocationStore
    @ObservationIgnored private let navigator: EditionNavigator
    @ObservationIgnored private let router: BridgeRouter
    @ObservationIgnored private let themeStore: PageThemeStore?
    @ObservationIgnored private let bridgeSource: String?
    @ObservationIgnored private let settingsSnapshot: SettingsSnapshot?
    /// The papers, outlines, Discover routes and instruments the native screens list.
    @ObservationIgnored let nativeCatalog: NativeCatalog?
    @ObservationIgnored private var contentSizeObserver: (any NSObjectProtocol)?
    /// DEBUG UI tests only: the route, and the pasteboard, are exposed for assertions.
    let exposesRouteForTests: Bool
    @ObservationIgnored private var observations: [NSKeyValueObservation] = []

    /// `ephemeralWebStorage` gives the page a non-persistent WebKit store. UI tests use it
    /// (with -AMStateSuite) so a theme or note set in one test never reaches the next, and
    /// nothing has to be deleted to start clean. A reader's launch never sets it.
    init(
        catalog: EditionCatalog, store: ReaderLocationStore, exposesRouteForTests: Bool = false,
        ephemeralWebStorage: Bool = false, readerData: ReaderDataStore? = nil, themeStore: PageThemeStore? = nil,
        contentSize: UIContentSizeCategory = .large
    ) {
        self.catalog = catalog
        self.store = store
        self.exposesRouteForTests = exposesRouteForTests
        self.navigator = EditionNavigator(catalog: catalog)
        let router = BridgeRouter()
        router.store = readerData
        router.readerData = catalog.readerData
        self.router = router
        self.themeStore = themeStore
        let bridgeSource = catalog.verifiedBridgeScript()
        self.bridgeSource = bridgeSource
        self.settingsSnapshot = catalog.verifiedSettingsSnapshot()
        self.nativeCatalog = catalog.verifiedNativeCatalog()
        self.bridgeInstalled = bridgeSource != nil
        self.typeSize = EditionTypeSize.percent(for: contentSize, steps: catalog.typeSizes)
        self.webView = EditionSession.makeWebView(
            catalog: catalog, navigator: navigator, router: router, bridgeSource: bridgeSource,
            ephemeralWebStorage: ephemeralWebStorage)
        self.handoff = NSUserActivity(activityType: NSUserActivityTypeBrowsingWeb)
        handoff.isEligibleForHandoff = true
        handoff.isEligibleForSearch = false
        handoff.isEligibleForPublicIndexing = false
        webView.userActivity = handoff
        installUserScripts()
        wireCallbacks()

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

    /// What the page, the navigator and the system tell the session.
    private func wireCallbacks() {
        router.onShare = { [weak self] url in
            self?.presentShareSheet(for: url)
        }
        navigator.onSavedFile = { [weak self] file in
            self?.presentShareSheet(for: file)
        }
        router.onTheme = { [weak self] theme in
            self?.didReceiveTheme(theme)
        }
        router.onTypeSize = { [weak self] size in
            self?.pageTypeSize = size
        }
        router.onRoute = { [weak self] route, anchor, title in
            self?.didReceiveRoute(route: route, anchor: anchor, title: title)
        }
        contentSizeObserver = NotificationCenter.default.addObserver(
            forName: UIContentSizeCategory.didChangeNotification, object: nil, queue: .main
        ) { [weak self] notification in
            let category = notification.userInfo?[UIContentSizeCategory.newValueUserInfoKey] as? UIContentSizeCategory
            MainActor.assumeIsolated {
                self?.didChangeContentSize(category ?? UIApplication.shared.preferredContentSizeCategory)
            }
        }
    }

    /// The reader changed their text size in Settings: the page follows at once, and every page
    /// loaded after this starts at the new size (bead am-app-settings-prepaint-tydj, requirement 4).
    func didChangeContentSize(_ category: UIContentSizeCategory) {
        guard let size = EditionTypeSize.percent(for: category, steps: catalog.typeSizes), size != typeSize else {
            return
        }
        typeSize = size
        installUserScripts()
        guard bridgeInstalled else { return }
        Task { [webView] in
            // The one fixed entry point for native events (App plan §7.2), called with arguments.
            _ = try? await webView.callAsyncJavaScript(
                "window.__AM_APP__ && window.__AM_APP__.dispatch(name, payload)",
                arguments: ["name": "settings.changed", "payload": ["typeSize": size]], in: nil, contentWorld: .page)
        }
    }

    /// The settings snapshot, then the bridge, both at document start and only when the bridge
    /// script matched its digest (App plan §7). Reinstalled when a setting changes, so the next
    /// page starts with it.
    private func installUserScripts() {
        let controller = webView.configuration.userContentController
        controller.removeAllUserScripts()
        guard let bridgeSource else { return }
        if let snapshot = settingsSnapshot?.source(.init(typeSize: typeSize)) {
            controller.addUserScript(
                WKUserScript(source: snapshot, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))
        }
        controller.addUserScript(
            WKUserScript(source: bridgeSource, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))
    }

    /// The page on the website, for sharing and Handoff.
    var canonicalURL: URL? { currentURL.flatMap(SiteURL.canonical(for:)) }

    func load(_ url: URL) {
        webView.load(URLRequest(url: url))
    }

    /// A link to the website the system handed the app (a universal link, or a URL opened in the
    /// app). What the edition carries opens in it; the rest of the site opens in Safari in the app.
    func openSiteLink(_ url: URL) {
        switch EditionLinkPolicy.siteLink(url, catalog: catalog) {
        case .openInEdition(let local):
            load(local)
        case .openOutside(let site):
            presentSafari(site)
        case .allow, .refuse:
            break
        }
    }

    /// The website inside the app, over whatever is showing. A link that launches the app arrives
    /// before the web view is in a window, with nothing yet to present from, so it waits for one:
    /// up to three seconds, in 150 ms steps, rather than being dropped.
    func presentSafari(_ url: URL, attempts: Int = 20) {
        guard let presenter = topPresenter else {
            guard attempts > 0 else { return }
            Task { @MainActor [weak self] in
                try? await Task.sleep(for: .milliseconds(150))
                self?.presentSafari(url, attempts: attempts - 1)
            }
            return
        }
        lastSafariLink = url
        presenter.present(SFSafariViewController(url: url), animated: true)
    }

    /// The controller at the top of the window's presentation chain.
    private var topPresenter: UIViewController? {
        guard var presenter = webView.window?.rootViewController else { return nil }
        while let next = presenter.presentedViewController {
            presenter = next
        }
        return presenter
    }

    /// Opens a page of the edition, at an anchor when given, from a native screen.
    func open(route: String, anchor: String?) {
        guard let url = EditionCatalog.url(route: route, anchor: anchor) else { return }
        load(url)
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
        guard let presenter = topPresenter else { return }
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        // Anchored in the presenter's own view: the web view sits under any sheet the app shows.
        if let anchor = presenter.view {
            sheet.popoverPresentationController?.sourceView = anchor
            sheet.popoverPresentationController?.sourceRect = CGRect(
                x: anchor.bounds.midX, y: anchor.bounds.midY, width: 1, height: 1)
        }
        presenter.present(sheet, animated: true)
    }

    /// The reader's data as the app holds it; nil when this build has no store or registry.
    func loadReaderData() -> ReaderData.LoadResult? {
        guard let store = router.store, let manifest = catalog.readerData else { return nil }
        return ReaderData.load(from: store, manifest: manifest)
    }

    /// Writes an export of the reader's data and offers it in the share sheet.
    func share(_ export: ReaderDataExport) {
        guard let file = ExportFiles.destination(suggested: export.suggestedFilename),
            (try? export.jsonData().write(to: file, options: .atomic)) != nil
        else { return }
        presentShareSheet(for: file)
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
        // Its user scripts are installed by installUserScripts().
        if bridgeSource != nil {
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
