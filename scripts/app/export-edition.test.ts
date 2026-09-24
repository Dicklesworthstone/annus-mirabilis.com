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
import { readerDataManifest } from "../../src/platform/app-bridge/readerData.ts";
import {
  SETTINGS_SNAPSHOT_PLACEHOLDER,
  SETTINGS_SNAPSHOT_TEMPLATE,
  SITE_TYPE_SIZES,
} from "../../src/platform/app-bridge/settingsSnapshot.ts";
import { TEST_CONSOLE_USER_SCRIPT_SOURCE } from "../../src/platform/app-bridge/testConsole.ts";
import { BRIDGE_USER_SCRIPT_SOURCE } from "../../src/platform/app-bridge/userScripts.ts";
import {
  AppExportError,
  BRIDGE_SCRIPT_FILE,
  contentTypeFor,
  EXCLUSION_RULES,
  editionDigest,
  editionDirectories,
  exportEdition,
  largestFiles,
  OCTET_STREAM,
  planEdition,
  referencedDigests,
  SETTINGS_SNAPSHOT_FILE,
  siteBinding,
  TEST_CONSOLE_FILE,
  unsafePathReason,
} from "./export-edition.ts";
import {
  NATIVE_CATALOG_FILE,
  NATIVE_CATALOG_SCHEMA,
  type NativeCatalog,
} from "./native-catalog.ts";

const LIVE = "a".repeat(64);
const STALE = "b".repeat(64);
const CHAINED = "c".repeat(64);

