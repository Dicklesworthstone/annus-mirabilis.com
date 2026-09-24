import XCTest

/// Reopening where the reader left off, and the page actions a phone adds:
/// share, print, find. Each test gets its own state store (`-AMStateSuite`),
/// so none of them depends on another or deletes anything.
final class ReaderStateUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    private func launch(suite: String, _ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-AMUITest", "-AMStateSuite", suite] + extra
        app.launch(for: self)
        return app
    }

    /// In UI-test mode the web view's accessibility value is the route it shows.
    @MainActor
    private func waitForRoute(
        _ route: String, in app: XCUIApplication, file: StaticString = #filePath, line: UInt = #line
    ) {
        let edition = app.webViews["edition-web-view"]
        let shown = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", route), object: edition)
        let result = XCTWaiter().wait(for: [shown], timeout: 30)
        XCTAssertEqual(
            result, .completed, "expected \(route), the web view shows \(String(describing: edition.value))",
            file: file, line: line)
    }

    @MainActor
    private func keep(_ app: XCUIApplication, _ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    @MainActor
    func testReopensWhereTheReaderLeftOff() throws {
        let suite = "uitest-\(UUID().uuidString)"
        var app = launch(suite: suite, ["-AMOpenRoute", "/papers/brownian-motion/", "-AMOpenAnchor", "s4"])
        waitForRoute("/papers/brownian-motion/#s4", in: app)
        app.terminate()

        app = launch(suite: suite)
        waitForRoute("/papers/brownian-motion/#s4", in: app)
        keep(app, "reopened-at-brownian-s4")
    }

    @MainActor
    func testAFreshInstallOpensTheHomePage() throws {
        let app = launch(suite: "uitest-\(UUID().uuidString)")
        waitForRoute("/", in: app)
    }

    @MainActor
    func testPageActionsSharePrintAndFind() throws {
        let app = launch(suite: "uitest-\(UUID().uuidString)", ["-AMOpenRoute", "/papers/brownian-motion/"])
        waitForRoute("/papers/brownian-motion/", in: app)

        let actions = app.buttons["page-actions"]
        XCTAssertTrue(actions.waitForExistence(timeout: 10), "the page actions button is missing")
        actions.tap()
        let share = app.buttons["Share this page"]
        XCTAssertTrue(share.waitForExistence(timeout: 10), "the menu has no share item")
        XCTAssertTrue(app.buttons["Print this page"].exists)
        XCTAssertTrue(app.buttons["Find on this page"].exists)
        keep(app, "page-actions-menu")

        share.tap()
        // The share sheet builds its preview before showing its actions; "Copy" is a cell, not a button.
        let copy = app.descendants(matching: .any).matching(NSPredicate(format: "label == 'Copy'")).firstMatch
        XCTAssertTrue(copy.waitForExistence(timeout: 30), "the share sheet did not open")
        keep(app, "share-sheet")
        copy.tap()
        // Copy closes the sheet. The copied address is not read back here: reading another app's
        // clipboard from the test runner raises iOS's paste prompt and stalls the run. The address
        // itself is covered by SiteURLTests and EditionSessionTests.
        XCTAssertTrue(copy.waitForNonExistence(timeout: 10), "Copy did not close the share sheet")

        actions.tap()
        app.buttons["Print this page"].tap()
        // iOS 26's print sheet: an "Options" bar with Close and a print button that stays disabled
        // until a printer is chosen, which a simulator has none of.
        let printSheet = app.navigationBars["Options"]
        XCTAssertTrue(printSheet.waitForExistence(timeout: 20), "the print sheet did not open")
        XCTAssertTrue(app.staticTexts["Printer"].exists, "the print sheet shows no printer row")
        keep(app, "print-sheet")
        let close = app.buttons.matching(NSPredicate(format: "label == 'Cancel' OR label == 'Close'")).firstMatch
        XCTAssertTrue(close.waitForExistence(timeout: 5), "the print sheet has no way out")
        close.tap()

        actions.tap()
        app.buttons["Find on this page"].tap()
        let field = app.descendants(matching: .any).matching(
            NSPredicate(
                format: "elementType == %d OR elementType == %d", XCUIElement.ElementType.searchField.rawValue,
                XCUIElement.ElementType.textField.rawValue)
        ).firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 10), "the find bar did not open")
        // A fresh simulator shows a one-time keyboard tip over the find bar; it is not the app's.
        let tip = app.buttons["Continue"]
        if tip.waitForExistence(timeout: 3) { tip.tap() }
        field.typeText("Brownian")
        keep(app, "find-on-page")
    }
}
