import Foundation
import Testing
import UIKit
import WebKit

@testable import AnnusMirabilis

private func freshDefaults() -> UserDefaults {
    // A new suite per test: nothing is shared, and nothing needs deleting afterwards.
    UserDefaults(suiteName: "annus-mirabilis-tests-\(UUID().uuidString)")!
}

private func syntheticCatalog() throws -> EditionCatalog {
    let html = "text/html; charset=utf-8"
    return try EditionCatalog(
        root: URL(fileURLWithPath: "/nonexistent"),
        manifest: EditionManifest(
            schemaVersion: EditionCatalog.schemaVersion,
            editionDigest: "test",
            files: [
                .init(path: "index.html", sha256: "", size: 0, contentType: html),
                .init(path: "404.html", sha256: "", size: 0, contentType: html),
                .init(path: "papers/brownian-motion/index.html", sha256: "", size: 0, contentType: html),
                .init(path: "papers/light-quanta/facsimile.json", sha256: "", size: 0, contentType: "application/json"),
            ]))
}

@Suite("The website address of an edition page")
struct SiteURLTests {
    @Test("keeps the path, the face or Detail query, and the anchor")
    func mapping() {
        let url = SiteURL.canonical(for: URL(string: "am-edition://edition/papers/brownian-motion/?view=german#s4")!)
        #expect(url == URL(string: "https://annus-mirabilis.com/papers/brownian-motion/?view=german#s4"))
        #expect(SiteURL.canonical(for: EditionCatalog.homeURL) == URL(string: "https://annus-mirabilis.com/"))
    }

    @Test(
        "has no website address for anything outside the edition",
        arguments: ["https://example.com/", "am-edition://elsewhere/papers/", "about:blank"])
    func outside(link: String) {
        #expect(SiteURL.canonical(for: URL(string: link)!) == nil)
    }
}

@Suite("Where the reader left off")
struct ReaderLocationTests {
    @Test("an edition page is remembered with its query and anchor, and comes back as the same address")
    func roundTrip() throws {
        let catalog = try syntheticCatalog()
        let page = URL(string: "am-edition://edition/papers/brownian-motion/?detail=2#s4-p2")!
        let location = try #require(ReaderLocation(editionURL: page, catalog: catalog))
        #expect(location.display == "/papers/brownian-motion/?detail=2#s4-p2")
        #expect(location.url(in: catalog) == page)
    }

    @Test(
        "a 404, a data file, or a foreign address is never remembered",
        arguments: [
            "am-edition://edition/no-such-page/", "am-edition://edition/papers/light-quanta/facsimile.json",
            "https://annus-mirabilis.com/papers/brownian-motion/",
        ])
    func notRemembered(link: String) throws {
        #expect(ReaderLocation(editionURL: URL(string: link)!, catalog: try syntheticCatalog()) == nil)
    }

    @Test("a page this edition no longer has opens nothing, so the app falls back to the home page")
    func pageGone() throws {
        let gone = ReaderLocation(path: "/papers/retired-section/", query: nil, anchor: "s2")
        let catalog = try syntheticCatalog()
        #expect(gone.url(in: catalog) == nil)
        #expect(EditionStore.startURL(launchURL: nil, saved: gone, catalog: catalog) == EditionCatalog.homeURL)
    }

    @Test("a route given at launch wins over the remembered page, which wins over home")
    func startOrder() throws {
        let catalog = try syntheticCatalog()
        let saved = ReaderLocation(path: "/papers/brownian-motion/", query: nil, anchor: "s4")
        let launch = URL(string: "am-edition://edition/")!
        #expect(EditionStore.startURL(launchURL: launch, saved: saved, catalog: catalog) == launch)
        #expect(
            EditionStore.startURL(launchURL: nil, saved: saved, catalog: catalog)
                == URL(string: "am-edition://edition/papers/brownian-motion/#s4"))
        #expect(EditionStore.startURL(launchURL: nil, saved: nil, catalog: catalog) == EditionCatalog.homeURL)
    }

    @Test("the store reads back what it wrote, and reads a corrupt or future record as nothing")
    func store() throws {
        let defaults = freshDefaults()
        let store = ReaderLocationStore(defaults: defaults)
        #expect(store.load() == nil)
        let location = ReaderLocation(path: "/papers/brownian-motion/", query: "view=german", anchor: nil)
        store.save(location)
        #expect(store.load() == location)

        defaults.set(Data("not json".utf8), forKey: ReaderLocationStore.key)
        #expect(store.load() == nil)
        let future = #"{"version":2,"path":"/papers/","query":null,"anchor":null}"#
        defaults.set(Data(future.utf8), forKey: ReaderLocationStore.key)
        #expect(store.load() == nil)
    }
}