/** A catalogue whose pages the fixture site carries; the real one is built from content/. */
const CATALOG: NativeCatalog = {
  schemaVersion: NATIVE_CATALOG_SCHEMA,
  papers: [
    {
      slug: "light-quanta",
      name: "Light quanta",
      title: "Light quanta",
      germanTitle:
        "Über einen die Erzeugung und Verwandlung des Lichtes betreffenden heuristischen Gesichtspunkt",
      description: "A fixture.",
      route: "/papers/",
      sections: [{ id: "s1", title: "§1", route: "/papers/", anchor: "s1" }],
    },
  ],
  discover: [],
  labs: [],
};

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
  "share/brownian-motion.png": "png bytes",
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
    assert.deepEqual(excludedBy("share-card-image"), [
      "opengraph-image",
      "share/brownian-motion.png",
    ]);
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
    const result = exportEdition({ repo: dirname(out), outDir: out, dest, catalog: CATALOG });
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
    const directories = editionDirectories(manifest.files);
    assert.ok(directories.includes("papers") && directories.includes(`edition/${LIVE}`));
    assert.ok(
      directories.indexOf("edition") < directories.indexOf(`edition/${LIVE}`),
      "parents come first",
    );
    // The manifest, the three user scripts, the catalogue, and Edition/ itself, then its
    // directories and files.
    assert.equal(outputs.length, 6 + directories.length + result.fileCount);
    const [script, snapshot, testConsole] = manifest.userScripts;
    const written = readFileSync(join(dest, BRIDGE_SCRIPT_FILE), "utf8");
    assert.equal(written, BRIDGE_USER_SCRIPT_SOURCE);
    assert.equal(script.file, BRIDGE_SCRIPT_FILE);
    assert.equal(script.sha256, createHash("sha256").update(written).digest("hex"));
    assert.ok(
      outputs.some((line) => line.endsWith(`/${BRIDGE_SCRIPT_FILE}`)),
      "the script is a declared output",
    );
    assert.equal(readFileSync(join(dest, "edition-source.txt"), "utf8"), `${out}\n`);
    const inputs = readFileSync(join(dest, "edition-inputs.xcfilelist"), "utf8").trim().split("\n");
    assert.ok(inputs.includes(`${out}/index.html`), "inputs name out/ by its absolute path");
    assert.ok(
      outputs.some((line) => line.endsWith("/Edition/papers")),
      "a directory is declared",
    );
    assert.equal(manifest.site.commit, null);
    assert.equal(manifest.site.binding, "unbound");
    assert.equal(manifest.editionDigest, result.editionDigest);
    // The settings snapshot: pinned like the bridge, with the one span the app fills in.
    const template = readFileSync(join(dest, SETTINGS_SNAPSHOT_FILE), "utf8");
    assert.equal(template, SETTINGS_SNAPSHOT_TEMPLATE);
    assert.equal(snapshot.id, "settings-snapshot");
    assert.equal(snapshot.sha256, createHash("sha256").update(template).digest("hex"));
    assert.equal(snapshot.placeholder, SETTINGS_SNAPSHOT_PLACEHOLDER);
    assert.equal(
      template.split(SETTINGS_SNAPSHOT_PLACEHOLDER).length,
      2,
      "exactly one placeholder",
    );
    assert.ok(outputs.some((line) => line.endsWith(`/${SETTINGS_SNAPSHOT_FILE}`)));
    // The test console: pinned like the bridge, and marked as a DEBUG build's alone.
    const consoleText = readFileSync(join(dest, TEST_CONSOLE_FILE), "utf8");
    assert.equal(consoleText, TEST_CONSOLE_USER_SCRIPT_SOURCE);
    assert.deepEqual(
      [testConsole.id, testConsole.file, testConsole.debugOnly],
      ["test-console", TEST_CONSOLE_FILE, true],
    );
    assert.equal(testConsole.sha256, createHash("sha256").update(consoleText).digest("hex"));
    assert.ok(outputs.some((line) => line.endsWith(`/${TEST_CONSOLE_FILE}`)));
    assert.ok(inputs.some((line) => line.endsWith(`/${TEST_CONSOLE_FILE}`)));
    assert.deepEqual(manifest.settings, { typeSizes: [...SITE_TYPE_SIZES] });
    // The native screens' data, pinned like the scripts.
    const catalogText = readFileSync(join(dest, NATIVE_CATALOG_FILE), "utf8");
    assert.deepEqual(JSON.parse(catalogText), CATALOG);
    assert.equal(
      manifest.nativeCatalog.sha256,
      createHash("sha256").update(catalogText).digest("hex"),
    );
    assert.ok(outputs.some((line) => line.endsWith(`/${NATIVE_CATALOG_FILE}`)));
    // The app labels and exports the reader's data from this, never from its own copy.
    assert.deepEqual(manifest.readerData, JSON.parse(JSON.stringify(readerDataManifest())));
  });

  it("refuses an edition over its budget and names the size", () => {
    const out = fixture(SITE);
    const dest = mkdtempSync(join(tmpdir(), "app-edition-dest-"));
    assert.throws(
      () =>
        exportEdition({ repo: dirname(out), outDir: out, dest, catalog: CATALOG, budgetBytes: 10 }),
      (error: unknown) =>
        error instanceof AppExportError &&
        error.code === "edition-over-budget" &&
        /over the 10-byte budget/.test(error.message) &&
        /Largest files: index\.html \(\d+ bytes\), /.test(error.message),
    );
  });

  it("orders the largest files biggest first, breaking ties by path", () => {
    const files = [
      { path: "b.html", size: 5 },
      { path: "a.html", size: 5 },
      { path: "big.js", size: 9 },
      { path: "tiny.css", size: 1 },
    ];
    assert.equal(largestFiles(files, 3), "big.js (9 bytes), a.html (5 bytes), b.html (5 bytes)");
  });

  it("refuses a catalogue that would open a page the edition does not carry, naming it", () => {
    const out = fixture(SITE);
    const dest = mkdtempSync(join(tmpdir(), "app-edition-dest-"));
    const lost: NativeCatalog = {
      ...CATALOG,
      labs: [
        {
          paper: "brownian-motion",
          name: "Brownian motion",
          instruments: [{ id: "bm-01", name: "Tracer ensemble", route: "/lab/bm-01/" }],
        },
      ],
    };
    assert.throws(
      () => exportEdition({ repo: dirname(out), outDir: out, dest, catalog: lost }),
      (error: unknown) =>
        error instanceof AppExportError &&
        error.code === "catalog-route-missing" &&
        error.message.includes("/lab/bm-01/") &&
        !error.message.includes("/papers/,"),
    );
  });

  it("refuses when there is no web build to export", () => {
    const out = fixture({ "papers/index.html": "no root page" });
    const dest = mkdtempSync(join(tmpdir(), "app-edition-dest-"));
    assert.throws(
      () => exportEdition({ repo: dirname(out), outDir: out, dest, catalog: CATALOG }),
      (error: unknown) => error instanceof AppExportError && error.code === "no-web-build",
    );
  });

  it("refuses a path the bundling phase would misread, before hashing anything", () => {
    const out = fixture({ "index.html": "root", "a/$(HOME)/b.html": "x" });
    const dest = mkdtempSync(join(tmpdir(), "app-edition-dest-"));
    assert.throws(
      () => exportEdition({ repo: dirname(out), outDir: out, dest, catalog: CATALOG }),
      (error: unknown) => error instanceof AppExportError && error.code === "unsafe-edition-path",
    );
  });
});

describe("siteBinding", () => {
  const built = new Date("2026-09-24T01:40:28Z");
  const committed = "2026-09-23T21:31:52-04:00";

  it("names the commit for a clean worktree built after its HEAD", () => {
    const binding = siteBinding({
      head: "b9af6ebe",
      clean: true,
      headCommittedAt: committed,
      outBuiltAt: built,
    });
    assert.equal(binding.commit, "b9af6ebe");
    assert.equal(binding.binding, "clean-worktree-head");
  });

  it("stays unbound for a dirty tree, a build older than HEAD, or no git at all, and says which", () => {
    const dirty = siteBinding({
      head: "b9af6ebe",
      clean: false,
      headCommittedAt: committed,
      outBuiltAt: built,
    });
    assert.match(dirty.reason, /uncommitted/);
    const early = new Date("2026-09-23T20:00:00Z");
    const stale = siteBinding({
      head: "b9af6ebe",
      clean: true,
      headCommittedAt: committed,
      outBuiltAt: early,
    });
    assert.match(stale.reason, /older than/);
    const none = siteBinding({ head: null, clean: null, headCommittedAt: null, outBuiltAt: built });
    assert.match(none.reason, /not inside a git worktree/);
    for (const clean of [false, null]) {
      assert.equal(
        siteBinding({ head: "x", clean, headCommittedAt: committed, outBuiltAt: built }).commit,
        null,
      );
    }
  });
});
