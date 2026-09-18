import { describe, expect, test } from "bun:test";
import {
  type OfflineChapterInput,
  packageOfflineChapter,
} from "../platform/offline/chapter.ts";
import { chapterFixture, fixtureMath } from "../platform/offline/chapter.test.mjs";

describe("offlinePrivacy: storage absence, privacy isolation, and CSP guarantees", () => {
  const fixture = chapterFixture() as unknown as OfflineChapterInput;
  const pkg = packageOfflineChapter(fixture, fixtureMath);

  test("generated HTML contains zero storage access APIs", () => {
    // Neither markup nor inline scripts should touch browser storage
    expect(pkg.html).not.toMatch(
      /\b(localStorage|sessionStorage|indexedDB|openDatabase|document\.cookie|caches\.open)\b/,
    );
  });

  test("generated HTML contains no notebook content, notes, or reader predictions", () => {
    expect(pkg.html).not.toMatch(
      /\b(data-notebook|user-notes|myNotes|userPrediction|personalTour|readerSession|notebook-entry)\b/i,
    );
    expect(pkg.html).toContain(
      "No simulation, search index, notebook, or private settings are included.",
    );
  });

  test("generated HTML contains no interactive ?tape= state, WASM, or running simulation", () => {
    expect(pkg.html).not.toMatch(/\b(\?tape=|controlTape|runTape|wasmInstance|WebAssembly)\b/);
    expect(pkg.html).not.toContain("<canvas");
    expect(pkg.html).toContain(
      "Static host-calculated example, not a running experiment or an observation.",
    );
  });

  test("generated HTML contains no outbound network APIs, external resources, or tracking beacons", () => {
    // Network calling APIs
    expect(pkg.html).not.toMatch(
      /\b(fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|Worker\s*\()\b/,
    );

    // No external script or link elements
    expect(pkg.html).not.toMatch(/<script[^>]+src=/i);
    expect(pkg.html).not.toMatch(/<link[^>]+(?:stylesheet|preload)/i);
    expect(pkg.html).not.toMatch(/<(?:iframe|embed|object|video|audio)\b/i);

    // No unapproved external image references (only data: or cited links)
    expect(pkg.html).not.toMatch(/<img[^>]+src=["'](?!data:)[^"']+["']/i);
  });

  test("Content-Security-Policy enforces total network lockdown and strict origin sandbox", () => {
    expect(pkg.html).toContain("default-src &#39;none&#39;");
    expect(pkg.html).toContain("connect-src &#39;none&#39;");
    expect(pkg.html).toContain("base-uri &#39;none&#39;");
    expect(pkg.html).toContain("form-action &#39;none&#39;");
    expect(pkg.html).toContain('meta name="referrer" content="no-referrer"');
  });

  test("edition identity contains reproducible build metadata and no reader telemetry", () => {
    // Provenance fields present
    expect(pkg.html).toContain("<dt>Generated</dt>");
    expect(pkg.html).toContain("<dt>Content revision</dt>");
    expect(pkg.html).toContain("<dt>Build digest</dt>");

    // Telemetry and reader identifier absence
    expect(pkg.html).not.toMatch(/\b(readerId|userId|trackingId|visitorToken|claritySignal)\b/);
  });
});
