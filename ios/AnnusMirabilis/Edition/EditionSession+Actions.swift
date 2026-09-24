import UIKit

/// What the reader can do with the page from the native chrome: share it, print it, find in it,
/// and take their data away.
extension EditionSession {
    /// The share sheet for a page of the website when the page asks for one (`share.request`),
    /// or for a file the page saved. The page-actions menu shares through SwiftUI's ShareLink.
    func presentShareSheet(for url: URL) {
        guard let presenter = topPresenter else { return }
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        // Anchored in the presenter's own view: the web view sits under any sheet the app shows.
        if let anchor = presenter.view {
            sheet.popoverPresentationController?.sourceView = anchor
            sheet.popoverPresentationController?.sourceRect = CGRect(
                x: anchor.bounds.midX, y: anchor.bounds.midY, width: 1, height: 1)
        }
        presenter.present(sheet, animated: true)
    }

    /// Writes an export of the reader's data and offers it in the share sheet.
    func share(_ export: ReaderDataExport) {
        guard let file = ExportFiles.destination(suggested: export.suggestedFilename),
            (try? export.jsonData().write(to: file, options: .atomic)) != nil
        else { return }
        presentShareSheet(for: file)
    }

    /// Print, or save as PDF, the page as the edition's print styles set it.
    func printPage() {
        let info = UIPrintInfo.printInfo()
        info.outputType = .general
        info.jobName = title ?? "Annus Mirabilis"
        let controller = UIPrintInteractionController.shared
        controller.printInfo = info
        controller.printFormatter = webView.viewPrintFormatter()
        controller.present(animated: true)
    }

    /// The system find bar, searching the page's text.
    func findOnPage() {
        webView.findInteraction?.presentFindNavigator(showingReplace: false)
    }

    /// A link to the website the system handed the app (a universal link, or a URL opened in the
    /// app). What the edition carries opens in it; the rest of the site opens in Safari in the app.
    func openSiteLink(_ url: URL) {
        switch EditionLinkPolicy.siteLink(url, catalog: catalog) {
        case .openInEdition(let local):
            load(local)
        case .openOutside(let site):
            presentSafari(site)
        case .allow, .refuse:
            break
        }
    }

    /// Loads a page of the edition, remembering it as the page to retry if it fails.
    func load(_ url: URL) {
        lastRequestedURL = url
        webView.load(URLRequest(url: url))
    }

    /// Opens a page of the edition, at an anchor when given, from a native screen.
    func open(route: String, anchor: String?) {
        guard let url = EditionCatalog.url(route: route, anchor: anchor) else { return }
        load(url)
    }

    /// A page could not be loaded: remember which, so the reader can try it again. WebKit names
    /// the address it failed on (the edition origin always does); when it does not, the page the app
    /// last asked for is the one. The page last shown is not: on a first load there is none, and the
    /// home page would open instead (measured 2026-09-24, run 20260924T124602Z-6c8aefa8).
    func didFailLoad(_ url: URL?) {
        loadFailure = url ?? lastRequestedURL ?? currentURL ?? EditionCatalog.homeURL
    }

    /// Loads the page that failed, once more.
    func retryLoad() {
        guard let url = loadFailure else { return }
        loadFailure = nil
        load(url)
    }
}
