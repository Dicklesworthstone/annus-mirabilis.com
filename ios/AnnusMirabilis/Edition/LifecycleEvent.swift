import Foundation
import SwiftUI

/// What the app tells the page about the system (App plan §7.2; bead
/// am-app-lifecycle-resilience-4dhu, requirements 1 to 3), as the bridge's enumerated native
/// events. The page's runtime decides what to do with them: pause a laboratory, release
/// presentation resources, draw less. The app only reports, and never changes the page's science.
enum LifecycleEvent: Equatable, Sendable {
    /// The app came to the foreground, or went to the background.
    case visibility(visible: Bool)
    /// The system is short of memory.
    case memoryWarning
    /// The device is warm, or in Low Power Mode.
    case thermal(state: ProcessInfo.ThermalState, lowPower: Bool)

    /// The event's name, one of NATIVE_EVENT_NAMES in src/platform/app-bridge/schemas.ts.
    var name: String {
        switch self {
        case .visibility: "lifecycle.visibility"
        case .memoryWarning: "lifecycle.memoryWarning"
        case .thermal: "lifecycle.thermalState"
        }
    }

    /// The event's detail, as the page receives it: strings and booleans only.
    var payload: [String: any Sendable] {
        switch self {
        case .visibility(let visible):
            ["state": visible ? "visible" : "hidden"]
        case .memoryWarning:
            [:]
        case .thermal(let state, let lowPower):
            ["state": Self.thermalName(state), "lowPower": lowPower]
        }
    }

    /// The four states the bead names. A state added by a later iOS is reported as "serious",
    /// so an unknown condition makes the page draw less, never more.
    static func thermalName(_ state: ProcessInfo.ThermalState) -> String {
        switch state {
        case .nominal: "nominal"
        case .fair: "fair"
        case .serious: "serious"
        case .critical: "critical"
        @unknown default: "serious"
        }
    }

    /// Foreground and background only. `.inactive` is the app switcher or a system sheet passing
    /// over, which is not a reason to pause anything.
    static func visibility(for phase: ScenePhase) -> LifecycleEvent? {
        switch phase {
        case .active: .visibility(visible: true)
        case .background: .visibility(visible: false)
        default: nil
        }
    }
}
