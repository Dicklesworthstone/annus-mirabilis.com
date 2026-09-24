import XCTest

/// The band behind the status bar, and the status bar itself, follow the PAGE's
/// theme; the page follows the DEVICE until the reader presses its toggle.
/// Checked by sampling the screenshot above the Dynamic Island, where only the
/// app's own background shows.
final class ThemeChromeUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    override func tearDown() {
        XCUIDevice.shared.appearance = .light
    }

    @MainActor
    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-AMUITest", "-AMStateSuite", "uitest-\(UUID().uuidString)", "-AMOpenRoute", "/papers/brownian-motion/",
        ]
        app.launch()
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", "/papers/brownian-motion/"),
            object: app.webViews["edition-web-view"])
        XCTAssertEqual(XCTWaiter().wait(for: [ready], timeout: 30), .completed, "the page never reported ready")
        return app
    }

    /// Relative luminance, 0 to 1, of the pixel 3 points down at the horizontal centre.
    @MainActor
    private func bandLuminance(_ app: XCUIApplication) -> Double {
        let screenshot = app.screenshot().image
        guard let image = screenshot.cgImage,
            let pixel = image.cropping(
                to: CGRect(x: image.width / 2, y: Int(3 * screenshot.scale), width: 1, height: 1))
        else { return -1 }
        var bytes = [UInt8](repeating: 0, count: 4)
        let drawn = bytes.withUnsafeMutableBytes { buffer -> Bool in
            guard
                let context = CGContext(
                    data: buffer.baseAddress, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4,
                    space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
            else { return false }
            context.draw(pixel, in: CGRect(x: 0, y: 0, width: 1, height: 1))
            return true
        }
        guard drawn else { return -1 }
        return (0.2126 * Double(bytes[0]) + 0.7152 * Double(bytes[1]) + 0.0722 * Double(bytes[2])) / 255
    }

    /// Polls, because the page reports its theme a moment after it paints.
    @MainActor
    private func waitForBand(
        _ app: XCUIApplication, dark: Bool, file: StaticString = #filePath, line: UInt = #line
    ) {
        var last = -1.0
        for _ in 0..<20 {
            last = bandLuminance(app)
            if dark ? last < 0.25 : last > 0.8 { return }
            Thread.sleep(forTimeInterval: 0.5)
        }
        XCTFail("the band behind the status bar stayed at luminance \(last)", file: file, line: line)
    }

    private func keep(_ app: XCUIApplication, _ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }

    @MainActor
    func testTheBandFollowsThePageWhenTheReaderChoosesDarkOnALightDevice() throws {
        XCUIDevice.shared.appearance = .light
        let app = launch()
        waitForBand(app, dark: false)
        let toggle = app.webViews.buttons["Switch to dark theme"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 10))
        toggle.tap()
        waitForBand(app, dark: true)
        keep(app, "dark-page-on-light-device")
    }

    @MainActor
    func testAPageWithNoChoiceStillFollowsTheDevice() throws {
        XCUIDevice.shared.appearance = .dark
        let app = launch()
        waitForBand(app, dark: true)
        XCUIDevice.shared.appearance = .light
        waitForBand(app, dark: false)
        keep(app, "follows-device-back-to-light")
    }
}
