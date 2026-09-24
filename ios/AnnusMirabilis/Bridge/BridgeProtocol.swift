import Foundation

/// The native side of the bridge's version-1 protocol. It mirrors
/// src/platform/app-bridge/schemas.ts check for check, in the same order, so
/// the first problem found (and so the verdict) is the same on both sides; the
/// golden fixtures in src/platform/app-bridge/fixtures/messages.json hold both
/// to that (App plan §7; bead am-app-bridge-protocol-ai2g).
enum BridgeProtocol {
    static let version = 1
    static let handlerName = "amEdition"
    static let maxMessageBytes = 256 * 1024
    static let maxShareURLLength = 2048
    static let ratePerSecond = 50

    /// Types a release build accepts. The two test types exist only in DEBUG builds.
    static var messageTypes: Set<String> {
        var types: Set<String> = [
            "hello", "storage.read", "storage.write", "storage.list", "storage.clear", "storage.export",
            "settings.changed", "route.changed", "share.request", "external.open", "facsimile.status",
            "facsimile.request", "print.request",
        ]
        #if DEBUG
            types.formUnion(["test.log", "test.snapshot"])
        #endif
        return types
    }
}

enum BridgeRejection: String, Sendable, Equatable {
    case notAnObject = "not-an-object"
    case unknownVersion = "unknown-version"
    case unknownType = "unknown-type"
    case unknownField = "unknown-field"
    case missingField = "missing-field"
    case wrongType = "wrong-type"
    case oversized
    case badURL = "bad-url"
    case rateLimited = "rate-limited"
    // Native-only: WebKit tells the app which frame and origin sent a message.
    case notMainFrame = "not-main-frame"
    case foreignOrigin = "foreign-origin"
}

/// A JSON value as it arrives from WebKit or from a fixture file.
indirect enum JSONValue: Sendable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    /// WebKit hands a message body over as Foundation objects; JSONSerialization does too.
    init?(foundation value: Any) {
        switch value {
        case is NSNull:
            self = .null
        case let number as NSNumber:
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                self = .bool(number.boolValue)
            } else {
                self = .number(number.doubleValue)
            }
        case let string as String:
            self = .string(string)
        case let array as [Any]:
            let items = array.compactMap(JSONValue.init(foundation:))
            guard items.count == array.count else { return nil }
            self = .array(items)
        case let dictionary as [String: Any]:
            let fields = dictionary.compactMapValues(JSONValue.init(foundation:))
            guard fields.count == dictionary.count else { return nil }
            self = .object(fields)
        default:
            return nil
        }
    }
}

struct BridgeMessage: Sendable, Equatable {
    let type: String
    let body: [String: JSONValue]
}

enum BridgeVerdict: Sendable, Equatable {
    case accepted(BridgeMessage)
    case rejected(BridgeRejection, String)

    /// The fixture file's vocabulary: "ok" or the rejection code.
    var code: String {
        switch self {
        case .accepted: "ok"
        case .rejected(let reason, _): reason.rawValue
        }
    }
}

enum BridgeValidator {
    private enum Kind { case string, boolean, number, stringOrNull }

    private struct Field {
        let name: String
        let kind: Kind
        var optional = false
        var maxLength: Int?
    }

    private static func key(_ name: String, optional: Bool = false) -> Field {
        Field(name: name, kind: .string, optional: optional, maxLength: 256)
    }

    /// Each body's exact fields, in the same order as schemas.ts BODIES.
    private static let bodies: [String: [Field]] = [
        "hello": [],
        "storage.read": [key("namespace"), key("key")],
        "storage.write": [
            key("namespace"), key("key"),
            Field(name: "value", kind: .string, maxLength: BridgeProtocol.maxMessageBytes),
        ],
        "storage.list": [key("namespace")],
        "storage.clear": [key("namespace")],
        "storage.export": [key("namespace", optional: true)],
        "settings.changed": [
            Field(name: "theme", kind: .string, optional: true, maxLength: 64),
            Field(name: "detail", kind: .string, optional: true, maxLength: 64),
            Field(name: "perspective", kind: .string, optional: true, maxLength: 64),
            Field(name: "notation", kind: .string, optional: true, maxLength: 64),
            Field(name: "readingOnly", kind: .boolean, optional: true),
            Field(name: "typeSize", kind: .number, optional: true),
        ],
        "route.changed": [
            Field(name: "route", kind: .string, maxLength: BridgeProtocol.maxShareURLLength),
            Field(name: "anchor", kind: .stringOrNull, maxLength: 256),
            Field(name: "title", kind: .string, maxLength: 512),
        ],
        "share.request": [Field(name: "url", kind: .string, maxLength: BridgeProtocol.maxShareURLLength)],
        "external.open": [Field(name: "url", kind: .string, maxLength: BridgeProtocol.maxShareURLLength)],
        "facsimile.status": [Field(name: "key", kind: .string, maxLength: 32)],
        "facsimile.request": [Field(name: "key", kind: .string, maxLength: 32)],
        "print.request": [],
        "test.log": [
            Field(name: "level", kind: .string, maxLength: 8), Field(name: "message", kind: .string, maxLength: 8192),
        ],
        "test.snapshot": [Field(name: "route", kind: .string, maxLength: BridgeProtocol.maxShareURLLength)],
    ]

    /// JavaScript measures `string.length` in UTF-16 code units, so this does too.
    private static func length(_ text: String) -> Int { text.utf16.count }

    static func validate(_ raw: Any) -> BridgeVerdict {
        switch envelope(raw) {
        case .failure(let rejection):
            return rejection.verdict
        case .success(let parsed):
            if let rejection = checkFields(type: parsed.type, body: parsed.body, spec: parsed.spec)
                ?? specialRule(type: parsed.type, body: parsed.body)
            {
                return rejection
            }
            return .accepted(BridgeMessage(type: parsed.type, body: parsed.body))
        }
    }

