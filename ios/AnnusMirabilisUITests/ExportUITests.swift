import XCTest

/// The site's own exports, which download a Blob, reach the reader in the app:
/// the file is handed to the share sheet (Save to Files, AirDrop, Mail) instead of
/// being dropped by a web view that cannot download.
final class ExportUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    @MainActor
    func testYourDataDownloadOpensTheShareSheetWithTheFile() throws {
        let app = XCUIApplication()
        app.launchArguments = [
            "-AMUITest", "-AMStateSuite", "uitest-\(UUID().uuidString)", "-AMOpenRoute", "/your-data/",
        ]
        app.launch(for: self)
        let edition = app.webViews["edition-web-view"]
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", "/your-data/"), object: edition)
        XCTAssertEqual(XCTWaiter().wait(for: [ready], timeout: 30), .completed)

        let download = edition.buttons["Download all of it (JSON)"]
        XCTAssertTrue(download.waitForExistence(timeout: 10), "the data page's download button is missing")
        for _ in 0..<8 where !download.isHittable {
            edition.swipeUp()
        }
        download.tap()

        // The sheet names the file the page made, so this is the export, not some other sheet.
        let file = app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH 'annus-mirabilis-data-'")).firstMatch
        XCTAssertTrue(file.waitForExistence(timeout: 20), "no share sheet offered the downloaded file")
        XCTAssertTrue(app.descendants(matching: .any)["Save to Files"].exists, "the sheet cannot save the file")
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "your-data-export-share-sheet"
        shot.lifetime = .keepAlways
        add(shot)
    }
}
