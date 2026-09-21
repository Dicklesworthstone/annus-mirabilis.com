import assert from "node:assert/strict";
import { test } from "node:test";
import {
  projectFacsimileDocument, facsimileSectionPages, facsimilePageAnchor,
  facsimilePdfHref, resolveFacsimileTarget,
} from "../reader/facsimile/document.ts";

const config = () => ({
  configVersion: 1, key: "ap-18-639",
  verifiedAnchor: { parentPageIndex: 233, printedPage: 639, verifiedBy: "recorded reviewer" },
  articlePages: { printedFirst: 639, printedLast: 641, parentPageIndices: [233,234,235] },
  rights: { publicationDecision: "publish", rightsStatus: "scan-open-terms" },
  pinned: { path: "public/papers/pdfs/ap-18-639.pdf", sha256: "a".repeat(64), pageCount: 3,
    mimeType: "application/pdf", originUrl: "https://archive.org/example.pdf", acquisitionDate: "2026-09-18",
    parent: { pageCount: 241, parentPageIndices: [233,234,235] } },
});
const inventory = () => ({ paper: "mass-energy", document: "ap-18-639", status: "in-preparation",
  pageCount: 3, pageRange: [639,641], units: [
    { id: "masthead-title", kind: "masthead-title", locators: [{page:639}] },
    { id: "s0-p6", kind: "paragraph", locators: [{page:640},{page:641}], destination: {editionBlockId:"de-mass-energy-s0-p6"} },
    { id: "eq-s0-d1", kind: "display-equation", locators: [{page:639}] },
  ],
});
const project = (c=config(), i=inventory()) => projectFacsimileDocument("mass-energy", "ap-18-639", c, i);

test("projects one-based extracted pages, not parent offsets or printed folios", () => {
  const d = project();
  assert.deepEqual(d.pages, [{pdfPage:1,printedPage:639},{pdfPage:2,printedPage:640},{pdfPage:3,printedPage:641}]);
  assert.equal(d.pdfUrl, "/papers/pdfs/ap-18-639.pdf");
  assert.equal(facsimilePdfHref(d, 2), "/papers/pdfs/ap-18-639.pdf#page=2");
  assert.equal(d.inventoryStatus, "in-preparation");
  assert.ok(Object.isFrozen(d) && Object.isFrozen(d.pages) && Object.isFrozen(d.units[1].pdfPages));
});
test("honors local-only and reference-only decisions without touching a pin", () => {
  for (const decision of ["pin-local-only", "reference-only"]) {
    const c=config(); c.rights.publicationDecision=decision; delete c.pinned;
    assert.equal(project(c), null);
  }
  const c=config(); delete c.pinned; assert.equal(project(c), null);
});
test("does not invent a transcription or inventory when only the PDF is available", () => {
  const d=project(config(),null); assert.equal(d.units.length,0); assert.equal(d.pages.length,3);
  assert.equal(d.inventoryStatus,null); assert.deepEqual(facsimileSectionPages(d,"s0"),[]);
});
test("rejects unsafe URLs, mismatched identity, unknown decisions and invalid pin metadata", () => {
  const mutations = [c=>c.key="ap-17-549", c=>c.configVersion=2, c=>c.rights.publicationDecision="maybe",
    c=>c.pinned.path="public/../../private.pdf", c=>c.pinned.originUrl="javascript:alert(1)",
    c=>c.pinned.originUrl="https://user:password@example.org/file.pdf", c=>c.pinned.sha256="bad",
    c=>c.pinned.mimeType="text/html", c=>c.pinned.pageCount=4, c=>c.pinned.pageCount=Infinity,
    c=>c.articlePages.printedFirst=638, c=>c.pinned.acquisitionDate="unknown" ];
  for (const mutate of mutations) {const c=config();mutate(c);assert.throws(()=>project(c),/facsimile-data-invalid/);}
});
test("same-length wrong page window, stale extract map and out-of-parent pages are rejected", () => {
  const mutations = [c=>c.articlePages.parentPageIndices=[232,233,234], c=>delete c.verifiedAnchor,
    c=>c.verifiedAnchor.verifiedBy="", c=>c.pinned.parent.parentPageIndices=[232,233,234],
    c=>c.pinned.parent.pageCount=235, c=>c.articlePages.parentPageIndices=[233,233,235]];
  for(const mutate of mutations){const c=config();mutate(c);assert.throws(()=>project(c),/facsimile-data-invalid/);}
});
test("supports the configuration schema's nested verified anchor", () => {
  const c=config();c.articlePages.verifiedAnchor=c.verifiedAnchor;delete c.verifiedAnchor;
  assert.equal(project(c).pages[0].printedPage,639);
});
test("multi-page source units and edition aliases select the first recorded page", () => {
  const d=project(); assert.deepEqual(d.units[1].pdfPages,[2,3]);
  for(const hash of ["#s0-p6","#de-mass-energy-s0-p6","#%73%30-p6"]) assert.equal(resolveFacsimileTarget(d,hash),2);
  assert.equal(resolveFacsimileTarget(d,"#eq-s0-d1"),1);
  assert.equal(resolveFacsimileTarget(d,"#facsimile-page-641"),3);
  assert.equal(resolveFacsimileTarget(d,"#s0"),1);
  assert.equal(facsimilePageAnchor(d.pages[1]),"facsimile-page-640");
});
test("section scopes use locators and retain both pages of a straddling unit", () => {
  const i=inventory();i.units[1].section="s1";
  const d=project(config(),i);
  assert.deepEqual(facsimileSectionPages(d,"s1").map(p=>p.pdfPage),[2,3]);
  assert.deepEqual(facsimileSectionPages(d,"s9"),[]);
  assert.equal(facsimileSectionPages(d),d.pages);
});
test("malformed and unknown fragments never fabricate a matching page", () => {
  for (const hash of ["", "#%E0%A4%A", "#facsimile-page-640junk", "#facsimile-page-1", "#s0-p999", "#arg-me-subtraction", "#s999", "x".repeat(513)]) {
    assert.equal(resolveFacsimileTarget(project(),hash),null);
  }
  for(const page of [0,4,1.5,NaN,Infinity])assert.throws(()=>facsimilePdfHref(project(),page),/facsimile-page-out-of-range/);
});
test("inventory identity, page ranges, missing locators, duplicate ids and unsafe aliases fail closed", () => {
  const mutations=[i=>i.paper="brownian-motion", i=>i.document="ap-17-549", i=>i.pageRange=[639,642],
    i=>i.units[1].locators=[{page:642}], i=>i.units[1].locators=[], i=>i.units.push({...i.units[0]}),
    i=>i.units[1].destination.editionBlockId="facsimile-page-639", i=>i.units[1].id="facsimile-page-640",
    i=>i.units[1].section="../s0", i=>i.units[1].id="bad id"];
  for(const mutate of mutations){const i=inventory();mutate(i);assert.throws(()=>project(config(),i),/facsimile-data-invalid/);}
});

test("many-to-one edition aliases retain all contributors without changing a canonical source anchor", () => {
  const i=inventory();i.units[2].destination={editionBlockId:"de-mass-energy-s0-p6"};
  const d=project(config(),i);
  assert.equal(resolveFacsimileTarget(d,"#de-mass-energy-s0-p6"),1);
  assert.equal(resolveFacsimileTarget(d,"#s0-p6"),2);
});
