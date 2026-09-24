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
        var launchURL: URL?
        #if DEBUG
            if case .success(let launch) = LaunchArguments.parse(arguments) {
                if let suite = launch.stateSuite, let isolated = UserDefaults(suiteName: suite) {
                    defaults = isolated
                    ephemeral = true
                }
                exposesRoute = launch.uiTest
                launchURL = launch.openRoute.flatMap { EditionCatalog.url(route: $0, anchor: launch.openAnchor) }
            }
        #endif
        let store = ReaderLocationStore(defaults: defaults)
        let start = startURL(launchURL: launchURL, saved: store.load(), catalog: catalog)
        let session = EditionSession(
            catalog: catalog, store: store, exposesRouteForTests: exposesRoute, ephemeralWebStorage: ephemeral)
        session.load(start)
        return session
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
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            if let session {
                EditionWebView(session: session)
                    .ignoresSafeArea()
                    .preferredColorScheme(session.pageColorScheme)
                    .overlay(alignment: .bottomTrailing) {
                        PageActionsButton(session: session)
                            .padding(.trailing, 16)
                            .padding(.bottom, 12)
                    }
                    .onChange(of: scenePhase, initial: true) { _, phase in
                        if phase == .active { session.handoff.becomeCurrent() }
                    }
            } else if unavailable {
                EditionUnavailableView()
            } else {
                Color("LaunchBackground").ignoresSafeArea()
            }
        }
        .onAppear {
            guard session == nil, !unavailable else { return }
            session = EditionStore.makeSession()
            unavailable = session == nil
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
                .foregroundStyle(.secondary)
                .accessibilityIdentifier("app-version")
        }
        .padding(24)
        .frame(maxWidth: 560, maxHeight: .infinity, alignment: .leading)
        .frame(maxWidth: .infinity)
        .background(Color("LaunchBackground"))
        .accessibilityIdentifier("edition-unavailable")
    }
}
