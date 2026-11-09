import SwiftUI
import UIKit

/// The native entrances surround one permanently mounted reader. Measuring the selected content
/// region keeps that reader above the tab bar or beside the sidebar, without reparenting its
/// WKWebView when the size class changes or a different native screen is selected.
@MainActor
struct EditionShellView<Reader: View>: View {
    let session: EditionSession
    @ViewBuilder let reader: () -> Reader
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var contentFrame = CGRect.zero
    @State private var coordinateName = UUID()
    @State private var columns: NavigationSplitViewVisibility = .all

    private var selection: Binding<EditionShellSection> {
        Binding(get: { session.shell.section }, set: { session.selectShellSection($0) })
    }

    var body: some View {
        ZStack(alignment: .topLeading) {
            Group {
                if sizeClass == .regular { regular } else { compact }
            }
            readerPanel
                .frame(width: max(0, contentFrame.width), height: max(0, contentFrame.height))
                .offset(x: contentFrame.minX, y: contentFrame.minY)
                .opacity(session.shell.showingReader && contentFrame.height > 0 ? 1 : 0)
                .allowsHitTesting(session.shell.showingReader)
                .accessibilityHidden(!session.shell.showingReader)
        }
        .coordinateSpace(name: coordinateName)
        .onPreferenceChange(EditionShellFrame.self) { frame in
            if frame.width > 0, frame.height > 0 {
                Task { @MainActor in contentFrame = frame }
            }
        }
        .background(Color("LaunchBackground").ignoresSafeArea())
        .tint(Color("PageInk"))
        .onChange(of: session.showingSearch) { _, showing in
            if showing {
                session.selectShellSection(.search)
                session.showingSearch = false
            }
        }
        .accessibilityIdentifier("edition-shell")
    }

    private var compact: some View {
        TabView(selection: selection) {
            ForEach(EditionShellSection.allCases) { section in
                destination(section)
                    .tabItem { Label(section.title, systemImage: section.symbol) }
                    .tag(section)
            }
        }
    }

    private var regular: some View {
        NavigationSplitView(columnVisibility: $columns) {
            List(selection: Binding<EditionShellSection?>(
                get: { session.shell.section },
                set: { if let section = $0 { session.selectShellSection(section) } }))
            {
                ForEach(EditionShellSection.allCases) { section in
                    Label(section.title, systemImage: section.symbol)
                        .tag(section)
                        .accessibilityIdentifier("shell-section-\(section.rawValue)")
                }
            }
            .onEditionPaper()
            .navigationTitle("Annus Mirabilis")
        } detail: {
            destination(session.shell.section)
        }
        .navigationSplitViewStyle(.balanced)
    }

    private func destination(_ section: EditionShellSection) -> some View {
        Group {
            switch section {
            case .read: catalogue(.papers)
            case .discover: catalogue(.discover)
            case .lab: catalogue(.instruments)
            case .search: EditionSearchView(session: session, embedded: true)
            case .more: EditionMoreView(session: session)
            }
        }
        // Hide only this panel, not the tab bar or sidebar. Its bounds remain available while
        // the reader is visible, and the native navigation stack keeps its place underneath.
        .opacity(session.shell.showingReader && session.shell.section == section ? 0 : 1)
        .allowsHitTesting(!session.shell.showingReader)
        .accessibilityHidden(session.shell.showingReader)
        .background {
            GeometryReader { proxy in
                Color.clear.preference(
                    key: EditionShellFrame.self,
                    value: session.shell.section == section ? proxy.frame(in: .named(coordinateName)) : .zero)
            }
        }
    }

    @ViewBuilder private func catalogue(_ part: EditionContentsView.Part) -> some View {
        if let catalog = session.nativeCatalog {
            EditionContentsView(
                catalog: catalog,
                open: { route, anchor in session.open(route: route, anchor: anchor) },
                fixedPart: part, session: session)
        } else {
            NavigationStack {
                ContentUnavailableView {
                    Label("Contents are unavailable", systemImage: "book.closed")
                } description: {
                    Text("The bundled edition can still be opened in the reader.")
                } actions: {
                    Button("Open the edition") { session.load(EditionCatalog.homeURL) }
                }
                .onEditionPaper()
                .navigationTitle(part.rawValue)
            }
        }
    }

    private var readerPanel: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button {
                    session.showShellContents()
                } label: {
                    Label(session.shell.section.title, systemImage: "chevron.backward")
                        .font(.body)
                }
                .accessibilityLabel("Back to \(session.shell.section.title)")
                .accessibilityIdentifier("reader-back-to-contents")
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Color("LaunchBackground"))
            Divider()
            reader()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color("LaunchBackground"))
    }
}

private struct EditionShellFrame: PreferenceKey {
    static var defaultValue: CGRect { .zero }
    static func reduce(value: inout CGRect, nextValue: () -> CGRect) {
        let next = nextValue()
        if next.width > 0, next.height > 0 { value = next }
    }
}

