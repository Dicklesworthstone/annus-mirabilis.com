import Foundation

struct FacsimileDirectories: Sendable {
    let cache: URL
    let receipts: URL

    static func application() -> FacsimileDirectories? {
        let manager = FileManager.default
        guard let caches = manager.urls(for: .cachesDirectory, in: .userDomainMask).first,
            let support = manager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        else { return nil }
        return FacsimileDirectories(
            cache: caches.appendingPathComponent("Facsimiles", isDirectory: true),
            receipts: support.appendingPathComponent("FacsimileReceipts", isDirectory: true))
    }
}

struct VerifiedFacsimile: Sendable {
    let url: URL
    let bytes: Int
    let sha256: String
}

/// Used only inside FacsimileStore. Staging and final files share a directory for atomic rename.
struct FacsimileCache: Sendable {
    let directories: FacsimileDirectories
    var availableSpace: @Sendable (URL) throws -> Int64 = { url in
        let values = try url.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey])
        guard let available = values.volumeAvailableCapacityForImportantUsage else { throw FacsimileFailure.storage }
        return available
    }

    func finalURL(_ pin: FacsimilePin) -> URL {
        directories.cache.appendingPathComponent("\(pin.key)-\(pin.sha256.prefix(16)).pdf")
    }

    private func receiptURL(_ pin: FacsimilePin) -> URL {
        directories.receipts.appendingPathComponent("\(pin.key)-\(pin.sha256.prefix(16)).verified")
    }

    func wasVerified(_ pin: FacsimilePin) -> Bool {
        (try? String(contentsOf: receiptURL(pin), encoding: .utf8)) == pin.sha256
    }

    func exists(_ pin: FacsimilePin) -> Bool {
        FileManager.default.fileExists(atPath: finalURL(pin).path)
    }

    func prepare(_ pin: FacsimilePin) throws -> URL {
        let manager = FileManager.default
        try manager.createDirectory(at: directories.cache, withIntermediateDirectories: true)
        try manager.createDirectory(at: directories.receipts, withIntermediateDirectories: true)
        var directory = directories.cache
        try excludeFromBackup(&directory)
        guard try availableSpace(directory) >= FacsimileDownloadPolicy.requiredSpace(pin) else {
            throw FacsimileFailure.insufficientSpace
        }
        let staged = directory.appendingPathComponent(".\(pin.key)-\(UUID().uuidString).part")
        try Data().write(to: staged, options: .withoutOverwriting)
        return staged
    }

    func verified(_ pin: FacsimilePin) throws -> VerifiedFacsimile {
        let file = finalURL(pin)
        try verify(file, pin: pin)
        return VerifiedFacsimile(url: file, bytes: pin.bytes, sha256: pin.sha256)
    }

    func verify(_ file: URL, pin: FacsimilePin) throws {
        let info = try file.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
        guard info.isRegularFile == true, info.isSymbolicLink != true, info.fileSize == pin.bytes else {
            throw FacsimileFailure.digestMismatch
        }
        let handle = try FileHandle(forReadingFrom: file)
        defer { try? handle.close() }
        var integrity = FacsimileIntegrity(pin: pin)
        while let data = try handle.read(upToCount: 65_536), !data.isEmpty {
            try integrity.append(data)
        }
        try integrity.finish()
    }

    func publish(_ staged: URL, pin: FacsimilePin) throws -> VerifiedFacsimile {
        try verify(staged, pin: pin)
        var destination = finalURL(pin)
        let manager = FileManager.default
        if manager.fileExists(atPath: destination.path) {
            let info = try destination.resourceValues(forKeys: [.isSymbolicLinkKey, .isRegularFileKey])
            guard info.isSymbolicLink != true, info.isRegularFile == true else { throw FacsimileFailure.storage }
            if (try? verify(destination, pin: pin)) != nil {
                // Another scene can have published the same immutable file while this transfer ran.
                discard(staged)
            } else {
                _ = try manager.replaceItemAt(destination, withItemAt: staged)
            }
        } else {
            do {
                try manager.moveItem(at: staged, to: destination)
            } catch {
                // A different actor/process won the rename. Trust only a freshly verified winner.
                try verify(destination, pin: pin)
                discard(staged)
            }
        }
        try excludeFromBackup(&destination)
        try Data(pin.sha256.utf8).write(to: receiptURL(pin), options: .atomic)
        return VerifiedFacsimile(url: destination, bytes: pin.bytes, sha256: pin.sha256)
    }

    /// Called only for this download's own staging file, including cancellation and failed verification.
    func discard(_ staged: URL) {
        try? FileManager.default.removeItem(at: staged)
    }

    /// A reader action, scoped to this exact pin and its receipt, never a cache-directory purge.
    func remove(_ pin: FacsimilePin) throws {
        for file in [finalURL(pin), receiptURL(pin)] where FileManager.default.fileExists(atPath: file.path) {
            try FileManager.default.removeItem(at: file)
        }
    }

    private func excludeFromBackup(_ url: inout URL) throws {
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try url.setResourceValues(values)
    }
}
