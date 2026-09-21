import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadPaper } from "../../content/server.ts";
import { FaceFallback } from "../FaceFallback.tsx";
import { listReadablePapers } from "../paperRoutes.ts";
import type { FacsimileDocument } from "./document.ts";
import type { FacsimileAvailability } from "./server.ts";

async function fixture() {
  const paperId = (await listReadablePapers())[0];
  if (!paperId) throw new Error("facsimile-compiled-paper-missing");
  const { paper } = await loadPaper(paperId);
  const document: FacsimileDocument = {
    paperId, key: paper.citation, pdfUrl: `/papers/pdfs/${paper.citation}.pdf`,
    sha256: "a".repeat(64), acquisitionDate: "2026-09-18", rightsStatus: "test-fixture",
    originUrl: "https://archive.org/example.pdf", inventoryStatus: "in-preparation",
    pages: [{ pdfPage: 1, printedPage: 639 }], units: [],
  };
  return { paperId, paper, document };
}

test("shared fallback renders an admitted source, including the dedicated Brownian face path", async () => {
  const { paperId, paper, document } = await fixture();
  const calls: string[][] = [];
  const html = renderToStaticMarkup(await FaceFallback({ paperId, face: "facsimile" }, {
    facsimileLoader: async (id, key): Promise<FacsimileAvailability> => {
      calls.push([id, key]);
      return { kind: "available", document };
    },
  }));
  expect(calls).toEqual([[paperId, paper.citation]]);
  expect(html).toContain("data-facsimile-reader");
  expect(html).toContain('data-view="facsimile"');
  expect(html).toContain(`href="/papers/pdfs/${paper.citation}.pdf#page=1"`);
  expect(html).not.toContain("facsimile for this paper is not yet available");
  expect(html.match(/data-reader-root/g)?.length).toBe(1);
});

test("failed source admission keeps the explanation reachable and never emits a PDF embed", async () => {
  const { paperId } = await fixture();
  const html = renderToStaticMarkup(await FaceFallback({ paperId, face: "facsimile" }, {
    facsimileLoader: async () => ({ kind: "unavailable", code: "facsimile-digest-mismatch", message: "Fixture digest does not match." }),
  }));
  expect(html).toContain('data-refusal-code="facsimile-digest-mismatch"');
  expect(html).toContain("Fixture digest does not match.");
  expect(html).toContain(`href="/papers/${paperId}/"`);
  expect(html).not.toContain("<iframe");
  expect(html).not.toContain("data-facsimile-reader");
});

test("ordinary fallback faces never read or hash the pinned PDF", async () => {
  const { paperId } = await fixture();
  for (const face of ["german", "english", "results", "split"] as const) {
    let calls = 0;
    await FaceFallback({ paperId, face }, {
      facsimileLoader: async () => {
        calls++;
        throw new Error("facsimile-read-on-unrelated-face");
      },
    });
    expect(calls).toBe(0);
  }
});
