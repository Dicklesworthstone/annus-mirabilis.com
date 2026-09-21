import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FacsimilePanel } from "./FacsimilePanel.tsx";
import { projectFacsimileDocument } from "./document.ts";

const document = projectFacsimileDocument("mass-energy", "ap-18-639", {
  configVersion: 1, key: "ap-18-639",
  verifiedAnchor: { parentPageIndex: 233, printedPage: 639, verifiedBy: "test fixture" },
  articlePages: { printedFirst: 639, printedLast: 641, parentPageIndices: [233, 234, 235] },
  rights: { publicationDecision: "publish", rightsStatus: "scan-open-terms" },
  pinned: { path: "public/papers/pdfs/ap-18-639.pdf", sha256: "a".repeat(64), pageCount: 3,
    mimeType: "application/pdf", acquisitionDate: "2026-09-18", originUrl: "https://archive.org/example.pdf" },
}, {
  paper: "mass-energy", document: "ap-18-639", pageCount: 3, pageRange: [639, 641], status: "in-preparation",
  units: [
    { id: "s0-p1", kind: "paragraph", locators: [{ page: 639 }] },
    { id: "s1-p1", kind: "paragraph", locators: [{ page: 640 }, { page: 641 }], destination: { editionBlockId: "de-example" } },
    { id: "eq-s1-d1", kind: "display-equation", locators: [{ page: 641 }], destination: { editionBlockId: "de-example" } },
  ],
});
function panel(section?: string, inline = false) {
  if (!document) throw new Error("facsimile-fixture-not-admitted");
  return <FacsimilePanel document={document} title="Original paper" section={section} inline={inline}
    faceHref="/papers/mass-energy/view/facsimile/" explanationHref="/papers/mass-energy/" />;
}

describe("FacsimilePanel static source face", () => {
  test("inline source ids never collide with the mounted explanation's section anchors", () => {
    const html = renderToStaticMarkup(<><section id="s1" />{panel("s1", true)}</>);
    expect(html.match(/id="s1"/g)?.length).toBe(1);
    expect(html).not.toContain('id="s1-p1"');
    expect(html).toContain('data-facsimile-target="s1-p1"');
    expect(html).toContain('href="/papers/mass-energy/view/facsimile/#s1-p1"');
    expect(html).toContain('data-view-link="reading"');
  });
  test("every original page and recovery path is in the HTML before JavaScript", () => {
    const html = renderToStaticMarkup(panel());
    for (const page of [1, 2, 3]) expect(html).toContain(`/papers/pdfs/ap-18-639.pdf#page=${page}`);
    for (const printed of [639, 640, 641]) expect(html).toContain(`id="facsimile-page-${printed}"`);
    expect(html).toContain("<noscript>");
    expect(html).toContain("download=");
    expect(html).toContain('href="/papers/mass-energy/"');
    expect(html).toContain('data-facsimile-controls="" disabled=""');
    expect(html).not.toContain("pdfjs");
    expect(html).not.toContain("<canvas");
  });
  test("source aliases and shared section anchors are unique, and straddling units retain both pages", () => {
    const html = renderToStaticMarkup(panel("s1"));
    expect(html).toContain('data-facsimile-pdf-page="2"');
    expect(html).toContain('id="s1-p1"');
    expect(html).toContain('id="eq-s1-d1"');
    expect(html.match(/id="de-example"/g)?.length).toBe(1);
    expect(html.match(/id="s1"/g)?.length).toBe(1);
    expect(html).toContain("PDF page 2</a>");
    expect(html).toContain("PDF page 3</a>");
    expect(html).toContain("not the original text");
  });
  test("unmapped sections open the whole paper without inventing a passage location", () => {
    const html = renderToStaticMarkup(panel("s9"));
    expect(html).toContain('data-facsimile-pdf-page="1"');
    expect(html).toContain("No source-page map is recorded for this section yet");
  });
  test("multiple viewers have unique form ids rather than the donor's global page-input id", () => {
    const html = renderToStaticMarkup(<>{panel()}{panel()}</>);
    const inputIds = [...html.matchAll(/<input id="([^"]+)"/g)].map(match => match[1]);
    expect(inputIds.length).toBe(4);
    expect(new Set(inputIds).size).toBe(4);
  });
});
