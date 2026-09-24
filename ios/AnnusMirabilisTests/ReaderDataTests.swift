import Foundation
import Testing

@testable import AnnusMirabilis

/// The app's list and export of the reader's data, held to the site: readerDataExport.json is
/// computed by the site's own `exportNamespaces` (src/platform/app-bridge/readerData.test.ts
/// fails when it goes stale), and the app must write the same document from the same data.
@Suite("The reader's data, listed and exported by the app")
@MainActor
struct ReaderDataTests {
    struct Case: Decodable {
        let name: String
        let registry: [ReaderDataManifest.Entry]
        let storage: [String: String]
        let prefix: String?
        let exportedAt: String
    }

    private static let snapshot = ReaderDataManifest.Record(namespace: "localStorage", key: "snapshot")

    private func fixture() throws -> (cases: [Case], expected: [NSDictionary]) {
        let bundle = Bundle(for: ReaderDataFixtureToken.self)
        let url = try #require(bundle.url(forResource: "readerDataExport", withExtension: "json"))
        let data = try Data(contentsOf: url)
        let cases = try JSONDecoder().decode([Case].self, from: data)
        let raw = try #require(try JSONSerialization.jsonObject(with: data) as? [[String: Any]])
        let expected = try raw.map { try #require($0["expected"] as? NSDictionary) }
        return (cases, expected)
    }

    private func date(_ text: String) throws -> Date {
        try Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(text)
    }

    /// The snapshot the page's mirror would write for these values.
    private func snapshotText(_ item: Case) throws -> String {
        try #require(String(bytes: try JSONSerialization.data(withJSONObject: item.storage), encoding: .utf8))
    }

    private func store() -> ReaderDataStore {
        ReaderDataStore(
            directory: FileManager.default.temporaryDirectory.appendingPathComponent("reader-data-\(UUID().uuidString)")
        )
    }

    @Test("the file the app writes is the document the site writes, case by case")
    func fileMatchesTheSite() throws {
        let (cases, expected) = try fixture()
        #expect(!cases.isEmpty)
        for (index, item) in cases.enumerated() {
            let data = ReaderData(
                manifest: ReaderDataManifest(snapshot: Self.snapshot, registry: item.registry), values: item.storage)
            let exported = data.export(prefix: item.prefix, at: try date(item.exportedAt))
            let written = try JSONSerialization.jsonObject(with: exported.jsonData()) as? NSDictionary
            #expect(written == expected[index], "\(item.name): the file differs from the site's")
            #expect(
                NSDictionary(dictionary: exported.replyObject()) == expected[index],
                "\(item.name): the bridge reply differs from the site's")
            #expect(exported.suggestedFilename == "annus-mirabilis-data-2026-09-24.json")
        }
    }

    @Test("a stored document is written with its own bytes, so no number or character is rewritten")
    func documentsKeepTheirBytes() throws {
        let (cases, _) = try fixture()
        let item = try #require(cases.first)
        let data = ReaderData(
            manifest: ReaderDataManifest(snapshot: Self.snapshot, registry: item.registry), values: item.storage)
        let text = try #require(String(data: data.export(at: try date(item.exportedAt)).jsonData(), encoding: .utf8))
        let notes = try #require(item.storage["am:discovery-notes:v1:brownian-motion"])
        #expect(text.contains(notes))
    }

    @Test("storage.list names the registered keys the app holds, in the registry's order, narrowed by a prefix")
    func list() throws {
        let (cases, _) = try fixture()
        let item = try #require(cases.first)
        let router = BridgeRouter()
        let list = { (prefix: String) in
            router.handle(BridgeMessage(type: "storage.list", body: ["namespace": .string(prefix)]))
        }
        #expect(list("am:")["status"] as? String == "unavailable", "no store, no registry")

        router.store = store()
        router.readerData = ReaderDataManifest(snapshot: Self.snapshot, registry: item.registry)
        #expect(list("am:")["value"] as? [String] == [], "nothing saved yet reads as an empty list")

        #expect(router.store?.write(namespace: "localStorage", key: "snapshot", value: try snapshotText(item)) == true)
        let registered = item.registry.map(\.key).filter { item.storage[$0] != nil }
        #expect(list("am:")["value"] as? [String] == registered)
        #expect(!registered.contains("am:unregistered:v1"))
        #expect(
            list("am:discovery-notes:v1:")["value"] as? [String]
                == ["am:discovery-notes:v1:brownian-motion", "am:discovery-notes:v1:mass-energy"])
        #expect(list("am:tours:v1")["value"] as? [String] == ["am:tours:v1"])

        #expect(router.store?.write(namespace: "localStorage", key: "snapshot", value: "{not json") == true)
        #expect(list("am:")["status"] as? String == "corrupt")
    }

    @Test("storage.export answers with the site's document for everything, or for one namespace")
    func export() throws {
        let (cases, expected) = try fixture()
        let everything = try #require(
            cases.firstIndex { $0.prefix == nil && $0.name == "everything registered" })
        let one = try #require(cases.firstIndex { $0.prefix == "am:discovery-notes:v1:brownian-motion" })
        let item = cases[everything]
        let router = BridgeRouter()
        router.store = store()
        router.readerData = ReaderDataManifest(snapshot: Self.snapshot, registry: item.registry)
        router.now = {
            (try? Date.ISO8601FormatStyle(includingFractionalSeconds: true).parse(item.exportedAt)) ?? Date()
        }
        #expect(router.store?.write(namespace: "localStorage", key: "snapshot", value: try snapshotText(item)) == true)

        let all = router.handle(BridgeMessage(type: "storage.export", body: [:]))
        #expect(all["status"] as? String == "ok")
        #expect((all["value"] as? [String: Any]).map(NSDictionary.init(dictionary:)) == expected[everything])

        let single = router.handle(
            BridgeMessage(type: "storage.export", body: ["namespace": .string("am:discovery-notes:v1:brownian-motion")])
        )
        #expect((single["value"] as? [String: Any]).map(NSDictionary.init(dictionary:)) == expected[one])
    }

    @Test("one row's export is exactly that namespace, as the site exports it by name")
    func exportOneKey() throws {
        let (cases, expected) = try fixture()
        let index = try #require(cases.firstIndex { $0.prefix == "am:discovery-notes:v1:brownian-motion" })
        let item = cases[index]
        let data = ReaderData(
            manifest: ReaderDataManifest(snapshot: Self.snapshot, registry: item.registry), values: item.storage)
        let exported = data.export(key: "am:discovery-notes:v1:brownian-motion", at: try date(item.exportedAt))
        #expect(NSDictionary(dictionary: exported.replyObject()) == expected[index])
        // A key is not a prefix here: "am:discovery-notes:v1:" names no single namespace.
        #expect(data.export(key: "am:discovery-notes:v1:", at: try date(item.exportedAt)).namespaces.isEmpty)
    }

    @Test("this build's edition carries the site's registry and names the mirror's record")
    func bundledRegistry() throws {
        let catalog = try EditionCatalog.load()
        let readerData = try #require(catalog.readerData, "the export did not record the reader-data registry")
        #expect(readerData.snapshot == Self.snapshot)
        #expect(!readerData.registry.isEmpty)
        #expect(readerData.registry.allSatisfy { $0.key.hasPrefix("am:") && !$0.label.isEmpty })
        #expect(readerData.registry.contains { $0.key == "am:tours:v1" && $0.kind == "document" })
    }
}

/// Finds the test bundle, where the fixture is a resource.
private final class ReaderDataFixtureToken {}
