/**
 * The app edition export (App plan §5): what ships, what is excluded and why,
 * and the files the Xcode bundling phase consumes. Fixtures are real files in a
 * temporary directory, exported by the real function.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import {
  AppExportError,
  contentTypeFor,
  EXCLUSION_RULES,
  editionDigest,
  exportEdition,
  OCTET_STREAM,
  planEdition,
  referencedDigests,
  unsafePathReason,
} from "./export-edition.ts";

const LIVE = "a".repeat(64);
const STALE = "b".repeat(64);
const CHAINED = "c".repeat(64);

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "app-edition-out-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const SITE: Record<string, string> = {
  "index.html": `<a href="/papers/">Papers</a><link href="/edition/${LIVE}/record.json">`,
  "index.txt": "flight payload for /",
  "404.html": "not found",
  "papers/index.html": "papers",
  "papers/index.txt": "flight payload for /papers/",
  "papers/pdfs/ap-17-132.pdf": "%PDF-1.4",
  "papers/transcripts/ap-17-132-machine-draft.txt": "a machine draft, not a flight payload",
  [`edition/${LIVE}/record.json`]: `{"next":"edition/${CHAINED}/more.md"}`,
  [`edition/${CHAINED}/more.md`]: "chained",
  [`edition/${STALE}/record.json`]: `{"orphan":"edition/${"d".repeat(64)}/x.md"}`,
  "edition/kitchen/worksheet.txt": "not a digest directory",
  "robots.txt": "User-agent: *",
  "sitemap.xml": "<urlset/>",
  "opengraph-image": "png bytes",
  "offline/chapter-1.html": "an offline chapter",
  "wasm/kernel.wasm": "\u0000asm",
  "fonts/newsreader/OFL.txt": "licence",
};

describe("contentTypeFor", () => {
  it("names the type from a fixed table, case-insensitively", () => {
    assert.equal(contentTypeFor("a/b/index.html"), "text/html; charset=utf-8");
    assert.equal(contentTypeFor("x/kernel.WASM"), "application/wasm");
    assert.equal(contentTypeFor("fonts/a.woff2"), "font/woff2");
    assert.equal(contentTypeFor("chunks/app.mjs"), "text/javascript; charset=utf-8");
  });

  it("falls back to octet-stream for an unknown or missing extension, never a guess", () => {
    assert.equal(contentTypeFor("pdfjs/wasm/LICENSE_QCMS"), OCTET_STREAM);
    assert.equal(contentTypeFor("fragments/_none"), OCTET_STREAM);
    assert.equal(contentTypeFor("dir/.hidden"), OCTET_STREAM);
    assert.equal(contentTypeFor("data.unknownext"), OCTET_STREAM);
  });
});

describe("referencedDigests", () => {
  const paths = Object.keys(SITE);
  const digests = referencedDigests(paths, (path) => SITE[path] ?? "");

  it("keeps a digest a page names and one named from inside a kept digest", () => {
    assert.ok(digests.has(LIVE));
    assert.ok(digests.has(CHAINED));
  });

  it("does not keep a digest named only from inside an unreferenced digest", () => {
    assert.ok(!digests.has(STALE));
    assert.ok(!digests.has("d".repeat(64)));
  });
});

describe("planEdition", () => {
  const paths = Object.keys(SITE);
  const plan = planEdition(
    paths,
    referencedDigests(paths, (path) => SITE[path] ?? ""),
  );
  const excludedBy = (rule: string) => plan.excluded.get(rule) ?? [];

  it("drops the pinned facsimile PDFs", () => {
    assert.deepEqual(excludedBy("facsimile-pdf"), ["papers/pdfs/ap-17-132.pdf"]);
  });

  it("drops a flight payload only where its page exists, and keeps other text files", () => {
    assert.deepEqual(excludedBy("flight-payload"), ["index.txt", "papers/index.txt"]);
    assert.ok(plan.included.includes("papers/transcripts/ap-17-132-machine-draft.txt"));
    assert.ok(plan.included.includes("edition/kitchen/worksheet.txt"));
    assert.ok(plan.included.includes("fonts/newsreader/OFL.txt"));
  });

  it("drops unreferenced edition digests and keeps the live and chained ones", () => {
    assert.deepEqual(excludedBy("unreferenced-edition-digest"), [`edition/${STALE}/record.json`]);
    assert.ok(plan.included.includes(`edition/${LIVE}/record.json`));
    assert.ok(plan.included.includes(`edition/${CHAINED}/more.md`));
  });

  it("drops crawler files and share cards", () => {
    assert.deepEqual(excludedBy("crawler-file"), ["robots.txt", "sitemap.xml"]);
    assert.deepEqual(excludedBy("share-card-image"), ["opengraph-image"]);
  });

  it("ships everything no rule names, including offline chapters, 404 and WASM", () => {
    for (const path of [
      "index.html",
      "404.html",
      "papers/index.html",
      "offline/chapter-1.html",
      "wasm/kernel.wasm",
    ]) {
      assert.ok(plan.included.includes(path), path);
    }
  });

  it("puts every path in exactly one bucket", () => {
    const excluded = [...plan.excluded.values()].flat();
    assert.equal(plan.included.length + excluded.length, paths.length);
    assert.equal(new Set([...plan.included, ...excluded]).size, paths.length);
  });

  it("gives every rule a reason a reader of the manifest can act on", () => {
    for (const rule of EXCLUSION_RULES) {
      assert.ok(rule.reason.length > 40, rule.id);
    }
  });
});

describe("unsafePathReason", () => {
  it("refuses a path Xcode would expand as a build setting", () => {
    assert.match(unsafePathReason("a/$(HOME)/b.html") ?? "", /build setting/);
    assert.equal(unsafePathReason("papers/brownian-motion/index.html"), null);
  });
});

describe("editionDigest", () => {
  const a = { path: "a.html", sha256: "1".repeat(64), size: 1, contentType: "text/html" };
  const b = { path: "b.html", sha256: "2".repeat(64), size: 2, contentType: "text/html" };

  it("does not depend on listing order", () => {
    assert.equal(editionDigest([a, b]), editionDigest([b, a]));
  });

  it("changes when one file's bytes change", () => {
    assert.notEqual(editionDigest([a, b]), editionDigest([a, { ...b, sha256: "3".repeat(64) }]));
  });
});

describe("exportEdition", () => {
  it("writes a manifest, checksums and file lists that agree with the bytes on disk", () => {
    const out = fixture(SITE);
    const dest = mkdtempSync(join(tmpdir(), "app-edition-dest-"));
    const result = exportEdition({ repo: dirname(out), outDir: out, dest });
    const manifest = JSON.parse(readFileSync(join(dest, "edition-manifest.json"), "utf8"));

    assert.equal(manifest.files.length, result.fileCount);
    assert.ok(result.fileCount > 0);
    for (const file of manifest.files) {
      const bytes = readFileSync(join(out, file.path));
      assert.equal(file.sha256, createHash("sha256").update(bytes).digest("hex"), file.path);
      assert.equal(file.size, bytes.byteLength, file.path);
    }
    const sums = readFileSync(join(dest, "edition.sha256"), "utf8").trim().split("\n");
    assert.equal(sums.length, result.fileCount);
    assert.equal(sums[0], `${manifest.files[0].sha256}  ${manifest.files[0].path}`);
    const listed = readFileSync(join(dest, "edition-files.txt"), "utf8").trim().split("\n");
    assert.deepEqual(
      listed,
      manifest.files.map((file: { path: string }) => file.path),
    );
    const outputs = readFileSync(join(dest, "edition-outputs.xcfilelist"), "utf8")
      .trim()
      .split("\n");
    assert.equal(outputs.length, result.fileCount + 1);
    assert.equal(manifest.site.commit, null);
    assert.equal(manifest.site.binding, "unbound");
    assert.equal(manifest.editionDigest, result.editionDigest);
  });

  it("refuses an edition over its budget and names the size", () => {
    const out = fixture(SITE);
    const dest = mkdtempSync(join(tmpdir(), "app-edition-dest-"));
    assert.throws(
      () => exportEdition({ repo: dirname(out), outDir: out, dest, budgetBytes: 10 }),
      (error: unknown) =>
        error instanceof AppExportError &&
        error.code === "edition-over-budget" &&
        /over the 10-byte budget/.test(error.message),
    );
  });

  it("refuses when there is no web build to export", () => {
    const out = fixture({ "papers/index.html": "no root page" });
    const dest = mkdtempSync(join(tmpdir(), "app-edition-dest-"));
    assert.throws(
      () => exportEdition({ repo: dirname(out), outDir: out, dest }),
      (error: unknown) => error instanceof AppExportError && error.code === "no-web-build",
    );
  });

  it("refuses a path the bundling phase would misread, before hashing anything", () => {
    const out = fixture({ "index.html": "root", "a/$(HOME)/b.html": "x" });
    const dest = mkdtempSync(join(tmpdir(), "app-edition-dest-"));
    assert.throws(
      () => exportEdition({ repo: dirname(out), outDir: out, dest }),
      (error: unknown) => error instanceof AppExportError && error.code === "unsafe-edition-path",
    );
  });
});
