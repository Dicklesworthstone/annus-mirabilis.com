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
