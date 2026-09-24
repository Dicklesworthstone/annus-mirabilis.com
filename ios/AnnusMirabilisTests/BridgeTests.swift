import Foundation
import Testing

@testable import AnnusMirabilis

private final class TestBundleToken {}

@Suite("Bridge contract: the same verdicts as the TypeScript schema")
struct BridgeContractTests {
    struct Fixture {
        let name: String
        let message: Any
        let verdict: String
    }

    static func fixtures() throws -> [Fixture] {
        let url = try #require(Bundle(for: TestBundleToken.self).url(forResource: "messages", withExtension: "json"))
        let root = try #require(try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
        let marker = try #require(root["oversizedMarker"] as? String)
        let cases = try #require(root["cases"] as? [[String: Any]])
        return try cases.map { entry in
            let name = try #require(entry["name"] as? String)
            let verdict = try #require(entry["verdict"] as? String)
            // The one message too large to store is rebuilt from its marker, as the TS test does.
            let text = String(
                data: try JSONSerialization.data(withJSONObject: entry["message"] as Any, options: .fragmentsAllowed),
                encoding: .utf8)!
            let rebuilt = text.replacingOccurrences(
                of: "\"\(marker)\"", with: "\"\(String(repeating: "x", count: BridgeProtocol.maxMessageBytes))\"")
            let message = try JSONSerialization.jsonObject(with: Data(rebuilt.utf8), options: .fragmentsAllowed)
            return Fixture(name: name, message: message, verdict: verdict)
        }
    }

    @Test("every golden message gets the verdict the TypeScript schema gives it")
    func goldenVerdicts() throws {
        let fixtures = try Self.fixtures()
        #expect(fixtures.count >= 30)
        var disagreements: [String] = []
        for fixture in fixtures {
            let code = BridgeValidator.validate(fixture.message).code
            if code != fixture.verdict { disagreements.append("\(fixture.name): swift \(code), ts \(fixture.verdict)") }
        }
        #expect(
            disagreements.isEmpty,
            "\(disagreements.count) of \(fixtures.count): \(disagreements.joined(separator: "; "))")
        #expect(fixtures.contains { $0.verdict == "ok" } && fixtures.contains { $0.verdict != "ok" })
    }
}

@Suite("Bridge router")
@MainActor
struct BridgeRouterTests {
    let route: [String: Any] = [
        "v": 1, "type": "route.changed", "body": ["route": "/papers/", "anchor": NSNull(), "title": "Papers"],
    ]

    private func decide(
        _ body: Any, main: Bool = true, scheme: String = "am-edition", host: String = "edition", now: TimeInterval = 0,
        limiter: inout BridgeRateLimiter
    ) -> BridgeVerdict {
        BridgeRouter.decide(
            body: body, from: BridgeRouter.Sender(isMainFrame: main, scheme: scheme, host: host), now: now,
            limiter: &limiter)
    }

    @Test("accepts a valid message from the edition's main frame")
    func accepts() {
        var limiter = BridgeRateLimiter()
        #expect(decide(route, limiter: &limiter).code == "ok")
    }

    @Test("refuses a subframe and a foreign origin before reading the message")
    func frameAndOrigin() {
        var limiter = BridgeRateLimiter()
        #expect(decide(route, main: false, limiter: &limiter).code == "not-main-frame")
        #expect(decide(route, scheme: "https", host: "annus-mirabilis.com", limiter: &limiter).code == "foreign-origin")
        #expect(decide(route, host: "elsewhere", limiter: &limiter).code == "foreign-origin")
    }

    @Test("refuses the 51st message of one type within a second, and not another type")
    func rateLimit() {
        var limiter = BridgeRateLimiter()
        for index in 0..<50 {
            #expect(decide(route, now: Double(index) / 100, limiter: &limiter).code == "ok")
        }
        #expect(decide(route, now: 0.6, limiter: &limiter).code == "rate-limited")
        #expect(decide(["v": 1, "type": "hello", "body": [:]], now: 0.6, limiter: &limiter).code == "ok")
        #expect(decide(route, now: 1.6, limiter: &limiter).code == "ok")
    }
}

