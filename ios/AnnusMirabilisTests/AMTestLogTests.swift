import Foundation
import Testing

@testable import AnnusMirabilis

/// AMTestLog writes the record shape the gate validates with the web's own schema: the same fields as
/// scripts/app/fixtures/amtestlog-record.json, which scripts/app/test-records.test.ts validates.
@Suite("Test-log records")
@MainActor
struct AMTestLogTests {
    private func fixture() throws -> [String: Any] {
        let url = try #require(
            Bundle(for: AMTestLogToken.self).url(forResource: "amtestlog-record", withExtension: "json"))
        return try #require(try JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }

    @Test("a record has the fixture's fields, with app fields in extra, and the schema's formats")
    func shape() throws {
        let expected = try fixture()
        let data = AMTestLog.record(
            suite: "app-lifecycle", testId: "t", outcome: "passed", durationMs: 1, beadId: "b", paper: "p",
            anchor: "a", message: "m", extra: ["webProcessTerminations": 1])
        let record = try #require(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        #expect(Set(record.keys) == Set(expected.keys))
        let extra = try #require(record["extra"] as? [String: Any])
        let expectedExtra = try #require(expected["extra"] as? [String: Any])
        #expect(Set(extra.keys) == Set(expectedExtra.keys))
        let timestamp = try #require(record["timestamp"] as? String)
        #expect(timestamp.wholeMatch(of: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/) != nil, "\(timestamp)")
        let run = try #require(record["logRunId"] as? String)
        #expect(run.wholeMatch(of: /\d{8}T\d{6}Z-[0-9a-f]{8}/) != nil, "\(run)")
    }

    @Test("this catalogue test leaves a record for the gate")
    func catalogueRecord() throws {
        let catalog = try #require(try EditionCatalog.load().verifiedNativeCatalog())
        // The catalogue now loads even when a record or its digest fails; the message holds only when none did.
        #expect(catalog.problems.isEmpty, "\(catalog.problems)")
        let record = AMTestLog.record(
            suite: "app-catalog", testId: "AMTestLogTests.catalogueRecord", outcome: "passed", browser: false,
            beadId: "am-app-test-harness-da6e", message: "the bundled native catalogue verifies",
            extra: [
                "papers": catalog.papers.available.count, "destinations": catalog.destinations.count,
                "problems": catalog.problems.count,
            ])
        Attachment.record(record, named: "\(AMTestLog.attachmentPrefix)-catalogue.json")
    }
}

/// Finds the test bundle, where the fixture is a resource.
private final class AMTestLogToken {}
