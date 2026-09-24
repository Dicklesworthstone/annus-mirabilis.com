import Foundation
import Testing

@testable import AnnusMirabilis

/// scripts/app/fixtures/evidence-folders.json, which the gate's tests read too.
private struct EvidenceFolderCases: Decodable {
    struct Case: Decodable {
        let launch: String
        let folder: String
    }
    let cases: [Case]
}

/// What a UI-test launch keeps for a failing test (bead am-app-test-harness-da6e, requirement 5).
@MainActor
@Suite("Test evidence")
struct TestEvidenceTests {
    private final class Token {}

    private func caches() throws -> URL {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("evidence-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    /// The app and the gate name a test's folder alike: the gate's cases, from the same file.
    @Test
    func foldersAreNamedAsTheGateNamesThem() throws {
        let url = try #require(Bundle(for: Token.self).url(forResource: "evidence-folders", withExtension: "json"))
        let cases = try JSONDecoder().decode(EvidenceFolderCases.self, from: Data(contentsOf: url)).cases
        #expect(!cases.isEmpty)
        for entry in cases {
            #expect(TestEvidence.folder(for: entry.launch) == entry.folder)
        }
        #expect(TestEvidence.folder(for: nil) == "unnamed")
    }

    /// Each event is one JSON line in the launch's folder, after the launch's own line.
    @Test
    func eventsAreJSONLines() throws {
        let root = try caches()
        let evidence = try #require(TestEvidence(testId: "HarnessUITests/testX", caches: root))
        #expect(evidence.directory.path.contains("/AMTestEvidence/HarnessUITests_testX/"))
        evidence.record("console", ["level": "warn", "message": "a \"quoted\"\nline"])
        let text = try String(contentsOf: evidence.directory.appendingPathComponent("events.jsonl"), encoding: .utf8)
        let lines = text.split(separator: "\n").map {
            try? JSONSerialization.jsonObject(with: Data($0.utf8)) as? [String: String]
        }
        #expect(lines.count == 2)
        #expect(lines.first??["kind"] == "launch")
        #expect(lines.last??["kind"] == "console")
        #expect(lines.last??["message"] == "a \"quoted\"\nline")
        #expect(lines.last??["at"]?.hasSuffix("Z") == true)
    }

    /// The main document's markup comes out of a web archive; anything else is not read.
    @Test
    func theDocumentComesOutOfAWebArchive() throws {
        let archive = try PropertyListSerialization.data(
            fromPropertyList: ["WebMainResource": ["WebResourceData": Data("<html data-theme=\"x\"></html>".utf8)]],
            format: .binary, options: 0)
        #expect(TestEvidence.mainResource(of: archive) == Data("<html data-theme=\"x\"></html>".utf8))
        #expect(TestEvidence.mainResource(of: Data("not a plist".utf8)) == nil)
    }

    /// A page larger than the limit is cut there, and the header says both sizes.
    @Test
    func aLargePageIsBounded() {
        let large = Data(repeating: 0x61, count: TestEvidence.domLimit + 10)
        let kept = TestEvidence.bounded(large, route: "/a--b/")
        let header = String(bytes: kept.prefix(while: { $0 != 0x0A }), encoding: .utf8) ?? ""
        let sizes = "bytes=\(TestEvidence.domLimit + 10) kept=\(TestEvidence.domLimit)"
        #expect(header == "<!-- am-test-evidence route=/a- -b/ \(sizes) -->")
        #expect(kept.count == header.utf8.count + 1 + TestEvidence.domLimit)
    }
}
