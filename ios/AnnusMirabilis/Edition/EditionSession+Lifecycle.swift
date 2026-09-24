import SwiftUI
import UIKit
import WebKit

/// The system's news, told to the page (App plan §7.2; bead am-app-lifecycle-resilience-4dhu):
/// foreground and background, memory warnings, heat and Low Power Mode. The page's runtime decides
/// what each means; the app only reports.
extension EditionSession {
    /// Calls the bridge's one fixed entry point for native events with arguments, never with code
    /// built from values. True when the page's bridge accepted the event.
    @discardableResult
    func dispatchToPage(_ name: String, _ payload: [String: Any]) async -> Bool {
        guard bridgeInstalled else { return false }
        let result = try? await webView.callAsyncJavaScript(
            "return window.__AM_APP__ ? window.__AM_APP__.dispatch(name, payload) : false",
            arguments: ["name": name, "payload": payload], in: nil, contentWorld: .page)
        return (result as? Bool) ?? false
    }

    /// Reports a system event to the page.
    func send(_ event: LifecycleEvent) {
        Task { @MainActor [weak self] in
            guard let self else { return }
            let delivered = await dispatchToPage(event.name, event.payload)
            #if DEBUG
                if exposesRouteForTests {
                    let state = event.payload["state"].map { " \($0)" } ?? ""
                    deliveredLifecycleEvents = Array(
                        (deliveredLifecycleEvents + ["\(event.name)\(state) \(delivered ? "delivered" : "refused")"])
                            .suffix(6))
                }
            #endif
        }
    }

    /// The scene came to the foreground or went to the background.
    func sceneDidChange(_ phase: ScenePhase) {
        if let event = LifecycleEvent.visibility(for: phase) { send(event) }
    }

    /// The device's thermal state and Low Power Mode, as one event.
    var thermalEvent: LifecycleEvent {
        .thermal(state: ProcessInfo.processInfo.thermalState, lowPower: ProcessInfo.processInfo.isLowPowerModeEnabled)
    }

    func observeLifecycle() {
        let center = NotificationCenter.default
        let names: [(Notification.Name, @MainActor (EditionSession) -> Void)] = [
            (UIApplication.didReceiveMemoryWarningNotification, { $0.send(.memoryWarning) }),
            (ProcessInfo.thermalStateDidChangeNotification, { $0.send($0.thermalEvent) }),
            (.NSProcessInfoPowerStateDidChange, { $0.send($0.thermalEvent) }),
        ]
        lifecycleObservers = names.map { name, action in
            center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated {
                    if let self { action(self) }
                }
            }
        }
    }

    #if DEBUG
        /// UI tests only (-AMKillWebContentOnceReady): ends the page's web process, as the system does
        /// when it reclaims memory. A private WebKit call, compiled into DEBUG builds only.
        func debugTerminateWebContent() {
            let selector = NSSelectorFromString("_killWebContentProcess")
            guard webView.responds(to: selector) else { return }
            webView.perform(selector)
        }
    #endif
}
