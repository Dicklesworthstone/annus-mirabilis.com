import { describe, expect, test } from "bun:test";
import {
  type OfflineFigureAsset,
  type PublicationDecision,
  renderOfflineAsset,
} from "../platform/offline/assets.ts";
import { chapterFixture, fixtureMath } from "../platform/offline/chapter.test.mjs";
import { type OfflineChapterInput, packageOfflineChapter } from "../platform/offline/chapter.ts";

describe("offlineRights: publicationDecision filtering and embedding", () => {
  const dummyBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header
  const expectedBase64 = Buffer.from(dummyBytes).toString("base64");

  test("a publish figure is embedded as a data: URI with an offline figure element", () => {
    const asset: OfflineFigureAsset = {
      id: "fig-apparatus",
      title: "Experimental Apparatus",
      publicationDecision: "publish",
      mimeType: "image/png",
      bytes: dummyBytes,
      caption: "Figure 1: Schematic of the observation cell.",
    };

    const rendered = renderOfflineAsset(asset);
    expect(rendered.kind).toBe("embedded");
    expect(rendered.id).toBe("fig-apparatus");

    // Must be embedded as a data: URI
    expect(rendered.html).toContain(`data:image/png;base64,${expectedBase64}`);
    expect(rendered.html).toContain('<figure id="fig-apparatus" class="offline-figure">');
    expect(rendered.html).toContain('<img src="data:image/png;base64,');
    expect(rendered.html).toContain('alt="Experimental Apparatus"');
    expect(rendered.html).toContain(
      "<figcaption>Figure 1: Schematic of the observation cell.</figcaption>",
    );
    expect(rendered.html).not.toContain("cited-asset");
  });

  test("a pin-local-only figure is excluded and replaced by a citation reference", () => {
    const asset: OfflineFigureAsset = {
      id: "fig-historical-sketch",
      title: "Hand-drawn Notebook Sketch",
      publicationDecision: "pin-local-only",
      locator: "Archive MS 34, p. 12",
      url: "https://example.org/archive/ms34",
    };

    const rendered = renderOfflineAsset(asset);
    expect(rendered.kind).toBe("citation");
    expect(rendered.id).toBe("fig-historical-sketch");

    // Must NOT embed image bytes or data: URI
    expect(rendered.html).not.toContain("data:");
    expect(rendered.html).not.toContain("<img");
    expect(rendered.html).toContain('<figure id="fig-historical-sketch" class="cited-asset">');
    expect(rendered.html).toContain("Hand-drawn Notebook Sketch");
    expect(rendered.html).toContain("Archive MS 34, p. 12");
    expect(rendered.html).toContain('href="https://example.org/archive/ms34"');
    expect(rendered.html).toContain(
      "Excluded from offline edition; rights designation: pin-local-only.",
    );
  });

  test("a reference-only scan is excluded and replaced by a citation reference", () => {
    const asset: OfflineFigureAsset = {
      id: "scan-journal-page",
      title: "Annalen der Physik Volume 17 Page 549 Scan",
      publicationDecision: "reference-only",
      locator: "Ann. Phys. (4) 17, 549 (1905)",
      url: "https://example.org/scans/ap-17-549",
    };

    const rendered = renderOfflineAsset(asset);
    expect(rendered.kind).toBe("citation");
    expect(rendered.id).toBe("scan-journal-page");

    // Must NOT embed scan bytes or data: URI
    expect(rendered.html).not.toContain("data:");
    expect(rendered.html).not.toContain("<img");
    expect(rendered.html).toContain('<figure id="scan-journal-page" class="cited-asset">');
    expect(rendered.html).toContain("Annalen der Physik Volume 17 Page 549 Scan");
    expect(rendered.html).toContain("Ann. Phys. (4) 17, 549 (1905)");
    expect(rendered.html).toContain('href="https://example.org/scans/ap-17-549"');
    expect(rendered.html).toContain(
      "Excluded from offline edition; rights designation: reference-only.",
    );
  });

  test("invalid or unknown publicationDecision fails with TypeError", () => {
    const invalidAsset = {
      id: "fig-unknown",
      title: "Unknown terms",
      publicationDecision: "unrestricted-public-domain" as unknown as PublicationDecision,
    };

    expect(() => renderOfflineAsset(invalidAsset)).toThrow(TypeError);
  });

  test("a publish asset missing bytes or mimeType throws an Error", () => {
    const missingBytes: OfflineFigureAsset = {
      id: "fig-nobytes",
      title: "Missing Bytes",
      publicationDecision: "publish",
      mimeType: "image/png",
    };
    expect(() => renderOfflineAsset(missingBytes)).toThrow(/requires binary bytes/);

    const missingMime: OfflineFigureAsset = {
      id: "fig-nomime",
      title: "Missing Mime",
      publicationDecision: "publish",
      bytes: dummyBytes,
    };
    expect(() => renderOfflineAsset(missingMime)).toThrow(/requires binary bytes and mimeType/);
  });

  test("full integration in packageOfflineChapter handles mixed publish and non-publish assets", () => {
    const fixture = chapterFixture() as unknown as OfflineChapterInput;
    const inputWithFigures: OfflineChapterInput = {
      ...fixture,
      figures: [
        {
          id: "fig-pub",
          title: "Public Domain Diagram",
          publicationDecision: "publish",
          mimeType: "image/png",
          bytes: dummyBytes,
          caption: "Public Domain Diagram caption",
        },
        {
          id: "fig-pin",
          title: "Pinned Local Asset",
          publicationDecision: "pin-local-only",
          locator: "Plate 2",
          url: "https://example.org/plate2",
        },
        {
          id: "scan-ref",
          title: "Reference Scan",
          publicationDecision: "reference-only",
          locator: "Page 550",
          url: "https://example.org/scan550",
        },
      ],
    };

    const pkg = packageOfflineChapter(inputWithFigures, fixtureMath);

    // Section for figures exists
    expect(pkg.html).toContain("<h2>Figures and illustrations</h2>");

    // Only 'publish' has data URI and img
    expect(pkg.html).toContain(`data:image/png;base64,${expectedBase64}`);
    expect(pkg.html).toContain('<figure id="fig-pub" class="offline-figure">');

    // 'pin-local-only' and 'reference-only' appear as citations, not imgs
    expect(pkg.html).toContain('<figure id="fig-pin" class="cited-asset">');
    expect(pkg.html).toContain(
      "Excluded from offline edition; rights designation: pin-local-only.",
    );
    expect(pkg.html).toContain('<figure id="scan-ref" class="cited-asset">');
    expect(pkg.html).toContain(
      "Excluded from offline edition; rights designation: reference-only.",
    );

    // Footer notice acknowledges embedded figures and citations
    expect(pkg.html).toContain(
      "Figures with publication rights are embedded as offline data URIs.",
    );
  });

  test("chapter with only non-publish assets contains zero data: URIs and retains default footer notice", () => {
    const fixture = chapterFixture() as unknown as OfflineChapterInput;
    const nonPublishOnly: OfflineChapterInput = {
      ...fixture,
      figures: [
        {
          id: "fig-pin-only",
          title: "Pinned Local Asset",
          publicationDecision: "pin-local-only",
          locator: "Plate 2",
          url: "https://example.org/plate2",
        },
      ],
    };

    const pkg = packageOfflineChapter(nonPublishOnly, fixtureMath);
    expect(pkg.html).not.toContain("<img");
    expect(pkg.html).not.toContain("data:image");
    expect(pkg.html).toContain("No scans or external figures are embedded.");
  });
});
