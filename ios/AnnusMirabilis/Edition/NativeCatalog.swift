import Foundation

/// What the native navigation screens show: the library, each paper's outline, the Discover
/// routes and the lab catalogue, as scripts/app/native-catalog.ts took them from the site's own
/// records. Swift authors none of these words and checks none of these routes by guessing: the
/// export refused any route the edition does not carry.
struct NativeCatalog: Decodable, Sendable, Equatable {
    static let schemaVersion = "annus-mirabilis-native-catalog.v1"

    struct Section: Decodable, Sendable, Equatable, Identifiable {
        let id: String
        let title: String
        let route: String
        let anchor: String
    }

    struct Paper: Decodable, Sendable, Equatable, Identifiable {
        let slug: String
        let name: String
        let title: String
        let germanTitle: String
        let description: String
        let route: String
        let sections: [Section]
        var id: String { slug }
    }

    struct DiscoverRoute: Decodable, Sendable, Equatable, Identifiable {
        let slug: String
        let name: String
        let germanTitle: String
        let blurb: String
        let steps: [String]
        let route: String
        var id: String { slug }
    }

    struct Instrument: Decodable, Sendable, Equatable, Identifiable {
        let id: String
        let name: String
        let route: String
    }

    struct LabGroup: Decodable, Sendable, Equatable, Identifiable {
        let paper: String
        let name: String
        let instruments: [Instrument]
        var id: String { paper }
    }

    let schemaVersion: String
    let papers: [Paper]
    let discover: [DiscoverRoute]
    let labs: [LabGroup]

    /// Every page the catalogue opens, with its anchor when it has one.
    var destinations: [(route: String, anchor: String?)] {
        papers.flatMap { paper in [(paper.route, nil)] + paper.sections.map { ($0.route, $0.anchor) } }
            + discover.map { ($0.route, nil) }
            + labs.flatMap { group in group.instruments.map { ($0.route, nil) } }
    }

    /// The catalogue, only if its bytes match the digest the export recorded.
    static func load(_ entry: EditionManifest.CatalogFile?, directory: URL) -> NativeCatalog? {
        guard let entry, let data = try? Data(contentsOf: directory.appendingPathComponent(entry.file)),
            BridgeScript.sha256Hex(data) == entry.sha256,
            let catalog = try? JSONDecoder().decode(NativeCatalog.self, from: data),
            catalog.schemaVersion == schemaVersion
        else { return nil }
        return catalog
    }
}
