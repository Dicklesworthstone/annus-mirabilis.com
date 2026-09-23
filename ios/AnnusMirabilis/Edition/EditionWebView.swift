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
        } label: {
            Image(systemName: "ellipsis")
                .font(.body.weight(.semibold))
                .foregroundStyle(.primary)
                .frame(width: 44, height: 44)
                .modifier(FloatingSurface())
        }
        .tint(.primary)
        .accessibilityLabel("Page actions")
        .accessibilityHint("Share, print, or find on this page")
        .accessibilityIdentifier("page-actions")
    }
}

/// Liquid Glass where the system has it, a material circle before iOS 26.
private struct FloatingSurface: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular.interactive(), in: .circle)
        } else {
            content
                .background(.regularMaterial, in: Circle())
                .overlay(Circle().strokeBorder(.separator, lineWidth: 0.5))
        }
    }
}
