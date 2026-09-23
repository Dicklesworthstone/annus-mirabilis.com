import assert from "node:assert/strict";
import { test } from "node:test";
import {
  facsimilePageAnchor,
  facsimilePdfHref,
  facsimileSectionPages,
  projectFacsimileDocument,
  resolveFacsimileTarget,
} from "../reader/facsimile/document.ts";

const config = () => ({
  configVersion: 1,
  key: "ap-18-639",
  verifiedAnchor: { parentPageIndex: 233, printedPage: 639, verifiedBy: "recorded reviewer" },
  articlePages: { printedFirst: 639, printedLast: 641, parentPageIndices: [233, 234, 235] },
  rights: { publicationDecision: "publish", rightsStatus: "scan-open-terms" },
  pinned: {
    path: "public/papers/pdfs/ap-18-639.pdf",
    sha256: "a".repeat(64),
    pageCount: 3,
    mimeType: "application/pdf",
    originUrl: "https://archive.org/example.pdf",
    acquisitionDate: "2026-09-18",
    parent: { pageCount: 241, parentPageIndices: [233, 234, 235] },
  },
});
const inventory = () => ({
  paper: "mass-energy",
  document: "ap-18-639",
  status: "in-preparation",
  pageCount: 3,
  pageRange: [639, 641],
  units: [
    { id: "masthead-title", kind: "masthead-title", locators: [{ page: 639 }] },
    {
      id: "s0-p6",
      kind: "paragraph",
      locators: [{ page: 640 }, { page: 641 }],
      destination: { editionBlockId: "de-mass-energy-s0-p6" },
    },
    { id: "eq-s0-d1", kind: "display-equation", locators: [{ page: 639 }] },
  ],
});
const project = (c = config(), i = inventory()) =>
  projectFacsimileDocument("mass-energy", "ap-18-639", c, i);

/**
 * Assert WHICH refusal fired, at WHICH site.
 *
 * Every refusal below was asserted as `assert.throws(fn, /facsimile-data-invalid/)` before this
 * helper, and that is weaker than it looks. FacsimileDataError builds its message as
 * `${code}: ${message}`, so the regex is a SUBSTRING test on that message: renaming a site's
 * code to `facsimile-data-invalid-PLANTED` leaves the message matching and the test green. All
 * four coded sites in document.ts were planted that way and not one of them reddened.
 *
 * So this compares err.code exactly. Each site was established by planting it alone and seeing
 * which test reddened, never by reading test names and matching them up.
 *
 * This file is deliberately not reformatted: biome reflows 53 of its pre-existing lines and
 * would bury the change.
 */
const refusesWith = (fn, code, site) => {
  assert.throws(
    fn,
    (err) => {
      assert.equal(err.name, "FacsimileDataError", `${site}: ${err.name} is not a typed refusal`);
      assert.equal(err.code, code, `${site}: refused with ${err.code}, not ${code}`);
      return true;
    },
    `${site} did not refuse`,
  );
};

