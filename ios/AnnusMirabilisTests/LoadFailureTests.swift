import Foundation
import Testing
import WebKit

@testable import AnnusMirabilis

/// Which endings of a page load are failures the reader is told about (bead am-app-edition-webview-ju3v).
@Suite("Load failures")
struct LoadFailureTests {
    @Test("a newer navigation, or this app's own policy, ending a load is not a failure")
    func expectedInterruptions() {
        #expect(EditionNavigator.isExpectedInterruption(URLError(.cancelled)))
        #expect(EditionNavigator.isExpectedInterruption(NSError(domain: "WebKitErrorDomain", code: 102)))
    }

    @Test(
        "a load that could not be served is a failure",
        arguments: [URLError.Code.fileDoesNotExist, .cannotLoadFromNetwork, .badURL, .notConnectedToInternet])
    func failures(code: URLError.Code) {
        #expect(!EditionNavigator.isExpectedInterruption(URLError(code)))
        #expect(!EditionNavigator.isExpectedInterruption(NSError(domain: "WebKitErrorDomain", code: 101)))
    }

    @Test("retry loads the page that failed, once, and clears the failure")
    @MainActor
    func retryLoadsTheFailedPage() throws {
        let catalog = try EditionCatalog.load()
        let suite = "load-failure-\(UUID().uuidString)"
        let defaults = try #require(UserDefaults(suiteName: suite))
        let session = EditionSession(
            catalog: catalog, store: ReaderLocationStore(defaults: defaults), ephemeralWebStorage: true)
        let page = try #require(EditionCatalog.url(route: "/papers/brownian-motion/"))
        session.didFailLoad(page)
        #expect(session.loadFailure == page)
        session.retryLoad()
        #expect(session.loadFailure == nil)
        #expect(session.webView.url == page || session.webView.isLoading, "retry did not start the failed page")
        session.retryLoad()
        #expect(session.loadFailure == nil, "a second retry with nothing failed does nothing")
    }

    /// The failure seen on 2026-09-24: the first page failed, WebKit named no address, nothing had
    /// been shown yet, and "Try again" opened the home page instead of the paper.
    @Test("a first page that fails with no address given is retried as the page asked for")
    @MainActor
    func firstLoadWithoutAnAddress() throws {
        let catalog = try EditionCatalog.load()
        let defaults = try #require(UserDefaults(suiteName: "load-failure-\(UUID().uuidString)"))
        let session = EditionSession(
            catalog: catalog, store: ReaderLocationStore(defaults: defaults), ephemeralWebStorage: true)
        let paper = try #require(EditionCatalog.url(route: "/papers/brownian-motion/"))
        session.load(paper)
        session.didFailLoad(nil)
        #expect(session.loadFailure == paper)
        #expect(session.loadFailure != EditionCatalog.homeURL)
    }
}
