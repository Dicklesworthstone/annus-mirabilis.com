import Foundation
import WebKit

/// Serves the bundled edition at `am-edition://edition/` (docs/DECISIONS.md
/// D-2026-09-23-app-edition-hosting). The custom scheme keeps one origin across
/// launches, so the reader's local storage survives; a loopback server did not.
///
/// Only manifest-listed files are served, with the manifest's content type. Anything else, a path
/// that tries to leave the edition included, gets the edition's own 404 page, and nothing outside
/// the edition is ever read (bead am-app-scheme-handler-ghuu; scripts/app/fixtures/origin-vectors.json).
/// Files are read off the main thread, and a task WebKit has stopped is never answered.
@MainActor
final class EditionSchemeHandler: NSObject, WKURLSchemeHandler {
    private let catalog: EditionCatalog
    /// Reads a listed file's bytes. Tests replace it to hold a read open.
    var read: @Sendable (URL) async -> Data? = { url in try? Data(contentsOf: url, options: .mappedIfSafe) }
    /// Tasks started and not yet answered or stopped. Only these are ever answered.
    private var inFlight: Set<ObjectIdentifier> = []
    /// The work under way, each removing itself when it ends, so a test can wait for it to settle.
    private var work: [Int: Task<Void, Never>] = [:]
    private var nextWork = 0

    init(catalog: EditionCatalog) {
        self.catalog = catalog
    }

    /// Headers on every response, and no others: never Set-Cookie. The website sends no
    /// Content-Security-Policy yet; when it does, the same policy is added here, and it must allow
    /// 'wasm-unsafe-eval' or WebKit refuses every WebAssembly compile.
    static func headers(contentType: String, length: Int) -> [String: String] {
        [
            "Content-Type": contentType,
            "Content-Length": String(length),
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
        ]
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        let status: Int
        let file: EditionManifest.File?
        switch catalog.resolve(url) {
        case .file(let found):
            (status, file) = (200, found)
        case .notFound, .refused:
            (status, file) = (404, catalog.notFoundPage)
        }
        guard let file else {
            respond(urlSchemeTask, url: url, status: 404, body: Data(), contentType: "text/plain; charset=utf-8")
            return
        }
        let id = ObjectIdentifier(urlSchemeTask)
        inFlight.insert(id)
        let source = catalog.fileURL(for: file)
        let read = read
        let key = nextWork
        nextWork += 1
        // Both run on the main actor, so the task cannot end before it is recorded.
        work[key] = Task {
            defer { work[key] = nil }
            let body = await read(source)
            guard inFlight.remove(id) != nil else { return }
            guard let body else {
                urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
                return
            }
            respond(urlSchemeTask, url: url, status: status, body: body, contentType: file.contentType)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {
        inFlight.remove(ObjectIdentifier(urlSchemeTask))
    }

    /// Waits until every task started so far has been answered or dropped.
    func settle() async {
        while let task = work.values.first {
            await task.value
        }
    }

    private func respond(_ task: any WKURLSchemeTask, url: URL, status: Int, body: Data, contentType: String) {
        guard
            let response = HTTPURLResponse(
                url: url,
                statusCode: status,
                httpVersion: "HTTP/1.1",
                headerFields: Self.headers(contentType: contentType, length: body.count)
            )
        else {
            task.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
    }
}
