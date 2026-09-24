import SwiftUI

/// The app's native way into the edition (App plan §8.1, §8.2): the papers and their outlines,
/// the Discover routes, and the instruments. Every title, blurb and step is the site's own, from
/// the bundled catalogue; choosing one opens that page, at that section, in the reader.
struct EditionContentsView: View {
    let catalog: NativeCatalog
    let open: (_ route: String, _ anchor: String?) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var part: Part = .papers

    /// The sheet's three lists, chosen with a segmented control at the top. A tab bar floated its
    /// glass over the end of each long list, and the accessibility audit measured the text
    /// beneath it as failing contrast.
    enum Part: String, CaseIterable, Identifiable {
        case papers = "Papers"
        case discover = "Discover"
        case instruments = "Instruments"
        var id: String { rawValue }
    }

    var body: some View {
        NavigationStack {
            Group {
                switch part {
                case .papers: papers
                case .discover: discover
                case .instruments: instruments
                }
            }
            .navigationTitle(part.rawValue)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    Picker("Contents", selection: $part) {
                        ForEach(Part.allCases) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                done
            }
        }
    }

    private func go(_ route: String, _ anchor: String? = nil) {
        open(route, anchor)
        dismiss()
    }

    private var done: some ToolbarContent {
        ToolbarItem(placement: .confirmationAction) {
            Button("Done") { dismiss() }
        }
    }

    // MARK: Papers

    private var papers: some View {
        List(catalog.papers) { paper in
            NavigationLink {
                outline(paper)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text(paper.name).font(.headline)
                    Text(paper.title).font(.subheadline)
                    Text(Self.german(paper.germanTitle)).font(.footnote).italic().foregroundStyle(Color("MutedInk"))
                }
                .padding(.vertical, 4)
            }
        }
    }

    private func outline(_ paper: NativeCatalog.Paper) -> some View {
        List {
            Section {
                Button {
                    go(paper.route)
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(paper.title).font(.headline).foregroundStyle(Color("PageInk"))
                        Text(paper.description).font(.footnote).foregroundStyle(Color("MutedInk"))
                    }
                }
            }
            Section {
                ForEach(paper.sections) { section in
                    Button {
                        go(section.route, section.anchor)
                    } label: {
                        Text(section.title).foregroundStyle(Color("PageInk"))
                    }
                }
            }
        }
        .navigationTitle(paper.name)
        .toolbar { done }
    }

    // MARK: Discover

    private var discover: some View {
        List(catalog.discover) { route in
            NavigationLink {
                steps(route)
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text(route.name).font(.headline)
                    Text(Self.german(route.germanTitle)).font(.footnote).italic().foregroundStyle(Color("MutedInk"))
                }
                .padding(.vertical, 4)
            }
        }
    }

    private func steps(_ route: NativeCatalog.DiscoverRoute) -> some View {
        List {
            Section {
                Text(route.blurb).font(.callout)
                Button {
                    go(route.route)
                } label: {
                    Label("Open the route", systemImage: "arrow.forward")
                }
            }
            Section {
                ForEach(Array(route.steps.enumerated()), id: \.offset) { index, step in
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text(String(format: "%02d", index + 1)).font(.footnote.monospacedDigit()).foregroundStyle(
                            Color("MutedInk"))
                        Text(step)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .navigationTitle(route.name)
        .toolbar { done }
    }

    // MARK: Instruments

    private var instruments: some View {
        List(catalog.labs) { group in
            Section {
                ForEach(group.instruments) { instrument in
                    Button {
                        go(instrument.route)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(instrument.name).foregroundStyle(Color("PageInk"))
                            Text(instrument.id).font(.caption.monospaced()).foregroundStyle(Color("MutedInk"))
                        }
                    }
                    .accessibilityLabel(instrument.name)
                }
            } header: {
                Text(group.name).foregroundStyle(Color("MutedInk"))
            }
        }
    }

    /// German titles are marked as German, so VoiceOver reads them in German.
    private static func german(_ text: String) -> AttributedString {
        var german = AttributedString(text)
        german.languageIdentifier = "de"
        return german
    }
}
