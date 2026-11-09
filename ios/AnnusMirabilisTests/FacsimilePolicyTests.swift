import Foundation
import Testing

@testable import AnnusMirabilis

/// These bytes exercise the pinned-file boundary, not PDFKit's document parser.
/// The SHA-256 is a fixed fixture, independently computed from the exact UTF-8 bytes.
private let policyPDF = Data("%PDF-1.7\nnative facsimile policy fixture\n%%EOF\n".utf8)
private let policyDigest = "4f0f37a08d4bf345fadaced1af32a0d6cb6645d8a4d0ad356269946990682e24"
private let policyPath = "/papers/pdfs/ap-17-891.pdf"

private func policyAsset(
    key: String = "ap-17-891", published: Bool = true, path: String? = policyPath,
    digest: String? = policyDigest, bytes: Int? = policyPDF.count
) -> FacsimileAsset {
    FacsimileAsset(
        key: key, paper: "special-relativity", title: "Zur Elektrodynamik bewegter Körper",
        receiptHref: "/sources/special-relativity/", redistributable: published,
        path: path, sha256: digest, bytes: bytes)
}

private func expectFacsimileFailure(_ expected: FacsimileFailure, operation: () throws -> Void) {
    do {
        try operation()
        Issue.record("The facsimile boundary accepted a deliberately invalid fixture.")
    } catch {
        #expect((error as? FacsimileFailure) == expected)
    }
}

