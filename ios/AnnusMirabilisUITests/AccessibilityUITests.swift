import XCTest

/// Apple's accessibility audit on every native screen (bead am-app-accessibility-4h2o, requirement 7),
/// at the default text size and at the largest accessibility size, where the audit's text-clipped
/// and Dynamic Type checks decide whether essential labels survive (requirement 3).
///
/// An issue on a native control fails the test. Three kinds are passed over, each with its reason,
/// and every one is attached to the run so none is hidden:
/// - DEBUG probes (`debug-*`): one-point texts that exist only in UI-test launches, for the tests
///   to read. A reader's build has none.
/// - Buttons in a navigation or tab bar (Done, Back, the segmented control) report Dynamic Type "partially
///   unsupported": bar buttons stop growing by the system's design, and a long press shows the
///   Large Content Viewer instead.
/// - On the reading screen, issues on the edition's own web content are recorded, not failed: the
///   edition is the website, whose own accessibility gates own it.
/// - "Open the route" is reported as Dynamic Type "partially unsupported" and "may be clipped", as
///   plain text, a Label, with an explicit font, an explicit colour and without an identifier alike.
///   The claim is contradicted by the screen: at AccessibilityXXXL the label wraps onto two lines,
///   whole. testOpenTheRouteGrowsWithTheReadersTextSize measures that instead, and fails if it stops.
final class AccessibilityUITests: XCTestCase {
    override func setUp() {
        // Every screen's audit is its own observation: one screen's issue must not hide the next's.
        continueAfterFailure = true
    }

