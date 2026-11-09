import JavaScriptCore
import UIKit

/// What the reader can do with the page from the native chrome: share it, print it, find in it,
/// and take their data away.
extension EditionSession {
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

    /// Loads a page of the edition, remembering it as the page to retry if it fails.
    func load(_ url: URL, revealReader: Bool = true) {
        if revealReader { self.revealReader(url) }
        lastRequestedURL = url
        webView.load(URLRequest(url: url))
    }

    /// Opens a page of the edition, at an anchor when given, from a native screen.
    func open(route: String, anchor: String?) {
        guard let url = EditionCatalog.url(route: route, anchor: anchor) else { return }
        load(url)
    }

    /// A page could not be loaded: remember which, so the reader can try it again. WebKit names
    /// the address it failed on (the edition origin always does); when it does not, the page the app
    /// last asked for is the one. The page last shown is not: on a first load there is none, and the
    /// home page would open instead (measured 2026-09-24, run 20260924T124602Z-6c8aefa8).
    func didFailLoad(_ url: URL?) {
        loadFailure = url ?? lastRequestedURL ?? currentURL ?? EditionCatalog.homeURL
    }

    /// The controller at the top of the window's presentation chain.
    var topPresenter: UIViewController? {
        guard var presenter = webView.window?.rootViewController else { return nil }
        while let next = presenter.presentedViewController {
            presenter = next
        }
        return presenter
    }

    /// Native back (bead am-app-edition-webview-ju3v, requirement 3): a step back through the
    /// edition's own history, the same step the edge swipe takes, so a lesson opened beside the text
    /// closes and the reader is back at the passage. With no history there is nothing to do: the
    /// reader has no native navigation stack of its own to pop.
    func goBack() {
        if webView.canGoBack { webView.goBack() }
    }

    /// Loads the page that failed, once more.
    func retryLoad() {
        guard let url = loadFailure else { return }
        loadFailure = nil
        load(url)
    }
}

// MARK: - The edition's native search action

