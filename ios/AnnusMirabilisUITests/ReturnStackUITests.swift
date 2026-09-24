import XCTest

/// Native back walks the edition's own history (bead am-app-edition-webview-ju3v, requirement 3).
/// A lesson opened beside the text pushes one step onto the reader's return stack
/// (`?open=foundation:<id>`), and the page actions' Back returns to that exact step: the lesson
/// closed, the same paper and passage, not a different page. Back is WebKit's goBack, the step
/// the edge swipe takes too; a synthesized edge swipe never reached WebKit's gesture here (three
/// forms tried on 2026-09-24, none moved the history), so the swipe itself is not what this checks. The lesson is seen by its dialog's
/// close button, which exists only while the dialog is open: the step itself is invisible to the app,
/// because the bridge reports the route on load, hashchange and popstate, and the reader pushes it
/// with pushState, which fires neither. The reader has no native navigation stack of its own, so
/// there is nothing native to pop when the edition's history ends.
final class ReturnStackUITests: XCTestCase {
    private let passage = "/papers/brownian-motion/#arg-bm-observable"

    @MainActor
    private func waitFor(_ element: XCUIElement, _ format: String, _ value: Any, timeout: TimeInterval = 15)
        -> Bool
    {
        let reached = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: format, argumentArray: [value]), object: element)
        return XCTWaiter().wait(for: [reached], timeout: timeout) == .completed
    }

    @MainActor
    func testNativeBackClosesTheLessonAndStaysAtThePassage() throws {
        let app = XCUIApplication()
        app.launchArguments = [
            "-AMUITest", "-AMStateSuite", "uitest-\(UUID().uuidString)", "-AMOpenRoute", "/papers/brownian-motion/",
            "-AMOpenAnchor", "arg-bm-observable",
        ]
        app.launch(for: self)
        let page = app.webViews["edition-web-view"]
        XCTAssertTrue(
            waitFor(page, "value == %@", passage, timeout: 30),
            "the passage never reported ready: \(page.value ?? "nil")")

        // Two passages link this lesson; the first in the page is the one at #arg-bm-observable.
        let lesson = page.links["Open the foundation: Mean, variance and RMS"].firstMatch
        let close = page.buttons["Close the lesson and return to the passage"].firstMatch
        XCTAssertTrue(lesson.waitForExistence(timeout: 10), "the passage's lesson link is not in the page")
        // Not isHittable: it tests the centre of the frame, which for this link, wrapped onto two
        // lines, lies between them on no text, so it reads false for a link in plain view (seen
        // 2026-09-24: no tap was ever sent). Whether the frame is on screen is what matters.
        let window = app.windows.firstMatch.frame
        if !window.contains(lesson.frame) { page.swipeUp() }
        // The page counts as ready before its scripts hydrate, and a tap in that window follows the
        // plain link instead (see chooseDarkTheme), so tap until the lesson opens, five times at most.
        for _ in 0..<5 where !close.waitForExistence(timeout: 2) {
            // For the same reason, tap the link's first word, not the centre of its frame.
            if lesson.exists, window.contains(lesson.frame) {
                lesson.coordinate(withNormalizedOffset: CGVector(dx: 0.1, dy: 0.25)).tap()
            }
        }
        XCTAssertTrue(close.exists, "the lesson did not open beside the text: \(page.value ?? "nil")")
        // The step is in WebKit's own history: the page's address carries it.
        let address = app.staticTexts["debug-url"]
        XCTAssertTrue(
            waitFor(address, "label CONTAINS %@", "open=foundation"),
            "WebKit's address has no step for the lesson: \(address.label)")
        XCTAssertTrue(page.staticTexts["Mean, variance and RMS"].firstMatch.exists, "the open lesson is not this one")

        // Native back, from the page actions.
        app.buttons["page-actions"].tap()
        let back = app.buttons["Back"]
        XCTAssertTrue(back.waitForExistence(timeout: 10), "the page actions have no Back")
        XCTAssertTrue(back.isEnabled, "Back is off while the lesson's step is in the history")
        back.tap()
        XCTAssertTrue(
            waitFor(address, "NOT (label CONTAINS %@)", "open="),
            "native back did not take the step off WebKit's history: \(address.label)")
        XCTAssertTrue(waitFor(close, "exists == %@", false), "native back left the lesson open")
        XCTAssertTrue(
            waitFor(page, "value == %@", passage),
            "native back did not stay at the exact passage: \(page.value ?? "nil")")
        XCTAssertTrue(lesson.waitForExistence(timeout: 5), "the passage is gone after back")

        // Back once more has nothing left: this launch's history began at the passage.
        app.buttons["page-actions"].tap()
        XCTAssertTrue(back.waitForExistence(timeout: 10))
        XCTAssertFalse(back.isEnabled, "Back is on with no step left to go back to")
    }
}
