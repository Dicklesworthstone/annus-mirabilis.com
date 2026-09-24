import Foundation
import Testing

@testable import AnnusMirabilis

/// Website links the system hands the app (universal links), decided against this build's own
/// edition. The vectors are shared with scripts/app/association-file.test.ts, which checks whether
/// the association file hands each one to the app at all.
@Suite("Website links handed to the app")
struct UniversalLinkTests {
    struct Vector: Decodable {
        let url: String
        let app: String
        let path: String?
        let query: String?
        let anchor: String?
        let why: String
    }

    @Test("every shared vector gets the decision it records")
    func vectors() throws {
        let catalog = try EditionCatalog.load()
        let file = try #require(
            Bundle(for: UniversalLinkToken.self).url(forResource: "route-vectors", withExtension: "json"))
        let vectors = try JSONDecoder().decode([Vector].self, from: Data(contentsOf: file))
        #expect(Set(vectors.map(\.app)) == ["edition", "safari", "refuse"], "every outcome is exercised")
        for vector in vectors {
            let link = try #require(URL(string: vector.url))
            let decision = EditionLinkPolicy.siteLink(link, catalog: catalog)
            switch vector.app {
            case "edition":
                guard case .openInEdition(let local) = decision else {
                    Issue.record("\(vector.url) should open in the edition (\(vector.why)); got \(decision)")
                    continue
                }
                let parts = URLComponents(url: local, resolvingAgainstBaseURL: false)
                #expect(parts?.scheme == EditionCatalog.scheme && parts?.host == EditionCatalog.host, "\(vector.url)")
                #expect(parts?.path == vector.path, "\(vector.url)")
                #expect(parts?.query == vector.query, "\(vector.url)")
                #expect(parts?.fragment == vector.anchor, "\(vector.url)")
            case "safari":
                #expect(decision == .openOutside(link), "\(vector.url) should open in Safari: \(vector.why)")
            default:
                #expect(decision == .refuse, "\(vector.url) should be refused: \(vector.why)")
            }
        }
    }
}

/// Finds the test bundle, where the vectors are a resource.
private final class UniversalLinkToken {}
