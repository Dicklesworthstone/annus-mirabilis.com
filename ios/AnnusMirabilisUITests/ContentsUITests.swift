import XCTest

/// The native Contents screens open the edition where the reader chose: a paper's section, a
/// Discover route, an instrument. The page's own route report is the evidence of arrival.
final class ContentsUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    private func waitForRoute(_ route: String, in app: XCUIApplication) {
        let arrived = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", route), object: app.webViews["edition-web-view"])
        XCTAssertEqual(
            XCTWaiter().wait(for: [arrived], timeout: 30), .completed,
            "the page reported \(app.webViews["edition-web-view"].value ?? "nothing"), not \(route)")
    }

    @MainActor
    private func openContents(_ app: XCUIApplication) {
        app.buttons["page-actions"].tap()
        let contents = app.buttons["Contents"]
        XCTAssertTrue(contents.waitForExistence(timeout: 10), "the menu has no Contents")
        contents.tap()
    }

    @MainActor
    private func keep(_ app: XCUIApplication, _ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    @MainActor
    func testContentsOpensASectionARouteAndAnInstrument() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-AMUITest", "-AMStateSuite", "uitest-\(UUID().uuidString)", "-AMOpenRoute", "/"]
        app.launch(for: self)
        waitForRoute("/", in: app)

        // A paper's outline, then one of its sections.
        openContents(app)
        let paper = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Brownian motion'")).firstMatch
        XCTAssertTrue(paper.waitForExistence(timeout: 10), "the library has no Brownian motion")
        keep(app, "contents-papers")
        paper.tap()
        let section = app.buttons["§4 · From random displacement to diffusion"]
        XCTAssertTrue(section.waitForExistence(timeout: 10), "the outline has no §4")
        keep(app, "contents-outline")
        section.tap()
        waitForRoute("/papers/brownian-motion/#s4", in: app)

        // A Discover route.
        openContents(app)
        app.buttons["Discover"].tap()
        let route = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Brownian motion'")).firstMatch
        XCTAssertTrue(route.waitForExistence(timeout: 10))
        route.tap()
        let start = app.buttons["Open the route"]
        XCTAssertTrue(start.waitForExistence(timeout: 10))
        keep(app, "contents-discover-route")
        start.tap()
        waitForRoute("/discover/brownian-motion/", in: app)

        // An instrument.
        openContents(app)
        app.buttons["Instruments"].tap()
        let instrument = app.buttons["Tracer ensemble"]
        // The Brownian group follows the nine light-quanta instruments, below the first screen.
        for _ in 0..<8 where !instrument.isHittable {
            app.swipeUp()
        }
        XCTAssertTrue(instrument.waitForExistence(timeout: 10), "the catalogue has no bm-01")
        keep(app, "contents-instruments")
        instrument.tap()
        waitForRoute("/lab/bm-01/", in: app)
    }

    @MainActor
    func testNativeSearchOpensAnInstrumentAndClearsPrivateRecents() throws {
        let app = XCUIApplication()
        let suite = "uitest-search-\(UUID().uuidString)"
        app.launchArguments = ["-AMUITest", "-AMStateSuite", suite, "-AMOpenRoute", "/"]
        app.launch(for: self)
        waitForRoute("/", in: app)

        let search = app.buttons["native-search"]
        XCTAssertTrue(search.waitForExistence(timeout: 10))
        search.tap()
        let field = app.searchFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10), "native search has no searchable field")
        field.tap()
        field.typeText("Tracer ensemble")
        let tracer = app.buttons.matching(
            NSPredicate(
                format: "identifier BEGINSWITH %@ AND label BEGINSWITH %@",
                "native-search-result-", "Tracer ensemble")).firstMatch
        XCTAssertTrue(tracer.waitForExistence(timeout: 20), "the native index has no Tracer ensemble result")
        XCTAssertEqual(tracer.value as? String, "/lab/bm-01/")
        keep(app, "native-search-results")
        tracer.tap()
        waitForRoute("/lab/bm-01/", in: app)

        app.buttons["native-search"].tap()
        let recent = app.buttons.matching(
            NSPredicate(
                format: "identifier == %@ AND label CONTAINS %@",
                "native-search-recent", "Tracer ensemble")).firstMatch
        XCTAssertTrue(recent.waitForExistence(timeout: 10), "opening a result did not remember the explicit search")
        let clear = app.buttons["native-search-clear-recents"]
        XCTAssertTrue(clear.waitForExistence(timeout: 10))
        clear.tap()
        XCTAssertFalse(recent.exists)
        keep(app, "native-search-recents-cleared")
        app.buttons["native-search-done"].tap()

        // A second launch proves Clear changed the device record, not only this sheet's rows.
        app.terminate()
        app.launch(for: self)
        waitForRoute("/", in: app)
        app.buttons["native-search"].tap()
        XCTAssertTrue(app.searchFields.firstMatch.waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["native-search-clear-recents"].exists)
    }

}
