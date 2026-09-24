import CryptoKit
import Foundation
import Testing

@testable import AnnusMirabilis

@Suite("Edition request paths")
struct EditionPathTests {
    @Test("the static export's trailing-slash routes map to index.html")
    func trailingSlash() {
        #expect(EditionCatalog.candidatePaths(percentEncodedPath: "/") == ["index.html"])
        #expect(EditionCatalog.candidatePaths(percentEncodedPath: "") == ["index.html"])
        #expect(EditionCatalog.candidatePaths(percentEncodedPath: "/papers/") == ["papers/index.html"])
        #expect(EditionCatalog.candidatePaths(percentEncodedPath: "/papers") == ["papers", "papers/index.html"])
        #expect(
            EditionCatalog.candidatePaths(percentEncodedPath: "/_next/static/css/a.css") == ["_next/static/css/a.css"])
    }

    @Test("percent-encoded characters are decoded once")
    func decoding() {
        #expect(EditionCatalog.candidatePaths(percentEncodedPath: "/fonts/a%20b.woff2") == ["fonts/a b.woff2"])
    }

    @Test(
        "a path that tries to leave the edition is refused, not normalized",
        arguments: [
            "/../Info.plist", "/papers/../../AnnusMirabilis", "/./index.html", "/%2e%2e/Info.plist", "/a%2fb", "/a%2Fb",
            "/a%5cb", "/a%00b", "relative/path",
        ])
    func refused(path: String) {
        #expect(EditionCatalog.candidatePaths(percentEncodedPath: path) == nil)
    }
}

@Suite("Link policy")
struct EditionLinkPolicyTests {
    let catalog: EditionCatalog

    init() throws {
        let manifest = EditionManifest(
            schemaVersion: EditionCatalog.schemaVersion,
            editionDigest: "test",
            files: [
                .init(path: "index.html", sha256: "", size: 0, contentType: "text/html; charset=utf-8"),
                .init(
                    path: "papers/brownian-motion/index.html", sha256: "", size: 0,
                    contentType: "text/html; charset=utf-8"),
            ])
        catalog = try EditionCatalog(root: URL(fileURLWithPath: "/nonexistent"), manifest: manifest)
    }

    @Test("edition pages load in place")
    func editionAllowed() {
        #expect(EditionLinkPolicy.decide(URL(string: "am-edition://edition/papers/")!, catalog: catalog) == .allow)
        #expect(EditionLinkPolicy.decide(URL(string: "about:blank")!, catalog: catalog) == .allow)
    }

    @Test("a website link to a page the app carries opens the bundled copy, anchor kept")
    func siteLinkStaysInApp() {
        let decision = EditionLinkPolicy.decide(
            URL(string: "https://annus-mirabilis.com/papers/brownian-motion/?detail=2#s4")!, catalog: catalog)
        #expect(decision == .openInEdition(URL(string: "am-edition://edition/papers/brownian-motion/?detail=2#s4")!))
    }

    @Test("a website link to a page the app does not carry, and any other https link, opens outside")
    func externalLinks() {
        let missing = URL(string: "https://annus-mirabilis.com/not-in-this-build/")!
        #expect(EditionLinkPolicy.decide(missing, catalog: catalog) == .openOutside(missing))
        let other = URL(string: "https://en.wikipedia.org/wiki/Annus_mirabilis_papers")!
        #expect(EditionLinkPolicy.decide(other, catalog: catalog) == .openOutside(other))
    }

    @Test(
        "every other scheme is refused",
        arguments: [
            "http://example.com/", "mailto:someone@example.com", "tel:123", "javascript:alert(1)", "data:text/html,x",
            "am-edition://elsewhere/",
        ])
    func refusedSchemes(link: String) {
        #expect(EditionLinkPolicy.decide(URL(string: link)!, catalog: catalog) == .refuse)
    }
}

/// The edition actually inside this build of the app. These run in the app
/// bundle, so they check what a reader would get, not a fixture.
@Suite("The bundled edition")
struct BundledEditionTests {
    let catalog: EditionCatalog

    init() throws {
        catalog = try EditionCatalog.load(from: .main)
    }

