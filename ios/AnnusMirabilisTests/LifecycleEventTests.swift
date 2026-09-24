import Foundation
import SwiftUI
import Testing

@testable import AnnusMirabilis

/// The system events the app reports to the page, as the bridge's enumerated native events.
@Suite("Lifecycle events for the page")
struct LifecycleEventTests {
    @Test("each event carries a name the bridge accepts")
    func names() {
        #expect(LifecycleEvent.visibility(visible: true).name == "lifecycle.visibility")
        #expect(LifecycleEvent.memoryWarning.name == "lifecycle.memoryWarning")
        #expect(LifecycleEvent.thermal(state: .nominal, lowPower: false).name == "lifecycle.thermalState")
    }

    @Test(
        "every thermal state is named as the bead names it",
        arguments: [
            (ProcessInfo.ThermalState.nominal, "nominal"),
            (.fair, "fair"),
            (.serious, "serious"),
            (.critical, "critical"),
        ])
    func thermal(state: ProcessInfo.ThermalState, name: String) {
        #expect(LifecycleEvent.thermalName(state) == name)
        let payload = LifecycleEvent.thermal(state: state, lowPower: true).payload
        #expect(payload["state"] as? String == name)
        #expect(payload["lowPower"] as? Bool == true)
    }

    @Test("foreground and background are reported; passing through inactive is not")
    func scenePhases() {
        #expect(LifecycleEvent.visibility(for: .active) == .visibility(visible: true))
        #expect(LifecycleEvent.visibility(for: .background) == .visibility(visible: false))
        #expect(LifecycleEvent.visibility(for: .inactive) == nil)
        #expect(LifecycleEvent.visibility(visible: false).payload["state"] as? String == "hidden")
        #expect(LifecycleEvent.visibility(visible: true).payload["state"] as? String == "visible")
        #expect(LifecycleEvent.memoryWarning.payload.isEmpty)
    }

    @Test("every event name is one the bridge script lets through")
    func namesAreTheBridges() throws {
        let catalog = try EditionCatalog.load()
        let source = try #require(catalog.verifiedBridgeScript())
        for event in [
            LifecycleEvent.visibility(visible: true), .memoryWarning, .thermal(state: .fair, lowPower: false),
        ] {
            #expect(source.contains("\"\(event.name)\""), "\(event.name) is not in the bridge's event names")
        }
    }
}
