import SwiftUI

@main
struct AnnusMirabilisApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

/// The bundled edition, read once per process, and how each window starts.
enum EditionStore {
    static let catalog: Result<EditionCatalog, EditionCatalogError> = Result { () throws(EditionCatalogError) in
        try EditionCatalog.load()
    }

    /// A new reader session, opened where the reader left off. Nil when the
    /// installed copy has lost its edition.
    @MainActor
    static func makeSession(arguments: [String] = ProcessInfo.processInfo.arguments) -> EditionSession? {
        guard case .success(let catalog) = catalog else { return nil }
        var defaults = UserDefaults.standard
        var exposesRoute = false
        var ephemeral = false
        var readerData = ReaderDataStore.standard()
        var launchURL: URL?
        var holdLoad = false
        var siteLink: URL?
        #if DEBUG
            var debugLaunch: LaunchArguments?
            if case .success(let launch) = LaunchArguments.parse(arguments) {
                if let suite = launch.stateSuite, let isolated = UserDefaults(suiteName: suite) {
                    defaults = isolated
                    ephemeral = true
                    readerData = ReaderDataStore.standard(suite: suite)
                }
                exposesRoute = launch.uiTest
                launchURL = launch.openRoute.flatMap { EditionCatalog.url(route: $0, anchor: launch.openAnchor) }
                holdLoad = launch.holdLoad
                siteLink = launch.openSiteURL
                debugLaunch = launch
            }
        #endif
        let store = ReaderLocationStore(defaults: defaults)
        let start = startURL(launchURL: launchURL, saved: store.load(), catalog: catalog)
        let session = EditionSession(
            catalog: catalog, store: store, exposesRouteForTests: exposesRoute, ephemeralWebStorage: ephemeral,
            readerData: readerData, themeStore: PageThemeStore(defaults: defaults),
            contentSize: UIApplication.shared.preferredContentSizeCategory)
        #if DEBUG
            if let debugLaunch { session.apply(debugLaunch) }
        #endif
        if holdLoad {
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(3))
                session.load(start)
            }
        } else {
            session.load(start)
        }
        if let siteLink { session.openSiteLink(siteLink) }
        return session
    }

    /// The scheme of the reader's last chosen theme, for the frame before the session exists.
    static func savedColorScheme(arguments: [String] = ProcessInfo.processInfo.arguments) -> ColorScheme? {
        var defaults = UserDefaults.standard
        #if DEBUG
            if case .success(let launch) = LaunchArguments.parse(arguments), let suite = launch.stateSuite,
                let isolated = UserDefaults(suiteName: suite)
            {
                defaults = isolated
            }
        #endif
        switch PageThemeStore(defaults: defaults).load() {
        case "kramgasse-night": return .dark
        case "annalen": return .light
        default: return nil
        }
    }

    /// A route given at launch wins, then the page the reader left, if this
    /// edition still has it, then the home page.
    static func startURL(launchURL: URL?, saved: ReaderLocation?, catalog: EditionCatalog) -> URL {
        launchURL ?? saved?.url(in: catalog) ?? EditionCatalog.homeURL
    }
}

