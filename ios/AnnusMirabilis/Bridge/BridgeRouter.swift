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
    /// The export's timestamp; tests fix it.
    var now: () -> Date = { Date() }
    /// Called for an accepted `share.request`; the schema has already checked the URL is a page of the website.
    var onShare: ((URL) -> Void)?
    /// Called for every accepted `settings.changed` that names the page's theme.
    var onTheme: ((String) -> Void)?
    /// Called for every accepted `settings.changed` that names the type size the page shows.
    var onTypeSize: ((Int) -> Void)?

    private var limiter = BridgeRateLimiter()
    private let capabilities: [String]

    /// The same list, in the same order, as BRIDGE_CAPABILITIES in src/platform/app-bridge/userScripts.ts.
    init(capabilities: [String] = ["route", "theme", "share", "storage", "print", "find"]) {
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
            #endif
            return (["status": "rejected", "reason": reason.rawValue], nil)
        case .accepted(let accepted):
            return (handle(accepted), nil)
        }
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
            case "test.log":
                print("edition: \(Self.string(body, "message") ?? "")")
                return Self.okay
        #endif
        default:
            return Self.unavailable
        }
    }

    private func storage(_ type: String, _ body: [String: JSONValue]) -> [String: Any] {
        guard let store, let namespace = Self.string(body, "namespace"), let key = Self.string(body, "key") else {
            return Self.unavailable
        }
        if type == "storage.write" {
            let written = store.write(namespace: namespace, key: key, value: Self.string(body, "value") ?? "")
            return ["status": written ? "ok" : "quota"]
        }
        switch store.read(namespace: namespace, key: key) {
        case .value(let text): return ["status": "ok", "value": text]
        case .missing: return ["status": "missing"]
        case .corrupt: return ["status": "corrupt"]
        }
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
