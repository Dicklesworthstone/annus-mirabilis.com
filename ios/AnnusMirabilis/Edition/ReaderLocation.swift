import Foundation
import Observation

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
        guard version == Self.currentVersion, path.hasPrefix("/"),
            Self.isEncoded(path, allowed: .urlPathAllowed),
            query.map({ Self.isEncoded($0, allowed: .urlQueryAllowed) }) ?? true,
            anchor.map({ Self.isEncoded($0, allowed: .urlFragmentAllowed) }) ?? true,
            display.utf8.count <= 8192
        else { return nil }
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

    /// URLComponents' percentEncoded setters require well-formed escapes. Stored data can be
    /// corrupt, so reject it before those setters instead of letting Foundation raise an exception.
    private static func isEncoded(_ value: String, allowed: CharacterSet) -> Bool {
        let bytes = Array(value.utf8)
        var index = 0
        while index < bytes.count {
            if bytes[index] == 37 {
                guard index + 2 < bytes.count,
                    bytes[(index + 1)...(index + 2)].allSatisfy({
                        (48...57).contains($0) || (65...70).contains($0) || (97...102).contains($0)
                    })
                else { return false }
                index += 3
            } else {
                guard bytes[index] < 128, allowed.contains(UnicodeScalar(bytes[index])) else { return false }
                index += 1
            }
        }
        return true
    }

    /// The exact paper segment, not a substring match (brownian-motion-extra is another paper).
    func paperSlug(admitted: Set<String>) -> String? {
        let parts = path.split(separator: "/", omittingEmptySubsequences: true)
        guard parts.count >= 2, parts[0] == "papers", admitted.contains(String(parts[1])) else { return nil }
        return String(parts[1])
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
    static let positionsKey = "am:app:positions:v1"

    private struct PaperPositions: Codable {
        var version = 1
        var locations: [String: ReaderLocation]
    }

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

    /// Public passage addresses, kept privately on this device. No note text enters this namespace.
    func paperPositions(in catalog: EditionCatalog, admitted: Set<String>) -> [String: ReaderLocation] {
        guard let bytes = defaults.data(forKey: Self.positionsKey), bytes.count <= 65_536,
            let record = try? JSONDecoder().decode(PaperPositions.self, from: bytes), record.version == 1
        else { return [:] }
        return record.locations.filter { slug, location in
            location.paperSlug(admitted: admitted) == slug && location.url(in: catalog) != nil
        }
    }

    func savePaperPosition(_ location: ReaderLocation, in catalog: EditionCatalog, admitted: Set<String>) {
        guard location.url(in: catalog) != nil, let slug = location.paperSlug(admitted: admitted) else { return }
        var locations = paperPositions(in: catalog, admitted: admitted)
        locations[slug] = location
        guard let bytes = try? JSONEncoder().encode(PaperPositions(locations: locations)), bytes.count <= 65_536 else {
            return
        }
        defaults.set(bytes, forKey: Self.positionsKey)
    }

    /// A reader action in Your data; it affects only native reading positions, not notes or settings.
    func clearReadingPositions() {
        defaults.removeObject(forKey: Self.positionsKey)
        defaults.removeObject(forKey: Self.key)
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

/// Searches the reader explicitly submitted or used to open a result, kept only on this device.
/// Typing never writes a query. The dedicated namespace is not mirrored to a web page, put into
/// Handoff, logged, or submitted to Spotlight. Clear affects this list and nothing else.
@MainActor
struct NativeSearchRecents {
    static let key = "am:app:recent-searches:v1"
    static let maximum = 10
    let defaults: UserDefaults

    func load() -> [String] {
        guard let stored = defaults.stringArray(forKey: Self.key) else { return [] }
        var seen = Set<String>()
        return Array(
            stored.compactMap(Self.validQuery)
                .filter { seen.insert($0).inserted }
                .prefix(Self.maximum))
    }

    func record(_ query: String) {
        guard let value = Self.validQuery(query) else { return }
        let previous = load().filter { $0 != value }
        defaults.set(Array(([value] + previous).prefix(Self.maximum)), forKey: Self.key)
    }

    func clear() {
        defaults.removeObject(forKey: Self.key)
    }

    private static func validQuery(_ query: String) -> String? {
        let value = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, value.utf16.count <= 256,
            !value.unicodeScalars.contains(where: {
                ($0.value < 32 && $0.value != 9 && $0.value != 10 && $0.value != 13) || $0.value == 127
            })
        else { return nil }
        return value
    }
}

// MARK: - Native search state

/// Search state is separate from the sheet's lifetime. A cancelled or superseded request never
/// replaces a newer result, even if JavaScriptCore finished its synchronous work after cancellation.
@MainActor
@Observable
final class NativeSearchModel {
    enum Phase: Equatable {
        case idle
        case loading
        case results
        case failed(String)
    }

    struct Group: Identifiable {
        let id: Int
        let type: String
        var hits: [NativeSearchHit]
    }

    private(set) var metadata: NativeSearchMetadata?
    private(set) var hits: [NativeSearchHit] = []
    private(set) var phase: Phase = .idle
    private(set) var recentQueries: [String]
    @ObservationIgnored private let engine: any NativeSearchQuerying
    @ObservationIgnored private let recents: NativeSearchRecents
    @ObservationIgnored private var generation = 0

    init(engine: any NativeSearchQuerying, recents: NativeSearchRecents) {
        self.engine = engine
        self.recents = recents
        self.recentQueries = recents.load()
    }

    /// Contiguous sections keep the query engine's complete ranking unchanged. Grouping every
    /// result of a kind together would move lower-ranked hits ahead of higher-ranked neighbours.
    var groups: [Group] {
        var groups: [Group] = []
        for (index, hit) in hits.enumerated() {
            if groups.last?.type == hit.type {
                groups[groups.count - 1].hits.append(hit)
            } else {
                groups.append(Group(id: index, type: hit.type, hits: [hit]))
            }
        }
        return groups
    }

    func update(query: String, paper: String = "", type: String = "", debounce: Bool = true) async {
        generation += 1
        let request = generation
        hits = []
        phase = .loading
        do {
            let empty = query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            if debounce && !empty { try await Task.sleep(for: .milliseconds(180)) }
            try Task.checkCancellation()
            let loaded = try await engine.load()
            guard request == generation else { return }
            try Task.checkCancellation()
            metadata = loaded
            if empty {
                phase = .idle
                return
            }
            let found = try await engine.search(query, paper: paper, type: type)
            guard request == generation else { return }
            try Task.checkCancellation()
            hits = found
            phase = .results
        } catch is CancellationError {
            if request == generation { phase = .idle }
        } catch {
            guard request == generation, !Task.isCancelled else { return }
            phase = .failed(error.localizedDescription)
        }
    }

    func remember(_ query: String) {
        recents.record(query)
        recentQueries = recents.load()
    }

    func clearRecents() {
        recents.clear()
        recentQueries = []
    }
}