/// One serial owner of JavaScriptCore, off the main actor. No JSValue crosses its boundary.
/// The index, validation, normalization and ranking are the website's existing search code.
/// Queries are passed as values; only the hash-checked bundled module is evaluated as source.
actor NativeSearchEngine: NativeSearchQuerying {
    static let schemaVersion = "annus-mirabilis-native-search.v1"

    private let catalog: EditionCatalog
    private var context: JSContext?
    private var queryFunction: JSValue?
    private var metadata: NativeSearchMetadata?
    private(set) var coldLoadDuration: Duration?

    init(catalog: EditionCatalog) {
        self.catalog = catalog
    }

    /// These are file-read safety budgets from src/search/core.ts, not another query algorithm.
    private enum Budget {
        static let script = 256 * 1024
        static let manifest = 64 * 1024
        static let shard = 2 * 1024 * 1024
        static let total = 16 * 1024 * 1024
        static let shards = 128
        static let documents = 20_000
        static let response = 1024 * 1024
    }

    /// Only the fields required to locate bounded files are decoded here. The shared JS module
    /// validates the complete manifest, every document, alias, duplicate and total.
    private struct IndexShard: Decodable {
        let path: String
        let sha256: String
        let bytes: Int
    }

    private struct IndexFiles: Decodable {
        let buildDigest: String
        let totalDocuments: Int
        let shards: [IndexShard]
    }

    private struct QueryFailure: Decodable {
        let code: String
    }

    private struct Envelope: Decodable {
        let ok: Bool
        let error: QueryFailure?
    }

    private struct Results: Decodable {
        let hits: [NativeSearchHit]
    }

    private struct Options: Encodable {
        let paper: String?
        let type: String?
        let limit: Int
    }

    func load() throws -> NativeSearchMetadata {
        try Task.checkCancellation()
        if let metadata { return metadata }
        let start = ContinuousClock.now
        guard let entry = catalog.nativeSearch else { throw NativeSearchError.notIncluded }
        guard entry.schemaVersion == Self.schemaVersion,
            entry.queryScript.file == "native/search-query.js",
            entry.manifestPath == "search/index-manifest.json",
            (0...Budget.documents).contains(entry.totalDocuments)
        else { throw NativeSearchError.invalidManifest }

        let script = try verifiedText(
            path: entry.queryScript.file, limit: Budget.script,
            sha256: entry.queryScript.sha256, bytes: entry.queryScript.bytes)
        let input = try verifiedIndex(entry)

        guard let javascript = JSContext() else { throw NativeSearchError.runtimeUnavailable }
        javascript.evaluateScript(script, withSourceURL: catalog.root.appendingPathComponent(entry.queryScript.file))
        guard javascript.exception == nil,
            let api = javascript.objectForKeyedSubscript("AnnusMirabilisSearch"), !api.isUndefined, !api.isNull,
            let load = api.objectForKeyedSubscript("load"),
            let search = api.objectForKeyedSubscript("search")
        else { throw NativeSearchError.runtimeUnavailable }
        let response = load.call(withArguments: [input.manifest, input.shards])
        let loaded: NativeSearchMetadata = try decode(response, context: javascript, limit: Budget.manifest)
        guard loaded.schemaVersion == Self.schemaVersion,
            loaded.buildDigest == entry.buildDigest, loaded.documentCount == entry.totalDocuments,
            (1...256).contains(loaded.limits.queryCharacters), (1...30).contains(loaded.limits.results)
        else { throw NativeSearchError.invalidResponse }
        try Task.checkCancellation()
        self.context = javascript
        self.queryFunction = search
        self.metadata = loaded
        self.coldLoadDuration = start.duration(to: .now)
        return loaded
    }

    private struct QueryInput {
        let manifest: String
        let shards: [String]
    }

    private func verifiedIndex(_ entry: EditionManifest.NativeSearch) throws -> QueryInput {
        let manifestText = try verifiedText(path: entry.manifestPath, limit: Budget.manifest)
        let index: IndexFiles
        do {
            index = try JSONDecoder().decode(IndexFiles.self, from: Data(manifestText.utf8))
        } catch {
            throw NativeSearchError.invalidManifest
        }
        guard index.buildDigest == entry.buildDigest, index.totalDocuments == entry.totalDocuments,
            index.shards.count <= Budget.shards
        else { throw NativeSearchError.invalidManifest }

        var totalBytes = 0
        var shards: [String] = []
        var seen = Set<String>()
        for shard in index.shards {
            try Task.checkCancellation()
            guard (1...Budget.shard).contains(shard.bytes),
                shard.path == "/search/s-\(shard.sha256).json",
                shard.sha256.count == 64,
                shard.sha256.allSatisfy({ "0123456789abcdef".contains($0) }),
                seen.insert(shard.path).inserted
            else { throw NativeSearchError.invalidManifest }
            totalBytes += shard.bytes
            guard totalBytes <= Budget.total else { throw NativeSearchError.invalidManifest }
            shards.append(
                try verifiedText(
                    path: String(shard.path.dropFirst()), limit: Budget.shard,
                    sha256: shard.sha256, bytes: shard.bytes))
        }

        return QueryInput(manifest: manifestText, shards: shards)
    }

    func search(_ query: String, paper: String = "", type: String = "") throws -> [NativeSearchHit] {
        try Task.checkCancellation()
        let loaded = try load()
        // JavaScript measures UTF-16 code units, so an emoji cannot slip past the web limit here.
        guard query.utf16.count <= loaded.limits.queryCharacters else {
            throw NativeSearchError.queryTooLong(loaded.limits.queryCharacters)
        }
        guard let context, let queryFunction else { throw NativeSearchError.runtimeUnavailable }
        let options = Options(
            paper: paper.isEmpty ? nil : paper, type: type.isEmpty ? nil : type, limit: loaded.limits.results)
        let optionsJSON = String(decoding: try JSONEncoder().encode(options), as: UTF8.self)
        context.exception = nil
        let response = queryFunction.call(withArguments: [query, optionsJSON])
        guard context.exception == nil else { throw NativeSearchError.queryFailed }
        let result: Results = try decode(response, context: context, limit: Budget.response)
        guard result.hits.count <= loaded.limits.results else { throw NativeSearchError.invalidResponse }
        try Task.checkCancellation()
        return result.hits
    }

    private func decode<Value: Decodable>(
        _ value: JSValue?, context: JSContext, limit: Int
    ) throws -> Value {
        guard context.exception == nil, let value, value.isString, let text = value.toString(),
            text.utf8.count <= limit
        else { throw NativeSearchError.invalidResponse }
        let data = Data(text.utf8)
        let envelope: Envelope
        do {
            envelope = try JSONDecoder().decode(Envelope.self, from: data)
        } catch {
            throw NativeSearchError.invalidResponse
        }
        guard envelope.ok else {
            switch envelope.error?.code {
            case "invalid-index": throw NativeSearchError.invalidManifest
            case "not-loaded": throw NativeSearchError.runtimeUnavailable
            case "invalid-query", "query-failed": throw NativeSearchError.queryFailed
            default: throw NativeSearchError.invalidResponse
            }
        }
        do {
            return try JSONDecoder().decode(Value.self, from: data)
        } catch {
            throw NativeSearchError.invalidResponse
        }
    }

    /// The edition file table is the only file authority. Size checks happen before and during
    /// reading; a forged manifest cannot make an unbounded allocation or reach outside Edition/.
    private func verifiedText(
        path: String, limit: Int, sha256: String? = nil, bytes: Int? = nil
    ) throws -> String {
        guard let url = EditionCatalog.url(route: "/" + path),
            case .file(let file) = catalog.resolve(url), file.path == path,
            (1...limit).contains(file.size),
            sha256 == nil || sha256 == file.sha256,
            bytes == nil || bytes == file.size
        else { throw NativeSearchError.damagedFile(path) }
        let data: Data
        do {
            let handle = try FileHandle(forReadingFrom: catalog.fileURL(for: file))
            defer { try? handle.close() }
            var collected = Data()
            while let chunk = try handle.read(upToCount: min(65_536, file.size - collected.count + 1)),
                !chunk.isEmpty
            {
                collected.append(chunk)
                guard collected.count <= file.size else { throw NativeSearchError.damagedFile(path) }
            }
            data = collected
        } catch {
            throw NativeSearchError.damagedFile(path)
        }
        guard data.count == file.size, BridgeScript.sha256Hex(data) == file.sha256,
            let text = String(data: data, encoding: .utf8)
        else { throw NativeSearchError.damagedFile(path) }
        return text
    }
}
