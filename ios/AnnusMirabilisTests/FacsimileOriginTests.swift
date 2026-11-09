import Foundation
import Testing
import WebKit

@testable import AnnusMirabilis

@MainActor
private final class FacsimileSchemeTask: NSObject, @preconcurrency WKURLSchemeTask {
    let request: URLRequest
    private(set) var response: HTTPURLResponse?
    private(set) var data = Data()
    private(set) var calls = 0
    private(set) var finished = false

    init(_ url: URL, method: String = "GET", range: String? = nil, ifRange: String? = nil) {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(range, forHTTPHeaderField: "Range")
        request.setValue(ifRange, forHTTPHeaderField: "If-Range")
        self.request = request
    }

    func didReceive(_ response: URLResponse) {
        calls += 1
        self.response = response as? HTTPURLResponse
    }
    func didReceive(_ data: Data) {
        calls += 1
        self.data.append(data)
    }
    func didFinish() {
        calls += 1
        finished = true
    }
    func didFailWithError(_ error: any Error) { calls += 1 }
}

@MainActor
@Suite("Verified PDFs on the edition origin", .timeLimit(.minutes(1)))
struct FacsimileOriginTests {
    private func catalog() throws -> EditionCatalog {
        try EditionCatalog(
            root: FileManager.default.temporaryDirectory.appendingPathComponent("facsimile-origin-\(UUID())"),
            manifest: EditionManifest(schemaVersion: EditionCatalog.schemaVersion, editionDigest: "fixture", files: []))
    }

    private func pdfURL(_ suffix: String = "#page=2") throws -> URL {
        try #require(URL(string: "am-edition://edition/papers/pdfs/ap-18-639.pdf\(suffix)"))
    }

    @Test("the reader link and iframe can open exact verified PDF bytes and bounded ranges")
    func rangeServing() async throws {
        let cache = FacsimileFixture.cache()
        _ = try FacsimileFixture.published(cache)
        let store = FacsimileStore(assets: [FacsimileFixture.asset()], cache: cache)
        let catalog = try catalog()
        let handler = EditionSchemeHandler(catalog: catalog, facsimiles: store)
        let view = WKWebView()
        let url = try pdfURL()
        #expect(EditionLinkPolicy.decide(url, catalog: catalog) == .allow)
        #expect(EditionSchemeHandler.facsimilePath(url) == "/papers/pdfs/ap-18-639.pdf")
        let whole = FacsimileSchemeTask(url)
        handler.webView(view, start: whole)
        await handler.settle()
        #expect(whole.finished && whole.response?.statusCode == 200)
        #expect(whole.data == FacsimileFixture.bytes)
        #expect(whole.response?.value(forHTTPHeaderField: "Content-Type") == "application/pdf")
        let partial = FacsimileSchemeTask(url, range: "bytes=0-4")
        handler.webView(view, start: partial)
        await handler.settle()
        #expect(partial.response?.statusCode == 206 && partial.data == Data("%PDF-".utf8))
        #expect(partial.response?.value(forHTTPHeaderField: "Content-Range") == "bytes 0-4/\(whole.data.count)")
        #expect(partial.response?.value(forHTTPHeaderField: "Content-Length") == "5")
        #expect(partial.response?.value(forHTTPHeaderField: "Accept-Ranges") == "bytes")
        #expect(partial.response?.value(forHTTPHeaderField: "Set-Cookie") == nil)
    }