@Suite("Bridge handlers")
@MainActor
struct BridgeHandlerTests {
    private func message(_ type: String, _ body: [String: JSONValue]) -> BridgeMessage {
        BridgeMessage(type: type, body: body)
    }

    @Test("share.request hands the website URL to the share sheet, and says unavailable with nothing to show it")
    func share() {
        let router = BridgeRouter()
        let url = "https://annus-mirabilis.com/papers/brownian-motion/#s4"
        #expect(router.handle(message("share.request", ["url": .string(url)]))["status"] as? String == "unavailable")
        var shared: [URL] = []
        router.onShare = { shared.append($0) }
        #expect(router.handle(message("share.request", ["url": .string(url)]))["status"] as? String == "ok")
        #expect(shared == [URL(string: url)!])
    }

    @Test("settings.changed passes the theme on; a type this build does not serve says unavailable")
    func settingsAndUnserved() {
        let router = BridgeRouter()
        var themes: [String] = []
        router.onTheme = { themes.append($0) }
        #expect(router.handle(message("settings.changed", ["theme": .string("system")]))["status"] as? String == "ok")
        #expect(themes == ["system"])
        let print = router.handle(message("print.request", [:]))
        #expect(print["status"] as? String == "unavailable")
    }
}

@Suite("Reader data kept by the app")
@MainActor
struct ReaderDataStoreTests {
    private func store() -> ReaderDataStore {
        ReaderDataStore(
            directory: FileManager.default.temporaryDirectory.appendingPathComponent("reader-data-\(UUID().uuidString)")
        )
    }

    @Test("reads back what it wrote, and reads missing before any write")
    func roundTrip() {
        let data = store()
        #expect(data.read(namespace: "localStorage", key: "snapshot") == .missing)
        #expect(data.write(namespace: "localStorage", key: "snapshot", value: #"{"am:notebook:v1":"[1]"}"#))
        #expect(data.read(namespace: "localStorage", key: "snapshot") == .value(#"{"am:notebook:v1":"[1]"}"#))
    }

    @Test("a name that tries to leave the directory still lands inside it")
    func pathSafety() {
        let data = store()
        let url = data.fileURL(namespace: "../../..", key: "/etc/passwd")
        // Compared as paths: the same folder can differ only by a trailing slash as a URL.
        #expect(url.deletingLastPathComponent().standardizedFileURL.path == data.directory.standardizedFileURL.path)
        #expect(url.lastPathComponent.count == 64 + ".json".count)
    }

    @Test("bytes that are not text read as corrupt, not as a value")
    func corrupt() throws {
        let data = store()
        #expect(data.write(namespace: "n", key: "k", value: "x"))
        try Data([0xFF, 0xFE, 0xFD]).write(to: data.fileURL(namespace: "n", key: "k"))
        #expect(data.read(namespace: "n", key: "k") == .corrupt)
    }

    @Test("the router serves storage.read and storage.write, and says unavailable without a store")
    func router() {
        let router = BridgeRouter()
        let read = BridgeMessage(
            type: "storage.read", body: ["namespace": .string("localStorage"), "key": .string("snapshot")])
        #expect(router.handle(read)["status"] as? String == "unavailable")
        router.store = store()
        #expect(router.handle(read)["status"] as? String == "missing")
        let write = BridgeMessage(
            type: "storage.write",
            body: ["namespace": .string("localStorage"), "key": .string("snapshot"), "value": .string("{}")])
        #expect(router.handle(write)["status"] as? String == "ok")
        let reply = router.handle(read)
        #expect(reply["status"] as? String == "ok")
        #expect(reply["value"] as? String == "{}")
    }

