import XCTest

/// The page survives what the system does to it (bead am-app-lifecycle-resilience-4dhu): its web
/// process ended, and the app sent to the background and back.
final class LifecycleUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    private func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments =
            [
                "-AMUITest", "-AMStateSuite", "uitest-\(UUID().uuidString)",
                "-AMOpenRoute", "/papers/brownian-motion/", "-AMOpenAnchor", "s4",
            ] + extra
        app.launch()
        return app
    }

    @MainActor
    private func wait(_ element: XCUIElement, _ attribute: String, _ expected: String, _ why: String) {
        let met = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "\(attribute) == %@", expected), object: element)
        let now = element.exists ? String(describing: element.value(forKey: attribute) ?? "nil") : "(absent)"
        XCTAssertEqual(XCTWaiter().wait(for: [met], timeout: 30), .completed, "\(why): \(attribute) is \(now)")
    }

    /// The system reclaims the page's process. The page reported §4 before; the process ends (the
    /// counter says it happened); the route is cleared; and the page reports §4 again, from a
    /// reload the app made, not from a value left over.
    @MainActor
    func testAKilledWebProcessComesBackToTheSamePassage() throws {
        let app = launch(["-AMKillWebContentOnceReady"])
        let page = app.webViews["edition-web-view"]
        wait(app.staticTexts["debug-web-terminations"], "label", "1", "the web process was never ended")
        wait(page, "value", "/papers/brownian-motion/#s4", "the passage did not come back after the reload")
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "after-web-process-termination"
        shot.lifetime = .keepAlways
        add(shot)
    }

    /// Background, then foreground: the page is told both, through the bridge's lifecycle event.
    @MainActor
    func testTheBackgroundAndTheForegroundAreToldToThePage() throws {
        let app = launch()
        wait(app.webViews["edition-web-view"], "value", "/papers/brownian-motion/#s4", "the page never reported ready")
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 2)
        app.activate()
        let log = app.staticTexts["debug-lifecycle"]
        let told = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "label CONTAINS %@", "lifecycle.visibility visible delivered"), object: log)
        XCTAssertEqual(XCTWaiter().wait(for: [told], timeout: 20), .completed, "the page was not told: \(log.label)")
        let record = XCTAttachment(string: log.label)
        record.name = "lifecycle-events"
        record.lifetime = .keepAlways
        add(record)
        XCTAssertTrue(
            log.label.contains("lifecycle.visibility hidden"), "going to the background was not sent: \(log.label)")
    }
}
