import CryptoKit
import Foundation
import Testing

@testable import AnnusMirabilis

/// Real filesystem and URLSession boundary fixtures. No store or integrity decision is mocked.
struct FacsimileFixture {
    static let bytes = Data(("%PDF-1.4\n" + String(repeating: "0", count: 160_000) + "\n%%EOF").utf8)

    static func asset(_ data: Data = bytes) -> FacsimileAsset {
        FacsimileAsset(
            key: "ap-18-639", paper: "mass-energy", title: "Ist die Trägheit eines Körpers…",
            receiptHref: "/sources/mass-energy/", redistributable: true, path: "/papers/pdfs/ap-18-639.pdf",
            sha256: SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined(), bytes: data.count)
    }

    static func cache(space: Int64 = 100_000_000) -> FacsimileCache {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("facsimile-test-\(UUID())")
        return FacsimileCache(
            directories: FacsimileDirectories(
                cache: root.appendingPathComponent("Caches"), receipts: root.appendingPathComponent("Receipts")),
            availableSpace: { _ in space })
    }

    static func published(_ cache: FacsimileCache, data: Data = bytes) throws -> FacsimilePin {
        let pin = try FacsimileDownloadPolicy.pin(asset(data))
        let staged = try cache.prepare(pin)
        try data.write(to: staged)
        _ = try cache.publish(staged, pin: pin)
        return pin
    }

    enum WaitFailure: Error { case timeout, ended }

    static func terminal(_ store: FacsimileStore, key: String = "ap-18-639") async throws -> FacsimileStatus {
        let stream = await store.updates()
        return try await withThrowingTaskGroup(of: FacsimileStatus.self) { group in
            group.addTask {
                for await status in stream where status.key == key {
                    if status.state == .verified || status.state == .failed { return status }
                }
                throw WaitFailure.ended
            }
            group.addTask {
                try await Task.sleep(for: .seconds(5))
                throw WaitFailure.timeout
            }
            defer { group.cancelAll() }
            guard let result = try await group.next() else { throw WaitFailure.ended }
            return result
        }
    }
}

/// The immutable response is chosen before a request; held responses make cancellation and
/// concurrent callers deterministic. Locks protect the protocol's non-actor callbacks.
private final class FacsimileHTTPState: @unchecked Sendable {
    struct Response: Sendable {
        let data: Data
        let declaredLength: Int?
        let held: Bool
    }
    private let lock = NSLock()
    private var response = Response(data: Data(), declaredLength: nil, held: false)
    private var count = 0
    private var pending: [(FacsimileHTTPProtocol, Response)] = []

    func configure(_ data: Data, held: Bool = false, declaredLength: Int? = nil) {
        lock.lock()
        defer { lock.unlock() }
        response = Response(data: data, declaredLength: declaredLength, held: held)
        count = 0
        pending = []
    }

    func start(_ request: FacsimileHTTPProtocol) -> Response {
        lock.lock()
        defer { lock.unlock() }
        count += 1
        if response.held { pending.append((request, response)) }
        return response
    }

    var starts: Int {
        lock.lock()
        defer { lock.unlock() }
        return count
    }

    func release() {
        lock.lock()
        let held = pending
        pending = []
        lock.unlock()
        for (request, response) in held { request.deliver(response) }
    }
}

private final class FacsimileHTTPProtocol: URLProtocol, @unchecked Sendable {
    static let state = FacsimileHTTPState()
    private let lock = NSLock()
    private var stopped = false

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let response = Self.state.start(self)
        if !response.held { deliver(response) }
    }

    override func stopLoading() {
        lock.lock()
        stopped = true
        lock.unlock()
    }

    func deliver(_ spec: FacsimileHTTPState.Response) {
        lock.lock()
        let canDeliver = !stopped
        lock.unlock()
        guard canDeliver, let url = request.url,
            let response = HTTPURLResponse(
                url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": "application/pdf", "Content-Length": String(spec.declaredLength ?? spec.data.count),
                ])
        else { return }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        for start in stride(from: 0, to: spec.data.count, by: 8192) {
            client?.urlProtocol(self, didLoad: spec.data.subdata(in: start..<min(start + 8192, spec.data.count)))
        }
        client?.urlProtocolDidFinishLoading(self)
    }
}

@Suite("Pinned facsimile download lifecycle", .serialized, .timeLimit(.minutes(1)))
struct FacsimileStoreTests {
    private func store(_ cache: FacsimileCache, asset: FacsimileAsset = FacsimileFixture.asset()) -> FacsimileStore {
        let downloader = FacsimileDownloader {
            let configuration = FacsimileDownloader.configuration()
            configuration.protocolClasses = [FacsimileHTTPProtocol.self]
            return configuration
        }
        return FacsimileStore(assets: [asset], cache: cache, downloader: downloader)
    }

    private func waitForRequest() async throws {
        for _ in 0..<100 {
            if FacsimileHTTPProtocol.state.starts > 0 { return }
            try await Task.sleep(for: .milliseconds(20))
        }
        throw FacsimileFixture.WaitFailure.timeout
    }

