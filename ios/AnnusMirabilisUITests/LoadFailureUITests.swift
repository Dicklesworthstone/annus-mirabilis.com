import XCTest

/// A page that could not be loaded (bead am-app-edition-webview-ju3v, criterion 5): the reader is
/// told so on a native screen that passes Apple's accessibility audit, and "Try again" opens the
/// same route. -AMFailFirstLoad makes the edition origin fail the first page once.
final class LoadFailureUITests: XCTestCase {
    @MainActor
    func testAFailedLoadIsShownAndTryAgainOpensTheRoute() throws {
        let app = XCUIApplication()
        app.launchArguments = [
            "-AMUITest", "-AMStateSuite", "uitest-\(UUID().uuidString)", "-AMOpenRoute", "/papers/brownian-motion/",
            "-AMFailFirstLoad",
        ]
        app.launch(for: self)
        let retry = app.buttons["load-failure-retry"]
        XCTAssertTrue(retry.waitForExistence(timeout: 20), "the failed load showed no failure screen")
        XCTAssertTrue(app.staticTexts["This page could not be opened"].exists)

        var issues: [String] = []
        try app.performAccessibilityAudit { issue in
            let identifier = issue.element?.identifier ?? ""
            // DEBUG probes exist only in UI-test launches (AccessibilityUITests says why).
            if !identifier.hasPrefix("debug-") {
                let element = issue.element.map { "\"\($0.label)\" type \($0.elementType.rawValue) \($0.frame)" }
                issues.append("\(issue.compactDescription) on \(identifier) \(element ?? "no element")")
            }
            return true
        }
        XCTAssertEqual(issues, [], "the failure screen's accessibility audit")

        retry.tap()
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", "/papers/brownian-motion/"),
            object: app.webViews["edition-web-view"])
        XCTAssertEqual(XCTWaiter().wait(for: [ready], timeout: 30), .completed, "Try again did not open the route")
        XCTAssertFalse(retry.exists, "the failure screen stayed over the loaded page")
    }

    /// Without the switch, a launch never shows the failure screen.
    @MainActor
    func testANormalLaunchShowsNoFailure() throws {
        let app = XCUIApplication()
        app.launchArguments = [
            "-AMUITest", "-AMStateSuite", "uitest-\(UUID().uuidString)", "-AMOpenRoute", "/papers/brownian-motion/",
        ]
        app.launch(for: self)
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", "/papers/brownian-motion/"),
            object: app.webViews["edition-web-view"])
        XCTAssertEqual(XCTWaiter().wait(for: [ready], timeout: 30), .completed, "the page never reported ready")
        XCTAssertFalse(app.buttons["load-failure-retry"].exists)
    }
}
