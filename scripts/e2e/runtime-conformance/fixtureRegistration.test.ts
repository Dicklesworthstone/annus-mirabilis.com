import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { bundleFixtureApp, fixtureBundlePath } from "../fixtures/bundleFixtures.ts";
import { FIXTURE_APP_REGISTRY, type FixtureAppEntry } from "../fixtures/fixtureApps.ts";
import { assertRuntimeRegistration, RUNTIME_FIXTURE_OWNER } from "./fixtureRegistration.ts";

const ROOT = process.cwd();

test("the runtime entry exists in the harness registry with this bead as owner", () => {
  const entry = FIXTURE_APP_REGISTRY.find((item) => item.id === "runtime");
  const registered = assertRuntimeRegistration(entry);
  assert.equal(registered.owner, RUNTIME_FIXTURE_OWNER);
});

test("a registration missing staticInputs fails naming the harness registry", () => {
  const incomplete = {
    id: "runtime",
    entry: "src/testing/runtime-fixtures/app/",
    outDir: "artifacts/e2e-fixtures/runtime/",
    owner: RUNTIME_FIXTURE_OWNER,
  } satisfies FixtureAppEntry;
  assert.throws(() => assertRuntimeRegistration(incomplete), /staticInputs[\s\S]*fixtureApps\.ts/);
});

test("bundling the runtime fixture copies pinned WASM bytes and emits a worker-backed bundle", async () => {
  const entry = assertRuntimeRegistration(
    FIXTURE_APP_REGISTRY.find((item) => item.id === "runtime"),
  );
  const dir = await mkdtemp(join(tmpdir(), "runtime-fixture-bundle-"));
  try {
    const bundled = await bundleFixtureApp({ ...entry, outDir: dir }, ROOT);
    const bundle = await readFile(fixtureBundlePath({ outDir: dir }, ROOT), "utf8");
    assert.match(bundle, /runtime-fixture-v1/);
    assert.match(bundle, /new Worker/);
    assert.ok(bundled.staticInputsCopied.length >= 2);
    for (const input of entry.staticInputs ?? []) {
      const source = await readFile(resolve(ROOT, input.from));
      const copied = await readFile(join(dir, input.servedPath));
      assert.equal(
        createHash("sha256").update(copied).digest("hex"),
        createHash("sha256").update(source).digest("hex"),
      );
    }
    assert.ok(!dir.includes(".next"));
    assert.ok(!dir.includes(`${ROOT}/public/`));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
