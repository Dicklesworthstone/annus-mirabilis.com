import XCTest

/// The reader's system text size reaches both the app's own chrome and the page: the page
/// reports the type size it shows through the bridge, read here from a DEBUG probe.
final class DynamicTypeUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    private func launch(category: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-AMUITest", "-AMStateSuite", "uitest-\(UUID().uuidString)", "-AMOpenRoute", "/papers/brownian-motion/",
            "-UIPreferredContentSizeCategoryName", category,
        ]
        app.launch()
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", "/papers/brownian-motion/"),
            object: app.webViews["edition-web-view"])
        XCTAssertEqual(XCTWaiter().wait(for: [ready], timeout: 30), .completed, "the page never reported ready")
        return app
    }

    @MainActor
    private func waitForPageTypeSize(_ app: XCUIApplication, _ size: String) {
        let probe = app.staticTexts["debug-type-size"]
        let shown = XCTNSPredicateExpectation(predicate: NSPredicate(format: "label == %@", size), object: probe)
        XCTAssertEqual(
            XCTWaiter().wait(for: [shown], timeout: 15), .completed,
            "the page shows type size \(probe.exists ? probe.label : "(no probe)"), not \(size)")
    }

    @MainActor
    private func keep(_ app: XCUIApplication, _ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    @MainActor
    func testTheLargestAccessibilitySizeReachesThePageAndTheChrome() throws {
        let app = launch(category: "UICTContentSizeCategoryAccessibilityXXXL")
        waitForPageTypeSize(app, "150")
        let actions = app.buttons["page-actions"]
        XCTAssertGreaterThan(actions.frame.width, 44, "the page-actions button did not grow")
        XCTAssertLessThanOrEqual(actions.frame.width, 64, "the page-actions button outgrew its cap")
        keep(app, "largest-accessibility-size-page")
        actions.tap()
        XCTAssertTrue(app.buttons["Your data on this device"].waitForExistence(timeout: 10))
        keep(app, "largest-accessibility-size-menu")
    }

    /// The control: at the default size the page keeps its own 100 and the button its 44 points,
    /// so the test above cannot pass by the page or the button ignoring the size.
    @MainActor
    func testTheDefaultSizeLeavesThePageAtItsOwnSize() throws {
        let app = launch(category: "UICTContentSizeCategoryL")
        waitForPageTypeSize(app, "100")
        XCTAssertEqual(app.buttons["page-actions"].frame.width, 44, accuracy: 0.5)
    }
}
