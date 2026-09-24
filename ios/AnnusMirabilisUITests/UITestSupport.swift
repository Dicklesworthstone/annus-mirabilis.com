import XCTest

extension XCUIApplication {
    /// Chooses the page's dark theme the way a reader does, with the page's own button. The app
    /// counts a page ready at DOMContentLoaded, before the page's scripts have hydrated, and a tap
    /// in that window does nothing (seen on the site build of 2026-09-24: the page stayed light and
    /// nothing was saved). So this taps until the page itself offers the light theme, five times at
    /// most, and fails if it never does.
    @MainActor
    func chooseDarkTheme(file: StaticString = #filePath, line: UInt = #line) {
        let toDark = webViews.buttons["Switch to dark theme"]
        let toLight = webViews.buttons["Switch to light theme"]
        XCTAssertTrue(toDark.waitForExistence(timeout: 10), "the page has no theme button", file: file, line: line)
        for _ in 0..<5 where !toLight.exists {
            if toDark.exists { toDark.tap() }
            _ = toLight.waitForExistence(timeout: 2)
        }
        XCTAssertTrue(toLight.exists, "the page never switched to its dark theme", file: file, line: line)
    }
}
