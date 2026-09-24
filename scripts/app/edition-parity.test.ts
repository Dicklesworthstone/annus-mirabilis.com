/**
 * Parity between the app's bundled edition and the web release: a match passes, a declared
 * exclusion is named by its rule, and every undeclared difference fails with the path and both
 * digests. Offline: a fixture build directory, and a fake fetcher standing in for the live site.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import {
  compareWithDirectory,
  compareWithSite,
  type EditionManifestFiles,
  type Fetcher,
  isVercelToolbarSuffix,
  sitemapRoutes,
  siteUrlPath,
  VERCEL_TOOLBAR_RULE,
  writeParityLog,
} from "./edition-parity.ts";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");

/** A web build: pages, a flight payload, crawler files and a facsimile the edition leaves out. */
const WEB: Record<string, string> = {
  "index.html": "<h1>Annus Mirabilis</h1>",
  "index.txt": "flight payload for /",
  "404.html": "not found",
  "papers/brownian-motion/index.html": "<h1>Brownian motion</h1>",
  "papers/brownian-motion/index.txt": "flight payload",
  "papers/pdfs/ap-17-549.pdf": "%PDF-1.4",
  "_next/static/chunks/app.js": "console.log(1)",
  "robots.txt": "User-agent: *",
  "sitemap.xml":
    "<urlset><url><loc>https://annus-mirabilis.com/</loc></url><url><loc>https://annus-mirabilis.com/papers/brownian-motion/</loc></url></urlset>",
};
const CARRIED = [
  "index.html",
  "404.html",
  "papers/brownian-motion/index.html",
  "_next/static/chunks/app.js",
];

