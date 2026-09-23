import SwiftUI

@main
struct AnnusMirabilisApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

/// The bundled edition, read once per process.
enum EditionStore {
    static let catalog: Result<EditionCatalog, EditionCatalogError> = Result { () throws(EditionCatalogError) in
        try EditionCatalog.load()
    }

    static func startURL(arguments: [String] = ProcessInfo.processInfo.arguments) -> URL {
        #if DEBUG
            if case .success(let launch) = LaunchArguments.parse(arguments),
                let route = launch.openRoute,
                let url = EditionCatalog.url(route: route, anchor: launch.openAnchor)
            {
                return url
            }
        #endif
        return EditionCatalog.homeURL
    }
}

struct RootView: View {
    var body: some View {
        switch EditionStore.catalog {
        case .success(let catalog):
            EditionWebView(catalog: catalog, startURL: EditionStore.startURL())
                .ignoresSafeArea()
        case .failure:
            EditionUnavailableView()
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
