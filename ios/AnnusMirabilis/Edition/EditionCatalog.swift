import Foundation

/// The file table of the bundled edition, read from `edition-manifest.json`,
/// which `scripts/app/export-edition.ts` writes and the bundling phase copies
/// beside the `Edition/` folder (App plan §5.1, §6.2).
///
/// Only files the manifest lists are ever served, with the content type the
/// manifest names. Swift never decides what ships or what a file is.
struct EditionManifest: Decodable, Sendable {
    struct File: Decodable, Sendable, Equatable {
        let path: String
        let sha256: String
        let size: Int
        let contentType: String
    }

    /// A document-start script the app may inject, pinned by SHA-256 (the bridge).
    struct UserScript: Decodable, Sendable, Equatable {
        let id: String
        let file: String
        let sha256: String
        /// The one span the app fills in, for a template (the settings snapshot).
        var placeholder: String?
    }

    /// The edition's own setting steps the app maps system settings onto.
    struct Settings: Decodable, Sendable, Equatable {
        let typeSizes: [Int]
    }

    /// A data file beside the manifest, pinned by SHA-256 (the native catalogue).
    struct CatalogFile: Decodable, Sendable, Equatable {
        let file: String
        let sha256: String
    }

    let schemaVersion: String
    let editionDigest: String
    let files: [File]
    var userScripts: [UserScript]?
    /// The site's registry of the reader's data; absent from exports made before it was recorded.
    var readerData: ReaderDataManifest?
    var settings: Settings?
    var nativeCatalog: CatalogFile?
}

enum EditionCatalogError: Error, Equatable {
    case manifestMissing
    case manifestUnreadable(String)
    case unsupportedSchema(String)
}

struct EditionCatalog: Sendable {
    static let schemaVersion = "annus-mirabilis-app-edition.v1"
    static let scheme = "am-edition"
    static let host = "edition"

    /// The folder in the app bundle that holds the edition's files.
    let root: URL
    let editionDigest: String
    /// The bridge script's manifest entry, when the export recorded one.
    let bridgeScript: EditionManifest.UserScript?
    let readerData: ReaderDataManifest?
    /// The settings snapshot template's manifest entry, when the export recorded one.
    let settingsSnapshotScript: EditionManifest.UserScript?
    /// The test console's manifest entry, which only a DEBUG build injects (TestEvidence).
    let testConsoleScript: EditionManifest.UserScript?
    /// The edition's type-size steps, in percent; empty for an export made before they were recorded.
    let typeSizes: [Int]
    /// The native catalogue's manifest entry, when the export recorded one.
    let nativeCatalogFile: EditionManifest.CatalogFile?
    private let files: [String: EditionManifest.File]

    init(root: URL, manifest: EditionManifest) throws(EditionCatalogError) {
        guard manifest.schemaVersion == Self.schemaVersion else {
            throw .unsupportedSchema(manifest.schemaVersion)
        }
        self.root = root
        self.editionDigest = manifest.editionDigest
        self.files = Dictionary(manifest.files.map { ($0.path, $0) }, uniquingKeysWith: { first, _ in first })
        self.bridgeScript = manifest.userScripts?.first { $0.id == "bridge" }
        self.readerData = manifest.readerData
        self.settingsSnapshotScript = manifest.userScripts?.first { $0.id == "settings-snapshot" }
        self.testConsoleScript = manifest.userScripts?.first { $0.id == "test-console" }
        self.typeSizes = manifest.settings?.typeSizes ?? []
        self.nativeCatalogFile = manifest.nativeCatalog
    }

    static func load(from bundle: Bundle = .main) throws(EditionCatalogError) -> EditionCatalog {
        guard let manifestURL = bundle.url(forResource: "edition-manifest", withExtension: "json") else {
            throw .manifestMissing
        }
        let manifest: EditionManifest
        do {
            manifest = try JSONDecoder().decode(EditionManifest.self, from: Data(contentsOf: manifestURL))
        } catch {
            throw .manifestUnreadable(String(describing: error))
        }
        return try EditionCatalog(
            root: bundle.bundleURL.appendingPathComponent("Edition", isDirectory: true), manifest: manifest)
    }