struct RootView: View {
    @State private var session: EditionSession?
    @State private var unavailable = false
    /// A website link that arrived before the session existed (a universal link at launch).
    @State private var pendingSiteLink: URL?
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if let session {
                EditionWebView(session: session)
                    .ignoresSafeArea()
                    .preferredColorScheme(session.pageColorScheme)
                    // Under the page actions, so Contents still reaches every other page.
                    .overlay {
                        if session.loadFailure != nil {
                            LoadFailureView { session.retryLoad() }
                        }
                    }
                    .overlay(alignment: .bottomTrailing) {
                        PageActionsButton(session: session)
                            .padding(.trailing, 16)
                            .padding(.bottom, 12)
                    }
                    .overlay(alignment: .topLeading) {
                        #if DEBUG
                            if session.exposesRouteForTests {
                                DebugPasteboardProbe()
                                DebugProbe(text: session.pageTypeSize.map(String.init) ?? "none", id: "debug-type-size")
                                DebugProbe(
                                    text: session.lastSafariLink?.absoluteString ?? "none", id: "debug-safari-link")
                                DebugProbe(text: String(session.webProcessTerminations), id: "debug-web-terminations")
                                DebugProbe(text: session.mirroredKeys.joined(separator: ","), id: "debug-mirror")
                                DebugProbe(
                                    text: session.deliveredLifecycleEvents.joined(separator: ", "),
                                    id: "debug-lifecycle")
                            }
                        #endif
                    }
                    .onChange(of: scenePhase, initial: true) { _, phase in
                        if phase == .active { session.handoff.becomeCurrent() }
                        session.sceneDidChange(phase)
                    }
            } else if unavailable {
                EditionUnavailableView()
            } else {
                Color("LaunchBackground").ignoresSafeArea()
                    .preferredColorScheme(EditionStore.savedColorScheme())
            }
        }
        .onAppear {
            guard session == nil, !unavailable else { return }
            session = EditionStore.makeSession()
            unavailable = session == nil
            if let session, let link = pendingSiteLink {
                pendingSiteLink = nil
                session.openSiteLink(link)
            }
        }
        // Universal links (App plan §8.5). The associated-domains entitlement that lets the system
        // send them is not granted yet (it needs the Apple team id); the handling is ready for it.
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            if let url = activity.webpageURL { receive(url) }
        }
        .onOpenURL { url in receive(url) }
    }

    private func receive(_ url: URL) {
        if let session {
            session.openSiteLink(url)
        } else {
            pendingSiteLink = url
        }
    }
}

/// Shown only when an installed copy has lost its bundled edition. A build
/// without one is refused at build time, so a reader should never see this.
struct EditionUnavailableView: View {
    private var versionLine: String {
        let info = Bundle.main.infoDictionary
        let version = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "Version \(version) (\(build))"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("The edition could not be opened")
                .font(.title2.weight(.semibold))
            Text("This copy of the app is missing the papers it carries. Reinstalling the app restores them.")
                .font(.body)
            Text(versionLine)
                .font(.footnote.monospaced())
                .foregroundStyle(Color("MutedInk"))
                .accessibilityIdentifier("app-version")
        }
        .padding(24)
        .frame(maxWidth: 560, maxHeight: .infinity, alignment: .leading)
        .frame(maxWidth: .infinity)
        .background(Color("LaunchBackground"))
        .accessibilityIdentifier("edition-unavailable")
    }
}

/// Shown over the reader when a page could not be loaded (bead am-app-edition-webview-ju3v,
/// criterion 5): what happened, in plain words, and the same page again on request.
struct LoadFailureView: View {
    let retry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Each text takes its whole height: in the flexible frame below, the audit found the
            // three-line explanation "may be clipped" (run 20260924T130548Z-d52ca419).
            Text("This page could not be opened")
                .font(.title2.weight(.semibold))
                .foregroundStyle(Color("PageInk"))
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            Text("The app carries the whole edition, so no connection is needed. Trying again reloads the page.")
                .font(.body)
                .foregroundStyle(Color("PageInk"))
                .fixedSize(horizontal: false, vertical: true)
            Button(action: retry) {
                Text("Try again")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Color("PageInk"))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color("PageInk"), lineWidth: 1))
            }
            .accessibilityIdentifier("load-failure-retry")
        }
        .padding(24)
        .frame(maxWidth: 560, maxHeight: .infinity, alignment: .leading)
        .frame(maxWidth: .infinity)
        .background(Color("LaunchBackground").ignoresSafeArea())
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("load-failure")
    }
}

#if DEBUG
    /// UI tests only: a value the app knows, on a nearly invisible element.
    private struct DebugProbe: View {
        let text: String
        let id: String

        var body: some View {
            Text(text)
                .font(.system(size: 1))
                .frame(width: 1, height: 1)
                .opacity(0.02)
                .accessibilityIdentifier(id)
        }
    }

    /// UI tests only: the app's own pasteboard text, on a nearly invisible element,
    /// so a test can check what a copy placed there. Read from inside the app, the
    /// pasteboard raises no paste prompt; read from the test runner, it does.
    private struct DebugPasteboardProbe: View {
        @State private var text = ""

        var body: some View {
            Text(text.isEmpty ? "empty" : text)
                .font(.system(size: 1))
                .frame(width: 1, height: 1)
                .opacity(0.02)
                .accessibilityIdentifier("debug-pasteboard")
                .onReceive(NotificationCenter.default.publisher(for: UIPasteboard.changedNotification)) { _ in
                    text = UIPasteboard.general.string ?? ""
                }
        }
    }
#endif
