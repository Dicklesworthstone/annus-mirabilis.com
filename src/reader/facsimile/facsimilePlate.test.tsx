/**
 * A phone browser has no dependable inline PDF viewer, so where every page of a pinned paper has
 * a plate (a 640px and a 1280px webp from generate-page-plates.ts), the facsimile face shows the
 * printed page as an image on a phone and keeps it on the page the reader selects.
 *
 * Four owners, each proved here: the loader offers plates only when EVERY page has BOTH widths;
 * the wire carries only the one directory the loader can name; the panel renders the initial
 * page's plate and nothing without plates; the controller moves the plate with the selection and
 * drops the PDF caveat from the status only while the plate is what the reader sees.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { mountFacsimileReader } from "./controller.ts";
import type { FacsimileDocument } from "./document.ts";
import { FacsimilePanel } from "./FacsimilePanel.tsx";
import { loadFacsimileDocument } from "./server.ts";
import { decodeFacsimileAvailability, FACSIMILE_WIRE_VERSION } from "./wire.ts";

// Byte admission only; the loader never renders the PDF or decodes a plate.
const bytes = Buffer.from("%PDF-1.7\nsynthetic plate fixture\n%%EOF\n");
const digest = createHash("sha256").update(bytes).digest("hex");
const config = `configVersion: 1
key: ap-18-639
verifiedAnchor:
  parentPageIndex: 233
  printedPage: 639
  verifiedBy: test-fixture
articlePages:
  printedFirst: 639
  printedLast: 641
  parentPageIndices: [233, 234, 235]
rights:
  publicationDecision: publish
  rightsStatus: scan-open-terms
pinned:
  path: public/papers/pdfs/ap-18-639.pdf
  sha256: ${digest}
  pageCount: 3
  mimeType: application/pdf
  acquisitionDate: '2026-09-18'
  originUrl: https://archive.org/example.pdf
  parent:
    pageCount: 241
    parentPageIndices: [233, 234, 235]
`;
const inventory = `paper: mass-energy
document: ap-18-639
pageCount: 3
pageRange: [639, 641]
status: in-preparation
units:
  - id: s0-p6
    kind: paragraph
    locators:
      - page: 640
      - page: 641
    destination:
      editionBlockId: de-mass-energy-s0-p6
`;
const PLATE_DIR = "/figures/plates/pages/ap-18-639";
const ALL_PLATES = ["639", "640", "641"].flatMap((page) => [`${page}.webp`, `${page}-1280.webp`]);

/** A scratch root holding the pin, the inventory and the named plate files. Kept for
 * post-failure inspection; no repository file is touched. */
async function fixture(plates: readonly string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "annus-facsimile-plate-"));
  const dirs = {
    config: join(root, "scripts/sources/facsimile-sources"),
    inventory: join(root, "content/source-blocks/mass-energy"),
    pdf: join(root, "public/papers/pdfs"),
    plates: join(root, "public", PLATE_DIR),
  };
  await Promise.all(Object.values(dirs).map((path) => mkdir(path, { recursive: true })));
  await writeFile(join(dirs.config, "ap-18-639.yaml"), config);
  await writeFile(join(dirs.inventory, "manifest.yaml"), inventory);
  await writeFile(join(dirs.pdf, "ap-18-639.pdf"), bytes);
  for (const file of plates) await writeFile(join(dirs.plates, file), "plate");
  return root;
}

async function loaded(plates: readonly string[]): Promise<FacsimileDocument> {
  const result = await loadFacsimileDocument("mass-energy", "ap-18-639", await fixture(plates));
  if (result.kind !== "available") throw new Error(`fixture not admitted: ${result.code}`);
  return result.document;
}

describe("the loader offers plates only when every page has both widths", () => {
  test("all six files: the document names the plate directory", async () => {
    expect((await loaded(ALL_PLATES)).plateDir).toBe(PLATE_DIR);
  });
  test("no plates, or one width missing for one page: no plate directory", async () => {
    expect((await loaded([])).plateDir).toBeUndefined();
    // Five of six: the last page's 1280px plate is absent, so a srcset would name a missing file.
    expect((await loaded(ALL_PLATES.slice(0, -1))).plateDir).toBeUndefined();
    // Every 1280px plate present, one 640px plate absent.
    expect((await loaded(ALL_PLATES.filter((file) => file !== "640.webp"))).plateDir).toBe(
      undefined,
    );
  });
});

describe("the wire carries only the directory the loader can name", () => {
  const wire = (document: FacsimileDocument, plateDir: unknown) =>
    JSON.parse(
      JSON.stringify({
        schemaVersion: FACSIMILE_WIRE_VERSION,
        kind: "available",
        document: { ...document, plateDir },
      }),
    );
  test("the key's own directory survives; any other value is dropped", async () => {
    const document = await loaded(ALL_PLATES);
    const decode = (plateDir: unknown) => {
      const result = decodeFacsimileAvailability(wire(document, plateDir), "mass-energy");
      if (result.kind !== "available") throw new Error("wire fixture refused");
      return result.document.plateDir;
    };
    expect(decode(PLATE_DIR)).toBe(PLATE_DIR);
    expect(decode("/figures/plates/pages/ap-17-132")).toBeUndefined();
    expect(decode("https://example.com/plates")).toBeUndefined();
    expect(decode(undefined)).toBeUndefined();
  });
});