    private struct Envelope {
        let type: String
        let body: [String: JSONValue]
        let spec: [Field]
    }

    private struct Rejected: Error {
        let verdict: BridgeVerdict
        init(_ reason: BridgeRejection, _ detail: String) { verdict = .rejected(reason, detail) }
    }

    /// Size, shape, version, type and body object, in schemas.ts order.
    private static func envelope(_ raw: Any) -> Result<Envelope, Rejected> {
        let options: JSONSerialization.WritingOptions = [.fragmentsAllowed, .withoutEscapingSlashes]
        guard let data = try? JSONSerialization.data(withJSONObject: raw, options: options) else {
            return .failure(Rejected(.notAnObject, "the message does not serialize"))
        }
        if data.count > BridgeProtocol.maxMessageBytes {
            return .failure(Rejected(.oversized, "the message is over \(BridgeProtocol.maxMessageBytes) bytes"))
        }
        guard let value = JSONValue(foundation: raw), case .object(let fields) = value else {
            return .failure(Rejected(.notAnObject, "the message is not an object"))
        }
        if let extra = fields.keys.first(where: { !["v", "type", "body"].contains($0) }) {
            return .failure(Rejected(.unknownField, "envelope field '\(extra)'"))
        }
        guard case .number(let version) = fields["v"], version == Double(BridgeProtocol.version) else {
            return .failure(Rejected(.unknownVersion, "version \(String(describing: fields["v"]))"))
        }
        guard case .string(let type) = fields["type"], BridgeProtocol.messageTypes.contains(type),
            let spec = bodies[type]
        else {
            return .failure(Rejected(.unknownType, "type \(String(describing: fields["type"]))"))
        }
        guard case .object(let body) = fields["body"] else {
            return .failure(Rejected(.wrongType, "body is not an object"))
        }
        return .success(Envelope(type: type, body: body, spec: spec))
    }

    /// Unknown fields first, then each field in spec order: missing, kind, length.
    private static func checkFields(type: String, body: [String: JSONValue], spec: [Field]) -> BridgeVerdict? {
        let known = Set(spec.map(\.name))
        if let extra = body.keys.first(where: { !known.contains($0) }) {
            return .rejected(.unknownField, "\(type).\(extra)")
        }
        for field in spec {
            guard let value = body[field.name] else {
                if field.optional { continue }
                return .rejected(.missingField, "\(type).\(field.name)")
            }
            if !matches(field.kind, value) {
                return .rejected(.wrongType, "\(type).\(field.name)")
            }
            if case .string(let text) = value, let max = field.maxLength, length(text) > max {
                return .rejected(.oversized, "\(type).\(field.name) is over \(max) characters")
            }
        }
        return nil
    }

    private static func matches(_ kind: Kind, _ value: JSONValue) -> Bool {
        switch (kind, value) {
        case (.string, .string), (.boolean, .bool), (.stringOrNull, .string), (.stringOrNull, .null):
            true
        case (.number, .number(let number)):
            number.isFinite
        default:
            false
        }
    }

    private static func string(_ body: [String: JSONValue], _ name: String) -> String {
        if case .string(let text) = body[name] { return text }
        return ""
    }

    private static func specialRule(type: String, body: [String: JSONValue]) -> BridgeVerdict? {
        switch type {
        case "route.changed" where !string(body, "route").hasPrefix("/"):
            return .rejected(.badURL, "route.changed.route must start with /")
        case "share.request" where !isCanonicalSiteURL(string(body, "url")):
            return .rejected(.badURL, "share.request.url must be a page of https://annus-mirabilis.com")
        case "external.open" where !isExternalURL(string(body, "url")):
            return .rejected(.badURL, "external.open.url must be https with a host")
        case "facsimile.status", "facsimile.request":
            return string(body, "key").wholeMatch(of: #/ap-\d{2}-\d{1,4}/#) == nil
                ? .rejected(.wrongType, "\(type).key must be a bibliographic key") : nil
        case "test.log" where !["log", "warn", "error"].contains(string(body, "level")):
            return .rejected(.wrongType, "test.log.level must be log, warn or error")
        default:
            return nil
        }
    }

    /// A canonical page of the website: https, this host, no user or password, a path.
    static func isCanonicalSiteURL(_ text: String) -> Bool {
        guard length(text) <= BridgeProtocol.maxShareURLLength, let parts = URLComponents(string: text),
            parts.scheme?.lowercased() == "https", parts.host?.lowercased() == "annus-mirabilis.com",
            parts.user == nil, parts.password == nil, parts.port == nil || parts.port == 443
        else { return false }
        return parts.path.isEmpty || parts.path.hasPrefix("/")
    }

    /// An address to open outside the reader: https with a host, never javascript:, data: or file:.
    static func isExternalURL(_ text: String) -> Bool {
        guard let parts = URLComponents(string: text), parts.scheme?.lowercased() == "https",
            let host = parts.host, !host.isEmpty
        else { return false }
        return parts.user == nil && parts.password == nil
    }
}

/// Per message type, per second, over a sliding window. Time is passed in.
struct BridgeRateLimiter {
    let limit: Int
    private var seen: [String: [TimeInterval]] = [:]

    init(limit: Int = BridgeProtocol.ratePerSecond) {
        self.limit = limit
    }

    mutating func allow(_ type: String, at now: TimeInterval) -> Bool {
        var recent = (seen[type] ?? []).filter { now - $0 < 1 }
        guard recent.count < limit else {
            seen[type] = recent
            return false
        }
        recent.append(now)
        seen[type] = recent
        return true
    }
}
