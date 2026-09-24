import SwiftUI

/// "Your data on this device" (App plan §8.7): what the app holds of the reader's own data,
/// named with the site's own labels, each exportable alone or all together as the file
/// /your-data/ writes. It reads the app's copy, so it still works when WebKit's is gone.
struct ReaderDataView: View {
    let session: EditionSession
    @Environment(\.dismiss) private var dismiss
    @State private var loaded: ReaderData.LoadResult?

    private static let footnote = """
        The app keeps its own copy of what the edition saves, so it survives if the web view's \
        storage is cleared. It leaves this device only when you export it.
        """

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Your data on this device")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                            .tint(Color("PageInk"))
                    }
                }
        }
        .onAppear { loaded = session.loadReaderData() }
    }

    @ViewBuilder private var content: some View {
        switch loaded {
        case .data(let data) where !data.held().isEmpty:
            List {
                Section {
                    ForEach(data.held(), id: \.key) { entry in
                        row(entry, in: data)
                    }
                } footer: {
                    Text(Self.footnote)
                }
                .editionPaperRow()
                Section {
                    Button {
                        session.share(data.export(at: Date()))
                    } label: {
                        Label("Export all of it (JSON)", systemImage: "square.and.arrow.up")
                    }
                    .accessibilityIdentifier("reader-data-export-all")
                }
                .editionPaperRow()
            }
            .onEditionPaper()
            .accessibilityIdentifier("reader-data-list")
        case .data:
            ContentUnavailableView(
                "Nothing saved yet", systemImage: "tray",
                description: Text("Settings you change and notes you save in the edition appear here.")
                    .foregroundStyle(Color("MutedInk")))
        case .corrupt:
            ContentUnavailableView(
                "The app's copy could not be read", systemImage: "exclamationmark.triangle",
                description: Text("The edition's own copy is untouched, and its Your data page can still export it.")
                    .foregroundStyle(Color("MutedInk")))
        case nil:
            ContentUnavailableView("This build keeps no copy", systemImage: "tray")
        }
    }

    private func row(_ entry: ReaderDataManifest.Entry, in data: ReaderData) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.label)
                Text(
                    ByteCountFormatter.string(
                        fromByteCount: Int64(data.values[entry.key]?.utf8.count ?? 0), countStyle: .file)
                )
                .font(.footnote)
                .foregroundStyle(Color("MutedInk"))
            }
            Spacer()
            if entry.exportable {
                Button {
                    session.share(data.export(key: entry.key, at: Date()))
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
                .buttonStyle(.borderless)
                .accessibilityLabel("Export \(entry.label)")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("reader-data-row")
    }
}