function panelHtml(document: FacsimileDocument, section?: string): string {
  return renderToStaticMarkup(
    <FacsimilePanel
      document={document}
      title="Original paper"
      section={section}
      faceHref="/papers/mass-energy/view/facsimile/"
      explanationHref="/papers/mass-energy/"
    />,
  );
}

describe("the panel renders the initial page's plate", () => {
  test("with plates: the first page, both widths, and an alt naming the printed page", async () => {
    const html = panelHtml(await loaded(ALL_PLATES));
    const img = html.match(/<img[^>]*data-facsimile-plate[^>]*>/)?.[0] ?? "";
    expect(img).toContain(`src="${PLATE_DIR}/639.webp"`);
    expect(img).toContain(`${PLATE_DIR}/639.webp 640w, ${PLATE_DIR}/639-1280.webp 1280w`);
    expect(img).toContain('alt="Printed page 639 of the pinned journal scan"');
    expect(img).toContain('loading="lazy"');
    // With plates there is no PDF frame at any width: a browser's PDF viewer would expose the
    // scan's machine-read text layer as selectable, searchable text (fb34b4ed).
    expect(html).not.toContain("data-facsimile-frame");
    expect(html).not.toContain("<iframe");
    // The pinned PDF itself stays one link away.
    expect(html).toContain('href="/papers/pdfs/ap-18-639.pdf#page=1"');
  });
  test("a section opens its plate at the section's first page", async () => {
    // s0-p6 is recorded on pages 640 and 641, so section s0 opens at 640.
    const html = panelHtml(await loaded(ALL_PLATES), "s0");
    expect(html).toMatch(/<img[^>]*src="\/figures\/plates\/pages\/ap-18-639\/640\.webp"/);
  });
  test("without plates: no image at all, so nothing names a missing file", async () => {
    const html = panelHtml(await loaded([]));
    expect(html).not.toContain("data-facsimile-plate");
    expect(html).not.toContain("<img");
    // With nothing else to show, the frame is the viewer.
    expect(html).toContain("data-facsimile-frame");
  });
});

describe("the controller keeps the plate on the selected page", () => {
  afterEach(uninstallDom);

  async function mounted() {
    await installDom();
    (
      window as unknown as { happyDOM: { settings: { disableIframePageLoading: boolean } } }
    ).happyDOM.settings.disableIframePageLoading = true;
    const document = await loaded(ALL_PLATES);
    const host = window.document.createElement("div");
    host.innerHTML = panelHtml(document);
    window.document.body.append(host);
    const root = host.querySelector<HTMLElement>("[data-facsimile-reader]");
    if (!root) throw new Error("panel did not render its root");
    const unmount = mountFacsimileReader(root, document, 1, "/papers/mass-energy/view/facsimile/");
    const plate = () => root.querySelector<HTMLImageElement>("[data-facsimile-plate]");
    const status = () => root.querySelector("[data-facsimile-status]")?.textContent ?? "";
    const click = (selector: string) => root.querySelector<HTMLButtonElement>(selector)?.click();
    return { root, unmount, plate, status, click };
  }

  test("Next and Previous move src, srcset and alt together", async () => {
    const { unmount, plate, click } = await mounted();
    click("[data-facsimile-next]");
    expect(plate()?.getAttribute("src")).toBe(`${PLATE_DIR}/640.webp`);
    expect(plate()?.getAttribute("srcset")).toBe(
      `${PLATE_DIR}/640.webp 640w, ${PLATE_DIR}/640-1280.webp 1280w`,
    );
    expect(plate()?.getAttribute("alt")).toBe("Printed page 640 of the pinned journal scan");
    click("[data-facsimile-next]");
    expect(plate()?.getAttribute("src")).toBe(`${PLATE_DIR}/641.webp`);
    click("[data-facsimile-previous]");
    expect(plate()?.getAttribute("src")).toBe(`${PLATE_DIR}/640.webp`);
    unmount();
  });

  test("the PDF caveat is dropped only while the plate is displayed", async () => {
    const { unmount, plate, status, click } = await mounted();
    // No stylesheet in happy-dom, so the plate is displayed.
    click("[data-facsimile-next]");
    expect(status()).toBe("Selected printed page 640 (PDF page 2 of 3).");
    // As on a wide screen, where facsimileReader.css hides the plate and the frame shows.
    plate()?.style.setProperty("display", "none");
    click("[data-facsimile-next]");
    expect(status()).toBe(
      "Selected printed page 641 (PDF page 3 of 3). The embedded display depends on your browser's PDF support.",
    );
    unmount();
  });
});
