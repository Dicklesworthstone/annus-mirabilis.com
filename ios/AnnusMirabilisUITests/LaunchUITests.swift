import XCTest

/// Launch the app and see the bundled edition, not the missing-edition screen.
/// The checks count links and read no page copy, so an edit to the website's
/// wording never breaks this test.
final class LaunchUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testLaunchShowsTheBundledHomePage() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-AMUITest"]
        app.launch()

        let edition = app.webViews["edition-web-view"]
        XCTAssertTrue(edition.waitForExistence(timeout: 30), "the edition web view never appeared")
        XCTAssertFalse(app.otherElements["edition-unavailable"].exists, "the app showed its missing-edition screen")

        let firstLink = edition.links.firstMatch
        XCTAssertTrue(firstLink.waitForExistence(timeout: 30), "the home page rendered no links")
        XCTAssertGreaterThan(
            edition.links.count, 5, "the home page rendered fewer links than its navigation alone carries")

        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "home"
        shot.lifetime = .keepAlways
        add(shot)
    }

    @MainActor
    func testLaunchArgumentOpensAPaper() throws {
        let app = XCUIApplication()
        app.launchArguments = ["-AMUITest", "-AMOpenRoute", "/papers/brownian-motion/"]
        app.launch()

        let edition = app.webViews["edition-web-view"]
        XCTAssertTrue(edition.waitForExistence(timeout: 30))
        XCTAssertTrue(edition.links.firstMatch.waitForExistence(timeout: 30))
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "brownian-motion"
        shot.lifetime = .keepAlways
        add(shot)
    }
}
