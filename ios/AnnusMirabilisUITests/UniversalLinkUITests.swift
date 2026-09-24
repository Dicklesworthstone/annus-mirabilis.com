import XCTest

/// A website link handed to the app at launch, through the same handler a universal link uses
/// (DEBUG -AMOpenSiteURL). The system itself cannot hand one over until the associated-domains
/// entitlement exists, which waits on the Apple team id.
final class UniversalLinkUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    private func launch(link: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-AMUITest", "-AMStateSuite", "uitest-\(UUID().uuidString)", "-AMOpenRoute", "/", "-AMOpenSiteURL", link,
        ]
        app.launch(for: self)
        return app
    }

    @MainActor
    private func waitForRoute(_ route: String, in app: XCUIApplication) {
        let web = app.webViews["edition-web-view"]
        let arrived = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", route), object: web)
        XCTAssertEqual(
            XCTWaiter().wait(for: [arrived], timeout: 30), .completed,
            "the page reported \(web.value ?? "nothing"), not \(route)")
    }

    @MainActor
    func testAPassageLinkOpensTheBundledPassage() throws {
        let app = launch(link: "https://annus-mirabilis.com/papers/brownian-motion/#s4")
        waitForRoute("/papers/brownian-motion/#s4", in: app)
        XCTAssertEqual(app.staticTexts["debug-safari-link"].label, "none")
    }

    @MainActor
    func testALabLinkWithAQueryOpensTheLab() throws {
        let app = launch(link: "https://annus-mirabilis.com/lab/bm-01/?detail=2")
        // The page reports its own query: the edition received it, and applies its own bounds.
        waitForRoute("/lab/bm-01/?detail=2", in: app)
    }

    /// A page the app does not carry opens in Safari inside the app, never through the system,
    /// which would hand a universal link straight back.
    @MainActor
    func testAPageTheAppDoesNotCarryOpensInSafariInTheApp() throws {
        let link = "https://annus-mirabilis.com/papers/no-such-paper/"
        let app = launch(link: link)
        // Safari in the app covers the page, and with it the probe, so it is found by its own
        // dismiss button and the probe is read once it closes.
        // SFSafariViewController's own close control; the page inside it has buttons of its own.
        let dismiss = app.buttons.matching(identifier: "Close").firstMatch
        XCTAssertTrue(dismiss.waitForExistence(timeout: 30), "Safari was not opened for \(link)")
        XCTAssertEqual(app.state, .runningForeground, "the link left the app")
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "site-link-not-carried-opens-in-safari"
        shot.lifetime = .keepAlways
        add(shot)
        // Safari's controls live in its own process. XCUITest's element tap was measured not to reach
        // this one (hittable, tapped, still open 5 s later); a touch at its position closes it, as a
        // reader's finger does.
        let hittable = XCTNSPredicateExpectation(predicate: NSPredicate(format: "isHittable == true"), object: dismiss)
        XCTAssertEqual(XCTWaiter().wait(for: [hittable], timeout: 10), .completed)
        dismiss.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        XCTAssertTrue(dismiss.waitForNonExistence(timeout: 10), "Safari did not close")
        let probe = app.staticTexts["debug-safari-link"]
        let opened = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", link), object: probe)
        XCTAssertEqual(
            XCTWaiter().wait(for: [opened], timeout: 10), .completed,
            "Safari opened \(probe.exists ? probe.label : "(no probe)"), not \(link)")
    }

    /// Another site's address is not the app's to open.
    @MainActor
    func testAnotherSitesLinkIsIgnored() throws {
        let app = launch(link: "https://annus-mirabilis.vercel.app/")
        waitForRoute("/", in: app)
        XCTAssertEqual(app.staticTexts["debug-safari-link"].label, "none")
    }
}
