import SwiftUI

/// Download controls are native; source titles, permissions and destinations come from the edition.
@MainActor
struct FacsimileManagerView: View {
    let session: EditionSession
    @State private var statuses: [String: FacsimileStatus] = [:]
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("Save original scans for offline reading. Scanned pages remain available in the reader.")
                        .foregroundStyle(Color("MutedInk"))
                }
                if let records = session.catalog.sourceAssets, !records.isEmpty {
                    CatalogRecords(records: records) { asset in
                        Section {
                            row(asset)
                        }
                    }
                } else {
                    Text("This edition has no source downloads. Source receipts are available in the reader.")
                }
            }
            .onEditionPaper()
            .navigationTitle("Facsimile downloads")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .task { await observe() }
        }
        .accessibilityIdentifier("facsimile-downloads")
    }

    private func row(_ asset: FacsimileAsset) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            germanTitle(asset.title).font(.headline)
            Text(asset.key).font(.caption).foregroundStyle(Color("MutedInk"))
            if let bytes = asset.bytes, (5...FacsimileDownloadPolicy.maximumBytes).contains(bytes) {
                Text(ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file))
                    .font(.caption).foregroundStyle(Color("MutedInk"))
            }
            if let status = statuses[asset.key] {
                controls(asset, status: status)
            } else if session.facsimiles == nil {
                Text("Downloads are unavailable on this device.").foregroundStyle(Color("MutedInk"))
            } else {
                ProgressView("Checking download")
            }
            Button("Source receipt") { openReceipt(asset) }
                .accessibilityIdentifier("facsimile-receipt-\(asset.key)")
        }
        .padding(.vertical, 4)
    }

    private func germanTitle(_ title: String) -> Text {
        var attributed = AttributedString(title)
        attributed.languageIdentifier = "de"
        return Text(attributed)
    }

    @ViewBuilder
    private func controls(_ asset: FacsimileAsset, status: FacsimileStatus) -> some View {
        switch status.state {
        case .downloading:
            ProgressView(value: status.progress) { Text("Downloading") }
                .accessibilityValue(Text(status.progress, format: .percent.precision(.fractionLength(0))))
            Button("Cancel download") { perform(asset.key, action: .cancel) }
                .accessibilityIdentifier("facsimile-cancel-\(asset.key)")
        case .verified:
            Label("Saved for offline reading", systemImage: "checkmark.circle")
            Button("Open original PDF") { openPDF(asset.key) }
                .accessibilityIdentifier("facsimile-open-\(asset.key)")
            Button("Remove download", role: .destructive) { perform(asset.key, action: .remove) }
                .accessibilityIdentifier("facsimile-remove-\(asset.key)")
        case .evicted:
            Text("This device removed the cached scan. You can download it again.")
            downloadButton(asset.key, title: "Download again")
        case .failed:
            Text(status.reason ?? "The scan could not be downloaded.").foregroundStyle(Color("MutedInk"))
            downloadButton(asset.key, title: "Try download again")
        case .notDownloaded:
            downloadButton(asset.key, title: "Download original PDF")
        case .unavailable:
            Text(status.reason ?? "This scan is not offered for download. See its source receipt.")
                .foregroundStyle(Color("MutedInk"))
        }
    }

    private func downloadButton(_ key: String, title: String) -> some View {
        Button(title) { perform(key, action: .download) }
            .accessibilityIdentifier("facsimile-download-\(key)")
    }

    private enum Action { case download, cancel, remove }

    private func perform(_ key: String, action: Action) {
        guard let store = session.facsimiles else { return }
        Task {
            switch action {
            case .download: _ = await store.request(key)
            case .cancel: _ = await store.cancel(key)
            case .remove: _ = await store.remove(key)
            }
        }
    }

    private func observe() async {
        guard let store = session.facsimiles else { return }
        let stream = await store.updates()
        for asset in session.catalog.sourceAssets?.compactMap(\.value) ?? [] {
            statuses[asset.key] = await store.status(asset.key)
        }
        for await snapshot in stream {
            guard !Task.isCancelled else { return }
            statuses[snapshot.key] = snapshot
        }
    }

    private func openPDF(_ key: String) {
        guard let store = session.facsimiles else { return }
        Task {
            guard let status = await store.status(key) else { return }
            statuses[key] = status
            guard status.state == .verified, let path = status.path else { return }
            session.open(route: path, anchor: nil)
            dismiss()
        }
    }

    private func openReceipt(_ asset: FacsimileAsset) {
        guard let url = URL(string: asset.receiptHref, relativeTo: EditionCatalog.homeURL)?.absoluteURL,
            case .file(let file) = session.catalog.resolve(url), file.contentType.hasPrefix("text/html")
        else { return }
        session.load(url)
        dismiss()
    }
}