@Suite("Facsimile source pins and network boundary")
struct FacsimilePolicyTests {
    @Test("a complete published source pin retains the exact path, byte count and digest")
    func completePin() throws {
        let pin = try FacsimileDownloadPolicy.pin(policyAsset())
        #expect(pin.key == "ap-17-891")
        #expect(pin.path == policyPath)
        #expect(pin.sha256 == policyDigest)
        #expect(pin.bytes == 47)
        #expect(try FacsimileDownloadPolicy.pin(policyAsset(bytes: 5)).bytes == 5)
        #expect(
            try FacsimileDownloadPolicy.pin(policyAsset(bytes: FacsimileDownloadPolicy.maximumBytes)).bytes
                == FacsimileDownloadPolicy.maximumBytes)
    }

    @Test("a source that is not published never obtains a download pin")
    func unpublishedSource() {
        expectFacsimileFailure(.notPublished) {
            _ = try FacsimileDownloadPolicy.pin(policyAsset(published: false))
        }
        expectFacsimileFailure(.notPublished) {
            _ = try FacsimileDownloadPolicy.pin(
                policyAsset(published: false, path: nil, digest: nil, bytes: nil))
        }
    }

    @Test("missing and malformed keys, paths, digests and sizes cannot authorize a download")
    func malformedPins() {
        let invalid: [FacsimileAsset] = [
            policyAsset(key: "../ap-17-891"),
            policyAsset(key: "ap-17-891\n"),
            policyAsset(key: "ap-170-891"),
            policyAsset(key: "ap-17-89100"),
            policyAsset(path: nil),
            policyAsset(path: "/papers/pdfs/ap-17-549.pdf"),
            policyAsset(path: "papers/pdfs/ap-17-891.pdf"),
            policyAsset(path: "/papers/pdfs/../ap-17-891.pdf"),
            policyAsset(path: "/papers/pdfs/ap-17-%38%39%31.pdf"),
            policyAsset(path: "https://annus-mirabilis.com" + policyPath),
            policyAsset(digest: nil),
            policyAsset(digest: String(policyDigest.dropLast())),
            policyAsset(digest: policyDigest.uppercased()),
            policyAsset(digest: String(repeating: "g", count: 64)),
            policyAsset(digest: policyDigest + "\n"),
            policyAsset(bytes: nil),
            policyAsset(bytes: -1),
            policyAsset(bytes: 0),
            policyAsset(bytes: 4),
            policyAsset(bytes: FacsimileDownloadPolicy.maximumBytes + 1),
        ]
        for asset in invalid {
            expectFacsimileFailure(.invalidPin) { _ = try FacsimileDownloadPolicy.pin(asset) }
        }
    }

    @Test("only the exact HTTPS PDF address and its default port pass the request policy")
    func exactAddress() throws {
        let pin = try FacsimileDownloadPolicy.pin(policyAsset())
        for address in [
            "https://annus-mirabilis.com" + policyPath,
            "https://annus-mirabilis.com:443" + policyPath,
        ] {
            #expect(FacsimileDownloadPolicy.allows(try #require(URL(string: address)), pin: pin))
        }
        let refused = [
            "http://annus-mirabilis.com" + policyPath,
            "https://www.annus-mirabilis.com" + policyPath,
            "https://annus-mirabilis.com.example.org" + policyPath,
            "https://example.org" + policyPath,
            "https://annus-mirabilis.com:444" + policyPath,
            "https://reader@annus-mirabilis.com" + policyPath,
            "https://reader:secret@annus-mirabilis.com" + policyPath,
            "https://annus-mirabilis.com" + policyPath + "?download=1",
            "https://annus-mirabilis.com" + policyPath + "#page=1",
            "https://annus-mirabilis.com/papers/pdfs/ap-17-549.pdf",
            "https://annus-mirabilis.com/papers/pdfs/ap-17-%38%39%31.pdf",
            "file:///papers/pdfs/ap-17-891.pdf",
        ]
        for address in refused {
            #expect(!FacsimileDownloadPolicy.allows(try #require(URL(string: address)), pin: pin))
        }
        let forged = FacsimilePin(key: pin.key, path: "/outside.pdf", sha256: pin.sha256, bytes: pin.bytes)
        #expect(
            !FacsimileDownloadPolicy.allows(
                try #require(URL(string: "https://annus-mirabilis.com/outside.pdf")), pin: forged))
    }

    @Test("a successful response must retain the exact URL, status and bounded declared length")
    func responseBoundary() throws {
        let pin = try FacsimileDownloadPolicy.pin(policyAsset())
        let url = try #require(URL(string: FacsimileDownloadPolicy.origin + pin.path))
        let good = try #require(
            HTTPURLResponse(
                url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                headerFields: ["Content-Length": String(pin.bytes), "Content-Type": "application/pdf"]))
        try FacsimileDownloadPolicy.response(good, pin: pin)
        // Streaming responses may omit length; streamed bytes are still bounded and hashed.
        let unknownLength = try #require(
            HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [:]))
        try FacsimileDownloadPolicy.response(unknownLength, pin: pin)
        for status in [206, 301, 302, 404, 500] {
            let response = try #require(
                HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: [:]))
            expectFacsimileFailure(.response) { try FacsimileDownloadPolicy.response(response, pin: pin) }
        }
        let redirected = try #require(
            HTTPURLResponse(
                url: try #require(URL(string: "https://elsewhere.example" + policyPath)),
                statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [:]))
        expectFacsimileFailure(.refusedURL) { try FacsimileDownloadPolicy.response(redirected, pin: pin) }
        let nonHTTP = URLResponse(
            url: url, mimeType: "application/pdf", expectedContentLength: pin.bytes, textEncodingName: nil)
        expectFacsimileFailure(.refusedURL) { try FacsimileDownloadPolicy.response(nonHTTP, pin: pin) }
        let oversized = try #require(
            HTTPURLResponse(
                url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                headerFields: ["Content-Length": String(FacsimileDownloadPolicy.transferLimit(pin) + 1)]))
        expectFacsimileFailure(.tooLarge) { try FacsimileDownloadPolicy.response(oversized, pin: pin) }
    }

    @Test("the download configuration has no persisted cache, cookies or credentials")
    func privateConfiguration() {
        let configuration = FacsimileDownloader.configuration()
        #expect(configuration.identifier == nil)
        #expect(configuration.urlCache == nil)
        #expect(configuration.httpCookieStorage == nil)
        #expect(configuration.urlCredentialStorage == nil)
        #expect(!configuration.httpShouldSetCookies)
        #expect(configuration.requestCachePolicy == .reloadIgnoringLocalCacheData)
        #expect(!configuration.waitsForConnectivity)
        #expect(configuration.timeoutIntervalForRequest == 60)
        #expect(configuration.timeoutIntervalForResource == 300)
    }

    @Test("the transfer and disk margins are bounded even at the maximum published PDF size")
    func budgets() throws {
        for bytes in [5, policyPDF.count, FacsimileDownloadPolicy.maximumBytes] {
            let pin = try FacsimileDownloadPolicy.pin(policyAsset(bytes: bytes))
            let limit = FacsimileDownloadPolicy.transferLimit(pin)
            #expect(limit > bytes)
            #expect(limit <= bytes + 65_536)
            #expect(FacsimileDownloadPolicy.requiredSpace(pin) == Int64(limit) + 1_048_576)
        }
    }
}

@Suite("Streamed facsimile integrity")
struct FacsimileIntegrityTests {
    @Test(
        "a pinned PDF verifies across arbitrary prefix and content chunk boundaries",
        arguments: [1, 2, 4, 5, 9, 65_536])
    func chunkedSuccess(chunkSize: Int) throws {
        let pin = try FacsimileDownloadPolicy.pin(policyAsset())
        var integrity = FacsimileIntegrity(pin: pin)
        try integrity.append(Data())
        for start in stride(from: 0, to: policyPDF.count, by: chunkSize) {
            try integrity.append(policyPDF.subdata(in: start..<min(policyPDF.count, start + chunkSize)))
        }
        #expect(integrity.count == pin.bytes)
        try integrity.finish()
    }

    @Test("an incorrect PDF prefix is refused as soon as its fifth byte arrives")
    func badPrefix() throws {
        var integrity = FacsimileIntegrity(pin: try FacsimileDownloadPolicy.pin(policyAsset()))
        try integrity.append(Data("%PD".utf8))
        #expect(integrity.count == 3)
        expectFacsimileFailure(.notPDF) { try integrity.append(Data("X-".utf8)) }
        var tooShort = FacsimileIntegrity(pin: try FacsimileDownloadPolicy.pin(policyAsset()))
        try tooShort.append(Data("%PDF".utf8))
        expectFacsimileFailure(.notPDF) { try tooShort.finish() }
    }