    @MainActor
    private func launch(category: String) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = [
            "-AMUITest", "-AMStateSuite", "uitest-\(UUID().uuidString)", "-AMOpenRoute", "/papers/brownian-motion/",
            "-UIPreferredContentSizeCategoryName", category,
        ]
        app.launch(for: self)
        let ready = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "value == %@", "/papers/brownian-motion/"),
            object: app.webViews["edition-web-view"])
        XCTAssertEqual(XCTWaiter().wait(for: [ready], timeout: 30), .completed, "the page never reported ready")
        return app
    }

    /// Audits what is on screen. Returns nothing; fails on a native issue.
    @MainActor
    private func audit(
        _ app: XCUIApplication, _ screen: String, reading: Bool = false,
        types: XCUIAccessibilityAuditType = .all
    ) throws {
        var passedOver: [String] = []
        var failing: [String] = []
        let bars = (app.navigationBars.allElementsBoundByIndex + app.tabBars.allElementsBoundByIndex).map(\.frame)
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "screen-\(screen)"
        shot.lifetime = .keepAlways
        add(shot)
        try app.performAccessibilityAudit(for: types) { issue in
            let identifier = issue.element?.identifier ?? ""
            let label = issue.element?.label ?? ""
            let frame = issue.element.map { "\($0.frame)" } ?? "no element"
            let line =
                "\(issue.compactDescription) on \(identifier.isEmpty ? "\"\(label)\"" : identifier) (type "
                + "\(issue.element.map { String($0.elementType.rawValue) } ?? "none"), \(frame))"
            if identifier.hasPrefix("debug-") {
                passedOver.append("DEBUG probe: \(line)")
                return true
            }
            if issue.auditType == .dynamicType, let element = issue.element, element.elementType == .button,
                bars.contains(where: { $0.contains(CGPoint(x: element.frame.midX, y: element.frame.midY)) })
            {
                passedOver.append("bar button, Large Content Viewer instead: \(line)")
                return true
            }
            if issue.auditType == .dynamicType || issue.auditType == .textClipped, label == "Open the route" {
                passedOver.append("measured instead (testOpenTheRouteGrowsWithTheReadersTextSize): \(line)")
                return true
            }
            if reading, issue.element != nil, identifier != "page-actions" {
                passedOver.append("edition web content: \(line)")
                return true
            }
            failing.append("\(line): \(issue.detailedDescription)")
            return true
        }
        let note = XCTAttachment(
            string: "\(screen): \(failing.count) failing, \(passedOver.count) passed over\n"
                + (failing.map { "FAILING: \($0)" } + passedOver).joined(separator: "\n"))
        note.name = "audit-\(screen)"
        note.lifetime = .keepAlways
        add(note)
        recordAudit(screen, failing: failing, passedOver: passedOver)
        // The handler takes every issue so the record above is always written; a native one fails here.
        XCTAssertEqual(failing, [], "\(screen): native accessibility issues")
    }

    /// Back to the sheet's root, where the Papers, Discover and Instruments control is.
    @MainActor
    private func back(_ app: XCUIApplication) {
        let back = app.navigationBars.buttons.matching(NSPredicate(format: "label != 'Done'")).firstMatch
        XCTAssertTrue(back.waitForExistence(timeout: 10), "no way back to the sheet's root")
        back.tap()
    }

    /// The screen's audit as a test-log record (suite app-a11y), for the gate to collect.
    @MainActor
    private func recordAudit(_ screen: String, failing: [String], passedOver: [String]) {
        AMTestLog.attach(
            AMTestLog.record(
                suite: "app-a11y", testId: "AccessibilityUITests.\(screen)",
                outcome: failing.isEmpty ? "passed" : "failed",
                browser: false, beadId: "am-app-accessibility-4h2o",
                message: "\(failing.count) native issue(s), \(passedOver.count) passed over",
                extra: [
                    "screen": screen, "audit": failing.isEmpty ? "passed" : "issues",
                    "issueTypes": failing.map { String($0.prefix(60)) },
                    "textSize": screen.hasSuffix("largest") ? "AccessibilityXXXL" : "L",
                ]),
            to: self, name: screen)
    }

    /// Scrolls until the element exists and can be tapped: at the largest sizes a list is several
    /// screens long, and its rows are created only as they scroll into view. Up first, then down:
    /// the page-actions menu opens upward from its button, so its last item is at the top.
    @MainActor
    private func reveal(_ element: XCUIElement, in app: XCUIApplication) -> XCUIElement {
        for attempt in 0..<16 where !(element.waitForExistence(timeout: 2) && element.isHittable) {
            if attempt < 8 { app.swipeUp() } else { app.swipeDown() }
        }
        XCTAssertTrue(element.exists && element.isHittable, "\(element) never came into reach")
        return element
    }

    @MainActor
    private func everyNativeScreen(_ app: XCUIApplication, _ size: String) throws {
        try audit(app, "reading-\(size)", reading: true)

        app.buttons["page-actions"].tap()
        XCTAssertTrue(app.buttons["Contents"].waitForExistence(timeout: 10))
        try audit(app, "menu-\(size)")

        app.buttons["Contents"].tap()
        XCTAssertTrue(app.navigationBars["Papers"].waitForExistence(timeout: 10))
        try audit(app, "contents-papers-\(size)")
        let paper = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Brownian motion'")).firstMatch
        reveal(paper, in: app).tap()
        XCTAssertTrue(app.navigationBars["Brownian motion"].waitForExistence(timeout: 10))
        try audit(app, "contents-outline-\(size)")
        back(app)

        app.buttons["Discover"].tap()
        XCTAssertTrue(app.navigationBars["Discover"].waitForExistence(timeout: 10))
        try audit(app, "contents-discover-\(size)")
        let route = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Brownian motion'")).firstMatch
        reveal(route, in: app).tap()
        XCTAssertTrue(app.navigationBars["Brownian motion"].waitForExistence(timeout: 10))
        try audit(app, "contents-route-\(size)")
        // At the largest sizes the blurb fills the screen and the button is below it. Scrolled to, the
        // blurb passes under the translucent bar, so the button is audited for size and clipping only.
        _ = reveal(app.buttons["Open the route"], in: app)
        try audit(app, "contents-route-button-\(size)", types: [.dynamicType, .textClipped])
        back(app)

        app.buttons["Instruments"].tap()
        XCTAssertTrue(app.navigationBars["Instruments"].waitForExistence(timeout: 10))
        try audit(app, "contents-instruments-\(size)")
        app.buttons["Done"].firstMatch.tap()

        app.buttons["page-actions"].tap()
        reveal(app.buttons["Your data on this device"], in: app).tap()
        XCTAssertTrue(app.navigationBars["Your data on this device"].waitForExistence(timeout: 10))
        try audit(app, "your-data-\(size)")
        app.buttons["Done"].firstMatch.tap()
    }

    /// The default size, light: the data screen is empty, so its empty state is audited.
    @MainActor
    func testEveryNativeScreenAtTheDefaultSize() throws {
        try everyNativeScreen(launch(category: "UICTContentSizeCategoryL"), "default")
    }

    /// The largest accessibility size, dark: the reader chooses the dark theme first, so the sheets
    /// are audited in the dark palette and the data screen lists what was saved.
    @MainActor
    func testEveryNativeScreenAtTheLargestAccessibilitySize() throws {
        let app = launch(category: "UICTContentSizeCategoryAccessibilityXXXL")
        app.chooseDarkTheme()
        app.waitForMirror(of: "am:settings:v1:theme")
        try everyNativeScreen(app, "largest")
    }

    /// The Discover route's "Open the route" label, measured where the audit's heuristic misreads it:
    /// at the largest accessibility size its text is more than twice its default height and stays
    /// inside its button.
    @MainActor
    func testOpenTheRouteGrowsWithTheReadersTextSize() throws {
        func measure(_ category: String) -> (text: CGRect, button: CGRect) {
            let app = launch(category: category)
            app.buttons["page-actions"].tap()
            app.buttons["Contents"].tap()
            app.buttons["Discover"].tap()
            reveal(
                app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Brownian motion'")).firstMatch, in: app
            ).tap()
            let button = reveal(app.buttons["Open the route"], in: app)
            let text = button.staticTexts["Open the route"]
            XCTAssertTrue(text.exists, "the label's text is not in the tree")
            let frames = (text.frame, button.frame)
            app.terminate()
            return frames
        }
        let normal = measure("UICTContentSizeCategoryL")
        let largest = measure("UICTContentSizeCategoryAccessibilityXXXL")
        let note = XCTAttachment(string: "default \(normal)\nlargest \(largest)")
        note.name = "open-the-route-frames"
        note.lifetime = .keepAlways
        add(note)
        XCTAssertGreaterThan(largest.text.height, normal.text.height * 2, "the label did not grow with the text size")
        XCTAssertTrue(largest.button.contains(largest.text), "the label's text runs outside its button")
    }

    /// The page's own structure is in the accessibility tree the rotor walks: its title and a section
    /// heading are reachable inside the web view. Whether VoiceOver's rotor lists them as headings
    /// needs VoiceOver itself, on a device (docs/accessibility/manual-protocol.md).
    @MainActor
    func testThePagesHeadingsAreInTheAccessibilityTree() throws {
        let app = launch(category: "UICTContentSizeCategoryL")
        let page = app.webViews["edition-web-view"]
        XCTAssertTrue(
            page.staticTexts["Brownian motion: from wandering to a measurable law"].waitForExistence(timeout: 10))
        XCTAssertTrue(
            page.descendants(matching: .any)
                .matching(NSPredicate(format: "label CONTAINS %@", "From random displacement to diffusion")).firstMatch
                .waitForExistence(timeout: 10),
            "the §4 heading is not in the accessibility tree")
        let tree = XCTAttachment(string: page.debugDescription)
        tree.name = "edition-accessibility-tree"
        tree.lifetime = .keepAlways
        add(tree)
    }
}
