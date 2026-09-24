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

    private var limiter = BridgeRateLimiter()
    private let capabilities: [String]

    init(capabilities: [String] = ["route", "share", "print", "find"]) {
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

    private func handle(_ message: BridgeMessage) -> [String: Any] {
        switch message.type {
        case "hello":
            return ["status": "ok", "value": ["bridgeVersion": BridgeProtocol.version, "capabilities": capabilities]]
        case "route.changed":
            var route = ""
            var anchor: String?
            var title = ""
            if case .string(let text) = message.body["route"] { route = text }
            if case .string(let text) = message.body["anchor"] { anchor = text }
            if case .string(let text) = message.body["title"] { title = text }
            onRoute?(route, anchor, title)
            return ["status": "ok"]
        #if DEBUG
            case "test.log":
                if case .string(let text) = message.body["message"] { print("edition: \(text)") }
                return ["status": "ok"]
        #endif
        default:
            // Accepted by the schema, not yet served by this build: said plainly, never faked.
            return ["status": "unavailable"]
        }
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
