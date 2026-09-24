#if DEBUG
    import Foundation
    import os
    import WebKit

    /// What a UI-test launch keeps in case its test fails (bead am-app-test-harness-da6e, requirement 5),
    /// in Library/Caches/AMTestEvidence/<test>/<launch>/, which the Apple gate copies out of the
    /// simulator for each failing test:
    /// - `events.jsonl`: the page's console lines and uncaught errors (through the test console),
    ///   every bridge message's type and outcome, with a storage message's namespace, and the app's
    ///   own lifecycle events. Never a message's body, so none of the reader's data (requirement 6);
    /// - `dom.html`: the page's DOM as the web view serializes it, bounded to 512 KiB, rewritten
    ///   whenever the page reports that it changed.
    ///
    /// Each event also goes to the app's log (subsystem: the bundle id, category "test-evidence"), which
    /// the gate excerpts. A DEBUG build's alone: a reader's build has none of this.
    @MainActor
    final class TestEvidence {
        static let folderName = "AMTestEvidence"
        nonisolated static let domLimit = 512 * 1024
        static let logCategory = "test-evidence"

        let directory: URL
        private let logger: Logger
        private var snapshotting = false
        private var snapshotAgain = false

        /// The evidence folder for this launch of `testId` (AM_TEST_ID, which the UI tests set), or
        /// nil when it cannot be made.
        init?(
            testId: String?,
            caches: URL? = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
        ) {
            guard let caches else { return nil }
            let launch = Date.now.formatted(
                Date.ISO8601FormatStyle(timeZone: .gmt).year().month().day()
                    .time(includingFractionalSeconds: true).dateSeparator(.omitted).timeSeparator(.omitted))
            directory =
                caches
                .appendingPathComponent(Self.folderName, isDirectory: true)
                .appendingPathComponent(Self.folder(for: testId), isDirectory: true)
                .appendingPathComponent(launch, isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            } catch {
                return nil
            }
            logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "AnnusMirabilis", category: Self.logCategory)
            record("launch", ["test": testId ?? ""])
        }

        /// A test's folder name: its id with anything but letters, digits, dot, dash and underscore
        /// replaced by "_". The gate derives the same name from the test's identifier.
        nonisolated static func folder(for testId: String?) -> String {
            guard let testId, !testId.isEmpty else { return "unnamed" }
            let allowed = Set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")
            return String(testId.map { allowed.contains($0) ? $0 : "_" })
        }

        /// One event: a line in events.jsonl and a line in the app's log.
        func record(_ kind: String, _ fields: [String: String]) {
            var line = fields
            line["kind"] = kind
            line["at"] = Date.now.formatted(Date.ISO8601FormatStyle(includingFractionalSeconds: true, timeZone: .gmt))
            guard var data = try? JSONSerialization.data(withJSONObject: line, options: [.sortedKeys]) else { return }
            data.append(0x0A)
            let file = directory.appendingPathComponent("events.jsonl")
            if let handle = try? FileHandle(forWritingTo: file) {
                defer { try? handle.close() }
                _ = try? handle.seekToEnd()
                try? handle.write(contentsOf: data)
            } else {
                try? data.write(to: file)
            }
            let text = String(bytes: data.dropLast(), encoding: .utf8) ?? kind
            logger.log("\(text, privacy: .public)")
        }

        /// Keeps the page's DOM as the web view serializes it now. One at a time: a request while one
        /// is being made is served once it finishes, so the last change is always kept.
        func snapshot(_ webView: WKWebView, route: String) {
            guard !snapshotting else {
                snapshotAgain = true
                return
            }
            snapshotting = true
            webView.createWebArchiveData { [weak self, weak webView] result in
                MainActor.assumeIsolated {
                    guard let self else { return }
                    self.snapshotting = false
                    self.keep(result, route: route)
                    if self.snapshotAgain, let webView {
                        self.snapshotAgain = false
                        self.snapshot(webView, route: route)
                    }
                }
            }
        }

        private func keep(_ result: Result<Data, any Error>, route: String) {
            switch result {
            case .success(let archive):
                guard let html = Self.mainResource(of: archive) else {
                    record("snapshot", ["route": route, "outcome": "unreadable"])
                    return
                }
                try? Self.bounded(html, route: route).write(to: directory.appendingPathComponent("dom.html"))
                record("snapshot", ["route": route, "outcome": "kept", "bytes": String(html.count)])
            case .failure(let error):
                record("snapshot", ["route": route, "outcome": "failed", "error": error.localizedDescription])
            }
        }

        /// The main document's markup from a web archive.
        nonisolated static func mainResource(of archive: Data) -> Data? {
            guard
                let plist = try? PropertyListSerialization.propertyList(from: archive, format: nil) as? [String: Any],
                let main = plist["WebMainResource"] as? [String: Any],
                let data = main["WebResourceData"] as? Data
            else { return nil }
            return data
        }

        /// The markup, cut at `domLimit` bytes, after a comment naming the route and both sizes.
        nonisolated static func bounded(_ html: Data, route: String) -> Data {
            let kept = html.prefix(domLimit)
            let safeRoute = route.replacingOccurrences(of: "--", with: "- -")
            let header = "<!-- am-test-evidence route=\(safeRoute) bytes=\(html.count) kept=\(kept.count) -->\n"
            var data = Data(header.utf8)
            data.append(kept)
            return data
        }
    }
#endif
