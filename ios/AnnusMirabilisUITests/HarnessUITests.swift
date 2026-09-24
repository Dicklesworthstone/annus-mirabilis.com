import XCTest

/// The harness itself (bead am-app-test-harness-da6e): the device check, the test's name as the gate
/// reads it, and a failure seeded on purpose so the gate can prove what a failing test leaves behind.
final class HarnessUITests: XCTestCase {
    /// Requirement 4. The gate chose a simulator by UDID; this runner must be on it.
    @MainActor
    func testRunsOnTheGatesSimulator() throws {
        let environment = ProcessInfo.processInfo.environment
        guard environment["AM_SIMULATOR_UDID"] != nil else {
            throw XCTSkip("outside the Apple gate, no simulator was chosen")
        }
        XCTAssertNil(HarnessDevice.mismatch(environment))
    }

    /// The check refuses another device and a run that is not on a simulator, and holds nothing to it
    /// outside the gate.
    func testTheDeviceCheckRefusesAnotherSimulator() {
        XCTAssertNil(HarnessDevice.mismatch(["AM_SIMULATOR_UDID": "A", "SIMULATOR_UDID": "A"]))
        XCTAssertEqual(
            HarnessDevice.mismatch(["AM_SIMULATOR_UDID": "A", "SIMULATOR_UDID": "B"]),
            "this test runs on B, but the gate chose A")
        XCTAssertNotNil(HarnessDevice.mismatch(["AM_SIMULATOR_UDID": "A"]))
        XCTAssertNil(HarnessDevice.mismatch(["SIMULATOR_UDID": "B"]))
    }

    /// The launch's name is the .xcresult's name for the test, less its "()": the gate finds a failing
    /// test's evidence folder by it.
    func testATestIsNamedAsTheResultBundleNamesIt() {
        XCTAssertEqual(HarnessDevice.testId(of: name), "HarnessUITests/testATestIsNamedAsTheResultBundleNamesIt")
        XCTAssertEqual(HarnessDevice.testId(of: "two words"), "two words", "only XCTest's -[Type method] form")
        XCTAssertEqual(HarnessDevice.testId(of: "-[A.B c d]"), "-[A.B c d]")
    }

    /// Requirement 7. Fails on purpose, and only in the gate's seeded-failure lane
    /// (apple-harness-evidence), which then requires every evidence item this failure should leave:
    /// the .xcresult, a screenshot of the right shape, the page's console and bridge events, a DOM
    /// snapshot of the page as it now is (the dark theme is set by the page's script, so the DOM
    /// must say so), and the app's log for the run. Anywhere else it is skipped.
    @MainActor
    func testSeededFailureRetainsEvidence() throws {
        guard ProcessInfo.processInfo.environment["AM_SEEDED_FAILURE"] == "1" else {
            throw XCTSkip("runs only in the gate's seeded-failure lane")
        }
        let app = XCUIApplication()
        app.launchArguments = [
            "-AMUITest", "-AMStateSuite", "uitest-\(UUID().uuidString)", "-AMOpenRoute", "/papers/brownian-motion/",
        ]
        app.launch(for: self)
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", "/papers/brownian-motion/"),
            object: app.webViews["edition-web-view"])
        XCTAssertEqual(XCTWaiter().wait(for: [ready], timeout: 30), .completed, "the page never reported ready")
        app.chooseDarkTheme()
        app.waitForMirror(of: "am:settings:v1:theme")
        XCTFail("seeded failure: the harness must keep this test's evidence")
    }
}
