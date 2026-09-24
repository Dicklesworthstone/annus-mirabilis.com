import CryptoKit
import Foundation

/// The reader's own data, kept by the app beside WebKit's copy, so it survives
/// if WebKit ever clears the page's storage (App plan §7.3, §11). It lives in
/// Application Support: part of the reader's device backup, never synced to a
/// server, never indexed. The bridge script decides what goes in: a snapshot of
/// the site's own keys, nothing else.
struct ReaderDataStore: Sendable {
    let directory: URL

    enum ReadResult: Equatable, Sendable {
        case value(String)
        case missing
        case corrupt
    }

    /// Application Support/reader-data, or a separate folder per DEBUG UI-test
    /// state suite so no test reads another's data and none has to delete any.
    static func standard(suite: String? = nil) -> ReaderDataStore {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        var directory = base.appendingPathComponent("reader-data", isDirectory: true)
        if let suite { directory = directory.appendingPathComponent(suite, isDirectory: true) }
        return ReaderDataStore(directory: directory)
    }

    /// The file for one namespace and key: a digest, so no name the page sends can
    /// reach outside the directory, whatever characters it holds.
    func fileURL(namespace: String, key: String) -> URL {
        let digest = SHA256.hash(data: Data("\(namespace)\u{0}\(key)".utf8)).map { String(format: "%02x", $0) }
        return directory.appendingPathComponent(digest.joined() + ".json", isDirectory: false)
    }

    func read(namespace: String, key: String) -> ReadResult {
        let url = fileURL(namespace: namespace, key: key)
        guard FileManager.default.fileExists(atPath: url.path) else { return .missing }
        guard let data = try? Data(contentsOf: url), let text = String(data: data, encoding: .utf8) else {
            return .corrupt
        }
        return .value(text)
    }

    /// Writes atomically, so a crash mid-write leaves the previous copy. False when the disk refuses.
    func write(namespace: String, key: String, value: String) -> Bool {
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try Data(value.utf8).write(to: fileURL(namespace: namespace, key: key), options: .atomic)
            return true
        } catch {
            return false
        }
    }
}
