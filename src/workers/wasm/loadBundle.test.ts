import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import type { WasmArtifactManifest } from "../protocol/provenance.ts";
import { expectationFromManifest, loadBundle, type WasmBindgenGlue } from "./loadBundle.ts";
import { PINNED_ARTIFACT } from "./pinnedArtifact.ts";

const manifest = JSON.parse(
  readFileSync(resolve("public/wasm/manifest.json"), "utf8"),
) as WasmArtifactManifest;
const dir = resolve("public/wasm", manifest.bundleId, manifest.hashPrefix);
const wasmPath = resolve(dir, PINNED_ARTIFACT.wasmFile);
const wasmBytes = readFileSync(wasmPath);
const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const expectation = expectationFromManifest(manifest);
if (!expectation) throw new Error("The live manifest names no wasm file.");
const readBytes = (p: string) => readFile(p);

/**
 * A separate instance of the glue module each call, since the glue is a singleton. Bun caches a
 * module by path even with a query string, so each instance is a copy at its own path, and all
 * copies exist before the first import (bun does not see files created after it resolves one).
 */
const copies = mkdtempSync(join(process.env.AM_TEST_TMP ?? tmpdir(), "am-glue-"));
const COPIES = 12;
for (let i = 1; i <= COPIES; i++)
  copyFileSync(resolve(dir, PINNED_ARTIFACT.glueFile), join(copies, `glue-${i}.js`));
let fresh = 0;
async function freshGlue(): Promise<WasmBindgenGlue> {
  fresh++;
  if (fresh > COPIES) throw new Error("Out of glue copies.");
  return (await import(pathToFileURL(join(copies, `glue-${fresh}.js`)).href)) as WasmBindgenGlue;
}

/** A valid module that imports env.missing, which the glue does not provide. */
function unlinkableModule(): Uint8Array {
  // magic, version 1; type section: () -> (); import section: env.missing, func type 0
  const hex = "0061736d01000000" + "010401600000" + "020f0103656e76076d697373696e670000";
  return Uint8Array.from(hex.match(/../g) ?? [], (h) => Number.parseInt(h, 16));
}

describe("loadBundle: verify, then initialize, or refuse with a typed outcome", () => {
  it("loads the pinned artifact: one compile, of exactly the verified bytes, and the pinned identity", async () => {
    const compiled: string[] = [];
    const result = await loadBundle({
      manifestData: manifest,
      wasmUrl: wasmPath,
      readBytes,
      glue: await freshGlue(),
      compileFn: async (bytes) => {
        compiled.push(sha256(new Uint8Array(bytes as ArrayBuffer)));
        return WebAssembly.compile(bytes);
      },
    });
    assert.equal(result.kind, "loaded", JSON.stringify(result));
    if (result.kind !== "loaded") return;
    assert.deepEqual(compiled, [manifest.wasmDigest]);
    assert.equal(result.digest, manifest.wasmDigest);
    assert.equal(result.bytes, wasmBytes.byteLength);
    assert.equal(result.identity, PINNED_ARTIFACT.buildIdentity);
    assert.equal(result.exports.build_identity(), PINNED_ARTIFACT.buildIdentity);
  });

  it("an application/wasm response is still compiled from the hashed bytes, never from a second read", async () => {
    let reads = 0;
    const compiled: string[] = [];
    const result = await loadBundle({
      artifact: expectation,
      wasmUrl: "http://localhost:3000/w.wasm",
      fetchFn: async () => {
        reads++;
        return new Response(wasmBytes, { headers: { "Content-Type": "application/wasm" } });
      },
      glue: await freshGlue(),
      compileFn: async (bytes) => {
        compiled.push(sha256(new Uint8Array(bytes as ArrayBuffer)));
        return WebAssembly.compile(bytes);
      },
    });
    assert.equal(result.kind, "loaded");
    assert.equal(reads, 1);
    assert.deepEqual(compiled, [manifest.wasmDigest]);
  });

  it("refuses one tampered byte with artifact-mismatch, before any compile", async () => {
    let compiles = 0;
    const tampered = new Uint8Array(wasmBytes);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
    const result = await loadBundle({
      artifact: expectation,
      wasmUrl: "http://localhost:3000/tampered.wasm",
      fetchFn: async () => new Response(tampered),
      glue: await freshGlue(),
      compileFn: async (b) => {
        compiles++;
        return WebAssembly.compile(b);
      },
    });
    assert.equal(result.kind, "refused");
    if (result.kind !== "refused") return;
    assert.equal(result.outcome, "artifact-mismatch");
    assert.equal(result.executionOutcome.outcome, "artifact-mismatch");
    assert.equal(result.executionOutcome.retry, "reload");
    assert.equal(result.expectedDigest, manifest.wasmDigest);
    assert.notEqual(result.digest, manifest.wasmDigest);
    assert.equal(compiles, 0);
  });

  it("refuses a missing file with missing-artifact, before any compile", async () => {
    let compiles = 0;
    const result = await loadBundle({
      artifact: expectation,
      wasmUrl: "http://localhost:3000/nonexistent.wasm",
      fetchFn: async () => new Response("404", { status: 404 }),
      glue: await freshGlue(),
      compileFn: async (b) => {
        compiles++;
        return WebAssembly.compile(b);
      },
    });
    assert.equal(result.kind, "refused");
    if (result.kind === "refused")
      assert.equal(result.executionOutcome.outcome, "missing-artifact");
    assert.equal(compiles, 0);
  });

  it("a module whose digest is expected but which does not link is artifact-mismatch, not raw exports", async () => {
    const bytes = unlinkableModule();
    assert.equal(WebAssembly.validate(bytes), true);
    const result = await loadBundle({
      artifact: { bundleId: "x", wasmUrl: "http://h/x.wasm", wasmDigest: sha256(bytes) },
      fetchFn: async () => new Response(bytes),
      glue: await freshGlue(),
    });
    assert.equal(result.kind, "refused");
    if (result.kind !== "refused") return;
    assert.equal(result.executionOutcome.outcome, "artifact-mismatch");
    assert.match(result.message, /did not compile or link/);
  });

  it("a module that reports another identity is artifact-mismatch", async () => {
    const result = await loadBundle({
      artifact: { ...expectation, buildIdentity: '{"transport":"someone-else"}' },
      wasmUrl: wasmPath,
      readBytes,
      glue: await freshGlue(),
    });
    assert.equal(result.kind, "refused");
    if (result.kind === "refused") {
      assert.equal(result.executionOutcome.outcome, "artifact-mismatch");
      assert.match(result.message, /reports/);
    }
  });

  it("a glue already initialized with the pinned module refuses a different module", async () => {
    const glue = await freshGlue();
    const first = await loadBundle({ manifestData: manifest, wasmUrl: wasmPath, readBytes, glue });
    assert.equal(first.kind, "loaded");
    const other = unlinkableModule();
    const second = await loadBundle({
      artifact: { bundleId: "x", wasmUrl: "http://h/x.wasm", wasmDigest: sha256(other) },
      fetchFn: async () => new Response(other),
      glue,
    });
    assert.equal(second.kind, "refused");
    if (second.kind === "refused") assert.match(second.message, /already initialized/);
  });

  it("without glue there is nothing to initialize: missing-artifact", async () => {
    const result = await loadBundle({ manifestData: manifest, wasmUrl: wasmPath, readBytes });
    assert.equal(result.kind, "refused");
    if (result.kind === "refused") assert.equal(result.outcome, "missing-artifact");
  });
});
