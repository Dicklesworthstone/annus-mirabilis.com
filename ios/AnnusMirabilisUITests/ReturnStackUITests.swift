import XCTest

/// Native back walks the edition's own history (bead am-app-edition-webview-ju3v, requirement 3).
/// A lesson opened beside the text pushes one step onto the reader's return stack
/// (`?open=foundation:<id>`), and the system's back gesture returns to that exact step: the same
/// paper and passage, lesson closed, not a different page. The page reports its route, query
/// included, through the bridge, so the test sees the step arrive and go. The reader has no native
/// navigation stack of its own, so there is nothing native to pop when the edition's history ends.
final class ReturnStackUITests: XCTestCase {
    private let paper = "/papers/brownian-motion/"

    @MainActor
    private func waitForRoute(
        _ page: XCUIElement, _ format: String, _ route: String, timeout: TimeInterval = 15
    ) -> Bool {
        let reached = XCTNSPredicateExpectation(predicate: NSPredicate(format: format, route), object: page)
        return XCTWaiter().wait(for: [reached], timeout: timeout) == .completed
    }

    @MainActor
    func testNativeBackClosesTheLessonAndStaysAtThePassage() throws {
        let app = XCUIApplication()
        app.launchArguments = [
            "-AMUITest", "-AMStateSuite", "uitest-\(UUID().uuidString)", "-AMOpenRoute", paper,
            "-AMOpenAnchor", "arg-bm-observable",
        ]
        app.launch(for: self)
        let page = app.webViews["edition-web-view"]
        XCTAssertTrue(waitForRoute(page, "value == %@", paper, timeout: 30), "the paper never reported ready")

        let lesson = page.links["Open the foundation: Mean, variance and RMS"]
        XCTAssertTrue(lesson.waitForExistence(timeout: 10), "the passage's lesson link is not in the page")
        if !lesson.isHittable { page.swipeUp() }
        // The page counts as ready before its scripts hydrate, and a tap in that window follows the
        // plain link instead (see chooseDarkTheme), so tap until the step arrives, five times at most.
        let opened = "\(paper)?open="
        for _ in 0..<5 where !waitForRoute(page, "value BEGINSWITH %@", opened, timeout: 2) {
            if lesson.exists, lesson.isHittable { lesson.tap() }
        }
        XCTAssertTrue(
            (page.value as? String)?.hasPrefix(opened) == true,
            "the lesson did not open beside the text: \(page.value ?? "nil")")

        // The system's back gesture: a swipe in from the left edge of the screen.
        app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0.5))
            .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.5)))
        XCTAssertTrue(
            waitForRoute(page, "value == %@", paper),
            "native back did not return to the passage: \(page.value ?? "nil")")
        XCTAssertTrue(lesson.waitForExistence(timeout: 5), "the passage is gone after back")
    }
}