    @Test("status and serving never start downloads; ten reader requests share one transfer")
    func deduplicationAndPublication() async throws {
        let cache = FacsimileFixture.cache()
        let asset = FacsimileFixture.asset()
        let pin = try FacsimileDownloadPolicy.pin(asset)
        let store = store(cache)
        FacsimileHTTPProtocol.state.configure(FacsimileFixture.bytes, held: true)
        #expect(await store.status(asset.key)?.state == .notDownloaded)
        #expect(await store.file(at: pin.path) == nil)
        #expect(FacsimileHTTPProtocol.state.starts == 0)
        await withTaskGroup(of: Void.self) { group in
            for _ in 0..<10 { group.addTask { _ = await store.request(asset.key) } }
        }
        try await waitForRequest()
        #expect(FacsimileHTTPProtocol.state.starts == 1)
        #expect(await store.status(asset.key)?.state == .downloading)
        #expect(!cache.exists(pin))
        FacsimileHTTPProtocol.state.release()
        let terminal = try await FacsimileFixture.terminal(store)
        #expect(terminal.state == .verified && terminal.progress == 1)
        #expect(terminal.bytesReceived == pin.bytes && terminal.path == pin.path)
        #expect(await store.status(asset.key)?.state == .verified)
        #expect(try Data(contentsOf: cache.finalURL(pin)) == FacsimileFixture.bytes)
        #expect(
            try cache.finalURL(pin).resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true)
        let children = try FileManager.default.contentsOfDirectory(atPath: cache.directories.cache.path)
        #expect(children == [cache.finalURL(pin).lastPathComponent])
    }

    @Test("wrong digest, non-PDF, truncated, and oversized transfers never publish a file")
    func corruptTransfers() async throws {
        let correct = FacsimileFixture.bytes
        var changed = correct
        changed[changed.count - 1] ^= 1
        let cases = [changed, Data(repeating: 65, count: correct.count), correct.dropLast(),
            correct + Data(repeating: 0, count: 70_000)]
        for data in cases {
            let cache = FacsimileFixture.cache()
            let store = store(cache)
            let pin = try FacsimileDownloadPolicy.pin(FacsimileFixture.asset())
            FacsimileHTTPProtocol.state.configure(Data(data))
            _ = await store.request(pin.key)
            let result = try await FacsimileFixture.terminal(store)
            #expect(result.state == .failed && result.path == nil)
            #expect(await store.status(pin.key)?.state == .failed)
            #expect(!cache.exists(pin) && !cache.wasVerified(pin))
            #expect(try FileManager.default.contentsOfDirectory(atPath: cache.directories.cache.path).isEmpty)
        }
    }

    @Test("cancellation leaves no published file; a retry cannot be overwritten by the cancelled generation")
    func cancellationAndRetry() async throws {
        let cache = FacsimileFixture.cache()
        let store = store(cache)
        let pin = try FacsimileDownloadPolicy.pin(FacsimileFixture.asset())
        FacsimileHTTPProtocol.state.configure(FacsimileFixture.bytes, held: true)
        _ = await store.request(pin.key)
        try await waitForRequest()
        #expect(await store.cancel(pin.key)?.state == .failed)
        #expect(!cache.exists(pin))
        FacsimileHTTPProtocol.state.release()
        FacsimileHTTPProtocol.state.configure(FacsimileFixture.bytes)
        _ = await store.request(pin.key)
        #expect(try await FacsimileFixture.terminal(store).state == .verified)
        #expect(await store.status(pin.key)?.state == .verified)
        #expect(try Data(contentsOf: cache.finalURL(pin)) == FacsimileFixture.bytes)
    }

    @Test("a changed cache file is refused, then replaced atomically by a verified retry")
    func corruptedCacheRetry() async throws {
        let cache = FacsimileFixture.cache()
        let pin = try FacsimileFixture.published(cache)
        var changed = FacsimileFixture.bytes
        changed[changed.count - 1] ^= 1
        try changed.write(to: cache.finalURL(pin))
        let store = store(cache)
        #expect(await store.status(pin.key)?.state == .failed)
        #expect(await store.file(at: pin.path) == nil)
        FacsimileHTTPProtocol.state.configure(FacsimileFixture.bytes)
        _ = await store.request(pin.key)
        #expect(try await FacsimileFixture.terminal(store).state == .verified)
        #expect(try Data(contentsOf: cache.finalURL(pin)) == FacsimileFixture.bytes)
    }

    @Test("a relaunched store rechecks the file, reports OS eviction, and removes only its pin")
    func relaunchEvictionAndRemoval() async throws {
        let cache = FacsimileFixture.cache()
        let pin = try FacsimileFixture.published(cache)
        let first = store(cache)
        #expect(await first.status(pin.key)?.state == .verified)
        let second = store(cache)
        #expect(await second.status(pin.key)?.state == .verified)
        // Simulate the OS reclaiming this one cache file; its small durable receipt remains.
        try FileManager.default.removeItem(at: cache.finalURL(pin))
        let relaunched = store(cache)
        #expect(await relaunched.status(pin.key)?.state == .evicted)
        _ = try FacsimileFixture.published(cache)
        let unrelated = cache.directories.cache.appendingPathComponent("reader-keeps-this.txt")
        try Data("keep".utf8).write(to: unrelated)
        #expect(await relaunched.remove(pin.key)?.state == .notDownloaded)
        #expect(!cache.exists(pin) && !cache.wasVerified(pin))
        #expect(FileManager.default.fileExists(atPath: unrelated.path))
    }

    @Test("insufficient disk space, missing pins, and unknown keys cannot start network work")
    func refusedBeforeNetwork() async {
        FacsimileHTTPProtocol.state.configure(FacsimileFixture.bytes)
        let lowSpace = store(FacsimileFixture.cache(space: 0))
        let key = FacsimileFixture.asset().key
        #expect(await lowSpace.request(key)?.state == .failed)
        #expect(await lowSpace.request("ap-00-0") == nil)
        let withheld = FacsimileAsset(
            key: key, paper: "mass-energy", title: "Receipt only", receiptHref: "/sources/mass-energy/",
            redistributable: false, path: nil, sha256: nil, bytes: nil)
        let privateStore = store(FacsimileFixture.cache(), asset: withheld)
        #expect(await privateStore.request(key)?.state == .unavailable)
        #expect(FacsimileHTTPProtocol.state.starts == 0)
    }
}
