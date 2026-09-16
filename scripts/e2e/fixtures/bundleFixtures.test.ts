import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { bundleFixtureApp, fixtureBundlePath } from "./bundleFixtures.ts";
import type { FixtureAppEntry } from "./fixtureApps.ts";

const ROOT = process.cwd();

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Each test bundles into its own `mkdtemp`-owned directory, never a fixed
 * path under `artifacts/e2e-fixtures/`: a fixed path is a shared,
 * non-unique write target another run of this same test (or a parallel
 * suite run) could collide on, exactly the cross-test-pollution pattern
 * flagged for the whole swarm. Only `entry` (the committed, read-only
 * fixture source under `src/testing/`) is shared; nothing here writes to it.
 */
async function withTempOutDir<T>(run: (outDir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "bundle-fixtures-test-"));
  try {
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const PROBE_ENTRY_BASE = {
  id: "bundler-probe",
  entry: "src/testing/e2e/fixture-apps/bundler-probe/",
  owner: "am-test-e2e-harness-bqmh",
} as const;

test("a committed two-module fixture application bundles to the same file names and bytes on two runs", async () => {
  await withTempOutDir(async (outDir) => {
    const entry: FixtureAppEntry = { ...PROBE_ENTRY_BASE, outDir };

    const first = await bundleFixtureApp(entry, ROOT);
    const firstBundle = await readFile(fixtureBundlePath(entry, ROOT));
    const firstMap = await readFile(join(first.outDir, "bundle.js.map"));

    const second = await bundleFixtureApp(entry, ROOT);
    const secondBundle = await readFile(fixtureBundlePath(entry, ROOT));
    const secondMap = await readFile(join(second.outDir, "bundle.js.map"));

    assert.deepEqual(first.bundleFiles, ["bundle.js", "bundle.js.map"]);
    assert.deepEqual(second.bundleFiles, ["bundle.js", "bundle.js.map"]);
    assert.equal(sha256(firstBundle), sha256(secondBundle));
    assert.equal(sha256(firstMap), sha256(secondMap));
    assert.match(firstBundle.toString("utf8"), /hello, \$\{name\}|hello, /);
  });
});

test("an entry declaring staticInputs has each file copied with a digest equal to the source's", async () => {
  await withTempOutDir(async (outDir) => {
    const entry: FixtureAppEntry = {
      ...PROBE_ENTRY_BASE,
      outDir,
      staticInputs: [
        {
          from: "src/testing/e2e/fixture-apps/bundler-probe/manifest.json",
          servedPath: "manifest.json",
        },
      ],
    };
    const result = await bundleFixtureApp(entry, ROOT);
    assert.deepEqual(result.staticInputsCopied, ["manifest.json"]);

    const source = await readFile(
      resolve(ROOT, "src/testing/e2e/fixture-apps/bundler-probe/manifest.json"),
    );
    const copied = await readFile(join(result.outDir, "manifest.json"));
    assert.equal(sha256(copied), sha256(source));
  });
});

test("a missing source file fails naming the entry and the path", async () => {
  await withTempOutDir(async (outDir) => {
    const entry: FixtureAppEntry = {
      ...PROBE_ENTRY_BASE,
      outDir,
      staticInputs: [
        {
          from: "src/testing/e2e/fixture-apps/bundler-probe/does-not-exist.json",
          servedPath: "does-not-exist.json",
        },
      ],
    };
    await assert.rejects(
      () => bundleFixtureApp(entry, ROOT),
      /fixture application "bundler-probe" declares staticInputs\.from "src\/testing\/e2e\/fixture-apps\/bundler-probe\/does-not-exist\.json", which does not exist/,
    );
  });
});

test("a parent-relative .ts specifier resolves under Bun.build browser target", async () => {
  await withTempOutDir(async (outDir) => {
    const entry: FixtureAppEntry = { ...PROBE_ENTRY_BASE, outDir };
    await bundleFixtureApp(entry, ROOT);
    const bundle = await readFile(fixtureBundlePath(entry, ROOT), "utf8");
    assert.match(bundle, /hello/);
  });
});