    @Test("matching size and header do not excuse a wrong digest or changed content")
    func digestMismatch() throws {
        var wrongPin = FacsimileIntegrity(
            pin: try FacsimileDownloadPolicy.pin(policyAsset(digest: String(repeating: "0", count: 64))))
        try wrongPin.append(policyPDF)
        expectFacsimileFailure(.digestMismatch) { try wrongPin.finish() }
        var changed = policyPDF
        changed[9] ^= 1
        var wrongBytes = FacsimileIntegrity(pin: try FacsimileDownloadPolicy.pin(policyAsset()))
        try wrongBytes.append(changed)
        #expect(wrongBytes.count == policyPDF.count)
        expectFacsimileFailure(.digestMismatch) { try wrongBytes.finish() }
    }

    @Test("truncation and a short overrun fail the exact recorded length at completion")
    func exactLength() throws {
        let pin = try FacsimileDownloadPolicy.pin(policyAsset())
        var truncated = FacsimileIntegrity(pin: pin)
        try truncated.append(Data(policyPDF.dropLast()))
        expectFacsimileFailure(.digestMismatch) { try truncated.finish() }
        var overrun = FacsimileIntegrity(pin: pin)
        try overrun.append(policyPDF)
        try overrun.append(Data([0]))
        #expect(overrun.count == pin.bytes + 1)
        expectFacsimileFailure(.digestMismatch) { try overrun.finish() }
    }

    @Test("the streaming budget refuses the first byte beyond its bound")
    func boundedStream() throws {
        let pin = try FacsimileDownloadPolicy.pin(policyAsset())
        let limit = FacsimileDownloadPolicy.transferLimit(pin)
        var integrity = FacsimileIntegrity(pin: pin)
        try integrity.append(policyPDF)
        try integrity.append(Data(repeating: 0, count: limit - policyPDF.count))
        #expect(integrity.count == limit)
        expectFacsimileFailure(.tooLarge) { try integrity.append(Data([0])) }
    }
}

@Suite("Facsimile HTTP byte ranges")
struct FacsimileRangeTests {
    @Test("full, closed, open and suffix ranges return exactly their bounded byte interval")
    func admittedRanges() {
        let cases: [(String?, FacsimileRange)] = [
            (nil, .full),
            ("bytes=0-0", .partial(0..<1)),
            ("bytes=2-4", .partial(2..<5)),
            ("bytes=2-", .partial(2..<10)),
            ("bytes=-3", .partial(7..<10)),
            ("bytes=-100", .partial(0..<10)),
            ("bytes=0-100", .partial(0..<10)),
            ("bytes=9-9", .partial(9..<10)),
            ("bytes=0002-0004", .partial(2..<5)),
            ("  bytes=2-4  ", .partial(2..<5)),
        ]
        for (header, expected) in cases {
            #expect(FacsimileRange.parse(header, length: 10) == expected)
        }
        #expect(FacsimileRange.parse(nil, length: 0) == .full)
        #expect(FacsimileRange.full.bounds(length: 0).isEmpty)
    }

    @Test("invalid, overflowing, empty and multipart requests never expand into a full read")
    func refusedRanges() {
        for header in [
            "", "bytes=", "bytes=-", "bytes=-0", "bytes=10-", "bytes=7-2",
            "bytes=0-0,2-3", "bytes=1-2-3", "bytes=+1-2", "bytes=1.0-2", "bytes=1 -2",
            "bytes=1-a", "items=0-1", "bytes=999999999999999999999999999999-",
            "bytes=0-999999999999999999999999999999", "bytes=-999999999999999999999999999999",
        ] {
            #expect(FacsimileRange.parse(header, length: 10) == .unsatisfiable)
        }
        #expect(FacsimileRange.parse("bytes=0-", length: 0) == .unsatisfiable)
        #expect(FacsimileRange.parse("bytes=0-", length: -1) == .unsatisfiable)
    }

    @Test("range status and headers use inclusive HTTP endpoints and the exact response size")
    func rangeHeaders() {
        #expect(FacsimileRange.full.status == 200)
        #expect(FacsimileRange.full.headers(length: 10) == ["Accept-Ranges": "bytes", "Content-Length": "10"])
        let partial = FacsimileRange.partial(2..<5)
        #expect(partial.status == 206)
        #expect(partial.bounds(length: 10) == 2..<5)
        #expect(partial.headers(length: 10) == [
            "Accept-Ranges": "bytes", "Content-Length": "3", "Content-Range": "bytes 2-4/10",
        ])
        #expect(FacsimileRange.unsatisfiable.status == 416)
        #expect(FacsimileRange.unsatisfiable.bounds(length: 10).isEmpty)
        #expect(FacsimileRange.unsatisfiable.headers(length: 10) == [
            "Accept-Ranges": "bytes", "Content-Length": "0", "Content-Range": "bytes */10",
        ])
    }
}
