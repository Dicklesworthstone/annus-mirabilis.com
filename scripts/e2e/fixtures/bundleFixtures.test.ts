import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { bundleFixtureApp, fixtureBundlePath } from "./bundleFixtures.ts";
import type { FixtureAppEntry } from "./fixtureApps.ts";

const ROOT = process.cwd();

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const PROBE_ENTRY: FixtureAppEntry = {
  id: "bundler-probe",
  entry: "src/testing/e2e/fixture-apps/bundler-probe/",
  outDir: "artifacts/e2e-fixtures/bundler-probe-test/",
  owner: "am-test-e2e-harness-bqmh",
};

test("a committed two-module fixture application bundles to the same file names and bytes on two runs", async () => {
  await rm(resolve(ROOT, PROBE_ENTRY.outDir), { recursive: true, force: true });
  const first = await bundleFixtureApp(PROBE_ENTRY, ROOT);
  const firstBundle = await readFile(fixtureBundlePath(PROBE_ENTRY, ROOT));
  const firstMap = await readFile(join(first.outDir, "bundle.js.map"));

  const second = await bundleFixtureApp(PROBE_ENTRY, ROOT);
  const secondBundle = await readFile(fixtureBundlePath(PROBE_ENTRY, ROOT));
  const secondMap = await readFile(join(second.outDir, "bundle.js.map"));

  assert.deepEqual(first.bundleFiles, ["bundle.js", "bundle.js.map"]);
  assert.deepEqual(second.bundleFiles, ["bundle.js", "bundle.js.map"]);
  assert.equal(sha256(firstBundle), sha256(secondBundle));
  assert.equal(sha256(firstMap), sha256(secondMap));
  assert.match(firstBundle.toString("utf8"), /hello, \$\{name\}|hello, /);
});

test("an entry declaring staticInputs has each file copied with a digest equal to the source's", async () => {
  const entry: FixtureAppEntry = {
    ...PROBE_ENTRY,
    outDir: "artifacts/e2e-fixtures/bundler-probe-static-inputs-test/",
    staticInputs: [
      {
        from: "src/testing/e2e/fixture-apps/bundler-probe/manifest.json",
        servedPath: "manifest.json",
      },
    ],
  };
  await rm(resolve(ROOT, entry.outDir), { recursive: true, force: true });
  const result = await bundleFixtureApp(entry, ROOT);
  assert.deepEqual(result.staticInputsCopied, ["manifest.json"]);

  const source = await readFile(
    resolve(ROOT, "src/testing/e2e/fixture-apps/bundler-probe/manifest.json"),
  );
  const copied = await readFile(join(result.outDir, "manifest.json"));
  assert.equal(sha256(copied), sha256(source));
});

test("a missing source file fails naming the entry and the path", async () => {
  const entry: FixtureAppEntry = {
    ...PROBE_ENTRY,
    outDir: "artifacts/e2e-fixtures/bundler-probe-missing-static-input-test/",
    staticInputs: [
      {
        from: "src/testing/e2e/fixture-apps/bundler-probe/does-not-exist.json",
        servedPath: "does-not-exist.json",
      },
    ],
  };
  await rm(resolve(ROOT, entry.outDir), { recursive: true, force: true });
  await assert.rejects(
    () => bundleFixtureApp(entry, ROOT),
    /fixture application "bundler-probe" declares staticInputs\.from "src\/testing\/e2e\/fixture-apps\/bundler-probe\/does-not-exist\.json", which does not exist/,
  );
});
