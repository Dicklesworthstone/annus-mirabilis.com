import Foundation

/// Where a link inside the edition goes (App plan §6.4). The reader only ever
/// loads the bundled edition; the web is opened outside it, and a link to a
/// page of annus-mirabilis.com that the app carries opens the bundled copy.
enum EditionLinkPolicy {
    enum Decision: Equatable {
        case allow
        case openInEdition(URL)
        case openOutside(URL)
        case refuse
    }

    static let siteHosts: Set<String> = ["annus-mirabilis.com", "www.annus-mirabilis.com"]

    static func decide(_ url: URL, catalog: EditionCatalog) -> Decision {
        switch url.scheme?.lowercased() {
        case EditionCatalog.scheme:
            return url.host() == EditionCatalog.host ? .allow : .refuse
        case "about":
            // about:blank and about:srcdoc hold no content of their own.
            return .allow
        case "https", "http":
            if let host = url.host()?.lowercased(), siteHosts.contains(host),
                let local = editionURL(forSiteURL: url),
                case .file = catalog.resolve(local)
            {
                return .openInEdition(local)
            }
            return url.scheme?.lowercased() == "https" ? .openOutside(url) : .refuse
        default:
            return .refuse
        }
    }

    /// The bundled copy of a website URL, keeping its path, query and anchor.
    static func editionURL(forSiteURL url: URL) -> URL? {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return nil }
        components.scheme = EditionCatalog.scheme
        components.host = EditionCatalog.host
        components.port = nil
        components.user = nil
        components.password = nil
        if components.path.isEmpty { components.path = "/" }
        return components.url
    }
}
