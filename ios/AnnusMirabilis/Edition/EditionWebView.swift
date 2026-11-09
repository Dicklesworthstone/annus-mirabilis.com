import SwiftUI
import UIKit
import WebKit

/// The bundled edition in one web view (App plan §6.3). Every face, reading,
/// equation and instrument is the website's own code; this view only hosts the
/// session's web view.
struct EditionWebView: UIViewRepresentable {
    let session: EditionSession

    func makeUIView(context: Context) -> WKWebView {
        session.webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}
}

/// Command-K reaches native search even while WebKit owns keyboard focus. The command is
/// a native action, not a synthetic key or reader-supplied JavaScript.
@MainActor
final class EditionReaderWebView: WKWebView {
    var onSearch: (() -> Void)?

    override var keyCommands: [UIKeyCommand]? {
        let search = UIKeyCommand(input: "k", modifierFlags: .command, action: #selector(openNativeSearch))
        search.discoverabilityTitle = "Search the edition"
        search.wantsPriorityOverSystemBehavior = true
        return (super.keyCommands ?? []) + [search]
    }

    @objc private func openNativeSearch() {
        onSearch?()
    }
}

/// Native search and the page actions, above the edition's own chrome:
/// the share sheet, printing, and the system find bar. The page's own header
/// keeps its navigation; this adds no second menu of destinations.
@MainActor
struct PageActionsButton: View {
    @Bindable var session: EditionSession
    var embeddedInShell = false
    @State private var showingReaderData = false
    @State private var showingContents = false
    @State private var showingFacsimiles = false
    /// 44 points at the default text size, growing with the reader's up to 64. It floats over
    /// the reading column, so past that it would cover the page it serves: at 88 points it hid
    /// the Detail control's chevron. At accessibility sizes a long press shows the Large Content
    /// Viewer instead, the system's answer for a control that cannot keep growing.
    @ScaledMetric(relativeTo: .body) private var side: CGFloat = 44

    var body: some View {
        HStack(spacing: 8) {
            Button {
                if embeddedInShell { session.selectShellSection(.search) } else { session.showingSearch = true }
            } label: {
                Image(systemName: "magnifyingglass")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(Color("PageInk"))
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    .frame(width: min(side, 64), height: min(side, 64))
                    .modifier(FloatingSurface())
            }
            .keyboardShortcut("k", modifiers: .command)
            .accessibilityLabel("Search the edition")
            .accessibilityHint("Find papers, passages, people, and instruments in this edition")
            .accessibilityIdentifier("native-search")
            .accessibilityShowsLargeContentViewer {
                Label("Search the edition", systemImage: "magnifyingglass")
            }
            pageActions
        }
        .sheet(isPresented: Binding(
            get: { !embeddedInShell && session.showingSearch },
            set: { session.showingSearch = $0 }))
        {
            EditionSearchView(session: session)
                .pausesEditionReader(session)
                .preferredColorScheme(session.pageColorScheme)
                .presentationBackground(Color("LaunchBackground"))
                .pageSizedSheet()
        }
    }