test("projects one-based extracted pages, not parent offsets or printed folios", () => {
  const d = project();
  assert.deepEqual(d.pages, [
    { pdfPage: 1, printedPage: 639 },
    { pdfPage: 2, printedPage: 640 },
    { pdfPage: 3, printedPage: 641 },
  ]);
  assert.equal(d.pdfUrl, "/papers/pdfs/ap-18-639.pdf");
  assert.equal(facsimilePdfHref(d, 2), "/papers/pdfs/ap-18-639.pdf#page=2");
  assert.equal(d.inventoryStatus, "in-preparation");
  assert.ok(Object.isFrozen(d) && Object.isFrozen(d.pages) && Object.isFrozen(d.units[1].pdfPages));
});
test("honors local-only and reference-only decisions without touching a pin", () => {
  for (const decision of ["pin-local-only", "reference-only"]) {
    const c = config();
    c.rights.publicationDecision = decision;
    delete c.pinned;
    assert.equal(project(c), null);
  }
  const c = config();
  delete c.pinned;
  assert.equal(project(c), null);
});
test("does not invent a transcription or inventory when only the PDF is available", () => {
  const d = project(config(), null);
  assert.equal(d.units.length, 0);
  assert.equal(d.pages.length, 3);
  assert.equal(d.inventoryStatus, null);
  assert.deepEqual(facsimileSectionPages(d, "s0"), []);
});
test("rejects unsafe URLs, mismatched identity, unknown decisions and invalid pin metadata", () => {
  const mutations = [
    (c) => (c.key = "ap-17-549"),
    (c) => (c.configVersion = 2),
    (c) => (c.rights.publicationDecision = "maybe"),
    (c) => (c.pinned.path = "public/../../private.pdf"),
    (c) => (c.pinned.originUrl = "javascript:alert(1)"),
    (c) => (c.pinned.originUrl = "https://user:password@example.org/file.pdf"),
    (c) => (c.pinned.sha256 = "bad"),
    (c) => (c.pinned.mimeType = "text/html"),
    (c) => (c.pinned.pageCount = 4),
    (c) => (c.pinned.pageCount = Infinity),
    (c) => (c.articlePages.printedFirst = 638),
    (c) => (c.pinned.acquisitionDate = "unknown"),
  ];
  for (const mutate of mutations) {
    const c = config();
    mutate(c);
    refusesWith(() => project(c), "facsimile-data-invalid", "(document.ts:49)");
  }
  // An origin the URL parser cannot read at all, which is a different site from one it reads
  // and rejects. Every mutation above is PARSEABLE - "javascript:alert(1)" and
  // "https://user:password@..." both construct fine and are refused by the protocol guard - so
  // the catch around `new URL` was driven by nothing in this file until now.
  const unparseable = config();
  unparseable.pinned.originUrl = "not a url";
  refusesWith(() => project(unparseable), "facsimile-data-invalid", "(document.ts:118)");
});
test("same-length wrong page window, stale extract map and out-of-parent pages are rejected", () => {
  // Deleting the anchor leaves `config.verifiedAnchor ?? article.verifiedAnchor` undefined, so
  // it fails the record() type guard at :36, while the rest are records that fail a stated
  // condition at :41. Two sites behind one code, which is why they are cited apart.
  const missingAnchor = config();
  delete missingAnchor.verifiedAnchor;
  refusesWith(() => project(missingAnchor), "facsimile-data-invalid", "(document.ts:44)");
  const mutations = [
    (c) => (c.articlePages.parentPageIndices = [232, 233, 234]),
    (c) => (c.verifiedAnchor.verifiedBy = ""),
    (c) => (c.pinned.parent.parentPageIndices = [232, 233, 234]),
    (c) => (c.pinned.parent.pageCount = 235),
    (c) => (c.articlePages.parentPageIndices = [233, 233, 235]),
  ];
  for (const mutate of mutations) {
    const c = config();
    mutate(c);
    refusesWith(() => project(c), "facsimile-data-invalid", "(document.ts:49)");
  }
});
test("supports the configuration schema's nested verified anchor", () => {
  const c = config();
  c.articlePages.verifiedAnchor = c.verifiedAnchor;
  delete c.verifiedAnchor;
  assert.equal(project(c).pages[0].printedPage, 639);
});
test("multi-page source units and edition aliases select the first recorded page", () => {
  const d = project();
  assert.deepEqual(d.units[1].pdfPages, [2, 3]);
  for (const hash of ["#s0-p6", "#de-mass-energy-s0-p6", "#%73%30-p6"])
    assert.equal(resolveFacsimileTarget(d, hash), 2);
  assert.equal(resolveFacsimileTarget(d, "#eq-s0-d1"), 1);
  assert.equal(resolveFacsimileTarget(d, "#facsimile-page-641"), 3);
  assert.equal(resolveFacsimileTarget(d, "#s0"), 1);
  assert.equal(facsimilePageAnchor(d.pages[1]), "facsimile-page-640");
});
test("section scopes use locators and retain both pages of a straddling unit", () => {
  const i = inventory();
  i.units[1].section = "s1";
  const d = project(config(), i);
  assert.deepEqual(
    facsimileSectionPages(d, "s1").map((p) => p.pdfPage),
    [2, 3],
  );
  assert.deepEqual(facsimileSectionPages(d, "s9"), []);
  assert.equal(facsimileSectionPages(d), d.pages);
});
test("malformed and unknown fragments never fabricate a matching page", () => {
  for (const hash of [
    "",
    "#%E0%A4%A",
    "#facsimile-page-640junk",
    "#facsimile-page-1",
    "#s0-p999",
    "#arg-me-subtraction",
    "#s999",
    "x".repeat(513),
  ]) {
    assert.equal(resolveFacsimileTarget(project(), hash), null);
  }
  for (const page of [0, 4, 1.5, NaN, Infinity])
    refusesWith(
      () => facsimilePdfHref(project(), page),
      "facsimile-page-out-of-range",
      "(document.ts:335)",
    );
});
test("inventory identity, page ranges, missing locators, duplicate ids and unsafe aliases fail closed", () => {
  const mutations = [
    (i) => (i.paper = "brownian-motion"),
    (i) => (i.document = "ap-17-549"),
    (i) => (i.pageRange = [639, 642]),
    (i) => (i.units[1].locators = [{ page: 642 }]),
    (i) => (i.units[1].locators = []),
    (i) => i.units.push({ ...i.units[0] }),
    (i) => (i.units[1].destination.editionBlockId = "facsimile-page-639"),
    (i) => (i.units[1].id = "facsimile-page-640"),
    (i) => (i.units[1].section = "../s0"),
    (i) => (i.units[1].id = "bad id"),
  ];
  for (const mutate of mutations) {
    const i = inventory();
    mutate(i);
    refusesWith(() => project(config(), i), "facsimile-data-invalid", "(document.ts:49)");
  }
});

test("many-to-one edition aliases retain all contributors without changing a canonical source anchor", () => {
  const i = inventory();
  i.units[2].destination = { editionBlockId: "de-mass-energy-s0-p6" };
  const d = project(config(), i);
  assert.equal(resolveFacsimileTarget(d, "#de-mass-energy-s0-p6"), 1);
  assert.equal(resolveFacsimileTarget(d, "#s0-p6"), 2);
});

test("a closing block's section is its own, not a numbered section, and still refuses a bad one", () => {
  // Brownian's inventory marks closing-dateline and closing-received `section: closing`
  // (docs/CONTENT_IDS.md §3). The projector refused the whole face over them ("Invalid source
  // section."), so /papers/brownian-motion/view/facsimile/ showed only a notice.
  const i = inventory();
  i.units.push({
    id: "closing-dateline",
    kind: "closing-dateline",
    section: "closing",
    locators: [{ page: 641 }],
  });
  const document = project(config(), i);
  const closing = document.units.find((unit) => unit.id === "closing-dateline");
  assert.equal(closing.section, null);
  assert.deepEqual([...closing.pdfPages], [3]);
  // Only the literal "closing" is let through; any other non-numbered section still refuses.
  for (const section of ["closings", "Closing", "s", "../closing"]) {
    const bad = inventory();
    bad.units.push({
      id: "closing-received",
      kind: "closing-received",
      section,
      locators: [{ page: 641 }],
    });
    assert.throws(() => project(config(), bad), /Invalid source section/);
  }
});