@Suite("A reader session")
@MainActor
struct EditionSessionTests {
    @Test("a page change is remembered and handed off as the website address")
    func pageChange() throws {
        let defaults = freshDefaults()
        let session = EditionSession(catalog: try syntheticCatalog(), store: ReaderLocationStore(defaults: defaults))
        session.didChange(url: URL(string: "am-edition://edition/papers/brownian-motion/#s4")!)

        #expect(ReaderLocationStore(defaults: defaults).load()?.display == "/papers/brownian-motion/#s4")
        #expect(session.handoff.activityType == NSUserActivityTypeBrowsingWeb)
        #expect(session.handoff.webpageURL == URL(string: "https://annus-mirabilis.com/papers/brownian-motion/#s4"))
        #expect(session.canonicalURL == session.handoff.webpageURL)
        #expect(session.webView.isFindInteractionEnabled)
    }

    @Test("a 404 keeps the last real page remembered")
    func notFoundIsNotRemembered() throws {
        let defaults = freshDefaults()
        let session = EditionSession(catalog: try syntheticCatalog(), store: ReaderLocationStore(defaults: defaults))
        session.didChange(url: URL(string: "am-edition://edition/papers/brownian-motion/")!)
        session.didChange(url: URL(string: "am-edition://edition/no-such-page/")!)
        #expect(ReaderLocationStore(defaults: defaults).load()?.path == "/papers/brownian-motion/")
    }

}

@Suite("The reader's theme before the page loads")
@MainActor
struct PageThemePrepaintTests {
    @Test("a saved dark choice is painted the moment the session exists, before any page report")
    func savedDark() throws {
        let defaults = freshDefaults()
        PageThemeStore(defaults: defaults).save("kramgasse-night")
        let session = EditionSession(
            catalog: try syntheticCatalog(), store: ReaderLocationStore(defaults: defaults),
            themeStore: PageThemeStore(defaults: defaults))
        #expect(session.pageColorScheme == .dark)
        let band = try #require(session.webView.backgroundColor)
        var white: CGFloat = 0
        band.getWhite(&white, alpha: nil)
        #expect(white < 0.2, "the band behind the status bar starts dark, white = \(white)")
    }

    @Test("with no saved choice nothing is overridden, and a report of 'system' is saved as such")
    func systemIsRemembered() throws {
        let defaults = freshDefaults()
        let themes = PageThemeStore(defaults: defaults)
        let session = EditionSession(
            catalog: try syntheticCatalog(), store: ReaderLocationStore(defaults: defaults), themeStore: themes)
        #expect(session.pageColorScheme == nil)
        session.didReceiveTheme("kramgasse-night")
        #expect(themes.load() == "kramgasse-night")
        session.didReceiveTheme("system")
        #expect(session.pageColorScheme == nil)
        #expect(themes.load() == "system")
    }
}

@Suite("Private recent searches")
@MainActor
struct NativeSearchRecentsTests {
    @Test("typing writes nothing; explicit searches deduplicate, bound and clear only their own namespace")
    func storage() {
        let defaults = UserDefaults(suiteName: "native-search-recents-\(UUID().uuidString)")!
        let store = NativeSearchRecents(defaults: defaults)
        defaults.set("keep this", forKey: "reader-note")
        #expect(store.load().isEmpty)
        #expect(defaults.object(forKey: NativeSearchRecents.key) == nil)
        for index in 0..<12 { store.record("query \(index)") }
        #expect(store.load().count == 10)
        #expect(store.load().first == "query 11")
        store.record("  query 5  ")
        #expect(store.load().first == "query 5")
        #expect(store.load().filter { $0 == "query 5" }.count == 1)
        store.record(String(repeating: "x", count: 257))
        store.record("\u{0000}")
        #expect(store.load().count == 10)
        store.clear()
        #expect(store.load().isEmpty)
        #expect(defaults.string(forKey: "reader-note") == "keep this")
    }
}

