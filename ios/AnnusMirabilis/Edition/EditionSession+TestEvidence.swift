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

    extension EditionCatalog {
        /// The test console's source, only if its bytes match the recorded digest.
        func verifiedTestConsole() -> String? {
            BridgeScript.load(testConsoleScript, directory: scriptDirectory)
        }
    }
#endif
