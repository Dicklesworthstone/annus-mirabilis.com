import Foundation
import UIKit
import XCTest

/// A record in the shared test-log schema (src/testing/log/schema.ts; bead
/// am-app-test-harness-da6e, requirement 1). Tests attach records to their result as `amtestlog*`;
/// the Apple gate exports them from the .xcresult, validates each with the web's own
/// validateEvent, and appends them to artifacts/test-logs/<suite>/<logRunId>.jsonl
/// (scripts/app/test-records.ts). App-only fields go in `extra`: the schema refuses unknown ones.
private final class BundleToken {}

enum AMTestLog {
    /// The prefix the gate collects by.
    static let attachmentPrefix = "amtestlog"

    /// The gate's run identity (its TEST_RUNNER_AM_LOG_RUN_ID reaches the runner as AM_LOG_RUN_ID),
    /// or one made here in the same form when a test runs outside the gate.
    static let logRunId: String = {
        if let given = ProcessInfo.processInfo.environment["AM_LOG_RUN_ID"], !given.isEmpty { return given }
        let stamp = Date.ISO8601FormatStyle(timeZone: .gmt)
            .year().month().day().time(includingFractionalSeconds: false)
            .dateSeparator(.omitted).timeSeparator(.omitted).dateTimeSeparator(.standard)
        let hex = (0..<4).map { _ in String(format: "%02x", UInt8.random(in: 0...255)) }.joined()
        // The style names no time-zone field, so it prints none; the time is GMT, and the shared form
        // (20260924T120000Z-0a1b2c3d) marks that with a Z.
        return "\(Date.now.formatted(stamp))Z-\(hex)"
    }()

    /// A UI test's record, attached for the gate to collect. Kept on success too: the gate needs it.
    @MainActor
    static func attach(_ record: Data, to test: XCTestCase, name: String) {
        let attachment = XCTAttachment(data: record, uniformTypeIdentifier: "public.json")
        attachment.name = "\(attachmentPrefix)-\(name)"
        attachment.lifetime = .keepAlways
        test.add(attachment)
    }

    /// One record as the gate expects it. `browser` is "wkwebview" for a test that drives the edition.
    @MainActor
    static func record(
        suite: String, testId: String, outcome: String, durationMs: Int? = nil, browser: Bool = true,
        lane: String = "default", beadId: String? = nil, paper: String? = nil, anchor: String? = nil,
        message: String? = nil, extra: [String: Any] = [:]
    ) -> Data {
        var fields: [String: Any] = [
            "timestamp": Date.now.formatted(Date.ISO8601FormatStyle(includingFractionalSeconds: true, timeZone: .gmt)),
            "suite": suite,
            "logRunId": logRunId,
            "testId": testId,
            "outcome": outcome,
            "lane": lane,
        ]
        if browser { fields["browser"] = "wkwebview" }
        if let durationMs { fields["durationMs"] = durationMs }
        if let beadId { fields["beadId"] = beadId }
        if let paper { fields["paper"] = paper }
        if let anchor { fields["anchor"] = anchor }
        if let message { fields["message"] = message }
        // The test bundle's own Info.plist, not Bundle.main: in a UI test Bundle.main is XCTest's
        // runner app, which reported 1.0. MARKETING_VERSION and CURRENT_PROJECT_VERSION are set once,
        // for the whole project (project.yml), so the test bundle carries the app's own values.
        let info = Bundle(for: BundleToken.self).infoDictionary
        fields["extra"] = extra.merging(
            [
                "device": UIDevice.current.model,
                "osVersion": UIDevice.current.systemVersion,
                "appVersion": info?["CFBundleShortVersionString"] as? String ?? "unknown",
                "appBuild": info?["CFBundleVersion"] as? String ?? "unknown",
            ],
            uniquingKeysWith: { mine, _ in mine })
        return (try? JSONSerialization.data(withJSONObject: fields, options: [.sortedKeys])) ?? Data()
    }
}