@Suite("Native search presentation")
@MainActor
struct NativeSearchModelTests {
    @Test("a slow superseded result cannot overwrite the next query, and typing stores no recent query")
    func superseded() async {
        let engine = ControlledNativeSearch()
        let defaults = UserDefaults(suiteName: "native-search-model-\(UUID().uuidString)")!
        let recents = NativeSearchRecents(defaults: defaults)
        let model = NativeSearchModel(engine: engine, recents: recents)
        let first = Task { await model.update(query: "first", debounce: false) }
        await engine.waitForFirst()
        await model.update(query: "second", debounce: false)
        #expect(model.hits.map(\.id) == ["second"])
        await engine.releaseFirst()
        await first.value
        #expect(model.hits.map(\.id) == ["second"])
        #expect(model.phase == .results)
        #expect(recents.load().isEmpty)
        model.remember("second")
        #expect(recents.load() == ["second"])
        model.clearRecents()
        #expect(model.recentQueries.isEmpty)
    }

    @Test("cancellation discards an in-flight result")
    func cancelled() async {
        let engine = ControlledNativeSearch()
        let model = NativeSearchModel(
            engine: engine,
            recents: NativeSearchRecents(
                defaults: UserDefaults(suiteName: "native-search-cancel-\(UUID().uuidString)")!))
        let task = Task { await model.update(query: "first", debounce: false) }
        await engine.waitForFirst()
        task.cancel()
        await engine.releaseFirst()
        await task.value
        #expect(model.hits.isEmpty)
        #expect(model.phase == .idle)
    }

    @Test("group headings never change the engine's ranked order")
    func rankedGroups() async {
        let model = NativeSearchModel(
            engine: ControlledNativeSearch(),
            recents: NativeSearchRecents(
                defaults: UserDefaults(suiteName: "native-search-groups-\(UUID().uuidString)")!))
        await model.update(query: "groups", debounce: false)
        #expect(model.hits.map(\.id) == ["one", "two", "three"])
        #expect(model.groups.flatMap(\.hits).map(\.id) == ["one", "two", "three"])
        #expect(model.groups.map(\.type) == ["argument", "person", "argument"])
    }

    @Test("Command-K on the reader opens the native search presentation")
    func keyboardCommand() throws {
        let fixture = try NativeSearchFixture.make()
        let session = EditionSession(
            catalog: fixture.catalog,
            store: ReaderLocationStore(defaults: UserDefaults(suiteName: "native-search-key-\(UUID().uuidString)")!))
        let command = try #require(session.webView.keyCommands?.last {
            $0.input == "k" && $0.modifierFlags.contains(.command)
        })
        #expect(command.wantsPriorityOverSystemBehavior)
        #expect(UIApplication.shared.sendAction(command.action, to: session.webView, from: command, for: nil))
        #expect(session.showingSearch)
    }
}

/// A delayed response, only for presentation races; engine tests above always run the shipped JS.
private actor ControlledNativeSearch: NativeSearchQuerying {
    private var firstStarted = false
    private var started: CheckedContinuation<Void, Never>?
    private var pending: CheckedContinuation<Void, Never>?

    func load() -> NativeSearchMetadata {
        NativeSearchMetadata(
            schemaVersion: NativeSearchEngine.schemaVersion, buildDigest: String(repeating: "a", count: 64),
            profile: "scaffold", documentCount: 3, papers: ["special-relativity"],
            typeLabels: ["argument": "Arguments", "person": "People"], limits: .init(queryCharacters: 256, results: 30))
    }

    func search(_ query: String, paper: String, type: String) async -> [NativeSearchHit] {
        if query == "first" {
            firstStarted = true
            started?.resume()
            started = nil
            await withCheckedContinuation { pending = $0 }
        }
        if query == "groups" {
            return [
                NativeSearchFixture.hit("one"),
                NativeSearchFixture.hit("two", type: "person"),
                NativeSearchFixture.hit("three"),
            ]
        }
        return [NativeSearchFixture.hit(query)]
    }

    func waitForFirst() async {
        if firstStarted { return }
        await withCheckedContinuation { started = $0 }
    }

    func releaseFirst() {
        pending?.resume()
        pending = nil
    }
}
