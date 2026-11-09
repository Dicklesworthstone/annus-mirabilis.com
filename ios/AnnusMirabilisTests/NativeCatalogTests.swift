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

    @Test("older catalogues keep their paper rows without optional library metadata")
    func olderLibrary() throws {
        let catalog = try Self.decode(papers: [Self.paper("mass-energy", sections: [Self.section("s0")])])
        let paper = try #require(catalog.papers.available.first)
        #expect(paper.workingTitle == nil && paper.locator == nil && paper.pageCount == nil)
        #expect(paper.firstPage == nil && paper.lastPage == nil && paper.availabilityNotice == nil)
        #expect(catalog.portrait == nil && catalog.problems.isEmpty)
    }

    @Test("library metadata decodes from the export while a damaged portrait leaves paper navigation available")
    func libraryMetadata() throws {
        let paper = #"""
            {"slug":"mass-energy","name":"Mass and energy","title":"A title","germanTitle":"Ein Titel",
             "description":"A paper","route":"/papers/mass-energy/","sections":[],
             "workingTitle":"Working translation","locator":"Annalen der Physik (4) 18, 639–641 (1905)",
             "pageCount":3,"firstPage":639,"lastPage":641,"availabilityNotice":"Not yet available: the English translation."}
            """#
        let portrait = #"""
            {"path":"/figures/photographs/einstein-patent-office-480.webp","alt":"Portrait",
             "credit":"Archive credit","recordURL":"https://doi.org/10.3932/ethz-a-000495740"}
            """#
        func decode(_ image: String) throws -> NativeCatalog {
            let json = #"{"schemaVersion":"annus-mirabilis-native-catalog.v1","papers":[\#(paper)],"discover":[],"labs":[],"portrait":\#(image)}"#
            return try JSONDecoder().decode(NativeCatalog.self, from: Data(json.utf8))
        }
        let catalog = try decode(portrait)
        let row = try #require(catalog.papers.available.first)
        #expect(row.workingTitle == "Working translation")
        #expect(row.locator == "Annalen der Physik (4) 18, 639–641 (1905)")
        #expect(row.pageCount == 3 && row.firstPage == 639 && row.lastPage == 641)
        #expect(row.availabilityNotice == "Not yet available: the English translation.")
        #expect(catalog.portrait?.value?.credit == "Archive credit")
        #expect(catalog.problems.isEmpty)

        let damaged = try decode(#"{"path":7}"#)
        #expect(damaged.papers.available == catalog.papers.available)
        #expect(damaged.portrait?.value == nil)
        #expect(damaged.problems.count == 1)
        #expect(damaged.problems.first?.hasPrefix("portrait.path:") == true)
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

// MARK: - The bundled web search engine in JavaScriptCore

@Suite("Native search uses the edition's query engine")
struct NativeSearchEngineTests {
    @Test("the shipping module loads its pinned index once and an empty query has no results")
    func bundledSearch() async throws {
        let catalog = try EditionCatalog.load()
        let entry = try #require(catalog.nativeSearch)
        let engine = NativeSearchEngine(catalog: catalog)
        let metadata = try await engine.load()
        #expect(metadata.buildDigest == entry.buildDigest)
        #expect(metadata.documentCount == entry.totalDocuments)
        #expect(metadata.typeLabels["instrument"] == "Laboratories")
        #expect(try await engine.search("").isEmpty)
        let firstDuration = await engine.coldLoadDuration
        #expect(firstDuration != nil)
        #expect(try await engine.load() == metadata)
        #expect(await engine.coldLoadDuration == firstDuration)
    }

    @Test("ordinary language, Unicode units, a person and German all query the actual shipped module")
    func fixtureQueries() async throws {
        let fixture = try NativeSearchFixture.make()
        let engine = NativeSearchEngine(catalog: fixture.catalog)
        let queries = [
            ("clocks disagree", "clocks"),
            ("0.8 μ", "brownian"),
            ("Besso", "besso"),
            ("die Gleichzeitigkeit", "german"),
        ]
        for (query, expected) in queries {
            let hits = try await engine.search(query)
            #expect(hits.first?.id == expected, "fixture query \(query)")
        }
        #expect(try await engine.search("Besso", paper: "brownian-motion").isEmpty)
        #expect(try await engine.search("Besso", type: "instrument").isEmpty)
        let hit = try #require(try await engine.search("clocks disagree").first)
        #expect(hit.href == "/papers/special-relativity/?view=english#clocks")
        #expect(hit.destination(in: fixture.catalog)?.absoluteString
            == "am-edition://edition/papers/special-relativity/?view=english#clocks")
    }

    @Test("query text is passed as a value and cannot execute JavaScript")
    func queryIsData() async throws {
        let engine = NativeSearchEngine(catalog: try NativeSearchFixture.make().catalog)
        _ = try await engine.search("'); throw new Error('injected'); ('")
        #expect(try await engine.search("Besso").first?.id == "besso")
        do {
            _ = try await engine.search(String(repeating: "🕰", count: 129))
            Issue.record("a query beyond the web engine's UTF-16 limit was accepted")
        } catch let error as NativeSearchError {
            #expect(error == .queryTooLong(256))
        }
    }

    @Test("a missing search entry and a damaged script or shard cannot start a partial index")
    func refusedFiles() async throws {
        let fixture = try NativeSearchFixture.make()
        var oldManifest = fixture.manifest
        oldManifest.nativeSearch = nil
        let old = try EditionCatalog(root: fixture.catalog.root, manifest: oldManifest)
        do {
            _ = try await NativeSearchEngine(catalog: old).load()
            Issue.record("an edition with no native search entry started search")
        } catch let error as NativeSearchError {
            #expect(error == .notIncluded)
        }

        for path in [fixture.scriptPath, fixture.shardPath] {
            let damaged = try NativeSearchFixture.make()
            let target = path == fixture.scriptPath ? damaged.scriptPath : damaged.shardPath
            try Data("changed after export".utf8).write(
                to: damaged.catalog.root.appendingPathComponent(target), options: .atomic)
            let engine = NativeSearchEngine(catalog: damaged.catalog)
            do {
                _ = try await engine.load()
                Issue.record("search loaded bytes that do not match the pinned \(target)")
            } catch let error as NativeSearchError {
                #expect(error == .damagedFile(target))
            }
            #expect(await engine.coldLoadDuration == nil)
        }
    }

    @Test("valid checksums cannot admit a record refused by the shared web schema")
    func invalidIndexEnvelope() async throws {
        let fixture = try NativeSearchFixture.make(invalidDocument: true)
        let engine = NativeSearchEngine(catalog: fixture.catalog)
        do {
            _ = try await engine.load()
            Issue.record("the shared schema accepted an external document route")
        } catch let error as NativeSearchError {
            #expect(error == .invalidManifest)
        }
        #expect(await engine.coldLoadDuration == nil)
    }

    @Test("search destinations preserve query and anchor but never open an outside or non-HTML URL")
    func destinations() throws {
        let catalog = try NativeSearchFixture.make().catalog
        let valid = NativeSearchFixture.hit(
            "english", href: "/papers/special-relativity/?view=english&detail=2#s1-p2")
        #expect(valid.destination(in: catalog)?.absoluteString
            == "am-edition://edition/papers/special-relativity/?view=english&detail=2#s1-p2")
        for href in [
            "https://annus-mirabilis.com/papers/special-relativity/",
            "//example.com/papers/special-relativity/",
            "javascript:alert(1)", "/search/index-manifest.json", "/missing/",
            "/papers/%2e%2e/native/search-query.js", "/papers/%2fspecial-relativity/",
        ] {
            #expect(NativeSearchFixture.hit("bad", href: href).destination(in: catalog) == nil, "\(href)")
        }
    }
}

/// A small explicit corpus passed to the REAL bundled query script, not a second ranking function.
/// These files are test inputs; they are never represented as the shipping edition's contents.
struct NativeSearchFixture {
    let catalog: EditionCatalog
    let manifest: EditionManifest
    let scriptPath: String
    let shardPath: String

    static func make(invalidDocument: Bool = false) throws -> NativeSearchFixture {
        let shipping = try EditionCatalog.load()
        let script = try #require(shipping.nativeSearch?.queryScript)
        let scriptData = try Data(contentsOf: shipping.root.appendingPathComponent(script.file))
        #expect(scriptData.count == script.bytes)
        #expect(BridgeScript.sha256Hex(scriptData) == script.sha256)

        var documents: [[String: Any]] = [
            document("clocks", title: "Clocks disagree", text: "Distant clocks disagree.", face: "english"),
            document("besso", title: "Michele Besso", text: "Michele Besso", type: "person"),
            document(
                "german", title: "Gleichzeitigkeit", text: "Wir wollen die Gleichzeitigkeit bestimmen.",
                type: "sentence-de", language: "de", face: "german"),
            document(
                "brownian", title: "Brownian displacement", text: "The particle radius is 0.8 micrometre.",
                paper: "brownian-motion"),
        ]
        if invalidDocument { documents[0]["route"] = "https://example.com/" }
        let shard = try JSONSerialization.data(
            withJSONObject: ["schemaVersion": 1, "documents": documents, "aliases": []],
            options: [.sortedKeys])
        let shardDigest = BridgeScript.sha256Hex(shard)
        let shardPath = "search/s-\(shardDigest).json"
        let buildDigest = String(repeating: "a", count: 64)
        let index = try JSONSerialization.data(
            withJSONObject: [
                "schemaVersion": 1, "buildDigest": buildDigest, "profile": "scaffold",
                "totalDocuments": documents.count,
                "shards": [[
                    "path": "/" + shardPath, "sha256": shardDigest, "bytes": shard.count,
                    "gzipBytes": 1, "documents": documents.count,
                ]],
            ], options: [.sortedKeys])
        return try write(
            payloads: [
                script.file: scriptData, "search/index-manifest.json": index, shardPath: shard,
                "index.html": Data("<p>Fixture</p>".utf8),
                "papers/special-relativity/index.html": Data("<p>Fixture</p>".utf8),
                "papers/brownian-motion/index.html": Data("<p>Fixture</p>".utf8),
            ],
            script: script, shardPath: shardPath, buildDigest: buildDigest, count: documents.count)
    }

    private static func write(
        payloads: [String: Data], script: EditionManifest.NativeSearchScript,
        shardPath: String, buildDigest: String, count: Int
    ) throws -> NativeSearchFixture {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("native-search-\(UUID().uuidString)/Edition", isDirectory: true)
        var files: [EditionManifest.File] = []
        for (path, data) in payloads {
            let url = root.appendingPathComponent(path)
            try FileManager.default.createDirectory(
                at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: url, options: .atomic)
            let contentType: String
            if path.hasSuffix(".html") {
                contentType = "text/html"
            } else if path.hasSuffix(".js") {
                contentType = "text/javascript"
            } else {
                contentType = "application/json"
            }
            files.append(
                .init(path: path, sha256: BridgeScript.sha256Hex(data), size: data.count, contentType: contentType))
        }
        var manifest = EditionManifest(
            schemaVersion: EditionCatalog.schemaVersion, editionDigest: "fixture", files: files)
        manifest.nativeSearch = .init(
            schemaVersion: NativeSearchEngine.schemaVersion, queryScript: script,
            manifestPath: "search/index-manifest.json", buildDigest: buildDigest, totalDocuments: count)
        return NativeSearchFixture(
            catalog: try EditionCatalog(root: root, manifest: manifest), manifest: manifest,
            scriptPath: script.file, shardPath: shardPath)
    }

    private static func document(
        _ id: String, title: String, text: String, type: String = "argument",
        paper: String = "special-relativity", language: String = "en", face: String = ""
    ) -> [String: Any] {
        [
            "id": id, "type": type, "paper": paper, "section": "s1", "lang": language,
            "title": title, "text": text, "terms": [], "route": "/papers/\(paper)/",
            "anchor": id, "face": face, "scopeLabel": "Test fixture",
        ]
    }

    static func hit(_ id: String, type: String = "argument", href: String = "/papers/special-relativity/#s1")
        -> NativeSearchHit
    {
        NativeSearchHit(
            id: id, type: type, paper: "special-relativity", section: "s1", lang: "en",
            title: id, route: "/papers/special-relativity/", anchor: "s1", face: "",
            scopeLabel: "Test fixture", score: 1, snippet: id, aliasLabel: nil, href: href)
    }
}
