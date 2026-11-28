import CryptoKit
import Foundation
import WebKit

/// Receives the edition's messages (App plan §7.3). A message is accepted only
/// from the main frame of the edition's own origin, only when it passes the
/// closed schema, and only within the per-type rate. Every reply is a result
/// dictionary; nothing throws back into the page.
@MainActor
final class BridgeRouter: NSObject, WKScriptMessageHandlerWithReply {
    /// Called for every accepted `route.changed`: route, anchor, title.
    var onRoute: ((String, String?, String) -> Void)?
    /// Where `storage.read` and `storage.write` keep the reader's data; nil answers unavailable.
    var store: ReaderDataStore?
    /// The site's registry, for `storage.list` and `storage.export`; nil answers unavailable.
    var readerData: ReaderDataManifest?
    /// Optional for editions exported before source download pins were recorded.
    var facsimiles: FacsimileStore?
    /// The export's timestamp; tests fix it.
    var now: () -> Date = { Date() }
    /// Called for an accepted `share.request`; the schema has already checked the URL is a page of the website.
    var onShare: ((URL) -> Void)?
    /// Called for every accepted `settings.changed` that names the page's theme.
    var onTheme: ((String) -> Void)?
    /// Called for every accepted `settings.changed` that names the type size the page shows.
    var onTypeSize: ((Int) -> Void)?
    /// Called after every write the store accepted: namespace, key, value.
    var onStorageWrite: ((String, String, String) -> Void)?
    #if DEBUG
        /// UI tests' evidence (TestEvidence): the page's console line (level, message), its request
        /// to keep its DOM (route), and every message's type, outcome and, for storage, namespace.
        /// Never a message's body, so the reader's data never reaches a log.
        var onTestLog: ((String, String) -> Void)?
        var onTestSnapshot: ((String) -> Void)?
        var onMessage: ((String, String, String?) -> Void)?
    #endif

    // Each window has a router. Only the newest upload to this on-disk record may publish.
    // Incomplete bytes live with the router and disappear on termination; the committed
    // snapshot remains the same atomic file understood by older editions and native exports.
    private static var uploadOwners: [URL: String] = [:]
    private static var lastClear: [URL: UUID] = [:]
    private static let partBytes = 128 * 1024
    private static let maxSnapshotBytes = 32 * 1024 * 1024
    private struct Upload {
        let id: String
        let total: Int
        var data = Data()
    }
    private var upload: Upload?
    private var download: (id: String, data: Data, lastClear: UUID?)?
    private var limiter = BridgeRateLimiter()
    private let capabilities: [String]

    /// The same list, in the same order, as BRIDGE_CAPABILITIES in src/platform/app-bridge/userScripts.ts.
    init(capabilities: [String] = ["route", "theme", "share", "storage", "print", "find", "facsimile"]) {
        self.capabilities = capabilities
    }

    /// Who sent a message, as WebKit reports it.
    struct Sender: Sendable {
        let isMainFrame: Bool
        let scheme: String
        let host: String
    }

    /// The whole decision, without WebKit objects, so it can be tested.
    static func decide(body: Any, from sender: Sender, now: TimeInterval, limiter: inout BridgeRateLimiter)
        -> BridgeVerdict
    {
        guard sender.isMainFrame else { return .rejected(.notMainFrame, "a subframe sent a message") }
        guard sender.scheme == EditionCatalog.scheme, sender.host == EditionCatalog.host else {
            return .rejected(.foreignOrigin, "\(sender.scheme)://\(sender.host) is not the edition")
        }
        let verdict = BridgeValidator.validate(body)
        if case .accepted(let message) = verdict, !limiter.allow(message.type, at: now) {
            return .rejected(.rateLimited, "\(message.type) over \(limiter.limit) per second")
        }
        return verdict
    }

    func userContentController(
        _ userContentController: WKUserContentController, didReceive message: WKScriptMessage
    ) async -> (Any?, String?) {
        let origin = message.frameInfo.securityOrigin
        let sender = Sender(isMainFrame: message.frameInfo.isMainFrame, scheme: origin.protocol, host: origin.host)
        let verdict = Self.decide(
            body: message.body, from: sender, now: Date().timeIntervalSinceReferenceDate, limiter: &limiter)
        switch verdict {
        case .rejected(let reason, let detail):
            #if DEBUG
                print("bridge rejected \(reason.rawValue): \(detail)")
                onMessage?("rejected", reason.rawValue, nil)
            #endif
            return (["status": "rejected", "reason": reason.rawValue], nil)
        case .accepted(let accepted):
            return (await serveAsync(accepted), nil)
        }
    }

    /// Serves an accepted message. In a DEBUG build it also reports the message's type and outcome,
    /// with a storage message's namespace, for a UI test's evidence; never the body.
    func serve(_ message: BridgeMessage) -> [String: Any] {
        let reply = handle(message)
        #if DEBUG
            let namespace = message.type.hasPrefix("storage.") ? Self.string(message.body, "namespace") : nil
            onMessage?(message.type, reply["status"] as? String ?? "", namespace)
        #endif
        return reply
    }

