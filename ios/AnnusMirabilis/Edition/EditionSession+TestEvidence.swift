#if DEBUG
    import Foundation
    import WebKit

    /// A UI-test launch's evidence (TestEvidence): the test console injected ahead of the page's own
    /// scripts, and what the router hears written down.
    extension EditionSession {
        /// Starts keeping evidence, when this is a UI-test launch. The test names itself in AM_TEST_ID.
        func startTestEvidence() {
            guard exposesRouteForTests,
                let evidence = TestEvidence(testId: ProcessInfo.processInfo.environment["AM_TEST_ID"])
            else { return }
            testEvidence = evidence
            if catalog.verifiedTestConsole() == nil {
                // Said once, so a folder without console lines is never read as a quiet page.
                evidence.record("setup", ["testConsole": "missing or not matching its digest"])
            }
            router.onTestLog = { [weak evidence] level, message in
                evidence?.record("console", ["level": level, "message": message])
            }
            router.onTestSnapshot = { [weak self] route in
                self?.keepDOM(route)
            }
            router.onMessage = { [weak self] type, status, namespace in
                guard let self, let evidence = testEvidence else { return }
                var fields = ["type": type, "status": status]
                if let namespace { fields["namespace"] = namespace }
                evidence.record("bridge", fields)
                // The page is ready or changed its settings: its DOM is worth keeping as it now is.
                if type == "route.changed" || type == "settings.changed" {
                    keepDOM(bridgeRoute ?? webView.url?.path ?? "")
                }
            }
        }

        private func keepDOM(_ route: String) {
            testEvidence?.snapshot(webView, route: route)
        }

        /// The test console, first among the document-start scripts so the page's console is captured
        /// from its first line, and only when its bytes match the manifest's digest.
        func addTestConsole(to controller: WKUserContentController) {
            guard testEvidence != nil, let source = catalog.verifiedTestConsole() else { return }
            controller.addUserScript(
                WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true, in: .page))
        }
    }

    /// A launch's test-only switches (LaunchArguments).
    extension EditionSession {
        func apply(_ launch: LaunchArguments) {
            killWebContentOnceReady = launch.killWebContentOnceReady
            if launch.failFirstLoad { failFirstDocumentLoad() }
        }

        /// The edition origin fails the first page it is asked for, once, the way a failed read does,
        /// so the load-failure screen and its retry can be tested (bead am-app-edition-webview-ju3v).
        private func failFirstDocumentLoad() {
            let scheme = EditionCatalog.scheme
            guard let handler = webView.configuration.urlSchemeHandler(forURLScheme: scheme) as? EditionSchemeHandler
            else { return }
            let read = handler.read
            let armed = FailOnce()
            handler.read = { url in
                if url.pathExtension == "html", await armed.fire() { return nil }
                return await read(url)
            }
        }
    }

    /// True the first time it is asked, and never again.
    private actor FailOnce {
        private var armed = true

        func fire() -> Bool {
            defer { armed = false }
            return armed
        }
    }

    extension EditionCatalog {
        /// The test console's source, only if its bytes match the recorded digest.
        func verifiedTestConsole() -> String? {
            BridgeScript.load(testConsoleScript, directory: scriptDirectory)
        }
    }
#endif
