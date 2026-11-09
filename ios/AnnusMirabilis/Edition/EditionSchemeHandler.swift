import Foundation
import WebKit

/// Serves the bundled edition and verified source PDFs at one persistent edition origin.
/// Bundled files must be manifest-listed; cached PDFs must match this release's source pin.
/// Nothing in file serving starts a network request, and a stopped WebKit task is never answered.
@MainActor
final class EditionSchemeHandler: NSObject, WKURLSchemeHandler {
    private let catalog: EditionCatalog
    private let facsimiles: FacsimileStore?
    /// Reads a listed bundled file's bytes. Tests replace it to hold a read open.
    var read: @Sendable (URL) async -> Data? = { url in try? Data(contentsOf: url, options: .mappedIfSafe) }
    private var inFlight: Set<ObjectIdentifier> = []
    private var work: [Int: Task<Void, Never>] = [:]
    private var nextWork = 0

    init(catalog: EditionCatalog, facsimiles: FacsimileStore? = nil) {
        self.catalog = catalog
        self.facsimiles = facsimiles
    }

    /// The existing bundle headers stay unchanged. PDFs add only bounded HTTP range headers.
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
        let id = ObjectIdentifier(urlSchemeTask)
        inFlight.insert(id)
        let key = nextWork
        nextWork += 1
        work[key] = Task {
            defer { work[key] = nil }
            guard inFlight.contains(id) else { return }
            if let path = Self.facsimilePath(url), let facsimiles, let file = await facsimiles.file(at: path) {
                guard inFlight.contains(id) else { return }
                await servePDF(urlSchemeTask, url: url, file: file, id: id)
            } else {
                guard inFlight.contains(id) else { return }
                await serveBundle(urlSchemeTask, url: url, id: id)
            }
        }
    }

    /// Fragments select a PDF page and never affect its file identity. Encoded aliases are refused.
    static func facsimilePath(_ url: URL) -> String? {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
            parts.scheme == EditionCatalog.scheme, parts.host == EditionCatalog.host,
            parts.port == nil, parts.user == nil, parts.password == nil, parts.query == nil,
            parts.percentEncodedPath.range(
                of: #"\A/papers/pdfs/ap-[0-9]{2}-[0-9]{1,4}\.pdf\z"#, options: .regularExpression) != nil
        else { return nil }
        return parts.percentEncodedPath
    }

    private func serveBundle(_ task: any WKURLSchemeTask, url: URL, id: ObjectIdentifier) async {
        let status: Int
        let file: EditionManifest.File?
        switch catalog.resolve(url) {
        case .file(let found): (status, file) = (200, found)
        case .notFound, .refused: (status, file) = (404, catalog.notFoundPage)
        }
        guard let file else {
            guard inFlight.remove(id) != nil else { return }
            respond(task, url: url, status: 404, body: Data(), contentType: "text/plain; charset=utf-8")
            return
        }
        let body = await read(catalog.fileURL(for: file))
        guard inFlight.remove(id) != nil else { return }
        guard let body else {
            failMissing(task, url: url)
            return
        }
        respond(task, url: url, status: status, body: body, contentType: file.contentType)
    }

    private func servePDF(
        _ task: any WKURLSchemeTask, url: URL, file: VerifiedFacsimile, id: ObjectIdentifier
    ) async {
        let method = task.request.httpMethod ?? "GET"
        guard method == "GET" || method == "HEAD" else {
            guard inFlight.remove(id) != nil else { return }
            respond(task, url: url, status: 405, body: Data(), contentType: "application/pdf",
                extra: ["Allow": "GET, HEAD"])
            return
        }
        let etag = "\"\(file.sha256)\""
        let ifRange = task.request.value(forHTTPHeaderField: "If-Range")
        let rangeHeader = method == "GET" && (ifRange == nil || ifRange == etag)
            ? task.request.value(forHTTPHeaderField: "Range") : nil
        let range = FacsimileRange.parse(rangeHeader, length: file.bytes)
        let body = await FacsimileRange.read(file, range: range, head: method == "HEAD")
        guard inFlight.remove(id) != nil else { return }
        guard let body else {
            failMissing(task, url: url)
            return
        }
        var extra = range.headers(length: file.bytes)
        extra["ETag"] = etag
        extra["Cache-Control"] = "no-store"
        respond(task, url: url, status: range.status, body: body, contentType: "application/pdf", extra: extra)
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {
        inFlight.remove(ObjectIdentifier(urlSchemeTask))
    }

    /// Waits until every task started so far has been answered or dropped.
    func settle() async {
        while let task = work.values.first { await task.value }
    }

    private func failMissing(_ task: any WKURLSchemeTask, url: URL) {
        task.didFailWithError(URLError(.fileDoesNotExist, userInfo: [NSURLErrorFailingURLErrorKey: url]))
    }

    private func respond(
        _ task: any WKURLSchemeTask, url: URL, status: Int, body: Data, contentType: String,
        extra: [String: String] = [:]
    ) {
        let headers = Self.headers(contentType: contentType, length: body.count).merging(extra) { _, rhs in rhs }
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)
        else {
            task.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        task.didReceive(response)
        if !body.isEmpty { task.didReceive(body) }
        task.didFinish()
    }
}
