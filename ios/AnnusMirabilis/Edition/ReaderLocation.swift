import Foundation

/// The page the reader was on, kept on the device so the app reopens there
/// (App plan §1.3, "Continue reading"). Only the route, the query (the face
/// and Detail the page was opened with) and the anchor are kept. Nothing leaves
/// the device, and the page's own settings stay in the page's own storage.
struct ReaderLocation: Codable, Equatable, Sendable {
    static let currentVersion = 1

    let version: Int
    let path: String
    let query: String?
    let anchor: String?

    init(path: String, query: String?, anchor: String?) {
        self.version = Self.currentVersion
        self.path = path
        self.query = query
        self.anchor = anchor
    }

    /// Nil unless the URL is an HTML page this edition serves. A 404, a data
    /// file opened on its own, or a foreign address is never remembered.
    init?(editionURL url: URL, catalog: EditionCatalog) {
        guard case .file(let file) = catalog.resolve(url), file.contentType.hasPrefix("text/html"),
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else { return nil }
        let path = components.percentEncodedPath.isEmpty ? "/" : components.percentEncodedPath
        self.init(
            path: path,
            query: components.percentEncodedQuery,
            anchor: components.percentEncodedFragment.flatMap { $0.isEmpty ? nil : $0 })
    }

    /// The page in this edition, or nil when this edition no longer has it,
    /// which happens after an update removes or renames a page.
    func url(in catalog: EditionCatalog) -> URL? {
        guard version == Self.currentVersion, path.hasPrefix("/") else { return nil }
        var components = URLComponents()
        components.scheme = EditionCatalog.scheme
        components.host = EditionCatalog.host
        components.percentEncodedPath = path
        components.percentEncodedQuery = query
        components.percentEncodedFragment = anchor
        guard let url = components.url, case .file(let file) = catalog.resolve(url),
            file.contentType.hasPrefix("text/html")
        else { return nil }
        return url
    }

    /// The route as the address bar would show it, for tests and logs.
    var display: String {
        path + (query.map { "?\($0)" } ?? "") + (anchor.map { "#\($0)" } ?? "")
    }
}

/// Reads and writes the one remembered location. A missing, unreadable or
/// older-version record reads as nothing, and the app opens the home page.
struct ReaderLocationStore {
    static let key = "annus-mirabilis.app.reader-location.v1"

    let defaults: UserDefaults

    func save(_ location: ReaderLocation) {
        guard let data = try? JSONEncoder().encode(location) else { return }
        defaults.set(data, forKey: Self.key)
    }

    func load() -> ReaderLocation? {
        guard let data = defaults.data(forKey: Self.key),
            let location = try? JSONDecoder().decode(ReaderLocation.self, from: data),
            location.version == ReaderLocation.currentVersion
        else { return nil }
        return location
    }
}

/// The theme the page last reported ("annalen", "kramgasse-night" or "system"),
/// so the next launch paints the reader's choice before the page has loaded
/// (bead am-app-settings-prepaint-tydj). The page's own storage stays the source
/// of truth; this only spares the reader a light frame when they chose dark.
struct PageThemeStore {
    static let key = "annus-mirabilis.app.page-theme.v1"

    let defaults: UserDefaults

    func save(_ theme: String) {
        defaults.set(theme, forKey: Self.key)
    }

    func load() -> String? {
        defaults.string(forKey: Self.key)
    }
}