    @Test("an accepted write is reported to the app with its namespace, key and value; a refused one is not")
    func writeIsReported() throws {
        let router = BridgeRouter()
        var reported: [[String]] = []
        router.onStorageWrite = { reported.append([$0, $1, $2]) }
        router.store = store()
        let write = BridgeMessage(
            type: "storage.write",
            body: ["namespace": .string("localStorage"), "key": .string("snapshot"), "value": .string("{}")])
        #expect(router.handle(write)["status"] as? String == "ok")
        #expect(reported == [["localStorage", "snapshot", "{}"]])

        // A store whose directory is a file cannot write: the page hears "quota", the app hears nothing.
        let blocked = FileManager.default.temporaryDirectory.appendingPathComponent("blocked-\(UUID().uuidString)")
        try Data("a file, not a folder".utf8).write(to: blocked)
        router.store = ReaderDataStore(directory: blocked)
        #expect(router.handle(write)["status"] as? String == "quota")
        #expect(reported.count == 1)
    }

    /// A UI test's evidence hears each message's type and outcome, and a storage message's namespace,
    /// never its body, so the reader's data stays out of the log (bead am-app-test-harness-da6e).
    @Test
    func evidenceHearsTypesNotBodies() {
        let router = BridgeRouter()
        router.store = store()
        var heard: [[String]] = []
        router.onMessage = { heard.append([$0, $1, $2 ?? "-"]) }
        var console: [[String]] = []
        router.onTestLog = { console.append([$0, $1]) }
        var snapshots: [String] = []
        router.onTestSnapshot = { snapshots.append($0) }
        let note: [String: JSONValue] = [
            "namespace": .string("localStorage"), "key": .string("am:notes:v1"), "value": .string("a private note"),
        ]
        _ = router.serve(BridgeMessage(type: "storage.write", body: note))
        _ = router.serve(BridgeMessage(type: "route.changed", body: ["route": .string("/"), "title": .string("Home")]))
        _ = router.serve(BridgeMessage(type: "test.log", body: ["level": .string("warn"), "message": .string("x")]))
        _ = router.serve(BridgeMessage(type: "test.snapshot", body: ["route": .string("/")]))
        #expect(
            heard == [
                ["storage.write", "ok", "localStorage"], ["route.changed", "ok", "-"], ["test.log", "ok", "-"],
                ["test.snapshot", "ok", "-"],
            ])
        #expect(!heard.joined().contains { $0.contains("private") || $0.contains("am:notes") })
        #expect(console == [["warn", "x"]])
        #expect(snapshots == ["/"])
    }
}

@Suite("Bridge script integrity")
struct BridgeScriptTests {
    private func directory(with script: String) throws -> URL {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("bridge-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        try Data(script.utf8).write(to: dir.appendingPathComponent("bridge-user-script.js"))
        return dir
    }

    @Test("loads a script whose digest matches, and refuses one that differs, is missing, or has no entry")
    func digest() throws {
        let source = "(function(){})();"
        let dir = try directory(with: source)
        let good = EditionManifest.UserScript(
            id: "bridge", file: "bridge-user-script.js", sha256: BridgeScript.sha256Hex(Data(source.utf8)))
        #expect(BridgeScript.load(good, directory: dir) == source)

        let tampered = try directory(with: source + "alert(1);")
        #expect(BridgeScript.load(good, directory: tampered) == nil)
        let missing = EditionManifest.UserScript(id: "bridge", file: "absent.js", sha256: good.sha256)
        #expect(BridgeScript.load(missing, directory: dir) == nil)
        #expect(BridgeScript.load(nil, directory: dir) == nil)
    }

    @Test("the script bundled in this build verifies and defines the bridge")
    func bundled() throws {
        let catalog = try EditionCatalog.load(from: .main)
        let source = try #require(catalog.verifiedBridgeScript())
        #expect(source.contains("__AM_APP__"))
        #expect(source.contains(BridgeProtocol.handlerName))
    }
}
