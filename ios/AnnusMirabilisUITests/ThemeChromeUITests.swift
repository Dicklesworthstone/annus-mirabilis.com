import XCTest

/// The band behind the status bar, and the status bar itself, follow the PAGE's
/// theme; the page follows the DEVICE until the reader presses its toggle.
/// Checked by sampling the screenshot above the Dynamic Island, where only the
/// app's own background shows, and the page-actions button's dot against its disc.
final class ThemeChromeUITests: XCTestCase {
    override func setUp() {
        continueAfterFailure = false
    }

    override func tearDown() {
        XCUIDevice.shared.appearance = .light
    }

    @MainActor
    private func launch(suite: String = "uitest-\(UUID().uuidString)") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-AMUITest", "-AMStateSuite", suite, "-AMOpenRoute", "/papers/brownian-motion/",
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
        return luminance(of: screenshot, atPoint: CGPoint(x: screenshot.size.width / 2, y: 3))
    }

    /// WCAG relative luminance of one screenshot pixel, given in points.
    private func luminance(of screenshot: UIImage, atPoint point: CGPoint) -> Double {
        guard let image = screenshot.cgImage,
            let pixel = image.cropping(
                to: CGRect(x: Int(point.x * screenshot.scale), y: Int(point.y * screenshot.scale), width: 1, height: 1))
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
        func linear(_ byte: UInt8) -> Double {
            let value = Double(byte) / 255
            return value <= 0.04045 ? value / 12.92 : pow((value + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * linear(bytes[0]) + 0.7152 * linear(bytes[1]) + 0.0722 * linear(bytes[2])
    }

    /// Contrast of the page-actions button: its middle dot against the disc 12 points above it.
    @MainActor
    private func buttonContrast(_ app: XCUIApplication) -> Double {
        let frame = app.buttons["page-actions"].frame
        let screenshot = app.screenshot().image
        let dot = luminance(of: screenshot, atPoint: CGPoint(x: frame.midX, y: frame.midY))
        let disc = luminance(of: screenshot, atPoint: CGPoint(x: frame.midX, y: frame.midY - 12))
        return (max(dot, disc) + 0.05) / (min(dot, disc) + 0.05)
    }

    /// Polls, because the page reports its theme a moment after it paints.
    @MainActor
    private func waitForBand(
        _ app: XCUIApplication, dark: Bool, file: StaticString = #filePath, line: UInt = #line
    ) {
        var last = -1.0
        for _ in 0..<20 {
            last = bandLuminance(app)
            if dark ? last < 0.05 : last > 0.6 { return }
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
        XCTAssertGreaterThanOrEqual(buttonContrast(app), 4.5, "the page-actions button on the dark page")
        keep(app, "dark-page-on-light-device")
    }

    @MainActor
    func testAPageWithNoChoiceStillFollowsTheDevice() throws {
        XCUIDevice.shared.appearance = .dark
        let app = launch()
        waitForBand(app, dark: true)
        XCUIDevice.shared.appearance = .light
        waitForBand(app, dark: false)
        XCTAssertGreaterThanOrEqual(buttonContrast(app), 4.5, "the page-actions button on the light page")
        keep(app, "follows-device-back-to-light")
    }

    /// Each UI-test launch gets a fresh, empty WebKit store: exactly the state after
    /// WebKit has cleared a page's storage. The app's own copy is what brings the
    /// reader's choice back.
    @MainActor
    func testTheReadersChoiceComesBackWhenWebKitHasLostIt() throws {
        XCUIDevice.shared.appearance = .light
        let suite = "uitest-\(UUID().uuidString)"
        var app = launch(suite: suite)
        waitForBand(app, dark: false)
        let toggle = app.webViews.buttons["Switch to dark theme"]
        XCTAssertTrue(toggle.waitForExistence(timeout: 10))
        toggle.tap()
        waitForBand(app, dark: true)
        // The mirror is sent 300 ms after the write settles.
        Thread.sleep(forTimeInterval: 2)
        app.terminate()

        app = launch(suite: suite)
        waitForBand(app, dark: true)
        keep(app, "choice-restored-after-webkit-lost-it")
    }
}
