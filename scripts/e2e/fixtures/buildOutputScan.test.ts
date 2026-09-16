import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  formatBuildOutputScanIssue,
  listBuildOutputFiles,
  scanBuildOutputListing,
} from "./buildOutputScan.ts";
import type { FixtureAppEntry } from "./fixtureApps.ts";

const REGISTRY: readonly FixtureAppEntry[] = [
  {
    id: "harness-selftest",
    entry: "src/testing/e2e/fixture-apps/selftest/",
    outDir: "artifacts/e2e-fixtures/harness-selftest/",
    owner: "am-test-e2e-harness-bqmh",
    staticInputs: [{ from: "public/wasm/manifest.json", servedPath: "manifest.json" }],
  },
];

test("a fixture next build listing containing a fixture module id fails naming the file", () => {
  const listing = [".next/static/chunks/app/page.js", ".next/static/chunks/harness-selftest.js"];
  const issues = scanBuildOutputListing(REGISTRY, listing);
  assert.equal(issues.length, 1);
  const [issue] = issues;
  assert.ok(issue);
  assert.equal(issue.entryId, "harness-selftest");
  assert.equal(issue.file, ".next/static/chunks/harness-selftest.js");
  assert.match(formatBuildOutputScanIssue(issue), /harness-selftest/);
});

test("a listing containing a fixture static input's served name fails", () => {
  const listing = [".next/static/chunks/app/page.js", ".next/static/wasm/manifest.json"];
  const issues = scanBuildOutputListing(REGISTRY, listing);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.needle, "manifest.json");
  assert.equal(issues[0]?.file, ".next/static/wasm/manifest.json");
});

test("a clean listing passes", () => {
  const listing = [
    ".next/static/chunks/app/page.js",
    ".next/static/chunks/main-app.js",
    ".next/server/app/page.js",
  ];
  assert.deepEqual(scanBuildOutputListing(REGISTRY, listing), []);
});

test("listBuildOutputFiles walks a real directory into a flat, sorted relative listing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "build-output-scan-"));
  try {
    mkdirSync(join(dir, "static", "chunks"), { recursive: true });
    writeFileSync(join(dir, "static", "chunks", "page.js"), "// page");
    writeFileSync(join(dir, "build-manifest.json"), "{}");
    const files = await listBuildOutputFiles(dir);
    assert.deepEqual(files, ["build-manifest.json", join("static", "chunks", "page.js")]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
