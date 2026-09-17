import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToString } from "react-dom/server";
import type { FacsimileSourceAsset } from "./FacsimileFace.tsx";
import { FacsimileFace } from "./FacsimileFace.tsx";

describe("FacsimileFace rendering (am-read-facsimile-face-er0)", () => {
  const mockPublishAsset: FacsimileSourceAsset = {
    sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    pageCount: 3,
    publicationDecision: "publish",
    embeddedTextLayer: "present",
    institution: "State Library Example",
    path: "public/papers/pdfs/example-paper.pdf",
    pageMapping: [
      {
        pdfPageIndex: 1,
        printedPage: 549,
        contents: ["article-text"],
        sectionIds: ["s1"],
        displayEquations: { numbered: ["(1)"] },
        footnoteMarks: ["1)"],
      },
      {
        pdfPageIndex: 2,
        printedPage: 550,
        contents: ["article-text"],
        sectionIds: ["s1", "s2"],
        displayEquations: { numbered: ["(2)"] },
        footnoteMarks: [],
      },
      {
        pdfPageIndex: 3,
        printedPage: 551,
        contents: ["article-text"],
        sectionIds: ["s2"],
        displayEquations: { numbered: [] },
        footnoteMarks: [],
      },
    ],
  };

  const paper = {
    id: "brownian-motion",
    slug: "brownian-motion",
    title: "Brownian Motion",
    citation: "Ann. Phys. (4) 17, 549–560 (1905)",
    germanTitle: "Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung",
  };

  it("renders published facsimile with viewer, page map, embedded text layer notice, and fallback direct-link", () => {
    const html = renderToString(<FacsimileFace paper={paper} sourceAsset={mockPublishAsset} />);

    // Title & citation
    expect(html).toContain("Brownian Motion");
    expect(html).toContain("Ann. Phys. (4) 17, 549–560 (1905)");

    // SHA-256 digest
    expect(html).toContain("0123456789ab");

    // Status badge
    expect(html).toContain("status-publish");

    // Third-party OCR notice
    expect(html).toContain("Third-Party Text Layer Notice");
    expect(html).toContain("That text layer is third-party OCR output, not the reviewed edition");

    // Interactive viewer & noscript fallback link with exact required text
    expect(html).toContain("facsimile-viewer");
    expect(html).toContain(
      "Opens the scan in your browser&#x27;s PDF viewer, which may show the library&#x27;s machine-read text layer; that text is not the edition.",
    );

    // Page map table
    expect(html).toContain("facsimile-pagemap-table");
    expect(html).toContain("Page 1");
    expect(html).toContain("p. 549");
    expect(html).toContain("Eq. (1)");
    expect(html).toContain("§1");
  });

  it("renders pin-local-only fixture with identity, verbatim rights, digest, institution, and page map without embedding scan or offering download link", () => {
    const mockPinLocalAsset: FacsimileSourceAsset = {
      sha256: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
      pageCount: 2,
      publicationDecision: "pin-local-only",
      publicationReason: "Source library terms restrict public redistribution.",
      institution: "Restricted Archives Consortium",
      originUrl: "https://example.org/restricted/scan-01",
      rights: {
        status: "scan-terms-restrict-redistribution",
        statement: "Digital reproduction reserved for accredited research institutions.",
        source: "https://example.org/restricted/scan-01",
        recordedAt: "2026-09-15",
        reuseTerms: "no-reuse-offered",
      },
      pageMapping: [
        {
          pdfPageIndex: 1,
          printedPage: 1,
          contents: ["article-text"],
          sectionIds: ["s1"],
          displayEquations: { numbered: [] },
          footnoteMarks: [],
        },
        {
          pdfPageIndex: 2,
          printedPage: 2,
          contents: ["article-text"],
          sectionIds: ["s1"],
          displayEquations: { numbered: [] },
          footnoteMarks: [],
        },
      ],
    };

    const html = renderToString(<FacsimileFace paper={paper} sourceAsset={mockPinLocalAsset} />);

    // Identity and metadata
    expect(html).toContain("Brownian Motion");
    expect(html).toContain("fedcba987654");
    expect(html).toContain("status-pin-local-only");
    expect(html).toContain("Restricted Archives Consortium");

    // Local-only notice and verbatim statement
    expect(html).toContain("Local Verification Scan");
    expect(html).toContain(
      "This scan is pinned locally for verification only and is not distributed publicly under its source terms.",
    );
    expect(html).toContain("Digital reproduction reserved for accredited research institutions.");
    expect(html).toContain("https://example.org/restricted/scan-01");

    // NO interactive viewer or direct download link
    expect(html).not.toContain("facsimile-viewer-toolbar");
    expect(html).not.toContain("direct-pdf-link");

    // Page map table still present
    expect(html).toContain("facsimile-pagemap-table");
    expect(html).toContain("Page 1");
  });

  it("renders reference-only fixture without embedding scan", () => {
    const mockRefAsset: FacsimileSourceAsset = {
      sha256: "1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff",
      pageCount: 1,
      publicationDecision: "reference-only",
      publicationReason: "Physical copy witness only.",
      pageMapping: [
        {
          pdfPageIndex: 1,
          printedPage: 10,
          contents: ["article-text"],
          sectionIds: [],
          displayEquations: { numbered: [] },
          footnoteMarks: [],
        },
      ],
    };

    const html = renderToString(<FacsimileFace paper={paper} sourceAsset={mockRefAsset} />);

    expect(html).toContain("Reference Only Document");
    expect(html).toContain("Reference only; scan not hosted.");
    expect(html).not.toContain("facsimile-viewer-toolbar");
  });
});
