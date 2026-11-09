import CryptoKit
import Foundation

/// Only this edition's exact published first-party PDF can cross the network boundary.
enum FacsimileDownloadPolicy {
    static let maximumBytes = 64 * 1024 * 1024
    static let origin = "https://annus-mirabilis.com"

    static func pin(_ asset: FacsimileAsset) throws -> FacsimilePin {
        guard asset.redistributable else { throw FacsimileFailure.notPublished }
        guard asset.key.range(of: #"\Aap-[0-9]{2}-[0-9]{1,4}\z"#, options: .regularExpression) != nil,
            let path = asset.path, path == "/papers/pdfs/\(asset.key).pdf",
            let digest = asset.sha256, digest.count == 64,
            digest.allSatisfy({ "0123456789abcdef".contains($0) }),
            let bytes = asset.bytes, (5...maximumBytes).contains(bytes)
        else { throw FacsimileFailure.invalidPin }
        return FacsimilePin(key: asset.key, path: path, sha256: digest, bytes: bytes)
    }

    static func allows(_ url: URL, pin: FacsimilePin) -> Bool {
        guard pin.path == "/papers/pdfs/\(pin.key).pdf",
            let parts = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else { return false }
        return parts.scheme == "https" && parts.host == "annus-mirabilis.com"
            && (parts.port == nil || parts.port == 443) && parts.user == nil && parts.password == nil
            && parts.query == nil && parts.fragment == nil && parts.percentEncodedPath == pin.path
    }

    /// A small transfer margin; publication still requires the exact recorded byte count and hash.
    static func transferLimit(_ pin: FacsimilePin) -> Int {
        pin.bytes + min(65_536, max(1024, pin.bytes / 100))
    }

    static func requiredSpace(_ pin: FacsimilePin) -> Int64 {
        Int64(transferLimit(pin)) + 1_048_576
    }

    static func response(_ response: URLResponse, pin: FacsimilePin) throws {
        guard let http = response as? HTTPURLResponse, let url = http.url, allows(url, pin: pin) else {
            throw FacsimileFailure.refusedURL
        }
        guard http.statusCode == 200 else { throw FacsimileFailure.response }
        if http.expectedContentLength > Int64(transferLimit(pin)) { throw FacsimileFailure.tooLarge }
    }
}

/// The same incremental check verifies an incoming transfer and a cache file after relaunch.
struct FacsimileIntegrity {
    let pin: FacsimilePin
    private(set) var count = 0
    private var prefix = Data()
    private var hash = SHA256()

    init(pin: FacsimilePin) {
        self.pin = pin
    }

    mutating func append(_ data: Data) throws {
        count += data.count
        guard count <= FacsimileDownloadPolicy.transferLimit(pin) else { throw FacsimileFailure.tooLarge }
        if prefix.count < 5 { prefix.append(data.prefix(5 - prefix.count)) }
        if prefix.count == 5, prefix != Data("%PDF-".utf8) { throw FacsimileFailure.notPDF }
        hash.update(data: data)
    }

    mutating func finish() throws {
        guard prefix == Data("%PDF-".utf8) else { throw FacsimileFailure.notPDF }
        let digest = hash.finalize().map { String(format: "%02x", $0) }.joined()
        guard count == pin.bytes, digest == pin.sha256 else { throw FacsimileFailure.digestMismatch }
    }
}