    /// Where the manifest and its user scripts sit: the bundle, beside Edition/.
    var scriptDirectory: URL { root.deletingLastPathComponent() }

    /// The bridge script's source, only if its bytes match the recorded digest.
    func verifiedBridgeScript() -> String? {
        BridgeScript.load(bridgeScript, directory: scriptDirectory)
    }

    /// The native screens' data, only if its bytes match the recorded digest.
    func verifiedNativeCatalog() -> NativeCatalog? {
        NativeCatalog.load(nativeCatalogFile, directory: scriptDirectory)
    }

    /// The settings snapshot template, only if its bytes match the recorded digest.
    func verifiedSettingsSnapshot() -> SettingsSnapshot? {
        guard let entry = settingsSnapshotScript, let placeholder = entry.placeholder,
            let template = BridgeScript.load(entry, directory: scriptDirectory)
        else { return nil }
        return SettingsSnapshot(template: template, placeholder: placeholder)
    }

    var fileCount: Int { files.count }
    var allFiles: [EditionManifest.File] { Array(files.values) }

    /// The start page of the edition.
    static var homeURL: URL { URL(string: "\(scheme)://\(host)/")! }

    static func url(route: String, anchor: String? = nil) -> URL? {
        guard route.hasPrefix("/") else { return nil }
        var components = URLComponents()
        components.scheme = scheme
        components.host = host
        components.path = route
        components.fragment = anchor
        return components.url
    }

    enum Resolution: Equatable {
        case file(EditionManifest.File)
        case notFound
        case refused
    }

    /// Resolves a request URL to a listed file. A path that tries to leave the
    /// edition is refused, never normalized into one that exists.
    func resolve(_ url: URL) -> Resolution {
        guard url.scheme == Self.scheme, url.host() == Self.host else { return .refused }
        guard let candidates = Self.candidatePaths(percentEncodedPath: url.path(percentEncoded: true)) else {
            return .refused
        }
        for candidate in candidates {
            if let file = files[candidate] { return .file(file) }
        }
        return .notFound
    }

    /// The edition's own 404 page, when the export carried one.
    var notFoundPage: EditionManifest.File? { files["404.html"] }

    func fileURL(for file: EditionManifest.File) -> URL {
        root.appendingPathComponent(file.path, isDirectory: false)
    }

    /// The longest request path served, in bytes as sent: a longer one is refused before anything
    /// is decoded (scripts/app/fixtures/origin-vectors.json names the same limit).
    static let maxPathLength = 2048

    /// The manifest keys a request path may name, most specific first, or nil
    /// when the path is refused. The static export uses trailing slashes, so
    /// `/papers/` is `papers/index.html`; `/papers` is tried as the same page.
    static func candidatePaths(percentEncodedPath raw: String) -> [String]? {
        guard raw.utf8.count <= maxPathLength else { return nil }
        let path = raw.isEmpty ? "/" : raw
        let lowered = path.lowercased()
        // An encoded separator or NUL would let a segment smuggle "/" or "\" past the checks below.
        for forbidden in ["%2f", "%5c", "%00"] where lowered.contains(forbidden) {
            return nil
        }
        guard path.hasPrefix("/"), let decoded = path.removingPercentEncoding else { return nil }
        if decoded.contains("\\") || decoded.contains("\0") { return nil }
        let segments = decoded.split(separator: "/", omittingEmptySubsequences: false).dropFirst()
        for segment in segments where segment == ".." || segment == "." {
            return nil
        }
        let joined = segments.joined(separator: "/")
        if joined.isEmpty { return ["index.html"] }
        if decoded.hasSuffix("/") { return [joined + "index.html"] }
        let last = segments.last ?? ""
        if last.contains(".") { return [joined] }
        return [joined, joined + "/index.html"]
    }
}
