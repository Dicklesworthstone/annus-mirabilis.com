import XCTest

/// The UI test bundle's principal class (bead am-app-test-harness-da6e, requirement 5). XCTest makes
/// one before the first test runs. At the first issue a test records, it keeps a screenshot of the
/// screen and the interface's orientation, so every failing test carries both, not only one that
/// thought to take them. The gate checks the image's shape against that orientation, because the
/// donor's simulator screenshots came out rotated. The orientation is the app window's shape: the
/// simulator reports the device's own orientation as unknown (measured 2026-09-24). XCTest calls its observers on the main thread,
/// which the preconcurrency conformance checks as it runs.
@MainActor
final class HarnessObserver: NSObject, @preconcurrency XCTestObservation {
    static let screenshotName = "evidence-screen"
    static let orientationName = "evidence-orientation"

    private var kept: Set<String> = []

    override init() {
        super.init()
        XCTestObservationCenter.shared.addTestObserver(self)
    }

    func testCase(_ testCase: XCTestCase, didRecord issue: XCTIssue) {
        guard !kept.contains(testCase.name) else { return }
        kept.insert(testCase.name)
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = Self.screenshotName
        shot.lifetime = .keepAlways
        testCase.add(shot)
        let facing = XCTAttachment(string: Self.orientation())
        facing.name = Self.orientationName
        facing.lifetime = .keepAlways
        testCase.add(facing)
    }

    /// "portrait" or "landscape" from the app window's shape, then what it was read from. "unknown"
    /// when the app is not in front, since a query then would record a failure of its own.
    private static func orientation() -> String {
        let device = XCUIDevice.shared.orientation
        let told = device.isPortrait ? "portrait" : device.isLandscape ? "landscape" : "unknown"
        let app = XCUIApplication()
        guard app.state == .runningForeground, app.windows.firstMatch.exists else {
            return "unknown (the app is not in front; device \(told))"
        }
        let window = app.windows.firstMatch.frame
        let shape = window.height > window.width ? "portrait" : "landscape"
        return "\(shape) (app window \(Int(window.width))x\(Int(window.height)) pt; device \(told))"
    }
}
