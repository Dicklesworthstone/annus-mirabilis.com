import Foundation

/// The five native entrances into one reader. These are interface labels, never scientific copy.
enum EditionShellSection: String, CaseIterable, Codable, Identifiable, Sendable {
    case read, discover, lab, search, more

    var id: String { rawValue }

    var title: String {
        switch self {
        case .read: "Read"
        case .discover: "Discover"
        case .lab: "Lab"
        case .search: "Search"
        case .more: "More"
        }
    }

    var symbol: String {
        switch self {
        case .read: "book"
        case .discover: "sparkle.magnifyingglass"
        case .lab: "slider.horizontal.3"
        case .search: "magnifyingglass"
        case .more: "ellipsis.circle"
        }
    }

    /// Route classification changes navigation only; the edition catalogue still admits pages.
    static func destination(for url: URL) -> EditionShellSection? {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
            parts.scheme == EditionCatalog.scheme, parts.host == EditionCatalog.host,
            parts.user == nil, parts.password == nil, parts.port == nil
        else { return nil }
        let first = parts.path.split(separator: "/").first.map(String.init) ?? ""
        switch first {
        case "", "papers": return .read
        case "discover", "1904", "tours", "connections", "timeline": return .discover
        case "lab", "instruments": return .lab
        case "search": return .search
        default: return .more
        }
    }
}

/// Value semantics make navigation/restoration testable without SwiftUI or a system index.
/// A tab switch never asks WebKit to navigate: the current page remains mounted underneath.
struct EditionShellState: Codable, Equatable, Sendable {
    private(set) var version = 1
    private(set) var section: EditionShellSection = .read
    private(set) var showingReader = false
    private(set) var location: ReaderLocation?

    mutating func select(_ section: EditionShellSection) {
        self.section = section
        showingReader = false
    }

    mutating func showContents() {
        showingReader = false
    }

    /// PDF destinations may have no HTML location; opening one must not erase the last passage.
    @discardableResult
    mutating func reveal(_ url: URL, in catalog: EditionCatalog) -> Bool {
        guard let section = EditionShellSection.destination(for: url) else { return false }
        self.section = section
        showingReader = true
        if let location = ReaderLocation(editionURL: url, catalog: catalog) { self.location = location }
        return true
    }

    /// A late page report cannot pull someone out of a native catalogue or search field.
    mutating func remember(_ location: ReaderLocation, in catalog: EditionCatalog) {
        guard let url = location.url(in: catalog) else { return }
        self.location = location
        if showingReader, let section = EditionShellSection.destination(for: url) { self.section = section }
    }

    mutating func forgetLocation() {
        location = nil
    }

    var serialized: String {
        guard let bytes = try? JSONEncoder().encode(self) else { return "" }
        return String(decoding: bytes, as: UTF8.self)
    }

    static func restored(
        from serialized: String?, fallback: ReaderLocation?, in catalog: EditionCatalog
    ) -> EditionShellState {
        if let serialized, !serialized.isEmpty, serialized.utf8.count <= 16_384,
            var state = try? JSONDecoder().decode(Self.self, from: Data(serialized.utf8)), state.version == 1
        {
            if let location = state.location, location.url(in: catalog) == nil { state.location = nil }
            if state.showingReader {
                if let url = state.location?.url(in: catalog), let section = EditionShellSection.destination(for: url) {
                    state.section = section
                } else {
                    state.showingReader = false
                }
            }
            return state
        }
        var state = Self()
        if let fallback, let url = fallback.url(in: catalog) { state.reveal(url, in: catalog) }
        return state
    }

    /// Inactive system sheets retain the last foreground state; native catalogues always hide labs.
    func readerIsVisible(sceneInForeground: Bool, coveredByNativePresentation: Bool = false) -> Bool {
        sceneInForeground && showingReader && !coveredByNativePresentation
    }
}
