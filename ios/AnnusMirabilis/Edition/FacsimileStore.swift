import Foundation

/// One owner for requests, progress and publication. A second request for an in-flight key shares
/// its transfer. A cancelled generation can neither publish nor overwrite a subsequent retry.
actor FacsimileStore {
    private struct Transfer {
        let token: UUID
        let task: Task<Void, Never>
    }

    private let assets: [String: FacsimileAsset]
    private let cache: FacsimileCache
    private let downloader: any FacsimileDownloading
    private var states: [String: FacsimileStatus] = [:]
    private var transfers: [String: Transfer] = [:]
    private var observers: [UUID: AsyncStream<FacsimileStatus>.Continuation] = [:]

    init(
        assets: [FacsimileAsset], cache: FacsimileCache,
        downloader: any FacsimileDownloading = FacsimileDownloader()
    ) {
        self.assets = Dictionary(assets.map { ($0.key, $0) }, uniquingKeysWith: { first, _ in first })
        self.cache = cache
        self.downloader = downloader
    }

    func updates() -> AsyncStream<FacsimileStatus> {
        let token = UUID()
        let pair = AsyncStream<FacsimileStatus>.makeStream(bufferingPolicy: .bufferingNewest(64))
        observers[token] = pair.continuation
        pair.continuation.onTermination = { [weak self] _ in
            Task { await self?.removeObserver(token) }
        }
        for snapshot in states.values { pair.continuation.yield(snapshot) }
        return pair.stream
    }

    private func removeObserver(_ token: UUID) {
        observers[token] = nil
    }

    private func set(_ snapshot: FacsimileStatus) -> FacsimileStatus {
        states[snapshot.key] = snapshot
        for observer in observers.values { observer.yield(snapshot) }
        return snapshot
    }

    /// No network request can originate in a status check or in file serving.
    func status(_ key: String) -> FacsimileStatus? {
        guard let asset = assets[key] else { return nil }
        if transfers[key] != nil { return states[key] }
        guard let pin = try? FacsimileDownloadPolicy.pin(asset) else {
            return set(FacsimileStatus(
                key: key, state: .unavailable, bytesExpected: 0,
                reason: asset.redistributable
                    ? FacsimileFailure.invalidPin.localizedDescription
                    : FacsimileFailure.notPublished.localizedDescription))
        }
        if cache.exists(pin) {
            do {
                _ = try cache.verified(pin)
                return set(verified(pin))
            } catch {
                if cache.exists(pin) { return set(failed(pin, error: error)) }
            }
        }
        if let previous = states[key], previous.state == .failed { return previous }
        let evicted = states[key]?.state == .verified || cache.wasVerified(pin)
        return set(FacsimileStatus(key: key, state: evicted ? .evicted : .notDownloaded, bytesExpected: pin.bytes))
    }

    /// Starts only in response to the reader's action, and replies before the transfer completes.
    func request(_ key: String) -> FacsimileStatus? {
        guard let current = status(key) else { return nil }
        if current.state == .verified || current.state == .downloading || current.state == .unavailable {
            return current
        }
        guard let asset = assets[key], let pin = try? FacsimileDownloadPolicy.pin(asset) else { return current }
        let staged: URL
        do {
            staged = try cache.prepare(pin)
        } catch {
            return set(failed(pin, error: error))
        }
        let token = UUID()
        let snapshot = set(FacsimileStatus(key: key, state: .downloading, bytesExpected: pin.bytes))
        let task = Task { [weak self] in
            guard let self else { return }
            await self.perform(pin, staged: staged, token: token)
        }
        transfers[key] = Transfer(token: token, task: task)
        return snapshot
    }

    private func perform(_ pin: FacsimilePin, staged: URL, token: UUID) async {
        defer {
            cache.discard(staged)
            if transfers[pin.key]?.token == token { transfers[pin.key] = nil }
        }
        do {
            try await downloader.download(pin, to: staged) { [weak self] bytes in
                await self?.progress(pin, token: token, bytes: bytes)
            }
            try Task.checkCancellation()
            guard transfers[pin.key]?.token == token else { return }
            _ = try cache.publish(staged, pin: pin)
            _ = set(verified(pin))
        } catch {
            guard transfers[pin.key]?.token == token else { return }
            _ = set(failed(pin, error: error))
        }
    }

    private func progress(_ pin: FacsimilePin, token: UUID, bytes: Int) {
        guard transfers[pin.key]?.token == token else { return }
        _ = set(FacsimileStatus(
            key: pin.key, state: .downloading, bytesExpected: pin.bytes, bytesReceived: min(bytes, pin.bytes)))
    }

    func cancel(_ key: String) -> FacsimileStatus? {
        guard let transfer = transfers.removeValue(forKey: key), let asset = assets[key],
            let pin = try? FacsimileDownloadPolicy.pin(asset)
        else { return status(key) }
        transfer.task.cancel()
        return set(failed(pin, error: FacsimileFailure.cancelled))
    }

    func remove(_ key: String) -> FacsimileStatus? {
        if let transfer = transfers.removeValue(forKey: key) { transfer.task.cancel() }
        guard let asset = assets[key], let pin = try? FacsimileDownloadPolicy.pin(asset) else { return status(key) }
        do {
            try cache.remove(pin)
            return set(FacsimileStatus(key: key, state: .notDownloaded, bytesExpected: pin.bytes))
        } catch {
            return set(failed(pin, error: error))
        }
    }

    /// The scheme handler names the original PDF path. No arbitrary cache path is ever accepted.
    func file(at path: String) -> VerifiedFacsimile? {
        guard let asset = assets.values.first(where: { $0.path == path }),
            let pin = try? FacsimileDownloadPolicy.pin(asset), transfers[asset.key] == nil
        else { return nil }
        do {
            let file = try cache.verified(pin)
            _ = set(verified(pin))
            return file
        } catch {
            if cache.exists(pin) { _ = set(failed(pin, error: error)) } else { _ = status(asset.key) }
            return nil
        }
    }

    private func verified(_ pin: FacsimilePin) -> FacsimileStatus {
        FacsimileStatus(
            key: pin.key, state: .verified, bytesExpected: pin.bytes, bytesReceived: pin.bytes, path: pin.path)
    }

    private func failed(_ pin: FacsimilePin, error: any Error) -> FacsimileStatus {
        let failure: FacsimileFailure
        if error is CancellationError || (error as? URLError)?.code == .cancelled {
            failure = .cancelled
        } else if let known = error as? FacsimileFailure {
            failure = known
        } else if error is URLError {
            failure = .network
        } else {
            failure = .storage
        }
        return FacsimileStatus(
            key: pin.key, state: .failed, bytesExpected: pin.bytes, reason: failure.localizedDescription)
    }
}
