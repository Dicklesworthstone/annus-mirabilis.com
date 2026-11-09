import Foundation

/// One HTTP byte range. Multipart and malformed ranges are refused, never expanded into a full read.
enum FacsimileRange: Equatable, Sendable {
    case full
    case partial(Range<Int>)
    case unsatisfiable

    static func parse(_ header: String?, length: Int) -> FacsimileRange {
        guard let header else { return .full }
        let value = header.trimmingCharacters(in: .whitespaces)
        guard length > 0, value.hasPrefix("bytes=") else { return .unsatisfiable }
        let parts = value.dropFirst(6).split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 2, parts.allSatisfy({ $0.allSatisfy({ "0123456789".contains($0) }) }) else {
            return .unsatisfiable
        }
        if parts[0].isEmpty {
            guard let suffix = Int(parts[1]), suffix > 0 else { return .unsatisfiable }
            return .partial(max(0, length - min(suffix, length))..<length)
        }
        guard let first = Int(parts[0]), first < length else { return .unsatisfiable }
        if parts[1].isEmpty { return .partial(first..<length) }
        guard let last = Int(parts[1]), last >= first else { return .unsatisfiable }
        return .partial(first..<(min(last, length - 1) + 1))
    }

    var status: Int {
        switch self {
        case .full: 200
        case .partial: 206
        case .unsatisfiable: 416
        }
    }

    func bounds(length: Int) -> Range<Int> {
        switch self {
        case .full: 0..<length
        case .partial(let range): range
        case .unsatisfiable: 0..<0
        }
    }

    func headers(length: Int) -> [String: String] {
        var headers = ["Accept-Ranges": "bytes", "Content-Length": String(bounds(length: length).count)]
        switch self {
        case .partial(let range):
            headers["Content-Range"] = "bytes \(range.lowerBound)-\(range.upperBound - 1)/\(length)"
        case .unsatisfiable: headers["Content-Range"] = "bytes */\(length)"
        case .full: break
        }
        return headers
    }

    /// Only a freshly verified store result reaches this read. File IO stays away from the main actor.
    static func read(_ file: VerifiedFacsimile, range: FacsimileRange, head: Bool) async -> Data? {
        if head || range == .unsatisfiable { return Data() }
        return await Task.detached(priority: .userInitiated) {
            do {
                let handle = try FileHandle(forReadingFrom: file.url)
                defer { try? handle.close() }
                let bounds = range.bounds(length: file.bytes)
                try handle.seek(toOffset: UInt64(bounds.lowerBound))
                var body = Data()
                body.reserveCapacity(bounds.count)
                while body.count < bounds.count {
                    guard let chunk = try handle.read(upToCount: min(65_536, bounds.count - body.count)),
                        !chunk.isEmpty
                    else { return nil }
                    body.append(chunk)
                }
                return body
            } catch {
                return nil
            }
        }.value
    }
}
