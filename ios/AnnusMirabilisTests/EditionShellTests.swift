import Foundation
import Testing
import WebKit

@testable import AnnusMirabilis

private func shellCatalog(includeBrownian: Bool = true, withNativePapers: Bool = false) throws -> EditionCatalog {
    var pages = [
        "index.html", "papers/light-quanta/index.html", "lab/bm-01/index.html",
        "discover/brownian-motion/index.html", "foundations/diffusion/index.html", "notebook/index.html",
    ]
    if includeBrownian {
        pages += ["papers/brownian-motion/index.html", "papers/brownian-motion/s4/index.html"]
    }
    var files = pages.map {
        EditionManifest.File(path: $0, sha256: "", size: 0, contentType: "text/html; charset=utf-8")
    }
    files.append(.init(path: "papers/brownian-motion/data.json", sha256: "", size: 0, contentType: "application/json"))
    var root = URL(fileURLWithPath: "/nonexistent-shell-fixture")
    var manifest = EditionManifest(
        schemaVersion: EditionCatalog.schemaVersion, editionDigest: "shell-fixture", files: files)
    if withNativePapers {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("shell-native-\(UUID())")
        root = directory.appendingPathComponent("Edition", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let slugs = includeBrownian ? ["brownian-motion", "light-quanta"] : ["light-quanta"]
        let papers: [[String: Any]] = slugs.map { slug in
            ["slug": slug, "name": slug, "title": "Fixture title", "germanTitle": "Titel",
             "description": "Fixture paper", "route": "/papers/\(slug)/", "sections": [] as [Any]]
        }
        let body: [String: Any] = [
            "schemaVersion": NativeCatalog.schemaVersion, "papers": papers,
            "discover": [] as [Any], "labs": [] as [Any],
        ]
        let bytes = try JSONSerialization.data(withJSONObject: body)
        try bytes.write(to: directory.appendingPathComponent("native-catalog.json"))
        manifest.nativeCatalog = .init(file: "native-catalog.json", sha256: BridgeScript.sha256Hex(bytes))
    }
    return try EditionCatalog(root: root, manifest: manifest)
}

private func shellURL(_ path: String) -> URL {
    URL(string: "am-edition://edition" + path)!
}

@Suite("Native shell navigation preserves one reader")
struct EditionShellStateTests {
    @Test("route classification uses whole path segments and rejects foreign origins")
    func classification() {
        let cases: [(String, EditionShellSection)] = [
            ("/papers/brownian-motion/s4/?view=german&detail=2#s4-p2", .read),
            ("/discover/brownian-motion/", .discover), ("/1904/", .discover),
            ("/tours/one-hour/", .discover), ("/connections/", .discover), ("/timeline/", .discover),
            ("/lab/bm-01/?tape=bounded#controls", .lab), ("/instruments/", .lab),
            ("/search/", .search), ("/foundations/diffusion/", .more), ("/notebook/", .more),
            ("/laboratory/", .more), ("/papers-not-a-paper/", .more),
        ]
        for (path, expected) in cases {
            #expect(EditionShellSection.destination(for: shellURL(path)) == expected)
        }
        for address in [
            "https://annus-mirabilis.com/papers/brownian-motion/",
            "am-edition://elsewhere/papers/brownian-motion/",
            "am-edition://user@edition/papers/brownian-motion/",
            "am-edition://edition:443/papers/brownian-motion/",
        ] {
            #expect(EditionShellSection.destination(for: URL(string: address)!) == nil)
        }
    }

    @Test("native screens keep the exact parked query and anchor and ignore late reader reports")
    func parkedPassage() throws {
        let catalog = try shellCatalog()
        let page = shellURL("/papers/brownian-motion/s4/?view=german&detail=2#s4-p2")
        var state = EditionShellState()
        #expect(state.reveal(page, in: catalog))
        #expect(state.section == .read && state.showingReader)
        let location = try #require(state.location)
        #expect(location.url(in: catalog) == page)
        for section in EditionShellSection.allCases {
            state.select(section)
            state.remember(location, in: catalog)
            #expect(state.section == section)
            #expect(!state.showingReader)
            #expect(state.location?.url(in: catalog) == page)
        }
        #expect(state.reveal(page, in: catalog))
        #expect(state.section == .read && state.showingReader)
        #expect(state.location?.query == "view=german&detail=2")
        #expect(state.location?.anchor == "s4-p2")
    }

    @Test("revealing a route selects its own section without dropping instrument tapes")
    func deepLink() throws {
        let catalog = try shellCatalog()
        var state = EditionShellState()
        state.select(.search)
        let url = shellURL("/lab/bm-01/?tape=bounded%2Fseed#controls")
        #expect(state.reveal(url, in: catalog))
        #expect(state.section == .lab && state.showingReader)
        #expect(state.location?.url(in: catalog) == url)
        state.showContents()
        #expect(state.section == .lab && !state.showingReader)
    }

    @Test("a PDF can be viewed without replacing the last restorable HTML passage")
    func pdfKeepsPassage() throws {
        let catalog = try shellCatalog()
        var state = EditionShellState()
        state.reveal(shellURL("/papers/brownian-motion/#s4"), in: catalog)
        let saved = state.location
        #expect(state.reveal(shellURL("/papers/pdfs/ap-17-549.pdf#page=3"), in: catalog))
        #expect(state.showingReader && state.section == .read)
        #expect(state.location == saved)
        #expect(!state.reveal(URL(string: "https://example.com/")!, in: catalog))
        #expect(state.location == saved)
    }

    @Test("scene restoration preserves native selection and exact passage independently")
    func restoration() throws {
        let catalog = try shellCatalog()
        var original = EditionShellState()
        original.reveal(shellURL("/papers/brownian-motion/?detail=2#s4"), in: catalog)
        original.select(.discover)
        let restored = EditionShellState.restored(from: original.serialized, fallback: nil, in: catalog)
        #expect(restored == original)
        #expect(restored.section == .discover && !restored.showingReader)
        let removed = EditionShellState.restored(
            from: original.serialized, fallback: nil, in: try shellCatalog(includeBrownian: false))
        #expect(removed.location == nil && removed.section == .discover)
        original.reveal(shellURL("/papers/brownian-motion/#s4"), in: catalog)
        let noLongerPresent = EditionShellState.restored(
            from: original.serialized, fallback: nil, in: try shellCatalog(includeBrownian: false))
        #expect(!noLongerPresent.showingReader && noLongerPresent.location == nil)
        let mismatched = original.serialized.replacingOccurrences(of: "\"read\"", with: "\"search\"")
        let repaired = EditionShellState.restored(from: mismatched, fallback: nil, in: catalog)
        #expect(repaired.showingReader && repaired.section == .read)
        #expect(repaired.location == original.location)
    }

    @Test("bad or future scene state falls back to a valid saved passage; a fresh launch opens Read")
    func invalidState() throws {
        let catalog = try shellCatalog()
        let saved = ReaderLocation(path: "/papers/light-quanta/", query: "view=german", anchor: "s1")
        for bad in ["not json", #"{"version":2,"section":"read","showingReader":true}"#,
                    #"{"version":1,"section":"unknown","showingReader":true}"#, String(repeating: "x", count: 16_385)]
        {
            let state = EditionShellState.restored(from: bad, fallback: saved, in: catalog)
            #expect(state.showingReader && state.section == .read)
            #expect(state.location == saved)
        }
        let fresh = EditionShellState.restored(from: nil, fallback: nil, in: catalog)
        #expect(fresh.section == .read && !fresh.showingReader && fresh.location == nil)
    }

    @Test("native cover and background both hide a lab, while reopening never resumes in the background")
    func effectiveVisibility() throws {
        let catalog = try shellCatalog()
        var state = EditionShellState()
        state.reveal(shellURL("/lab/bm-01/"), in: catalog)
        #expect(state.readerIsVisible(sceneInForeground: true))
        #expect(!state.readerIsVisible(sceneInForeground: true, coveredByNativePresentation: true))
        #expect(!state.readerIsVisible(sceneInForeground: false))
        state.select(.search)
        #expect(!state.readerIsVisible(sceneInForeground: true))
        state.reveal(shellURL("/lab/bm-01/"), in: catalog)
        #expect(!state.readerIsVisible(sceneInForeground: false))
        #expect(state.readerIsVisible(sceneInForeground: true))
    }
}

@Suite("Private per-paper reading positions")
@MainActor
struct PaperReadingPositionsTests {
    private let admitted: Set<String> = ["brownian-motion", "light-quanta"]

    @Test("each paper keeps its latest section, query and anchor without overwriting another")
    func perPaper() throws {
        let catalog = try shellCatalog()
        let defaults = UserDefaults(suiteName: "paper-positions-\(UUID())")!
        let store = ReaderLocationStore(defaults: defaults)
        let brownian = ReaderLocation(path: "/papers/brownian-motion/", query: "view=german", anchor: "s3")
        let light = ReaderLocation(path: "/papers/light-quanta/", query: "detail=2", anchor: "s6")
        let later = ReaderLocation(path: "/papers/brownian-motion/s4/", query: "view=english&detail=1", anchor: "arg-bm-diffusion")
        for location in [brownian, light, later] {
            store.savePaperPosition(location, in: catalog, admitted: admitted)
        }
        let loaded = ReaderLocationStore(defaults: defaults).paperPositions(in: catalog, admitted: admitted)
        #expect(loaded == ["brownian-motion": later, "light-quanta": light])
        #expect(loaded["brownian-motion"]?.url(in: catalog) == shellURL("/papers/brownian-motion/s4/?view=english&detail=1#arg-bm-diffusion"))
        let nextEdition = store.paperPositions(in: try shellCatalog(includeBrownian: false), admitted: admitted)
        #expect(nextEdition == ["light-quanta": light])
    }

    @Test("only exact admitted paper segments and existing HTML pages can become positions")
    func refusesUnrelated() throws {
        let catalog = try shellCatalog()
        let defaults = UserDefaults(suiteName: "paper-positions-refusals-\(UUID())")!
        let store = ReaderLocationStore(defaults: defaults)
        for path in ["/papers/brownian-motion-extra/", "/lab/bm-01/", "/notebook/",
                     "/papers/brownian-motion/data.json", "/papers/brownian-motion/removed/"]
        {
            store.savePaperPosition(ReaderLocation(path: path, query: nil, anchor: nil), in: catalog, admitted: admitted)
        }
        #expect(store.paperPositions(in: catalog, admitted: admitted).isEmpty)
        #expect(defaults.object(forKey: ReaderLocationStore.positionsKey) == nil)
    }

    @Test("clear affects native passage addresses only, and malformed stored maps grant no positions")
    func clearAndCorruption() throws {
        let catalog = try shellCatalog()
        let defaults = UserDefaults(suiteName: "paper-positions-clear-\(UUID())")!
        let store = ReaderLocationStore(defaults: defaults)
        let saved = ReaderLocation(path: "/papers/brownian-motion/", query: nil, anchor: "s4")
        defaults.set("private note", forKey: "am:notebook:v1")
        defaults.set(["clocks"], forKey: NativeSearchRecents.key)
        store.save(saved)
        store.savePaperPosition(saved, in: catalog, admitted: admitted)
        store.clearReadingPositions()
        #expect(store.load() == nil && store.paperPositions(in: catalog, admitted: admitted).isEmpty)
        #expect(defaults.string(forKey: "am:notebook:v1") == "private note")
        #expect(defaults.stringArray(forKey: NativeSearchRecents.key) == ["clocks"])
        for bad in ["not json", #"{"version":2,"locations":{}}"#,
                    #"{"version":1,"locations":{"light-quanta":{"version":1,"path":"/papers/brownian-motion/"}}}"#]
        {
            defaults.set(Data(bad.utf8), forKey: ReaderLocationStore.positionsKey)
            #expect(store.paperPositions(in: catalog, admitted: admitted).isEmpty)
        }
    }

    @Test("corrupt escapes are rejected before Foundation's percent-encoded URL setters")
    func corruptEncodedLocation() throws {
        let catalog = try shellCatalog()
        for bad in ["%", "%X0", "%0X", "a b", "\n", "ümlaut"] {
            #expect(ReaderLocation(path: "/papers/brownian-motion/", query: bad, anchor: nil).url(in: catalog) == nil)
            #expect(ReaderLocation(path: "/papers/brownian-motion/", query: nil, anchor: bad).url(in: catalog) == nil)
        }
        let good = ReaderLocation(path: "/papers/brownian-motion/", query: "q=%C3%BC&detail=2", anchor: "s4%20p2")
        #expect(good.url(in: catalog)?.absoluteString == "am-edition://edition/papers/brownian-motion/?q=%C3%BC&detail=2#s4%20p2")
    }
}

@Suite("The shell reuses its reader session")
@MainActor
struct EditionShellSessionTests {
    @Test("overlapping native sheets pause the reader until every cover is dismissed")
    func presentationVisibility() throws {
        let catalog = try shellCatalog()
        let defaults = UserDefaults(suiteName: "shell-cover-\(UUID())")!
        let session = EditionSession(catalog: catalog, store: ReaderLocationStore(defaults: defaults))
        session.revealReader(shellURL("/lab/bm-01/"))
        session.sceneDidChange(.active)
        #expect(session.readerIsVisible)
        let first = UUID()
        let second = UUID()
        session.setReaderCover(first, presented: true)
        session.setReaderCover(first, presented: true)
        session.setReaderCover(second, presented: true)
        #expect(!session.readerIsVisible)
        session.setReaderCover(first, presented: false)
        #expect(!session.readerIsVisible)
        session.sceneDidChange(.background)
        session.setReaderCover(second, presented: false)
        #expect(!session.readerIsVisible)
        session.sceneDidChange(.active)
        #expect(session.readerIsVisible)
        session.selectShellSection(.read)
        #expect(!session.readerIsVisible)
    }

    @Test("selection and return preserve WebKit identity and never request navigation")
    func preservesSession() throws {
        let catalog = try shellCatalog()
        let defaults = UserDefaults(suiteName: "shell-session-\(UUID())")!
        let session = EditionSession(catalog: catalog, store: ReaderLocationStore(defaults: defaults))
        let view = session.webView
        let page = shellURL("/lab/bm-01/?tape=bounded#controls")
        session.didChange(url: page)
        session.revealReader(page)
        for section in EditionShellSection.allCases {
            session.selectShellSection(section)
            #expect(session.webView === view)
            #expect(session.currentURL == page && session.lastRequestedURL == nil)
            #expect(!session.shell.readerIsVisible(sceneInForeground: true))
        }
        session.revealReader(try #require(session.parkedReaderURL))
        #expect(session.webView === view)
        #expect(session.shell.section == .lab && session.shell.showingReader)
        #expect(session.lastRequestedURL == nil)
    }

    @Test("a bridge report preserves its query and decoded anchor, and clear removes the saved location")
    func bridgePosition() throws {
        let catalog = try shellCatalog()
        let defaults = UserDefaults(suiteName: "shell-bridge-position-\(UUID())")!
        let store = ReaderLocationStore(defaults: defaults)
        let session = EditionSession(catalog: catalog, store: store)
        session.didReceiveRoute(route: "/papers/brownian-motion/?view=german&detail=2", anchor: "s4 p2", title: "A paper")
        #expect(store.load()?.url(in: catalog) == shellURL("/papers/brownian-motion/?view=german&detail=2#s4%20p2"))
        session.clearReadingPositions()
        #expect(store.load() == nil && session.shell.location == nil && session.paperPositions.isEmpty)
    }

    @Test("web-process recovery preserves each window's passage and selection despite shared defaults")
    func recoveryBelongsToScene() throws {
        let catalog = try shellCatalog()
        let defaults = UserDefaults(suiteName: "shell-two-windows-\(UUID())")!
        let store = ReaderLocationStore(defaults: defaults)
        let first = EditionSession(catalog: catalog, store: store)
        let second = EditionSession(catalog: catalog, store: store)
        let firstPage = shellURL("/papers/brownian-motion/?view=german&detail=2#s4%20p2")
        let secondPage = shellURL("/lab/bm-01/?tape=bounded%2Fseed#controls")

        first.didChange(url: firstPage)
        first.revealReader(firstPage)
        first.selectShellSection(.discover)
        second.didChange(url: secondPage)
        second.revealReader(secondPage)
        #expect(store.load()?.url(in: catalog) == secondPage)

        first.recoverFromTermination()
        #expect(first.lastRequestedURL == firstPage)
        #expect(first.shell.location?.url(in: catalog) == firstPage)
        #expect(first.shell.section == .discover && !first.shell.showingReader)

        second.recoverFromTermination()
        #expect(second.lastRequestedURL == secondPage)
        #expect(second.shell.location?.url(in: catalog) == secondPage)
        #expect(second.shell.section == .lab && second.shell.showingReader)
    }

    @Test("Read entry and foreground refresh another window's saved or cleared paper positions")
    func sharedPositionsRefresh() throws {
        let catalog = try shellCatalog(withNativePapers: true)
        let defaults = UserDefaults(suiteName: "shell-shared-positions-\(UUID())")!
        let store = ReaderLocationStore(defaults: defaults)
        let first = EditionSession(catalog: catalog, store: store)
        let second = EditionSession(catalog: catalog, store: store)
        let native = try #require(second.nativeCatalog)
        #expect(native.problems.isEmpty)
        #expect(native.papers.available.map(\.slug).contains("brownian-motion"))
        let early = shellURL("/papers/brownian-motion/?view=german#s1")
        let later = shellURL("/papers/brownian-motion/s4/?detail=2#arg-bm-diffusion")

        first.didChange(url: early)
        #expect(second.paperPositions.isEmpty)
        second.selectShellSection(.read)
        #expect(second.paperPositions["brownian-motion"]?.url(in: catalog) == early)

        first.didChange(url: later)
        second.sceneDidChange(.active)
        #expect(second.paperPositions["brownian-motion"]?.url(in: catalog) == later)

        second.revealReader(shellURL("/papers/light-quanta/#s1"))
        first.clearReadingPositions()
        second.showShellContents()
        #expect(second.paperPositions.isEmpty)

        first.didChange(url: later)
        second.selectShellSection(.read)
        #expect(second.paperPositions["brownian-motion"]?.url(in: catalog) == later)
        first.clearReadingPositions()
        second.sceneDidChange(.background)
        second.sceneDidChange(.active)
        #expect(second.paperPositions.isEmpty)
    }
}