    @Test("HEAD, unsatisfiable ranges, and If-Range mismatch have correct response semantics")
    func rangeEdgeCases() async throws {
        let cache = FacsimileFixture.cache()
        _ = try FacsimileFixture.published(cache)
        let handler = EditionSchemeHandler(
            catalog: try catalog(), facsimiles: FacsimileStore(assets: [FacsimileFixture.asset()], cache: cache))
        let head = FacsimileSchemeTask(try pdfURL(), method: "HEAD", range: "bytes=0-4")
        handler.webView(WKWebView(), start: head)
        await handler.settle()
        #expect(head.response?.statusCode == 200 && head.data.isEmpty)
        #expect(head.response?.value(forHTTPHeaderField: "Content-Length") == String(FacsimileFixture.bytes.count))
        let refused = FacsimileSchemeTask(try pdfURL(), range: "bytes=999999-")
        handler.webView(WKWebView(), start: refused)
        await handler.settle()
        #expect(refused.response?.statusCode == 416 && refused.data.isEmpty)
        #expect(
            refused.response?.value(forHTTPHeaderField: "Content-Range") == "bytes */\(FacsimileFixture.bytes.count)")
        let stale = FacsimileSchemeTask(try pdfURL(), range: "bytes=0-4", ifRange: "\"old-release\"")
        handler.webView(WKWebView(), start: stale)
        await handler.settle()
        #expect(stale.response?.statusCode == 200 && stale.data == FacsimileFixture.bytes)
    }

    @Test("a cache file cannot authorize an unlisted key, encoded path, query, credentials, or foreign origin")
    func exactPathAndRelease() async throws {
        let cache = FacsimileFixture.cache()
        _ = try FacsimileFixture.published(cache)
        let handler = EditionSchemeHandler(
            catalog: try catalog(), facsimiles: FacsimileStore(assets: [], cache: cache))
        let unlisted = FacsimileSchemeTask(try pdfURL())
        handler.webView(WKWebView(), start: unlisted)
        await handler.settle()
        #expect(unlisted.response?.statusCode == 404 && unlisted.data.isEmpty)
        let aliases = [
            "am-edition://elsewhere/papers/pdfs/ap-18-639.pdf",
            "am-edition://user@edition/papers/pdfs/ap-18-639.pdf",
            "am-edition://edition:443/papers/pdfs/ap-18-639.pdf",
            "am-edition://edition/papers/pdfs/%61p-18-639.pdf",
            "am-edition://edition/papers/pdfs/ap-18-639.pdf?alternate=1",
            "am-edition://edition/papers/pdfs/../ap-18-639.pdf",
        ]
        for alias in aliases {
            #expect(EditionSchemeHandler.facsimilePath(try #require(URL(string: alias))) == nil)
        }
    }

    @Test("eviction produces a missing response, and a stopped PDF task receives no callbacks")
    func evictionAndStoppedTask() async throws {
        let cache = FacsimileFixture.cache()
        let pin = try FacsimileFixture.published(cache)
        let store = FacsimileStore(assets: [FacsimileFixture.asset()], cache: cache)
        let handler = EditionSchemeHandler(catalog: try catalog(), facsimiles: store)
        let view = WKWebView()
        let stopped = FacsimileSchemeTask(try pdfURL())
        handler.webView(view, start: stopped)
        handler.webView(view, stop: stopped)
        await handler.settle()
        #expect(stopped.calls == 0)
        try FileManager.default.removeItem(at: cache.finalURL(pin))
        let evicted = FacsimileSchemeTask(try pdfURL())
        handler.webView(view, start: evicted)
        await handler.settle()
        #expect(evicted.response?.statusCode == 404)
        #expect(await store.status(pin.key)?.state == .evicted)
    }

    @Test("the asynchronous bridge exposes only verified paths and distinguishes missing from unavailable")
    func bridgeResults() async throws {
        let router = BridgeRouter()
        let request = BridgeMessage(type: "facsimile.status", body: ["key": .string("ap-18-639")])
        #expect(await router.serveAsync(request)["status"] as? String == "unavailable")
        let cache = FacsimileFixture.cache()
        router.facsimiles = FacsimileStore(assets: [FacsimileFixture.asset()], cache: cache)
        let before = await router.serveAsync(request)
        let beforeValue = try #require(before["value"] as? [String: Any])
        #expect(beforeValue["state"] as? String == "not-downloaded" && beforeValue["path"] == nil)
        _ = try FacsimileFixture.published(cache)
        let saved = await router.serveAsync(request)
        let value = try #require(saved["value"] as? [String: Any])
        #expect(value["state"] as? String == "verified" && value["progress"] as? Double == 1)
        #expect(value["path"] as? String == "/papers/pdfs/ap-18-639.pdf")
        #expect(value["bytesExpected"] as? Int == value["bytesReceived"] as? Int)
        let again = BridgeMessage(type: "facsimile.request", body: request.body)
        #expect(await router.serveAsync(again)["status"] as? String == "ok")
        let unknown = BridgeMessage(type: "facsimile.status", body: ["key": .string("ap-00-0")])
        #expect(await router.serveAsync(unknown)["status"] as? String == "missing")
    }
}