    private var pageActions: some View {
        Menu {
            // The only visible way back: the edge swipe does the same, but nothing shows it exists.
            Button {
                session.goBack()
            } label: {
                Label("Back", systemImage: "chevron.backward")
            }
            .disabled(!session.canGoBack)
            Divider()
            if session.nativeCatalog != nil {
                Button {
                    showingContents = true
                } label: {
                    Label("Contents", systemImage: "list.bullet")
                }
                Divider()
            }
            if let url = session.canonicalURL {
                ShareLink(
                    item: url,
                    subject: Text(session.title ?? "Annus Mirabilis"),
                    preview: SharePreview(session.title ?? "Annus Mirabilis", icon: Image("PageMark"))
                ) {
                    Label("Share this page", systemImage: "square.and.arrow.up")
                }
            }
            Button {
                session.printPage()
            } label: {
                Label("Print this page", systemImage: "printer")
            }
            Button {
                session.findOnPage()
            } label: {
                Label("Find on this page", systemImage: "text.magnifyingglass")
            }
            Divider()
            Button("Facsimile downloads", systemImage: "arrow.down.document") { showingFacsimiles = true }
            Button {
                showingReaderData = true
            } label: {
                Label("Your data on this device", systemImage: "tray.full")
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.body.weight(.semibold))
                .foregroundStyle(Color("PageInk"))
                .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                .frame(width: min(side, 64), height: min(side, 64))
                .modifier(FloatingSurface())
        }
        .tint(.primary)
        .accessibilityShowsLargeContentViewer {
            Label("Page actions", systemImage: "ellipsis")
        }
        .accessibilityLabel("Page actions")
        .accessibilityHint("Back, contents, share, print, find, facsimile downloads, or your data on this device")
        .accessibilityIdentifier("page-actions")
        // A sheet is its own presentation: without this it follows the device, not the reader's theme.
        .sheet(isPresented: $showingReaderData) {
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
        .sheet(isPresented: $showingContents) {
            if let catalog = session.nativeCatalog {
                EditionContentsView(catalog: catalog, open: { route, anchor in
                    session.open(route: route, anchor: anchor)
                }, session: session)
                .pausesEditionReader(session)
                .preferredColorScheme(session.pageColorScheme)
                .presentationBackground(Color("LaunchBackground"))
                .pageSizedSheet()
            }
        }
    }
}

/// Liquid Glass where the system has it, a plain disc before iOS 26. Either way
/// the disc carries the page's paper and the icon the page's ink, so the button
/// reads at the site's own ink-on-paper contrast in both themes. Untinted glass
/// adapts to what lies behind it: on a dark page it was caught once as a grey
/// disc with grey dots at 2.08:1, and rendered at 15:1 on a later run. The tint
/// takes the contrast out of the glass's hands.
private struct FloatingSurface: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular.tint(Color("LaunchBackground").opacity(0.9)).interactive(), in: .circle)
        } else {
            content
                .background(Color("LaunchBackground").opacity(0.95), in: Circle())
                .overlay(Circle().strokeBorder(.separator, lineWidth: 0.5))
        }
    }
}

// MARK: - Native search sheet

/// Search stays inside the app: the same index and ranking as the site, then a manifest-checked
/// local reader link. No web storage, telemetry, or network request participates.
@MainActor
struct EditionSearchView: View {
    let session: EditionSession
    let embedded: Bool
    @State private var model: NativeSearchModel
    @State private var query = ""
    @State private var paper = ""
    @State private var type = ""
    @State private var retry = 0
    @State private var isSearching: Bool
    @Environment(\.dismiss) private var dismiss

    private struct Request: Equatable {
        let query: String
        let paper: String
        let type: String
        let retry: Int
    }

    init(session: EditionSession, embedded: Bool = false) {
        self.session = session
        self.embedded = embedded
        _isSearching = State(initialValue: !embedded || (session.shell.section == .search && !session.shell.showingReader))
        _model = State(
            initialValue: NativeSearchModel(engine: session.searchEngine, recents: session.recentSearches))
    }

