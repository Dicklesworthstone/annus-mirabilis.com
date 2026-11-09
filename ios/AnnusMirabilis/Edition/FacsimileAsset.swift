import Foundation

/// A projection of the edition's checked source receipt, never a native rights decision.
struct FacsimileAsset: Decodable, Sendable, Equatable, Identifiable {
    let key: String
    let paper: String
    let title: String
    let receiptHref: String
    let redistributable: Bool
    let path: String?
    let sha256: String?
    let bytes: Int?
    var id: String { key }
}

struct FacsimilePin: Sendable, Equatable {
    let key: String
    let path: String
    let sha256: String
    let bytes: Int
}

struct FacsimileStatus: Sendable, Equatable {
    enum State: String, Sendable {
        case notDownloaded = "not-downloaded"
        case downloading, verified, failed, evicted, unavailable
    }

    let key: String
    let state: State
    let bytesExpected: Int
    var bytesReceived = 0
    var reason: String?
    var path: String?

    var progress: Double {
        guard bytesExpected > 0 else { return 0 }
        return min(1, max(0, Double(bytesReceived) / Double(bytesExpected)))
    }

    /// Made on the main actor by the bridge or its event dispatcher; no Any crosses the store actor.
    var bridgeValue: [String: Any] {
        var value: [String: Any] = [
            "key": key, "state": state.rawValue, "bytesExpected": bytesExpected,
            "bytesReceived": bytesReceived, "progress": progress,
        ]
        if let reason { value["reason"] = reason }
        if state == .verified, let path { value["path"] = path }
        return value
    }
}

enum FacsimileFailure: Error, LocalizedError, Equatable {
    case notPublished, invalidPin, refusedURL, response, tooLarge, notPDF, digestMismatch
    case insufficientSpace, storage, cancelled, network

    var errorDescription: String? {
        switch self {
        case .notPublished: "This scan is not offered for download. Its source receipt is available."
        case .invalidPin: "This edition has no complete download record for this scan."
        case .refusedURL: "The download left the permitted source address. Nothing was saved."
        case .response: "The server could not provide the pinned scan. Please try again."
        case .tooLarge: "The download exceeded the size recorded for this scan. Nothing was saved."
        case .notPDF: "The downloaded file was not a PDF. Nothing was saved."
        case .digestMismatch: "The downloaded file did not match the pinned source. Nothing was saved."
        case .insufficientSpace: "There is not enough free space to save this scan."
        case .storage: "The scan could not be saved on this device. Please try again."
        case .cancelled: "The download was cancelled. You can try again."
        case .network: "The scan could not be downloaded. Check your connection and try again."
        }
    }
}
