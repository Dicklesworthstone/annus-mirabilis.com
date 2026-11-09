import Foundation

protocol FacsimileDownloading: Sendable {
    func download(
        _ pin: FacsimilePin, to staged: URL, progress: @escaping @Sendable (Int) async -> Void
    ) async throws
}

/// The only network path for source PDFs. Bytes are bounded and hashed as they arrive, never
/// accumulated as a whole PDF in memory. Configuration injection lets tests use URLProtocol at
/// this network boundary while keeping the same URL policy, stream checks and file publication.
struct FacsimileDownloader: FacsimileDownloading {
    let makeConfiguration: @Sendable () -> URLSessionConfiguration

    init(makeConfiguration: @escaping @Sendable () -> URLSessionConfiguration = FacsimileDownloader.configuration) {
        self.makeConfiguration = makeConfiguration
    }

    static func configuration() -> URLSessionConfiguration {
        let config = URLSessionConfiguration.ephemeral
        config.urlCache = nil
        config.httpCookieStorage = nil
        config.httpShouldSetCookies = false
        config.urlCredentialStorage = nil
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 300
        config.waitsForConnectivity = false
        return config
    }

    func download(
        _ pin: FacsimilePin, to staged: URL, progress: @escaping @Sendable (Int) async -> Void
    ) async throws {
        guard let url = URL(string: FacsimileDownloadPolicy.origin + pin.path),
            FacsimileDownloadPolicy.allows(url, pin: pin)
        else { throw FacsimileFailure.refusedURL }
        let session = URLSession(configuration: makeConfiguration())
        defer { session.invalidateAndCancel() }
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData)
        request.httpShouldHandleCookies = false
        request.setValue("application/pdf", forHTTPHeaderField: "Accept")
        request.setValue("identity", forHTTPHeaderField: "Accept-Encoding")
        try await withTaskCancellationHandler {
            let (bytes, response) = try await session.bytes(
                for: request, delegate: FacsimileRedirectGuard(pin: pin))
            try FacsimileDownloadPolicy.response(response, pin: pin)
            try await stream(bytes, pin: pin, to: staged, progress: progress)
        } onCancel: {
            session.invalidateAndCancel()
        }
    }

    private func stream(
        _ bytes: URLSession.AsyncBytes, pin: FacsimilePin, to staged: URL,
        progress: @escaping @Sendable (Int) async -> Void
    ) async throws {
        let handle = try FileHandle(forWritingTo: staged)
        defer { try? handle.close() }
        var integrity = FacsimileIntegrity(pin: pin)
        var buffer = Data()
        buffer.reserveCapacity(65_536)
        var received = 0
        var lastProgress = Date.distantPast
        for try await byte in bytes {
            received += 1
            guard received <= FacsimileDownloadPolicy.transferLimit(pin) else { throw FacsimileFailure.tooLarge }
            buffer.append(byte)
            if received == 5, buffer != Data("%PDF-".utf8) { throw FacsimileFailure.notPDF }
            if buffer.count == 65_536 {
                try Task.checkCancellation()
                try integrity.append(buffer)
                try handle.write(contentsOf: buffer)
                buffer.removeAll(keepingCapacity: true)
                if Date().timeIntervalSince(lastProgress) >= 0.15 {
                    await progress(received)
                    lastProgress = Date()
                }
            }
        }
        try Task.checkCancellation()
        try integrity.append(buffer)
        try integrity.finish()
        try handle.write(contentsOf: buffer)
        try handle.synchronize()
        await progress(received)
    }
}

/// Immutable delegate state; redirects can never broaden the exact URL admitted for this pin.
private final class FacsimileRedirectGuard: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    let pin: FacsimilePin

    init(pin: FacsimilePin) {
        self.pin = pin
    }

    func urlSession(
        _ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
        newRequest request: URLRequest, completionHandler: @escaping @Sendable (URLRequest?) -> Void
    ) {
        guard let url = request.url, FacsimileDownloadPolicy.allows(url, pin: pin),
            request.httpMethod == "GET"
        else {
            completionHandler(nil)
            return
        }
        completionHandler(request)
    }
}
