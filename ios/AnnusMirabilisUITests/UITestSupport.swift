import XCTest

extension XCUIApplication {
    /// Launches for `test` (bead am-app-test-harness-da6e). First checks that the test runs on the
    /// simulator the gate chose (requirement 4), then names the launch after the test in AM_TEST_ID,
    /// so the evidence the app keeps (TestEvidence) is found by test when one fails.
    @MainActor
    func launch(for test: XCTestCase, file: StaticString = #filePath, line: UInt = #line) {
        if let problem = HarnessDevice.mismatch(ProcessInfo.processInfo.environment) {
            XCTFail(problem, file: file, line: line)
        }
        launchEnvironment["AM_TEST_ID"] = HarnessDevice.testId(of: test.name)
        launch()
    }

    /// Waits until the page has mirrored a snapshot holding `key` to the app: the signal the storage
    /// mirror sends, instead of a sleep past its 300 ms debounce.
    @MainActor
    func waitForMirror(of key: String, file: StaticString = #filePath, line: UInt = #line) {
        let probe = staticTexts["debug-mirror"]
        let mirrored = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "label CONTAINS %@", key), object: probe)
        XCTAssertEqual(
            XCTWaiter().wait(for: [mirrored], timeout: 15), .completed,
            "the page never mirrored \(key): \(probe.exists ? probe.label : "(no probe)")", file: file, line: line)
    }

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

/// Which simulator a UI test runs on, and what the test is called (bead am-app-test-harness-da6e).
enum HarnessDevice {
    /// Why this is the wrong simulator, or nil. The gate passes the UDID it chose as
    /// TEST_RUNNER_AM_SIMULATOR_UDID; the simulator gives every process its own as SIMULATOR_UDID.
    /// Outside the gate nothing was chosen, so there is nothing to hold the test to.
    static func mismatch(_ environment: [String: String]) -> String? {
        guard let chosen = environment["AM_SIMULATOR_UDID"], !chosen.isEmpty else { return nil }
        let running = environment["SIMULATOR_UDID"] ?? "(not a simulator)"
        return running == chosen ? nil : "this test runs on \(running), but the gate chose \(chosen)"
    }

    /// "LifecycleUITests/testAKilledWebProcess" from XCTest's "-[AnnusMirabilisUITests.LifecycleUITests
    /// testAKilledWebProcess]": the form the .xcresult names the test in, without its "()".
    static func testId(of name: String) -> String {
        guard name.hasPrefix("-["), name.hasSuffix("]") else { return name }
        let parts = name.dropFirst(2).dropLast().split(separator: " ")
        guard parts.count == 2, let type = parts[0].split(separator: ".").last else { return name }
        return "\(type)/\(parts[1])"
    }
}