/// Each listed destination is retained even if an older edition does not contain it.
@MainActor
private struct EditionMoreView: View {
    let session: EditionSession
    @State private var showingData = false
    @State private var showingFacsimiles = false

    private struct Link: Identifiable {
        let title: String
        let route: String
        let symbol: String
        var id: String { route }
    }

    private static let links = [
        Link(title: "Notebook", route: "/notebook/", symbol: "note.text"),
        Link(title: "Notation", route: "/notation/", symbol: "character.book.closed"),
        Link(title: "Foundations", route: "/foundations/", symbol: "books.vertical"),
        Link(title: "Sources", route: "/sources/", symbol: "doc.text.magnifyingglass"),
        Link(title: "About this edition", route: "/about/", symbol: "info.circle"),
    ]

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(Self.links) { link in
                        let url = destination(link.route)
                        Button {
                            if let url { session.load(url) }
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Label(link.title, systemImage: link.symbol)
                                if url == nil {
                                    Text("Not available in this edition")
                                        .font(.footnote).foregroundStyle(Color("MutedInk"))
                                }
                            }
                        }
                        .disabled(url == nil)
                        .accessibilityIdentifier("more-\(link.route.trimmingCharacters(in: CharacterSet(charactersIn: "/")))")
                    }
                }
                .editionPaperRow()
                Section("On this device") {
                    Button("Facsimile downloads", systemImage: "arrow.down.document") { showingFacsimiles = true }
                    Button("Your data on this device", systemImage: "tray.full") { showingData = true }
                }
                .editionPaperRow()
            }
            .onEditionPaper()
            .navigationTitle("More")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) { EditionReturnToReader(session: session) }
            }
        }
        .sheet(isPresented: $showingData) {
            ReaderDataView(session: session)
                .pausesEditionReader(session)
                .preferredColorScheme(session.pageColorScheme)
                .presentationBackground(Color("LaunchBackground"))
                .pageSizedSheet()
        }
        .sheet(isPresented: $showingFacsimiles) {
            FacsimileManagerView(session: session)
                .pausesEditionReader(session)
                .preferredColorScheme(session.pageColorScheme)
                .presentationBackground(Color("LaunchBackground"))
                .pageSizedSheet()
        }
    }

    private func destination(_ route: String) -> URL? {
        guard let url = EditionCatalog.url(route: route), case .file(let file) = session.catalog.resolve(url),
            file.contentType.hasPrefix("text/html")
        else { return nil }
        return url
    }
}

/// A sheet covers the page without changing the app's scene phase. Use the runtime's existing
/// pause signal, and retain each presentation independently when one sheet opens another.
@MainActor
private struct EditionReaderCover: ViewModifier {
    let session: EditionSession
    @State private var id = UUID()

    func body(content: Content) -> some View {
        content
            .onAppear { session.setReaderCover(id, presented: true) }
            .onDisappear { session.setReaderCover(id, presented: false) }
    }
}

extension View {
    @MainActor func pausesEditionReader(_ session: EditionSession) -> some View {
        modifier(EditionReaderCover(session: session))
    }
}

/// Revealing the parked page preserves WebKit history, form input, scroll, and laboratory state.
@MainActor
struct EditionReturnToReader: View {
    let session: EditionSession
    var identifier = "return-to-reader"

    var body: some View {
        if let url = session.parkedReaderURL {
            Button {
                session.revealReader(url)
            } label: {
                Label("Return to reader", systemImage: "book")
            }
            .accessibilityIdentifier(identifier)
        }
    }
}

/// The portrait and attribution are optional compiled records. Decode/read failure affects this
/// image alone; it cannot remove the paper lists. No network request is made for a native image.
@MainActor
struct EditionPortraitView: View {
    let portrait: NativeCatalog.Portrait
    let catalog: EditionCatalog
    let openCredit: () -> Void
    @State private var image: UIImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let image {
                Image(uiImage: image)
                    .resizable().scaledToFit().frame(maxHeight: 240)
                    .accessibilityLabel(portrait.alt)
            }
            Button(action: openCredit) {
                Text(portrait.credit).font(.footnote)
            }
            .accessibilityHint("Opens the edition's photograph credit")
        }
        .task(id: portrait.path) {
            image = nil
            guard let url = EditionCatalog.url(route: portrait.path), case .file(let file) = catalog.resolve(url),
                file.contentType.hasPrefix("image/"), (1...8_388_608).contains(file.size)
            else { return }
            let source = catalog.fileURL(for: file)
            let bytes = await Task.detached(priority: .utility) {
                try? Data(contentsOf: source, options: .mappedIfSafe)
            }.value
            guard !Task.isCancelled, let bytes, bytes.count == file.size else { return }
            image = UIImage(data: bytes)
        }
    }
}