function webDir(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "edition-parity-web-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

const MANIFEST: EditionManifestFiles = {
  files: CARRIED.map((path) => ({ path, sha256: sha(WEB[path] ?? "") })),
};

describe("parity against a build directory", () => {
  it("passes when every carried file matches and every other file is a declared exclusion", () => {
    const result = compareWithDirectory(MANIFEST, webDir(WEB));
    assert.equal(result.passed, true);
    assert.equal(result.counts.same, CARRIED.length);
    const rules = Object.fromEntries(
      result.records.filter((r) => r.outcome === "excluded").map((r) => [r.path, r.rule]),
    );
    assert.deepEqual(rules, {
      "index.txt": "flight-payload",
      "papers/brownian-motion/index.txt": "flight-payload",
      "papers/pdfs/ap-17-549.pdf": "facsimile-pdf",
      "robots.txt": "crawler-file",
      "sitemap.xml": "crawler-file",
    });
  });

  it("fails a changed page, naming it and both digests", () => {
    const changed = {
      ...WEB,
      "papers/brownian-motion/index.html": "<h1>Brownian motion, edited</h1>",
    };
    const result = compareWithDirectory(MANIFEST, webDir(changed));
    assert.equal(result.passed, false);
    const record = result.records.find((r) => r.outcome === "differs");
    assert.deepEqual(record && [record.path, record.editionSha256, record.webSha256], [
      "papers/brownian-motion/index.html",
      sha("<h1>Brownian motion</h1>"),
      sha("<h1>Brownian motion, edited</h1>"),
    ]);
  });

  it("fails a payload the edition carries that the web build lacks", () => {
    const { "_next/static/chunks/app.js": _gone, ...rest } = WEB;
    const result = compareWithDirectory(MANIFEST, webDir(rest));
    assert.equal(result.passed, false);
    assert.deepEqual(
      result.records.filter((r) => r.outcome === "missing-from-web").map((r) => r.path),
      ["_next/static/chunks/app.js"],
    );
  });

  it("fails a web file the edition lacks when no rule declares it", () => {
    const result = compareWithDirectory(
      MANIFEST,
      webDir({ ...WEB, "papers/extra/index.html": "x" }),
    );
    assert.equal(result.passed, false);
    assert.deepEqual(
      result.records
        .filter((r) => r.outcome === "missing-from-edition")
        .map((r) => [r.path, r.rule]),
      [["papers/extra/index.html", null]],
    );
  });

  it("does not pass a comparison of nothing", () => {
    const result = compareWithDirectory({ files: [] }, webDir({}));
    assert.equal(result.records.length, 0);
    assert.equal(result.passed, false);
  });
});

/** The live site, played by a map of URL path to status and body. */
function fakeSite(
  files: Record<string, string>,
  overrides: Record<string, { status: number; body?: string }> = {},
): Fetcher {
  return async (url) => {
    const path = new URL(url).pathname;
    const override = overrides[path];
    if (override !== undefined)
      return { status: override.status, body: new TextEncoder().encode(override.body ?? "") };
    const file = path.endsWith("/") ? `${path.slice(1)}index.html` : path.slice(1);
    if (path === "/404.html")
      return { status: 404, body: new TextEncoder().encode(files["404.html"] ?? "") };
    const body = files[file];
    return body === undefined
      ? { status: 404, body: new TextEncoder().encode("not found") }
      : { status: 200, body: new TextEncoder().encode(body) };
  };
}

const ORIGIN = "https://annus-mirabilis.com";

describe("parity against the live site", () => {
  it("maps edition files to the addresses that serve them", () => {
    assert.equal(siteUrlPath("index.html"), "/");
    assert.equal(siteUrlPath("papers/brownian-motion/index.html"), "/papers/brownian-motion/");
    assert.equal(siteUrlPath("_next/static/chunks/app.js"), "/_next/static/chunks/app.js");
    assert.deepEqual(sitemapRoutes(WEB["sitemap.xml"] ?? "", ORIGIN), [
      "/",
      "/papers/brownian-motion/",
    ]);
    assert.deepEqual(sitemapRoutes("<loc>https://example.com/x/</loc>", ORIGIN), []);
  });

  it("passes when every carried file is served identically and every sitemap route is carried", async () => {
    const result = await compareWithSite(MANIFEST, ORIGIN, fakeSite(WEB));
    assert.equal(
      result.passed,
      true,
      JSON.stringify(result.records.filter((r) => r.outcome !== "same")),
    );
    assert.equal(result.counts.same, CARRIED.length);
  });

  it("fails a route the sitemap lists that the edition does not carry", async () => {
    const sitemap = `${WEB["sitemap.xml"]?.replace("</urlset>", "")}<url><loc>${ORIGIN}/discover/</loc></url></urlset>`;
    const result = await compareWithSite(
      MANIFEST,
      ORIGIN,
      fakeSite({ ...WEB, "sitemap.xml": sitemap }),
    );
    assert.equal(result.passed, false);
    assert.deepEqual(
      result.records.filter((r) => r.outcome === "missing-from-edition").map((r) => r.path),
      ["discover/index.html"],
    );
  });

  it("fails a file served with other bytes, and one the site no longer serves", async () => {
    const result = await compareWithSite(
      MANIFEST,
      ORIGIN,
      fakeSite(WEB, {
        "/papers/brownian-motion/": { status: 200, body: "<h1>newer release</h1>" },
        "/_next/static/chunks/app.js": { status: 404 },
      }),
    );
    assert.equal(result.passed, false);
    assert.deepEqual(
      result.records.filter((r) => r.outcome !== "same").map((r) => [r.path, r.outcome]),
      [
        ["_next/static/chunks/app.js", "missing-from-web"],
        ["papers/brownian-motion/index.html", "differs"],
      ],
    );
  });
});

describe("the platform's one declared difference", () => {
  const RUNTIME = "_next/static/chunks/webpack-1.js";
  const body = "self.webpackChunk=[];";
  const loader =
    '\n(function(){if(!/(?:^|\\s)__vercel_toolbar=1/.test(document.cookie))return;var s=document.createElement("script");s.src="https://vercel.live/_next-live/feedback/feedback.js";document.head.appendChild(s)})();';
  const manifest: EditionManifestFiles = {
    files: [{ path: RUNTIME, sha256: sha(body), size: new TextEncoder().encode(body).length }],
  };
  const serving = (served: string): Fetcher =>
    fakeSite({ [RUNTIME]: served, "sitemap.xml": "<urlset/>" });

  it("accepts the edition's exact bytes followed by Vercel's Toolbar loader, and names the rule", async () => {
    const result = await compareWithSite(manifest, ORIGIN, serving(body + loader));
    assert.deepEqual(
      result.records.map((r) => [r.path, r.outcome, r.rule]),
      [[RUNTIME, "excluded", VERCEL_TOOLBAR_RULE]],
    );
    assert.equal(isVercelToolbarSuffix(loader), true);
  });

  it("still fails other bytes before the loader, or anything else appended", async () => {
    const edited = await compareWithSite(
      manifest,
      ORIGIN,
      serving(`self.webpackChunk=[1];${loader}`),
    );
    assert.equal(edited.records[0]?.outcome, "differs");
    const other = await compareWithSite(
      manifest,
      ORIGIN,
      serving(`${body}\nfetch("https://example.com/beacon");`),
    );
    assert.equal(other.records[0]?.outcome, "differs");
  });
});

describe("the parity log", () => {
  it("writes one line per record and a summary line", async () => {
    // A fresh folder in the system's temporary directory, which the system clears; nothing here
    // deletes files.
    const repo = mkdtempSync(join(tmpdir(), "edition-parity-repo-"));
    const result = await compareWithSite(MANIFEST, ORIGIN, fakeSite(WEB));
    const file = writeParityLog(repo, result);
    const lines = readFileSync(file, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(lines.length, result.records.length + 1);
    assert.equal(lines.at(-1).outcome, "passed");
    assert.equal(lines[0].suite, "app-edition-parity");
  });
});