    var body: some View {
        NavigationStack {
            List {
                if query.isEmpty && !model.recentQueries.isEmpty {
                    recentQueries
                }
                searchContent
            }
            .onEditionPaper()
            .listStyle(.plain)
            .navigationTitle("Search")
            .searchable(
                text: $query, isPresented: $isSearching,
                placement: .navigationBarDrawer(displayMode: .always), prompt: "Search this edition")
            .onSubmit(of: .search) { model.remember(query) }
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { filters }
                if !embedded {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { dismiss() }
                            .tint(Color("PageInk"))
                            .accessibilityIdentifier("native-search-done")
                    }
                } else {
                    ToolbarItem(placement: .confirmationAction) {
                        EditionReturnToReader(session: session, identifier: "native-search-done")
                    }
                }
            }
            .task(id: Request(query: query, paper: paper, type: type, retry: retry)) {
                await model.update(query: query, paper: paper, type: type)
            }
            .onChange(of: session.shell.section == .search && !session.shell.showingReader) { _, active in
                if embedded { isSearching = active }
            }
        }
    }

    @ViewBuilder private var searchContent: some View {
        switch model.phase {
        case .idle:
            Section {
                Text("Try a name, a symbol, or a question in your own words.")
                    .foregroundStyle(Color("PageInk"))
                ForEach(["how far does it wander", "clocks disagree", "Besso"], id: \.self) { phrase in
                    Button(phrase) {
                        query = phrase
                        model.remember(phrase)
                    }
                    .foregroundStyle(Color("PageInk"))
                }
                Text("Searches and recent searches stay on this device.")
                    .font(.footnote).foregroundStyle(Color("MutedInk"))
            } header: {
                Text("Search the edition")
            }
            .editionPaperRow()
        case .loading:
            ProgressView("Searching this edition")
                .accessibilityIdentifier("native-search-loading")
                .editionPaperRow()
        case .failed(let message):
            Section {
                ContentUnavailableView {
                    Label("Search is unavailable", systemImage: "magnifyingglass")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try again") { retry += 1 }
                }
                .accessibilityIdentifier("native-search-unavailable")
            }
            .editionPaperRow()
        case .results:
            if model.hits.isEmpty {
                Section {
                    ContentUnavailableView.search(text: query)
                        .accessibilityIdentifier("native-search-empty")
                    if !paper.isEmpty || !type.isEmpty {
                        Button("Search all papers and kinds") {
                            paper = ""
                            type = ""
                        }
                    }
                }
                .editionPaperRow()
            } else {
                ForEach(model.groups) { group in
                    Section {
                        ForEach(group.hits) { hit in result(hit) }
                    } header: {
                        Text(model.metadata?.typeLabels[group.type] ?? group.type)
                            .foregroundStyle(Color("MutedInk"))
                    }
                    .editionPaperRow()
                }
            }
        }
    }

    private var recentQueries: some View {
        Section {
            ForEach(model.recentQueries, id: \.self) { recent in
                Button {
                    query = recent
                } label: {
                    Label(recent, systemImage: "clock")
                        .foregroundStyle(Color("PageInk"))
                }
                .accessibilityIdentifier("native-search-recent")
            }
            Button("Clear recent searches", role: .destructive) {
                model.clearRecents()
            }
            .accessibilityIdentifier("native-search-clear-recents")
        } header: {
            Text("Recent searches")
        }
        .editionPaperRow()
    }

    private var filters: some View {
        Menu {
            Picker("Paper", selection: $paper) {
                Text("All papers").tag("")
                ForEach(availablePapers) { item in
                    Text(item.name).tag(item.slug)
                }
            }
            Picker("Kind", selection: $type) {
                Text("All kinds").tag("")
                ForEach(model.metadata?.typeLabels.keys.sorted() ?? [], id: \.self) { kind in
                    Text(model.metadata?.typeLabels[kind] ?? kind).tag(kind)
                }
            }
        } label: {
            Label(
                paper.isEmpty && type.isEmpty ? "Filter results" : "Results filtered",
                systemImage: "line.3.horizontal.decrease.circle")
        }
        .tint(Color("PageInk"))
        .disabled(model.metadata == nil)
        .accessibilityIdentifier("native-search-filters")
    }

    private var availablePapers: [NativeCatalog.Paper] {
        let included = Set(model.metadata?.papers ?? [])
        return (session.nativeCatalog?.papers.available ?? []).filter { included.contains($0.slug) }
    }

    private func result(_ hit: NativeSearchHit) -> some View {
        let destination = hit.destination(in: session.catalog)
        return Button {
            guard let destination else { return }
            model.remember(query)
            session.load(destination)
            if !embedded { dismiss() }
        } label: {
            VStack(alignment: .leading, spacing: 5) {
                Text(hit.title).font(.headline).foregroundStyle(Color("PageInk"))
                if !hit.snippet.isEmpty {
                    Text(Self.passage(hit.snippet, language: hit.lang))
                        .font(.subheadline).foregroundStyle(Color("PageInk"))
                }
                if !hit.scopeLabel.isEmpty {
                    Text(hit.scopeLabel).font(.caption).foregroundStyle(Color("MutedInk"))
                }
                if let alias = hit.aliasLabel {
                    Text(alias).font(.caption).foregroundStyle(Color("MutedInk"))
                }
                if destination == nil {
                    Text("Not available in this edition").font(.caption).foregroundStyle(Color("MutedInk"))
                }
            }
            .padding(.vertical, 5)
        }
        .disabled(destination == nil)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens this result in the reader")
        .accessibilityValue(hit.href)
        .accessibilityIdentifier("native-search-result-\(hit.id)")
    }

    private static func passage(_ text: String, language: String) -> AttributedString {
        var passage = AttributedString(text)
        if language == "de" || language == "en" {
            passage.languageIdentifier = language
        }
        return passage
    }
}
