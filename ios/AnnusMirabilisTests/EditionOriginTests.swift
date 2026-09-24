import CryptoKit
import Foundation
import Testing
import WebKit

@testable import AnnusMirabilis

/// scripts/app/fixtures/origin-vectors.json, which scripts/app/origin-vectors.test.ts reads too.
private struct OriginVectors: Decodable {
    struct File: Decodable {
        let path: String
        let body: String
        let contentType: String
        let size: Int
        let sha256: String
    }
    struct Repeat: Decodable {
        let segment: String
        let count: Int
    }
    struct Vector: Decodable {
        let name: String
        let path: String
        let status: Int
        let file: String
        let host: String?
        let `repeat`: Repeat?
    }
    let maxPathLength: Int
    let headers: [String: String]
    let forbiddenHeaders: [String]
    let files: [File]
    let vectors: [Vector]
}

/// A request WebKit would hand the handler, recording what the handler answers.
@MainActor
private final class RecordingTask: NSObject, @preconcurrency WKURLSchemeTask {
    let request: URLRequest
    private(set) var response: HTTPURLResponse?
    private(set) var body = Data()
    private(set) var finished = false
    private(set) var failure: (any Error)?
    private(set) var calls = 0

    init(_ url: URL) {
        request = URLRequest(url: url)
    }

    func didReceive(_ response: URLResponse) {
        calls += 1
        self.response = response as? HTTPURLResponse
    }

    func didReceive(_ data: Data) {
        calls += 1
        body.append(data)
    }

    func didFinish() {
        calls += 1
        finished = true
    }

    func didFailWithError(_ error: any Error) {
        calls += 1
        failure = error
    }
}

/// The app's edition origin (bead am-app-scheme-handler-ghuu), served through the real handler.
@MainActor
@Suite("The edition origin")
struct EditionOriginTests {
    private final class Token {}

    private func vectors() throws -> OriginVectors {
        let url = try #require(Bundle(for: Token.self).url(forResource: "origin-vectors", withExtension: "json"))
        return try JSONDecoder().decode(OriginVectors.self, from: Data(contentsOf: url))
    }

    /// The vectors' files on disk, under a manifest that lists exactly them.
    private func handler(for vectors: OriginVectors) throws -> EditionSchemeHandler {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("origin-\(UUID().uuidString)")
        for file in vectors.files {
            let target = root.appendingPathComponent(file.path)
            try FileManager.default.createDirectory(
                at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
            try Data(file.body.utf8).write(to: target)
        }
        let listed = vectors.files.map {
            ["path": $0.path, "sha256": $0.sha256, "size": $0.size, "contentType": $0.contentType] as [String: Any]
        }
        let manifest = try JSONDecoder().decode(
            EditionManifest.self,
            from: JSONSerialization.data(withJSONObject: [
                "schemaVersion": EditionCatalog.schemaVersion, "editionDigest": "vectors", "files": listed,
            ]))
        return EditionSchemeHandler(catalog: try EditionCatalog(root: root, manifest: manifest))
    }

    private func url(_ vector: OriginVectors.Vector) throws -> URL {
        let tail = vector.repeat.map { String(repeating: $0.segment, count: $0.count) } ?? ""
        let host = vector.host ?? EditionCatalog.host
        return try #require(URL(string: "\(EditionCatalog.scheme)://\(host)\(vector.path)\(tail)"))
    }

    @Test("every shared vector gets its status, its file's bytes and type, and the fixed headers")
    func everyVector() async throws {
        let vectors = try vectors()
        let handler = try handler(for: vectors)
        #expect(!vectors.vectors.isEmpty)
        #expect(EditionCatalog.maxPathLength == vectors.maxPathLength, "the app and the vectors name one limit")
        for vector in vectors.vectors {
            let task = RecordingTask(try url(vector))
            handler.webView(WKWebView(), start: task)
            await handler.settle()
            let file = try #require(vectors.files.first { $0.path == vector.file }, "\(vector.name)")
            let response = try #require(task.response, "\(vector.name): no response")
            #expect(response.statusCode == vector.status, "\(vector.name)")
            #expect(task.finished && task.failure == nil, "\(vector.name)")
            #expect(response.value(forHTTPHeaderField: "Content-Type") == file.contentType, "\(vector.name)")
            #expect(response.value(forHTTPHeaderField: "Content-Length") == String(file.size), "\(vector.name)")
            for (name, value) in vectors.headers {
                #expect(response.value(forHTTPHeaderField: name) == value, "\(vector.name): \(name)")
            }
            for name in vectors.forbiddenHeaders {
                #expect(response.value(forHTTPHeaderField: name) == nil, "\(vector.name): \(name)")
            }
            let digest = SHA256.hash(data: task.body).map { String(format: "%02x", $0) }.joined()
            #expect(digest == file.sha256, "\(vector.name)")
        }
    }

    @Test("a task WebKit stopped is never answered")
    func stoppedTaskIsNotAnswered() async throws {
        let vectors = try vectors()
        let handler = try handler(for: vectors)
        let view = WKWebView()
        let stopped = RecordingTask(try #require(URL(string: "am-edition://edition/")))
        handler.webView(view, start: stopped)
        handler.webView(view, stop: stopped)
        let answered = RecordingTask(try #require(URL(string: "am-edition://edition/")))
        handler.webView(view, start: answered)
        await handler.settle()
        #expect(stopped.calls == 0)
        #expect(answered.finished && answered.response?.statusCode == 200)
    }

    @Test("a file that cannot be read fails the task instead of answering empty")
    func unreadableFileFails() async throws {
        let handler = try handler(for: try vectors())
        handler.read = { _ in nil }
        let task = RecordingTask(try #require(URL(string: "am-edition://edition/")))
        handler.webView(WKWebView(), start: task)
        await handler.settle()
        #expect(task.response == nil)
        #expect((task.failure as? URLError)?.code == .fileDoesNotExist)
        #expect((task.failure as? URLError)?.failingURL == task.request.url, "the failure names its page")
    }
}