    /// Source downloads live on their own actor; no network or digest work blocks the reader.
    func serveAsync(_ message: BridgeMessage) async -> [String: Any] {
        guard message.type == "facsimile.status" || message.type == "facsimile.request" else {
            return serve(message)
        }
        let reply: [String: Any]
        if let facsimiles, let key = Self.string(message.body, "key") {
            let snapshot: FacsimileStatus?
            if message.type == "facsimile.request" {
                snapshot = await facsimiles.request(key)
            } else {
                snapshot = await facsimiles.status(key)
            }
            reply = snapshot.map { ["status": "ok", "value": $0.bridgeValue] } ?? ["status": "missing"]
        } else {
            reply = Self.unavailable
        }
        #if DEBUG
            onMessage?(message.type, reply["status"] as? String ?? "", nil)
        #endif
        return reply
    }

    private static let okay: [String: Any] = ["status": "ok"]
    /// Accepted by the schema, not yet served by this build: said plainly, never faked.
    private static let unavailable: [String: Any] = ["status": "unavailable"]

    func handle(_ message: BridgeMessage) -> [String: Any] {
        let body = message.body
        switch message.type {
        case "hello":
            return ["status": "ok", "value": ["bridgeVersion": BridgeProtocol.version, "capabilities": capabilities]]
        case "share.request":
            return share(body)
        case "storage.read", "storage.write":
            return storage(message.type, body)
        case "storage.clear":
            return clearNamespace(body)
        case "storage.beginSnapshot", "storage.appendSnapshot", "storage.readSnapshotPart":
            return snapshotPart(message.type, body)
        case "storage.list", "storage.export":
            return readerDataReply(message.type, body)
        case "settings.changed":
            if let theme = Self.string(body, "theme") { onTheme?(theme) }
            if case .number(let size) = body["typeSize"], size.isFinite, size == size.rounded() {
                onTypeSize?(Int(size))
            }
            return Self.okay
        case "route.changed":
            onRoute?(Self.string(body, "route") ?? "", Self.string(body, "anchor"), Self.string(body, "title") ?? "")
            return Self.okay
        #if DEBUG
            case "test.log", "test.snapshot":
                return testOnly(message.type, body)
        #endif
        default:
            return Self.unavailable
        }
    }

    #if DEBUG
        /// A UI-test launch's test console: a console line, or a request to keep the page's DOM.
        private func testOnly(_ type: String, _ body: [String: JSONValue]) -> [String: Any] {
            if type == "test.log" {
                onTestLog?(Self.string(body, "level") ?? "log", Self.string(body, "message") ?? "")
            } else {
                onTestSnapshot?(Self.string(body, "route") ?? "")
            }
            return Self.okay
        }
    #endif

    private func storage(_ type: String, _ body: [String: JSONValue]) -> [String: Any] {
        guard let store, let namespace = Self.string(body, "namespace"), let key = Self.string(body, "key") else {
            return Self.unavailable
        }
        if type == "storage.write" {
            let value = Self.string(body, "value") ?? ""
            if namespace == readerData?.snapshot.namespace, key == readerData?.snapshot.key {
                upload = nil
                Self.uploadOwners.removeValue(forKey: store.fileURL(namespace: namespace, key: key))
            }
            let written = store.write(namespace: namespace, key: key, value: value)
            if written { onStorageWrite?(namespace, key, value) }
            return ["status": written ? "ok" : "quota"]
        }
        switch store.read(namespace: namespace, key: key) {
        case .value(let text):
            if body["chunked"] == .bool(true), namespace == readerData?.snapshot.namespace,
                key == readerData?.snapshot.key, text.utf8.count > 40 * 1024
            {
                guard text.utf8.count <= Self.maxSnapshotBytes else { return ["status": "quota"] }
                let id = UUID().uuidString
                download = (id, Data(text.utf8), Self.lastClear[store.fileURL(namespace: namespace, key: key)])
                return ["status": "ok", "transfer": id, "bytes": text.utf8.count]
            }
            return ["status": "ok", "value": text]
        case .missing: return ["status": "missing"]
        case .corrupt: return ["status": "corrupt"]
        }
    }

