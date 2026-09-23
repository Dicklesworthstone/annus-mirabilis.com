import Foundation
import WebKit

/// Serves the bundled edition at `am-edition://edition/` (docs/DECISIONS.md
/// D-2026-09-23-app-edition-hosting). The custom scheme keeps one origin across
/// launches, so the reader's local storage survives; a loopback server did not.
///
/// Only manifest-listed files are served, with the manifest's content type.
/// Anything else gets the edition's own 404 page, and a path that tries to
/// leave the edition gets a 400 with no body.
@MainActor
final class EditionSchemeHandler: NSObject, WKURLSchemeHandler {
    private let catalog: EditionCatalog

    init(catalog: EditionCatalog) {
        self.catalog = catalog
    }

    /// Headers on every response. The website sends no Content-Security-Policy
    /// yet; when it does, the same policy is added here, and it must allow
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
        switch catalog.resolve(url) {
        case .file(let file):
            respond(urlSchemeTask, url: url, status: 200, file: file)
        case .notFound:
            if let page = catalog.notFoundPage {
                respond(urlSchemeTask, url: url, status: 404, file: page)
            } else {
                respond(urlSchemeTask, url: url, status: 404, body: Data(), contentType: "text/plain; charset=utf-8")
            }
        case .refused:
            respond(urlSchemeTask, url: url, status: 400, body: Data(), contentType: "text/plain; charset=utf-8")
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {
        // Every response is delivered synchronously inside start, so there is
        // no work in flight to cancel.
    }

    private func respond(_ task: any WKURLSchemeTask, url: URL, status: Int, file: EditionManifest.File) {
        do {
            let body = try Data(contentsOf: catalog.fileURL(for: file), options: .mappedIfSafe)
            respond(task, url: url, status: status, body: body, contentType: file.contentType)
        } catch {
            task.didFailWithError(URLError(.fileDoesNotExist))
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