    @Test("every listed file is in the bundle with its manifest size and SHA-256")
    func filesMatchManifest() throws {
        #expect(catalog.fileCount > 0)
        var mismatched: [String] = []
        for file in catalog.allFiles {
            let data = try Data(contentsOf: catalog.fileURL(for: file), options: .mappedIfSafe)
            let digest = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
            if data.count != file.size || digest != file.sha256 { mismatched.append(file.path) }
        }
        #expect(
            mismatched.isEmpty,
            "\(mismatched.count) of \(catalog.fileCount) files differ, first \(mismatched.first ?? "")")
    }

    @Test("the bundle holds no edition file the manifest does not list")
    func noUnlistedFiles() throws {
        let listed = Set(catalog.allFiles.map(\.path))
        let root = catalog.root.standardizedFileURL
        let enumerator = try #require(
            FileManager.default.enumerator(at: root, includingPropertiesForKeys: [.isRegularFileKey]))
        var unlisted: [String] = []
        var seen = 0
        for case let url as URL in enumerator
        where (try? url.resourceValues(forKeys: [.isRegularFileKey]))?.isRegularFile == true {
            seen += 1
            let relative = String(url.standardizedFileURL.path.dropFirst(root.path.count + 1))
            if !listed.contains(relative) { unlisted.append(relative) }
        }
        #expect(seen == catalog.fileCount, "enumerated \(seen), manifest lists \(catalog.fileCount)")
        #expect(unlisted.isEmpty, "first unlisted: \(unlisted.first ?? "")")
    }

    @Test("the home page, a paper and the 404 page resolve; a traversal does not")
    func resolvesRealRoutes() {
        #expect(catalog.resolve(EditionCatalog.homeURL) != .notFound)
        #expect(catalog.resolve(URL(string: "am-edition://edition/papers/brownian-motion/")!) != .notFound)
        #expect(catalog.notFoundPage != nil)
        #expect(catalog.resolve(URL(string: "am-edition://edition/no-such-page/")!) == .notFound)
        #expect(catalog.resolve(URL(string: "am-edition://edition/%2e%2e/edition-manifest.json")!) == .refused)
        if case .file(let home) = catalog.resolve(EditionCatalog.homeURL) {
            #expect(home.contentType.hasPrefix("text/html"))
        } else {
            Issue.record("the home page did not resolve to a file")
        }
    }
}

@Suite("Files the page saves")
@MainActor
struct PageExportTests {
    @Test("a Blob the edition made, asked to download, is taken as a file")
    func editionBlobDownloads() throws {
        let blob = try #require(URL(string: "blob:am-edition://edition/6c0e1f5a-9b1d-4d8e-a1f2-000000000001"))
        #expect(EditionNavigator.isPageExport(blob, shouldDownload: true))
    }

    @Test(
        "nothing else becomes a download",
        arguments: [
            ("blob:am-edition://edition/6c0e1f5a", false),
            ("blob:https://example.com/6c0e1f5a", true),
            ("blob:am-edition://edition.example.com/6c0e1f5a", true),
            ("am-edition://edition/your-data/", true),
            ("https://annus-mirabilis.com/your-data/", true),
            ("data:application/json,%7B%7D", true),
        ])
    func othersAreRefused(address: String, shouldDownload: Bool) throws {
        let url = try #require(URL(string: address))
        #expect(!EditionNavigator.isPageExport(url, shouldDownload: shouldDownload))
    }

    @Test(
        "the page's suggested name becomes a plain file name",
        arguments: [
            ("annus-mirabilis-data-2026-09-24.json", "annus-mirabilis-data-2026-09-24.json"),
            ("../../Library/Preferences/x.plist", "x.plist"),
            ("notes/../../escape.json", "escape.json"),
            ("..", "annus-mirabilis-export"),
            (".hidden", "annus-mirabilis-export"),
            ("", "annus-mirabilis-export"),
            ("a\u{0}b:c*.json", "abc.json"),
        ])
    func suggestedNames(suggested: String, expected: String) {
        #expect(EditionNavigator.safeFilename(suggested) == expected)
    }
}
