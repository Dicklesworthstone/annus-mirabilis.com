import Foundation
import SafariServices
import UIKit
import WebKit

/// Link policy, downloads, new windows and process recovery for the web view.
@MainActor
final class EditionNavigator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private let catalog: EditionCatalog
    /// Receives a file the page saved (its own export of notes, data or a notebook).
    var onSavedFile: ((URL) -> Void)?
    private var destinations: [ObjectIdentifier: URL] = [:]

    init(catalog: EditionCatalog) {
        self.catalog = catalog
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async
        -> WKNavigationActionPolicy
    {
        guard let url = navigationAction.request.url else { return .cancel }
        if Self.isPageExport(url, shouldDownload: navigationAction.shouldPerformDownload) {
            return .download
        }
        return follow(url, in: webView)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse) async
        -> WKNavigationResponsePolicy
    {
        // Nothing opens inside the reader that it cannot show (App plan §6.4); a file the page
        // itself saves is handed to the share sheet instead of being dropped.
        if navigationResponse.canShowMIMEType { return .allow }
        guard let url = navigationResponse.response.url, Self.isPageExport(url, shouldDownload: true) else {
            return .cancel
        }
        return .download
    }

    /// A file the edition itself makes (a Blob behind a download link): the site's own
    /// "Download all of it (JSON)" and the notebook's exports. Nothing from elsewhere.
    static func isPageExport(_ url: URL, shouldDownload: Bool) -> Bool {
        guard shouldDownload else { return false }
        if url.scheme == "blob" {
            return url.absoluteString.hasPrefix("blob:\(EditionCatalog.scheme)://\(EditionCatalog.host)/")
        }
        return false
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String)
        async -> URL?
    {
        guard let destination = ExportFiles.destination(suggested: suggestedFilename) else { return nil }
        destinations[ObjectIdentifier(download)] = destination
        return destination
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let file = destinations.removeValue(forKey: ObjectIdentifier(download)) else { return }
        onSavedFile?(file)
    }

    func download(_ download: WKDownload, didFailWithError error: any Error, resumeData: Data?) {
        destinations.removeValue(forKey: ObjectIdentifier(download))
    }

    /// The page's suggested name, reduced to a plain file name.
    nonisolated static func safeFilename(_ suggested: String) -> String {
        let last = (suggested as NSString).lastPathComponent
        let cleaned = String(
            last.unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) || "-_. ".unicodeScalars.contains($0) }
        )
        .trimmingCharacters(in: .whitespaces)
        return cleaned.isEmpty || cleaned.hasPrefix(".") ? "annus-mirabilis-export" : cleaned
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        // A link that asks for a new window follows the same policy in this one.
        if let url = navigationAction.request.url, follow(url, in: webView) == .allow {
            webView.load(URLRequest(url: url))
        }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        // The system reclaimed the page's process; bring back the same page.
        webView.reload()
    }

    private func follow(_ url: URL, in webView: WKWebView) -> WKNavigationActionPolicy {
        switch EditionLinkPolicy.decide(url, catalog: catalog) {
        case .allow:
            return .allow
        case .openInEdition(let local):
            webView.load(URLRequest(url: local))
            return .cancel
        case .openOutside(let external):
            guard var presenter = webView.window?.rootViewController else { return .cancel }
            while let next = presenter.presentedViewController {
                presenter = next
            }
            presenter.present(SFSafariViewController(url: external), animated: true)
            return .cancel
        case .refuse:
            return .cancel
        }
    }
}

/// Files the reader takes away: a page's own export, or the app's export of the reader's data.
/// Each goes in a fresh folder in the app's temporary directory, which the system clears; the
/// reader chooses where it goes from the share sheet.
enum ExportFiles {
    static func destination(suggested: String) -> URL? {
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent("exports", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        guard (try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)) != nil else {
            return nil
        }
        return folder.appendingPathComponent(EditionNavigator.safeFilename(suggested), isDirectory: false)
    }
}
