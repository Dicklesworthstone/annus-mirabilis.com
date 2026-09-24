import SwiftUI
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

/// One small button over the page for what a phone does and a page cannot:
/// the share sheet, printing, and the system find bar. The page's own header
/// keeps its navigation; this adds no second menu of destinations.
struct PageActionsButton: View {
    let session: EditionSession
    @State private var showingReaderData = false

    var body: some View {
        Menu {
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
            Button {
                showingReaderData = true
            } label: {
                Label("Your data on this device", systemImage: "tray.full")
            }
        } label: {
            Image(systemName: "ellipsis")
                .font(.body.weight(.semibold))
                .foregroundStyle(Color("PageInk"))
                .frame(width: 44, height: 44)
                .modifier(FloatingSurface())
        }
        .tint(.primary)
        .accessibilityLabel("Page actions")
        .accessibilityHint("Share, print, or find on this page, or see your data on this device")
        .accessibilityIdentifier("page-actions")
        .sheet(isPresented: $showingReaderData) {
            ReaderDataView(session: session)
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
