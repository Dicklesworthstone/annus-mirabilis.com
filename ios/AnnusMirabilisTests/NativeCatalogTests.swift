import Foundation
import Testing

@testable import AnnusMirabilis

/// The native screens' data: verified by its digest, and every page it opens is a page this
/// build carries (the export refuses otherwise; this checks the bundle the app actually has).
@Suite("The native catalogue")
struct NativeCatalogTests {
    @Test("this build's catalogue verifies, and every page it opens is an HTML page of the edition")
    func bundled() throws {
        let edition = try EditionCatalog.load()
        let catalog = try #require(edition.verifiedNativeCatalog(), "the catalogue is missing or fails its digest")
        #expect(catalog.papers.map(\.slug) == ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"])
        #expect(catalog.papers.allSatisfy { !$0.sections.isEmpty })
        #expect(!catalog.discover.isEmpty && !catalog.labs.isEmpty)
        for destination in catalog.destinations {
            let url = try #require(EditionCatalog.url(route: destination.route, anchor: destination.anchor))
            guard case .file(let file) = edition.resolve(url) else {
                Issue.record("\(destination.route) is not in the edition")
                continue
            }
            #expect(file.contentType.hasPrefix("text/html"), "\(destination.route)")
        }
    }

    @Test("a catalogue whose bytes differ from the recorded digest, or of another schema, is refused")
    func refused() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("catalog-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let good = Data(
            #"{"schemaVersion":"annus-mirabilis-native-catalog.v1","papers":[],"discover":[],"labs":[]}"#.utf8)
        try good.write(to: directory.appendingPathComponent("c.json"))
        let entry = EditionManifest.CatalogFile(file: "c.json", sha256: BridgeScript.sha256Hex(good))
        #expect(NativeCatalog.load(entry, directory: directory) != nil)

        let other = EditionManifest.CatalogFile(file: "c.json", sha256: String(repeating: "0", count: 64))
        #expect(NativeCatalog.load(other, directory: directory) == nil)
        #expect(NativeCatalog.load(nil, directory: directory) == nil)

        let future = Data(
            #"{"schemaVersion":"annus-mirabilis-native-catalog.v2","papers":[],"discover":[],"labs":[]}"#.utf8)
        try future.write(to: directory.appendingPathComponent("f.json"))
        let futureEntry = EditionManifest.CatalogFile(file: "f.json", sha256: BridgeScript.sha256Hex(future))
        #expect(NativeCatalog.load(futureEntry, directory: directory) == nil)
    }
}
