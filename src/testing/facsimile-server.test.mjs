import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadFacsimileDocument, verifyFacsimilePdf } from "../reader/facsimile/server.ts";

// Tests of byte admission, not a claim that this synthetic header is a renderable scan.
const bytes = Buffer.from("%PDF-1.7\nsynthetic byte-admission fixture\n%%EOF\n");
const digest = createHash("sha256").update(bytes).digest("hex");
const config = (decision = "publish", hash = digest) => `configVersion: 1
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
  publicationDecision: ${decision}
  rightsStatus: scan-open-terms
pinned:
  path: public/papers/pdfs/ap-18-639.pdf
  sha256: ${hash}
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
async function fixture({ source = bytes, manifest = inventory, text = config() } = {}) {
  // Keep fixtures for post-failure inspection; no repository files are deleted.
  const root = await mkdtemp(join(tmpdir(), "annus-facsimile-"));
  const configDir = join(root, "scripts/sources/facsimile-sources");
  const inventoryDir = join(root, "content/source-blocks/mass-energy");
  const pdfDir = join(root, "public/papers/pdfs");
  await Promise.all(
    [configDir, inventoryDir, pdfDir].map((path) => mkdir(path, { recursive: true })),
  );
  if (text !== null) await writeFile(join(configDir, "ap-18-639.yaml"), text);
  if (manifest !== null) await writeFile(join(inventoryDir, "manifest.yaml"), manifest);
  if (source !== null) await writeFile(join(pdfDir, "ap-18-639.pdf"), source);
  return { root, configDir, inventoryDir, pdfDir, pdf: join(pdfDir, "ap-18-639.pdf") };
}
const load = (fixture) => loadFacsimileDocument("mass-energy", "ap-18-639", fixture.root);

test("server joins the existing YAML parser, page projection and verified file bytes", async () => {
  const result = await load(await fixture());
  assert.equal(result.kind, "available");
  assert.equal(result.document.sha256, digest);
  assert.equal(result.document.inventoryStatus, "in-preparation");
  assert.deepEqual(result.document.units[0].pdfPages, [2, 3]);
  assert.equal(result.document.pdfUrl, "/papers/pdfs/ap-18-639.pdf");
  assert.equal(JSON.stringify(result).includes(bytes.toString()), false);
});
test("an unreadable inventory refuses as an inventory fault, never as a scan fault", async () => {
  // No (server.ts:NN) citation on purpose. The refusal ratchet records six sites in server.ts and
  // none of them is this one: it counts `throw new SomeError("code")` and standalone code: fields,
  // not a helper call like unavailable("code", message). Citing a line the scanner does not track
  // would be a claim nobody can check, which is the laundering that ratchet exists to stop.
  // The scan is admitted and its digest verifies; only the source-unit record is malformed. Both
  // used to reach the same catch, so a reader was told "The scan or its page map did not pass the
  // source checks" - which names the scan, and is false here. Measured on the real corpus:
  // brownian-motion and special-relativity project 12 and 31 pages WITHOUT their inventories and
  // throw with them, so 15 of 28 facsimile routes carried that wrong attribution.
  const f = await fixture({
    manifest: inventory.replace("    kind: paragraph\n", ""), // a unit with an id and no kind
  });
  const result = await load(f);
  assert.equal(result.kind, "unavailable");
  assert.equal(result.code, "facsimile-inventory-invalid");
  // The distinction is the point, so it is asserted rather than left to the code string.
  assert.equal(
    result.message.includes("pinned and admitted for display"),
    true,
    "the refusal must clear the scan, not blame it",
  );
  assert.equal(
    result.message.includes("did not pass the source checks"),
    false,
    "the generic scan-blaming wording must not survive here",
  );
});
test("a genuinely malformed CONFIG still refuses as a source-data fault, not an inventory one", async () => {
  // The negative half: this must NOT collect the inventory code, or the new branch would simply
  // swallow every data failure and the distinction it exists to draw would be decorative.
  const f = await fixture({
    text: config().replace("printedFirst: 639", "printedFirst: notanumber"),
  });
  const result = await load(f);
  assert.equal(result.kind, "unavailable");
  assert.notEqual(result.code, "facsimile-inventory-invalid");
});
test("local-only and reference-only pins never read malformed inventory or missing PDF", async () => {
  for (const decision of ["pin-local-only", "reference-only"]) {
    const f = await fixture({
      source: null,
      manifest: "bad yaml without a mapping",
      text: config(decision),
    });
    const result = await load(f);
    assert.equal(result.kind, "unavailable");
    assert.equal(result.code, "facsimile-not-published");
    assert.equal("document" in result, false);
  }
});
test("absent configuration and absent pinned bytes have distinct explanations", async () => {
  assert.equal((await load(await fixture({ text: null }))).code, "facsimile-not-pinned");
  assert.equal((await load(await fixture({ source: null }))).code, "facsimile-source-missing");
});
test("a stale same-length PDF fails the pinned digest without exposing a usable source", async () => {
  const result = await load(
    await fixture({ source: Buffer.from(bytes.toString().replace("fixture", "changed")) }),
  );
  assert.equal(result.code, "facsimile-digest-mismatch");
  assert.equal("document" in result, false);
});
test("correctly hashed non-PDF bytes and too-small files are rejected (server.ts:51)", async () => {
  const html = Buffer.from("<html>Not an original scan</html>");
  const hash = createHash("sha256").update(html).digest("hex");
  assert.equal(
    (await load(await fixture({ source: html, text: config("publish", hash) }))).code,
    "facsimile-not-pdf",
  );
  // The stat-time size guard. facsimile-file-invalid has a second site at server.ts:61, which
  // this does not reach; see the note on that site below.
  assert.equal(
    (await load(await fixture({ source: Buffer.from("PDF") }))).code,
    "facsimile-file-invalid",
  );
});

test("metadata that is not a readable file is refused, not read as absent (server.ts:26)", async () => {
  // Nothing drove this site: planting its code left 11 pass 0 fail, and a marker on it was
  // never reached. It is reachable, though, and the branch that reaches it deterministically
  // is `!info.isFile()` rather than the 2 MB size limit, so no large fixture is needed.
  //
  // What makes it worth a test rather than a note is that the failure it guards is a SILENT
  // one. optionalMetadata returns null for a genuinely absent file, and null is how the
  // caller decides a paper simply has no pin yet. A path that exists but is not a file must
  // not take that route, or an unreadable inventory would be reported to the reader as "no
  // scan is recorded" - absence and malformation telling the same story.
  const f = await fixture({ manifest: null });
  // A directory where manifest.yaml belongs: stat succeeds, isFile() is false.
  await mkdir(join(f.inventoryDir, "manifest.yaml"), { recursive: true });
  const result = await load(f);
  assert.equal(result.kind, "unavailable");
  assert.equal(result.code, "facsimile-metadata-invalid");
  // And specifically NOT the absent-file code, which is the mistake being guarded.
  assert.notEqual(result.code, "facsimile-not-pinned");
  assert.notEqual(result.code, "facsimile-source-missing");
});

/**
 * server.ts:61 is NOT PAID HERE, and the reason is structural rather than a gap.
 *
 * It is the second site of facsimile-file-invalid, inside the streaming loop, and it fires
 * when the accumulated byte count passes MAX_PDF_BYTES. Its predecessor at :50 has already
 * rejected the file when `stat` reported a size over that same limit, before a single byte is
 * streamed. So :61 can only fire if the file GROWS between the stat and the read - a
 * time-of-check/time-of-use backstop against a concurrent writer.
 *
 * Driving it would mean appending to the file while the stream is consuming it, which is a
 * race, and a test that depends on winning a race is the flaky kind this repository forbids
 * rerunning until it passes. Recorded rather than faked. Planting it leaves 11 pass 0 fail,
 * which is the honest signature of an unreached backstop and not of a missing assertion.
 *
 * One latent hazard noticed while reading, reported rather than changed: both catch blocks
 * discriminate with `(error as NodeJS.ErrnoException).code === "ENOENT"`, and
 * FacsimileDataError also carries a `.code`. The two namespaces share one property. No
 * refusal code is currently "ENOENT", so nothing is wrong today, but a refusal code that
 * ever collided with an errno string would be silently reported as a missing file.
 */
test("a bad source-page map is not downgraded to an apparently unlocated valid scan", async () => {
  const wrong = inventory.replace("page: 641", "page: 642");
  assert.notEqual(wrong, inventory);
  const result = await load(await fixture({ manifest: wrong }));
  // The property this test is named for - a bad page map must never be downgraded to an
  // available scan with no anchors - is this line, and it is unchanged.
  assert.equal(result.kind, "unavailable");
  // The CODE changed deliberately: a bad locator lives in the inventory, so it now refuses as an
  // inventory fault rather than under the generic source-data code that also names the scan.
  assert.equal(result.code, "facsimile-inventory-invalid");
});
test("a pin without inventory remains readable but has no manufactured source anchors", async () => {
  const result = await load(await fixture({ manifest: null }));
  assert.equal(result.kind, "available");
  assert.deepEqual(result.document.units, []);
  assert.equal(result.document.inventoryStatus, null);
});
test("JSON source inventories are supported without a YAML counterpart", async () => {
  const f = await fixture({ manifest: null });
  await writeFile(
    join(f.inventoryDir, "manifest.json"),
    JSON.stringify({
      paper: "mass-energy",
      document: "ap-18-639",
      pageCount: 3,
      pageRange: [639, 641],
      units: [],
    }),
  );
  assert.equal((await load(f)).kind, "available");
});
test("invalid identities are rejected before path interpolation", async () => {
  for (const [paper, key] of [
    ["../private", "ap-18-639"],
    ["mass-energy", "../../secret"],
  ]) {
    const result = await loadFacsimileDocument(paper, key, "/path/that/does/not/exist");
    assert.equal(result.code, "facsimile-identity-invalid");
  }
});
test("a symlink cannot publish bytes from outside the public PDF directory", {
  skip: process.platform === "win32",
}, async () => {
  const f = await fixture({ source: null });
  const external = join(f.root, "private.pdf");
  await writeFile(external, bytes);
  await symlink(external, f.pdf);
  await assert.rejects(verifyFacsimilePdf(f.pdf, digest, f.pdfDir), {
    code: "facsimile-path-refused",
  });
  assert.equal((await load(f)).code, "facsimile-path-refused");
});
test("a changed file is re-verified on a later load rather than using a stale admission", async () => {
  const f = await fixture();
  assert.equal((await load(f)).kind, "available");
  await writeFile(f.pdf, Buffer.from("%PDF-1.7\nchanged source\n"));
  assert.equal((await load(f)).code, "facsimile-digest-mismatch");
});
