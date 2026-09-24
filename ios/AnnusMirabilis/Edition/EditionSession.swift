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
    /// How often the page's web process has ended and the passage been reloaded.
    private(set) var webProcessTerminations = 0
    /// DEBUG UI tests only: the lifecycle events sent to the page, newest last.
    var deliveredLifecycleEvents: [String] = []
    /// DEBUG UI tests only: the site keys in the last snapshot the page mirrored to the app, never
    /// their values. Tests wait on it instead of on the mirror's 300 ms debounce.
    private(set) var mirroredKeys: [String] = []

    @ObservationIgnored private let store: ReaderLocationStore
    @ObservationIgnored private let navigator: EditionNavigator
    @ObservationIgnored let router: BridgeRouter
    @ObservationIgnored private let themeStore: PageThemeStore?
    @ObservationIgnored private let bridgeSource: String?
    @ObservationIgnored private let settingsSnapshot: SettingsSnapshot?
    /// The papers, outlines, Discover routes and instruments the native screens list.
    @ObservationIgnored let nativeCatalog: NativeCatalog?
    @ObservationIgnored private var contentSizeObserver: (any NSObjectProtocol)?
    @ObservationIgnored var lifecycleObservers: [any NSObjectProtocol] = []
    #if DEBUG
        /// UI tests only: end the web process once, after the first page reports ready.
        @ObservationIgnored var killWebContentOnceReady = false
        /// UI tests only: what this launch keeps in case its test fails.
        @ObservationIgnored var testEvidence: TestEvidence?
    #endif
    /// The last page announced to VoiceOver as a new screen.
    @ObservationIgnored private var announcedRoute: String?
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
        #if DEBUG
            startTestEvidence()
        #endif
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
        navigator.onWebProcessTerminated = { [weak self] in
            self?.recoverFromTermination()
        }
        observeLifecycle()
        router.onTheme = { [weak self] theme in
            self?.didReceiveTheme(theme)
        }
        router.onTypeSize = { [weak self] size in
            self?.pageTypeSize = size
        }
        router.onStorageWrite = { [weak self] namespace, key, value in
            guard let self, exposesRouteForTests, let record = catalog.readerData?.snapshot,
                namespace == record.namespace, key == record.key
            else { return }
            mirroredKeys = ReaderData.snapshotValues(value)?.keys.sorted() ?? []
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
        Task { await dispatchToPage("settings.changed", ["typeSize": size]) }
    }

    /// The page's web process ended: the system reclaimed it, or it crashed. The page is gone and has
    /// not reported, so its route is cleared, and the reader goes back to the passage they were on,
    /// anchor and all (bead am-app-lifecycle-resilience-4dhu, requirement 4).
    func recoverFromTermination() {
        webProcessTerminations += 1
        #if DEBUG
            testEvidence?.record("lifecycle", ["event": "web-process-terminated"])
        #endif
        bridgeRoute = nil
        announcedRoute = nil
        if exposesRouteForTests { webView.accessibilityValue = nil }
        if let passage = store.load()?.url(in: catalog) {
            load(passage)
        } else {
            webView.reload()
        }
    }

    /// The settings snapshot, then the bridge, both at document start and only when the bridge
    /// script matched its digest (App plan §7). Reinstalled when a setting changes, so the next
    /// page starts with it.
    private func installUserScripts() {
        let controller = webView.configuration.userContentController
        controller.removeAllUserScripts()
        #if DEBUG
            addTestConsole(to: controller)
        #endif
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
    var topPresenter: UIViewController? {
        guard var presenter = webView.window?.rootViewController else { return nil }
        while let next = presenter.presentedViewController {
            presenter = next
        }
        return presenter
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
        // A new page is a new screen to VoiceOver, as a page load is in Safari, so its focus moves
        // into the page rather than staying on the control that opened it. A jump to an anchor on
        // the same page is the page's own to handle.
        if route != announcedRoute {
            announcedRoute = route
            if UIAccessibility.isVoiceOverRunning {
                UIAccessibility.post(notification: .screenChanged, argument: webView)
            }
        }
        #if DEBUG
            if killWebContentOnceReady {
                killWebContentOnceReady = false
                debugTerminateWebContent()
            }
        #endif
    }

    /// The reader's data as the app holds it; nil when this build has no store or registry.
    func loadReaderData() -> ReaderData.LoadResult? {
        guard let store = router.store, let manifest = catalog.readerData else { return nil }
        return ReaderData.load(from: store, manifest: manifest)
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
