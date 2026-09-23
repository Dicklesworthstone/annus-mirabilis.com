import Foundation

/// The website address of a page in the bundled edition. Sharing and Handoff
/// use it, so a link sent from the app opens the same page and anchor on
/// annus-mirabilis.com, which serves the same edition.
enum SiteURL {
    static let host = "annus-mirabilis.com"

    /// `am-edition://edition/papers/x/?view=german#s4` becomes
    /// `https://annus-mirabilis.com/papers/x/?view=german#s4`. Nil for anything
    /// that is not a page of the edition.
    static func canonical(for editionURL: URL) -> URL? {
        guard editionURL.scheme == EditionCatalog.scheme, editionURL.host() == EditionCatalog.host,
            var components = URLComponents(url: editionURL, resolvingAgainstBaseURL: false)
        else { return nil }
        components.scheme = "https"
        components.host = host
        components.port = nil
        if components.percentEncodedPath.isEmpty { components.percentEncodedPath = "/" }
        return components.url
    }
}
