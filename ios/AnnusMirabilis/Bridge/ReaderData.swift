import Foundation

/// The site's registry of what it keeps for the reader, and the record the bridge mirrors it
/// into, as the edition export wrote them (src/platform/app-bridge/readerData.ts). The app
/// takes every key, kind and label from here and authors none of its own.
struct ReaderDataManifest: Decodable, Sendable, Equatable {
    struct Record: Decodable, Sendable, Equatable {
        let namespace: String
        let key: String
    }

    struct Entry: Decodable, Sendable, Equatable {
        let key: String
        let kind: String
        let label: String
        let exportable: Bool
    }

    let snapshot: Record
    /// In the registry's order, which is the order /your-data/ lists and exports them.
    let registry: [Entry]
}

/// The reader's data as the app holds it: the page's last snapshot of its own keys.
struct ReaderData: Sendable {
    let manifest: ReaderDataManifest
    let values: [String: String]

    enum LoadResult: Sendable {
        case data(ReaderData)
        case corrupt
    }

    /// The app's copy, or an empty one when the page has not saved anything yet.
    static func load(from store: ReaderDataStore, manifest: ReaderDataManifest) -> LoadResult {
        switch store.read(namespace: manifest.snapshot.namespace, key: manifest.snapshot.key) {
        case .missing:
            return .data(ReaderData(manifest: manifest, values: [:]))
        case .corrupt:
            return .corrupt
        case .value(let text):
            guard let values = snapshotValues(text) else { return .corrupt }
            return .data(ReaderData(manifest: manifest, values: values))
        }
    }

    /// The snapshot is a JSON object of the site's keys to their stored strings.
    static func snapshotValues(_ text: String) -> [String: String]? {
        guard let object = try? JSONSerialization.jsonObject(with: Data(text.utf8)) as? [String: Any] else {
            return nil
        }
        return object.compactMapValues { $0 as? String }
    }

    /// The registered namespaces that hold something, in the registry's order. `prefix` narrows
    /// them to one key or to a family of keys ("am:discovery-notes:v1:" for every paper's notes).
    func held(prefix: String = "") -> [ReaderDataManifest.Entry] {
        manifest.registry.filter { $0.key.hasPrefix(prefix) && values[$0.key] != nil }
    }

    /// The file /your-data/ writes, from the app's copy: every exportable namespace that holds
    /// something, or only those whose key starts with `prefix`.
    func export(prefix: String? = nil, at date: Date) -> ReaderDataExport {
        let namespaces = manifest.registry.compactMap { entry -> ReaderDataExport.Namespace? in
            guard entry.exportable, prefix.map({ entry.key.hasPrefix($0) }) ?? true,
                let raw = values[entry.key]
            else { return nil }
            // As the site does: a document is its parsed JSON, an unreadable one its text.
            let isJSON =
                entry.kind == "document"
                && (try? JSONSerialization.jsonObject(with: Data(raw.utf8), options: .fragmentsAllowed)) != nil
            return ReaderDataExport.Namespace(
                key: entry.key, label: entry.label, value: isJSON ? .json(raw) : .text(raw))
        }
        return ReaderDataExport(exportedAt: ReaderDataExport.timestamp(date), namespaces: namespaces)
    }
}

/// The site's export document, `{exportedAt, namespaces: [{key, label, value}]}`
/// (src/platform/storage/exportClear.ts).
struct ReaderDataExport: Sendable, Equatable {
    enum Value: Sendable, Equatable {
        /// A setting, or a document the site could not parse: exported as a string.
        case text(String)
        /// A document's stored JSON, carried as its own bytes so no number is rewritten.
        case json(String)
    }

    struct Namespace: Sendable, Equatable {
        let key: String
        let label: String
        let value: Value
    }

    let exportedAt: String
    let namespaces: [Namespace]

    /// `Date.toISOString()`'s form: UTC, milliseconds, "Z".
    static func timestamp(_ date: Date) -> String {
        Date.ISO8601FormatStyle(includingFractionalSeconds: true, timeZone: .gmt).format(date)
    }

    /// The name /your-data/ gives the same file: the export's UTC date.
    var suggestedFilename: String {
        "annus-mirabilis-data-\(exportedAt.prefix(10)).json"
    }

    /// The file's bytes. Documents are written as they were stored, so the file holds the
    /// reader's numbers and text exactly.
    func jsonData() -> Data {
        let entries = namespaces.map { namespace in
            let value: String
            switch namespace.value {
            case .text(let text): value = Self.quoted(text)
            case .json(let raw): value = raw
            }
            let fields = [
                "\"key\": \(Self.quoted(namespace.key))",
                "\"label\": \(Self.quoted(namespace.label))",
                "\"value\": \(value)",
            ]
            return "    {\n\(fields.map { "      \($0)" }.joined(separator: ",\n"))\n    }"
        }
        let list = entries.isEmpty ? "[]" : "[\n\(entries.joined(separator: ",\n"))\n  ]"
        return Data("{\n  \"exportedAt\": \(Self.quoted(exportedAt)),\n  \"namespaces\": \(list)\n}\n".utf8)
    }

    /// The same document as objects, for a bridge reply.
    func replyObject() -> [String: Any] {
        let list: [[String: Any]] = namespaces.map { namespace in
            let value: Any
            switch namespace.value {
            case .text(let text):
                value = text
            case .json(let raw):
                value =
                    (try? JSONSerialization.jsonObject(with: Data(raw.utf8), options: .fragmentsAllowed)) ?? NSNull()
            }
            return ["key": namespace.key, "label": namespace.label, "value": value]
        }
        return ["exportedAt": exportedAt, "namespaces": list]
    }

    private static func quoted(_ text: String) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .withoutEscapingSlashes
        return (try? encoder.encode(text)).flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
    }
}
