/**
 * The pinned compiled artifact is the one on disk, the one the manifest names, and the one the
 * glue import points at (am-frankensim-repin-and-bind-jvhg). Runs under bun test and under
 * node --experimental-strip-types --test.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { PINNED_ARTIFACT, PINNED_WASM_URL } from "./pinnedArtifact.ts";
import { pinnedGlue } from "./pinnedGlue.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const manifest = JSON.parse(readFileSync(join(root, "public/wasm/manifest.json"), "utf8"));
const dir = join(root, "public/wasm", PINNED_ARTIFACT.bundleId, PINNED_ARTIFACT.hashPrefix);

describe("the pinned FrankenSim artifact", () => {
  it("is what public/wasm/manifest.json names", () => {
    assert.equal(manifest.bundleId, PINNED_ARTIFACT.bundleId);
    assert.equal(manifest.hashPrefix, PINNED_ARTIFACT.hashPrefix);
    assert.equal(manifest.wasmDigest, PINNED_ARTIFACT.wasmDigest);
    assert.equal(manifest.wasmBytes, PINNED_ARTIFACT.wasmBytes);
    assert.equal(manifest.files[PINNED_ARTIFACT.wasmFile].sha256, PINNED_ARTIFACT.wasmDigest);
    assert.equal(manifest.files[PINNED_ARTIFACT.glueFile].sha256, PINNED_ARTIFACT.glueDigest);
    assert.equal(manifest.revisions.frankensim, PINNED_ARTIFACT.frankensimRevision);
    assert.equal(manifest.build.identity, PINNED_ARTIFACT.buildIdentity);
    assert.equal(manifest.build.generatorType, "rust-wasm-bindgen");
    assert.equal(
      PINNED_WASM_URL,
      `/wasm/${manifest.bundleId}/${manifest.hashPrefix}/${PINNED_ARTIFACT.wasmFile}`,
    );
  });

  it("is content-addressed: every file hashes to its manifest entry, and the directory is the wasm hash", () => {
    const names = Object.keys(manifest.files);
    assert.equal(names.length, 4);
    for (const name of names) {
      const bytes = readFileSync(join(dir, name));
      assert.equal(bytes.byteLength, manifest.files[name].bytes, name);
      assert.equal(sha256(bytes), manifest.files[name].sha256, name);
    }
    assert.equal(PINNED_ARTIFACT.wasmDigest.slice(0, 16), PINNED_ARTIFACT.hashPrefix);
  });

  it("records the toolchain, revision and wasm-bindgen version the crate actually pins", () => {
    const crate = join(root, "scripts/wasm-artifacts/fs-annus-wasm");
    const channel = readFileSync(join(crate, "rust-toolchain.toml"), "utf8").match(
      /^channel = "([^"]+)"/m,
    )?.[1];
    assert.equal(manifest.toolchain, channel);
    const pins = readFileSync(join(crate, "src/pins.rs"), "utf8");
    assert.ok(pins.includes(`FRANKENSIM_REVISION: &str = "${PINNED_ARTIFACT.frankensimRevision}"`));
    const lock = readFileSync(join(crate, "Cargo.lock"), "utf8");
    assert.ok(lock.includes(`name = "wasm-bindgen"\nversion = "${manifest.wasmBindgenVersion}"`));
  });

  it("the glue import points at the pinned directory, and the module there reports the pinned identity", () => {
    const source = readFileSync(join(root, "src/workers/wasm/pinnedGlue.ts"), "utf8");
    const imported = source.match(/from "([^"]+)"/)?.[1];
    assert.equal(
      imported,
      `../../../public/wasm/${PINNED_ARTIFACT.bundleId}/${PINNED_ARTIFACT.hashPrefix}/${PINNED_ARTIFACT.glueFile}`,
    );
    const bytes = readFileSync(join(dir, PINNED_ARTIFACT.wasmFile));
    pinnedGlue.initSync({ module: bytes });
    assert.equal(pinnedGlue.build_identity(), PINNED_ARTIFACT.buildIdentity);
  });

  it("leaves the placeholder where it was (retiring it is a separate decision)", () => {
    assert.ok(
      existsSync(
        join(root, "public/wasm/fs-annus-diffusion/105d7ffc15414de5/fs_annus_diffusion_bg.wasm"),
      ),
    );
  });
});
