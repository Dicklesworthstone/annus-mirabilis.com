import Foundation
import Testing

@testable import AnnusMirabilis

/// The native screens' data: verified by its digest, and every page it opens is a page this
/// build carries (the export refuses otherwise; this checks the bundle the app actually has).
@Suite("The native catalogue")
struct NativeCatalogTests {
    /// The shipping-payload test (bead am-app-native-payloads-bued, requirement 4): every record of
    /// the catalogue this build bundles decodes. `seededRecordFailsTheShippingCheck` shows the same
    /// check is not empty on a catalogue that has one bad record.
    @Test("this build's catalogue verifies, every record decodes, and every page it opens is in the edition")
    func bundled() throws {
        let edition = try EditionCatalog.load()
        let catalog = try #require(edition.verifiedNativeCatalog(), "the export recorded no catalogue")
        for problem in catalog.problems {
            Issue.record("an unavailable catalogue record or list: \(problem)")
        }
        let papers = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"]
        #expect(catalog.papers.available.map(\.slug) == papers)
        #expect(catalog.papers.available.allSatisfy { !$0.sections.isEmpty })
        #expect(!catalog.discover.available.isEmpty && !catalog.labs.available.isEmpty)
        for destination in catalog.destinations {
            let url = try #require(EditionCatalog.url(route: destination.route, anchor: destination.anchor))
            guard case .file(let file) = edition.resolve(url) else {
                Issue.record("\(destination.route) is not in the edition")
                continue
            }
            #expect(file.contentType.hasPrefix("text/html"), "\(destination.route)")
        }
    }

    @Test("a record that does not decode is one unavailable entry, and every other record loads")
    func seededInvalidRecord() throws {
        let catalog = try Self.decode(
            papers: [
                Self.paper("a", sections: [Self.section("s1"), Self.section("s2")]),
                #"{"slug":"b","name":"B","title":7,"germanTitle":"","description":"","route":"/papers/b/","#
                    + #""sections":[]}"#,
                Self.paper("c", sections: [Self.section("s1"), #"{"id":"s2","title":"S2","route":"/papers/c/"}"#]),
            ],
            labs: [#"{"paper":"a","name":"A","instruments":[{"id":"lq-01","name":"One","route":"/lab/lq-01/"},5]}"#]
        )

        #expect(catalog.papers.records.count == 3)
        #expect(catalog.papers.available.map(\.slug) == ["a", "c"])
        guard case .unavailable(let key, let reason) = catalog.papers.records[1] else {
            Issue.record("the paper with a numeric title decoded")
            return
        }
        #expect(key == "b")
        #expect(reason.hasPrefix("papers[1].title:"), "\(reason)")

        // A bad section leaves its paper and the paper's other sections in place.
        let third = try #require(catalog.papers.available.last)
        #expect(third.sections.compactMap(\.value).map(\.id) == ["s1"])
        #expect(third.sections[1].problem == "s2: papers[2].sections[1].anchor: missing")

        // A bad instrument leaves its group and the group's other instruments in place.
        let group = try #require(catalog.labs.available.first)
        #expect(group.instruments.compactMap(\.value).map(\.id) == ["lq-01"])

        #expect(catalog.problems.count == 3, "\(catalog.problems)")
        #expect(catalog.destinations.map(\.route).contains("/papers/c/"))
    }

    @Test("the shipping check the bundled catalogue passes fails on a seeded invalid record")
    func seededRecordFailsTheShippingCheck() throws {
        let clean = try Self.decode(papers: [Self.paper("a", sections: [Self.section("s1")])])
        #expect(clean.problems.isEmpty)
        let seeded = try Self.decode(papers: [
            Self.paper("a", sections: [Self.section("s1")]), #"{"slug":"b"}"#,
        ])
        #expect(seeded.problems.count == 1)
        #expect(seeded.problems.first?.hasPrefix("b: papers[1].") == true, "\(seeded.problems)")
    }

    @Test("a list that is not a list fails that screen only")
    func failedList() throws {
        let data = Data(
            #"""
            {"schemaVersion":"annus-mirabilis-native-catalog.v1","papers":[],"discover":{"slug":"x"},"labs":[]}
            """#.utf8)
        let catalog = try JSONDecoder().decode(NativeCatalog.self, from: data)
        #expect(catalog.papers == .loaded([]))
        #expect(catalog.labs == .loaded([]))
        guard case .failed(let reason) = catalog.discover else {
            Issue.record("a discover object decoded as a list")
            return
        }
        #expect(reason.hasPrefix("discover:"), "\(reason)")
    }

    @Test("bytes that fail the recorded digest or name another schema fail every screen; no entry, no screens")
    func refused() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("catalog-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let good = Data(
            #"{"schemaVersion":"annus-mirabilis-native-catalog.v1","papers":[],"discover":[],"labs":[]}"#.utf8)
        try good.write(to: directory.appendingPathComponent("c.json"))
        let entry = EditionManifest.CatalogFile(file: "c.json", sha256: BridgeScript.sha256Hex(good))
        let loaded = try #require(NativeCatalog.load(entry, directory: directory))
        #expect(loaded.problems.isEmpty)

        let other = EditionManifest.CatalogFile(file: "c.json", sha256: String(repeating: "0", count: 64))
        Self.expectEveryListFailed(NativeCatalog.load(other, directory: directory), naming: "digest")
        let absent = EditionManifest.CatalogFile(file: "absent.json", sha256: BridgeScript.sha256Hex(good))
        Self.expectEveryListFailed(NativeCatalog.load(absent, directory: directory), naming: "not in the edition")
        #expect(NativeCatalog.load(nil, directory: directory) == nil)

        let future = Data(
            #"{"schemaVersion":"annus-mirabilis-native-catalog.v2","papers":[],"discover":[],"labs":[]}"#.utf8)
        try future.write(to: directory.appendingPathComponent("f.json"))
        let futureEntry = EditionManifest.CatalogFile(file: "f.json", sha256: BridgeScript.sha256Hex(future))
        Self.expectEveryListFailed(NativeCatalog.load(futureEntry, directory: directory), naming: "v2")
    }

    private static func expectEveryListFailed(
        _ catalog: NativeCatalog?, naming: String, sourceLocation: SourceLocation = #_sourceLocation
    ) {
        guard let catalog else {
            Issue.record("no catalogue at all, where every list should say it failed", sourceLocation: sourceLocation)
            return
        }
        for reason in [failure(catalog.papers), failure(catalog.discover), failure(catalog.labs)] {
            #expect(reason?.contains(naming) == true, "\(String(describing: reason))", sourceLocation: sourceLocation)
        }
    }

    private static func failure<Value>(_ list: CatalogList<Value>) -> String? {
        if case .failed(let reason) = list { reason } else { nil }
    }

    private static func paper(_ slug: String, sections: [String]) -> String {
        #"{"slug":"\#(slug)","name":"\#(slug)","title":"T","germanTitle":"G","description":"D","#
            + #""route":"/papers/\#(slug)/","sections":[\#(sections.joined(separator: ","))]}"#
    }

    private static func section(_ id: String) -> String {
        #"{"id":"\#(id)","title":"\#(id)","route":"/papers/x/","anchor":"\#(id)"}"#
    }

    private static func decode(papers: [String], labs: [String] = []) throws -> NativeCatalog {
        let json =
            #"{"schemaVersion":"annus-mirabilis-native-catalog.v1","papers":[\#(papers.joined(separator: ","))],"#
            + #""discover":[],"labs":[\#(labs.joined(separator: ","))]}"#
        return try JSONDecoder().decode(NativeCatalog.self, from: Data(json.utf8))
    }
}
