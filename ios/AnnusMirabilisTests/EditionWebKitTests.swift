import Foundation
import Testing
import WebKit

@testable import AnnusMirabilis

/// Waits for a web view's first navigation to finish or fail.
@MainActor
private final class NavigationWaiter: NSObject, WKNavigationDelegate {
    private var continuation: CheckedContinuation<Bool, Never>?

    func load(_ url: URL, in view: WKWebView) async -> Bool {
        view.navigationDelegate = self
        return await withCheckedContinuation { continuation in
            self.continuation = continuation
            view.load(URLRequest(url: url))
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        continuation?.resume(returning: true)
        continuation = nil
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
        continuation?.resume(returning: false)
        continuation = nil
    }

    func webView(
        _ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error
    ) {
        continuation?.resume(returning: false)
        continuation = nil
    }
}

/// The bundled edition in a real WKWebView over the app's own origin (bead am-app-scheme-handler-ghuu):
/// what the hosting probe (D-2026-09-23-app-edition-hosting) showed once, held as a test.
@MainActor
@Suite("The edition in WebKit")
struct EditionWebKitTests {
    @Test("scripts, a module worker, WebAssembly streaming and SubtleCrypto all work over am-edition://")
    func platformFeatures() async throws {
        let catalog = try EditionCatalog.load()
        let wasm = try #require(
            catalog.allFiles.map(\.path).filter { $0.hasPrefix("wasm/") && $0.hasSuffix(".wasm") }.sorted().first,
            "the edition carries no WebAssembly of its own")
        let worker = try #require(
            catalog.allFiles.map(\.path).first { $0.hasSuffix(".worker.min.mjs") },
            "the edition carries no module worker")
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(EditionSchemeHandler(catalog: catalog), forURLScheme: EditionCatalog.scheme)
        let view = WKWebView(frame: CGRect(x: 0, y: 0, width: 390, height: 844), configuration: configuration)
        let waiter = NavigationWaiter()
        #expect(await waiter.load(EditionCatalog.homeURL, in: view), "the home page did not load")

        let script = """
            const out = {};
            out.scripts = document.scripts.length;
            const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("am"));
            out.digest = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
            const module = await WebAssembly.compileStreaming(fetch("/" + wasm));
            out.wasm = module instanceof WebAssembly.Module;
            out.worker = await new Promise((resolve) => {
              const w = new Worker("/" + worker, { type: "module" });
              w.onerror = (e) => resolve("error: " + (e.message || "no message"));
              w.onmessage = (e) => resolve(e.data && e.data.action === "ready" ? "ready" : "other");
              setTimeout(() => resolve("no message in 10 s"), 10000);
            });
            return JSON.stringify(out);
            """
        let reply = try await view.callAsyncJavaScript(
            script, arguments: ["wasm": wasm, "worker": worker], in: nil, contentWorld: .defaultClient)
        let result = try #require(
            (reply as? String).flatMap { try? JSONSerialization.jsonObject(with: Data($0.utf8)) as? [String: Any] })
        #expect((result["scripts"] as? Int ?? 0) > 0, "the page has no scripts")
        // SHA-256 of "am", computed with `printf am | shasum -a 256`.
        #expect(result["digest"] as? String == "ab6db599234d2636659cba1aa191bd014c3867d5cfade98ff694785c20c28fc6")
        #expect(result["wasm"] as? Bool == true)
        #expect(result["worker"] as? String == "ready")
    }
}
