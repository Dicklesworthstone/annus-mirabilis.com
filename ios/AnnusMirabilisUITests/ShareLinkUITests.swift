import XCTest

/// A link the page copies inside the app names the website, not the app's own
/// origin, so it opens for whoever receives it.
final class ShareLinkUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testACopiedPassageLinkNamesTheWebsite() throws {
        let app = XCUIApplication()
        app.launchArguments = [
            "-AMUITest", "-AMStateSuite", "uitest-\(UUID().uuidString)", "-AMOpenRoute", "/papers/brownian-motion/",
        ]
        app.launch(for: self)
        let edition = app.webViews["edition-web-view"]
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", "/papers/brownian-motion/"), object: edition)
        XCTAssertEqual(XCTWaiter().wait(for: [ready], timeout: 30), .completed)

        let copy = edition.buttons["Copy a link to this passage: Zero average is not no movement"]
        XCTAssertTrue(copy.waitForExistence(timeout: 10), "the passage's copy-link button is missing")
        for _ in 0..<12 where !copy.isHittable {
            edition.swipeUp()
        }
        copy.tap()

        let pasteboard = app.staticTexts["debug-pasteboard"]
        let copied = XCTNSPredicateExpectation(
            predicate: NSPredicate(
                format: "label BEGINSWITH %@", "https://annus-mirabilis.com/papers/brownian-motion/"),
            object: pasteboard)
        let result = XCTWaiter().wait(for: [copied], timeout: 10)
        XCTAssertEqual(result, .completed, "the pasteboard holds \(pasteboard.label)")
        XCTAssertTrue(pasteboard.label.contains("arg-bm-observable"), pasteboard.label)
        XCTAssertFalse(pasteboard.label.contains("am-edition"), pasteboard.label)

        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "passage-link-copied"
        shot.lifetime = .keepAlways
        add(shot)
    }
}