    /// Exact registered namespaces only. A damaged snapshot must stay intact for recovery.
    private func clearNamespace(_ body: [String: JSONValue]) -> [String: Any] {
        guard let store, let readerData, let key = Self.string(body, "namespace"),
            readerData.registry.contains(where: { $0.key == key && $0.clearable == true })
        else { return Self.unavailable }
        let record = readerData.snapshot
        let url = store.fileURL(namespace: record.namespace, key: record.key)
        let checking = body["checkOnly"] == .bool(true)
        if !checking {
            upload = nil
            download = nil
            Self.uploadOwners.removeValue(forKey: url)
            Self.lastClear[url] = UUID()
        }
        switch store.read(namespace: record.namespace, key: record.key) {
        case .missing: return Self.okay
        case .corrupt: return ["status": "corrupt"]
        case .value(let text):
            guard var values = ReaderData.snapshotValues(text) else { return ["status": "corrupt"] }
            if checking { return Self.okay }
            guard values.removeValue(forKey: key) != nil else { return Self.okay }
            guard let bytes = try? JSONSerialization.data(withJSONObject: values, options: [.sortedKeys, .withoutEscapingSlashes]),
                let remaining = String(data: bytes, encoding: .utf8),
                store.write(namespace: record.namespace, key: record.key, value: remaining)
            else { return ["status": "quota"] }
            onStorageWrite?(record.namespace, record.key, remaining)
            return Self.okay
        }
    }

    private func snapshotPart(_ type: String, _ body: [String: JSONValue]) -> [String: Any] {
        guard let store, let record = readerData?.snapshot else { return Self.unavailable }
        let url = store.fileURL(namespace: record.namespace, key: record.key)
        if type == "storage.beginSnapshot" {
            guard case .number(let size) = body["bytes"], let total = Int(exactly: size),
                (1...Self.maxSnapshotBytes).contains(total)
            else { return ["status": "quota"] }
            let id = UUID().uuidString
            upload = Upload(id: id, total: total)
            Self.uploadOwners[url] = id
            return ["status": "ok", "transfer": id]
        }
        guard let id = Self.string(body, "transfer"), case .number(let position) = body["offset"],
            let offset = Int(exactly: position), offset >= 0
        else { return ["status": "corrupt"] }
        if type == "storage.readSnapshotPart" {
            guard let download, download.id == id, download.lastClear == Self.lastClear[url], offset < download.data.count,
                offset.isMultiple(of: Self.partBytes)
            else { return ["status": "missing"] }
            let end = min(offset + Self.partBytes, download.data.count)
            let part = download.data[offset..<end].base64EncodedString().replacingOccurrences(of: "/", with: "_")
            if end == download.data.count { self.download = nil }
            return ["status": "ok", "value": part]
        }

        guard Self.uploadOwners[url] == id, upload?.id == id, let total = upload?.total else {
            return ["status": "missing"]
        }
        guard offset == upload?.data.count, let encoded = Self.string(body, "data"),
            let part = Data(base64Encoded: encoded.replacingOccurrences(of: "_", with: "/")),
            part.count == min(Self.partBytes, total - offset)
        else { return ["status": "corrupt"] }
        upload?.data.append(part)
        guard offset + part.count == total else { return Self.okay }
        defer {
            upload = nil
            Self.uploadOwners.removeValue(forKey: url)
        }
        guard let bytes = upload?.data, let text = String(data: bytes, encoding: .utf8),
            (try? JSONSerialization.jsonObject(with: bytes)) is [String: String]
        else { return ["status": "corrupt"] }
        guard store.write(namespace: record.namespace, key: record.key, value: text) else {
            return ["status": "quota"]
        }
        onStorageWrite?(record.namespace, record.key, text)
        return Self.okay
    }

    /// The reader's data by the site's own namespaces (App plan §8.7). `storage.list` names the
    /// registered keys the app holds, in the registry's order; `storage.export` answers with the
    /// document /your-data/ downloads. A namespace narrows either to the keys that start with it.
    private func readerDataReply(_ type: String, _ body: [String: JSONValue]) -> [String: Any] {
        guard let store, let readerData else { return Self.unavailable }
        guard case .data(let data) = ReaderData.load(from: store, manifest: readerData) else {
            return ["status": "corrupt"]
        }
        let prefix = Self.string(body, "namespace")
        if type == "storage.list" {
            return ["status": "ok", "value": data.held(prefix: prefix ?? "").map(\.key)]
        }
        return ["status": "ok", "value": data.export(prefix: prefix, at: now()).replyObject()]
    }

    private func share(_ body: [String: JSONValue]) -> [String: Any] {
        guard let text = Self.string(body, "url"), let url = URL(string: text), let onShare else {
            return Self.unavailable
        }
        onShare(url)
        return Self.okay
    }

    private static func string(_ body: [String: JSONValue], _ key: String) -> String? {
        if case .string(let text) = body[key] { return text }
        return nil
    }
}

/// The bridge's document-start script, loaded only when its bytes match the
/// SHA-256 the edition export recorded (App plan §7, requirement 8).
enum BridgeScript {
    static func sha256Hex(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    /// The verified source, or nil: no entry, no file, or a digest that differs.
    static func load(_ entry: EditionManifest.UserScript?, directory: URL) -> String? {
        guard let entry, let data = try? Data(contentsOf: directory.appendingPathComponent(entry.file)),
            sha256Hex(data) == entry.sha256
        else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
