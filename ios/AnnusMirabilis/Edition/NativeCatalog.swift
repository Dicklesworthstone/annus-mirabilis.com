import Foundation

/// What the native navigation screens show: the library, each paper's outline, the Discover
/// routes and the lab catalogue, as scripts/app/native-catalog.ts took them from the site's own
/// records. Swift authors none of these words and checks none of these routes by guessing: the
/// export refused any route the edition does not carry.
///
/// Each list is read one record at a time (bead am-app-native-payloads-bued, requirement 3). A
/// record that does not decode becomes one unavailable entry and the rest of its list loads; a
/// list that is not a list fails that list's screen only; and a file that fails its digest or its
/// schema fails every screen, saying so, instead of hiding the Contents. FrankenPatents read its
/// catalogue all or nothing, and one record that failed an out-of-date rule took its library down.
struct NativeCatalog: Sendable, Equatable {
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
        let sections: [CatalogRecord<Section>]
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
        let instruments: [CatalogRecord<Instrument>]
        var id: String { paper }
    }

    let papers: CatalogList<Paper>
    let discover: CatalogList<DiscoverRoute>
    let labs: CatalogList<LabGroup>

    /// Every page the catalogue opens, with its anchor when it has one. Unavailable records open none.
    var destinations: [(route: String, anchor: String?)] {
        papers.available.flatMap { paper in
            [(paper.route, nil)] + paper.sections.compactMap(\.value).map { ($0.route, $0.anchor) }
        }
            + discover.available.map { ($0.route, nil) }
            + labs.available.flatMap { group in group.instruments.compactMap(\.value).map { ($0.route, nil) } }
    }

    /// Every list and record that did not load, each with its reason. The bundled edition must have
    /// none: NativeCatalogTests fails on any (the shipping-payload test).
    var problems: [String] {
        papers.problems + discover.problems + labs.problems
            + papers.available.flatMap { $0.sections.compactMap(\.problem) }
            + labs.available.flatMap { $0.instruments.compactMap(\.problem) }
    }

    /// The catalogue the export recorded, or nil when it recorded none. Bytes that are missing, fail
    /// the recorded digest, are not JSON, or name another schema fail every list, not the app.
    static func load(_ entry: EditionManifest.CatalogFile?, directory: URL) -> NativeCatalog? {
        guard let entry else { return nil }
        guard let data = try? Data(contentsOf: directory.appendingPathComponent(entry.file)) else {
            return failed("\(entry.file) is not in the edition")
        }
        guard BridgeScript.sha256Hex(data) == entry.sha256 else {
            return failed("\(entry.file) does not match the digest the export recorded")
        }
        do {
            return try JSONDecoder().decode(NativeCatalog.self, from: data)
        } catch {
            return failed("\(entry.file): \(CatalogProblem.describe(error))")
        }
    }

    static func failed(_ reason: String) -> NativeCatalog {
        NativeCatalog(papers: .failed(reason: reason), discover: .failed(reason: reason), labs: .failed(reason: reason))
    }
}

extension NativeCatalog: Decodable {
    private enum CodingKeys: String, CodingKey {
        case schemaVersion, papers, discover, labs
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let version = try container.decode(String.self, forKey: .schemaVersion)
        guard version == Self.schemaVersion else {
            throw DecodingError.dataCorruptedError(
                forKey: .schemaVersion, in: container,
                debugDescription: "the schema is \(version), not \(Self.schemaVersion)")
        }
        papers = CatalogList(container, .papers)
        discover = CatalogList(container, .discover)
        labs = CatalogList(container, .labs)
    }
}

/// One screen's list: its records, or why the whole list could not be read.
enum CatalogList<Value: Decodable & Sendable & Equatable>: Sendable, Equatable {
    case loaded([CatalogRecord<Value>])
    case failed(reason: String)

    init<Key: CodingKey>(_ container: KeyedDecodingContainer<Key>, _ key: Key) {
        do {
            self = .loaded(try container.decode([CatalogRecord<Value>].self, forKey: key))
        } catch {
            self = .failed(reason: CatalogProblem.describe(error))
        }
    }

    var records: [CatalogRecord<Value>] {
        if case .loaded(let records) = self { records } else { [] }
    }

    var available: [Value] { records.compactMap(\.value) }

    var problems: [String] {
        switch self {
        case .loaded(let records): records.compactMap(\.problem)
        case .failed(let reason): [reason]
        }
    }
}

/// One record of a list: decoded, or unavailable with its slug or id when that much can be read,
/// and the reason. Decoding one never throws, so a bad record cannot take its neighbours with it.
enum CatalogRecord<Value: Decodable & Sendable & Equatable>: Decodable, Sendable, Equatable {
    case available(Value)
    case unavailable(key: String?, reason: String)

    private enum KeyName: String, CodingKey {
        case slug, id
    }

    init(from decoder: any Decoder) throws {
        do {
            self = .available(try Value(from: decoder))
        } catch {
            let keyed = try? decoder.container(keyedBy: KeyName.self)
            let key = (try? keyed?.decode(String.self, forKey: .slug)) ?? (try? keyed?.decode(String.self, forKey: .id))
            self = .unavailable(key: key, reason: CatalogProblem.describe(error))
        }
    }

    var value: Value? {
        if case .available(let value) = self { value } else { nil }
    }

    var problem: String? {
        guard case .unavailable(let key, let reason) = self else { return nil }
        return key.map { "\($0): \(reason)" } ?? reason
    }
}

/// A decoding failure as a path into the file and what was wrong there ("papers[1].title: ...").
enum CatalogProblem {
    static func describe(_ error: any Error) -> String {
        guard let error = error as? DecodingError else { return String(describing: error) }
        switch error {
        case .keyNotFound(let key, let context):
            return "\(path(context.codingPath + [key])): missing"
        case .typeMismatch(_, let context), .valueNotFound(_, let context), .dataCorrupted(let context):
            return "\(path(context.codingPath)): \(context.debugDescription)"
        @unknown default:
            return String(describing: error)
        }
    }

    static func path(_ keys: [any CodingKey]) -> String {
        let text = keys.reduce(into: "") { text, key in
            if let index = key.intValue {
                text += "[\(index)]"
            } else {
                text += text.isEmpty ? key.stringValue : ".\(key.stringValue)"
            }
        }
        return text.isEmpty ? "the file" : text
    }
}
