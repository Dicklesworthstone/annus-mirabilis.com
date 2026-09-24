import Foundation
import Testing
import UIKit

@testable import AnnusMirabilis

/// The reader's system text size reaching the edition: the recorded table, the snapshot the
/// page reads before its first paint, and a change made while the app runs.
@Suite("Dynamic Type and the edition's type size")
@MainActor
struct EditionSettingsTests {
    private static let siteSteps = [100, 112, 125, 150]

    @Test(
        "the recorded table: every system text size and the edition step it gets",
        arguments: [
            (UIContentSizeCategory.extraSmall, 100),
            (.small, 100),
            (.medium, 100),
            (.large, 100),
            (.extraLarge, 112),
            (.extraExtraLarge, 125),
            (.extraExtraExtraLarge, 150),
            (.accessibilityMedium, 150),
            (.accessibilityLarge, 150),
            (.accessibilityExtraLarge, 150),
            (.accessibilityExtraExtraLarge, 150),
            (.accessibilityExtraExtraExtraLarge, 150),
        ])
    func table(category: UIContentSizeCategory, percent: Int) {
        #expect(EditionTypeSize.percent(for: category, steps: Self.siteSteps) == percent)
    }

    @Test("the table follows the edition's steps: larger steps would reach the accessibility sizes")
    func stepsComeFromTheEdition() {
        let steps = Self.siteSteps + [200, 300]
        #expect(EditionTypeSize.percent(for: .accessibilityMedium, steps: steps) == 200)
        #expect(EditionTypeSize.percent(for: .accessibilityExtraExtraExtraLarge, steps: steps) == 300)
        #expect(EditionTypeSize.percent(for: .large, steps: []) == nil)
    }

    @Test("this build's edition carries the site's steps and a verified snapshot template")
    func bundled() throws {
        let catalog = try EditionCatalog.load()
        #expect(catalog.typeSizes == Self.siteSteps)
        let snapshot = try #require(catalog.verifiedSettingsSnapshot())
        let source = try #require(snapshot.source(.init(typeSize: 150)))
        #expect(source.contains(#"{"typeSize":150}"#))
        #expect(!source.contains(snapshot.placeholder))
    }

    @Test("a template is filled only where its one placeholder is")
    func placeholder() {
        #expect(
            SettingsSnapshot(template: "(f)(P);", placeholder: "P")?.source(.init(typeSize: 112))
                == #"(f)({"typeSize":112});"#)
        #expect(SettingsSnapshot(template: "(f)(P,P);", placeholder: "P") == nil)
        #expect(SettingsSnapshot(template: "(f)();", placeholder: "P") == nil)
        #expect(SettingsSnapshot(template: "(f)();", placeholder: "") == nil)
    }

    @Test("a new system text size is sent to the page and to every page loaded after it")
    func liveChange() throws {
        let defaults = try #require(UserDefaults(suiteName: "settings-\(UUID().uuidString)"))
        let session = EditionSession(
            catalog: try EditionCatalog.load(), store: ReaderLocationStore(defaults: defaults), contentSize: .large)
        let scripts = { session.webView.configuration.userContentController.userScripts.map(\.source) }
        #expect(session.typeSize == 100)
        #expect(scripts().count == 2, "the snapshot, then the bridge")
        #expect(scripts().first?.contains(#"{"typeSize":100}"#) == true)

        session.didChangeContentSize(.accessibilityExtraExtraExtraLarge)
        #expect(session.typeSize == 150)
        #expect(scripts().count == 2)
        #expect(scripts().first?.contains(#"{"typeSize":150}"#) == true)
        #expect(scripts().last == session.catalog.verifiedBridgeScript())
    }
}
