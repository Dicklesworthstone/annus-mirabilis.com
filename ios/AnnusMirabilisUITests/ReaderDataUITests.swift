import XCTest

/// "Your data on this device": the app lists what it holds of the reader's data with the
/// site's own labels, and exports it as the file /your-data/ writes.
final class ReaderDataUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testTheReadersChoiceIsListedAndExported() throws {
        let app = XCUIApplication()
        app.launchArguments = [
            "-AMUITest", "-AMStateSuite", "uitest-\(UUID().uuidString)", "-AMOpenRoute", "/papers/brownian-motion/",
        ]
        app.launch(for: self)
        let edition = app.webViews["edition-web-view"]
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", "/papers/brownian-motion/"), object: edition)
        XCTAssertEqual(XCTWaiter().wait(for: [ready], timeout: 30), .completed, "the page never reported ready")

        // Nothing is saved on a fresh suite; the reader's theme choice is the first thing saved.
        app.chooseDarkTheme()
        app.waitForMirror(of: "am:settings:v1:theme")

        app.buttons["page-actions"].tap()
        app.buttons["Your data on this device"].tap()
        // The site's label for am:settings:v1:theme (src/platform/storage/keys.ts).
        XCTAssertTrue(app.staticTexts["Reading theme"].waitForExistence(timeout: 10), "the saved theme is not listed")
        XCTAssertTrue(app.buttons["Export Reading theme"].exists, "the row has no export")
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "your-data-on-this-device"
        shot.lifetime = .keepAlways
        add(shot)

        app.buttons["reader-data-export-all"].tap()
        let file = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH 'annus-mirabilis-data-'")).firstMatch
        XCTAssertTrue(file.waitForExistence(timeout: 20), "no share sheet offered the exported file")
        let sheet = XCTAttachment(screenshot: app.screenshot())
        sheet.name = "your-data-export-share-sheet"
        sheet.lifetime = .keepAlways
        add(sheet)
    }
}
