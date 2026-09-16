import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import type { WasmArtifactManifest } from "../protocol/provenance.ts";
import { loadBundle } from "./loadBundle.ts";

describe("loadBundle Digest Verification and Compile Paths", () => {
  const manifestPath = resolve("public/wasm/manifest.json");
  const manifestText = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(manifestText) as WasmArtifactManifest;
  const wasmPath = resolve(
    "public/wasm",
    manifest.bundleId,
    manifest.hashPrefix,
    "fs_annus_diffusion_bg.wasm",
  );
  const wasmBytes = readFileSync(wasmPath);

  it("loads valid artifact, records byte compile path, and verifies digest", async () => {
    let compileCalls = 0;
    let instantiateCalls = 0;

    const result = await loadBundle({
      manifestData: manifest,
      wasmUrl: wasmPath,
      compileFn: async (bytes) => {
        compileCalls++;
        return WebAssembly.compile(bytes);
      },
      instantiateFn: async (mod, imports) => {
        instantiateCalls++;
        return WebAssembly.instantiate(mod, imports);
      },
    });

    assert.equal(result.kind, "loaded");
    if (result.kind === "loaded") {
      assert.equal(result.compilePath, "bytes");
      assert.equal(result.digest, manifest.wasmDigest);
      assert.equal(result.bytes, wasmBytes.byteLength);
      assert.equal(compileCalls, 1);
      assert.equal(instantiateCalls, 1);
    }
  });

  it("streaming compile path recorded when server serves application/wasm", async () => {
    let streamingCompileCalls = 0;

    const fakeResponse = new Response(wasmBytes, {
      status: 200,
      headers: { "Content-Type": "application/wasm" },
    });

    const result = await loadBundle({
      manifestData: manifest,
      wasmUrl: "http://localhost:3000/wasm/fs-annus-diffusion/fs_annus_diffusion_bg.wasm",
      fetchFn: async () => fakeResponse,
      compileStreamingFn: async (resp) => {
        streamingCompileCalls++;
        const b = await (await resp).arrayBuffer();
        return WebAssembly.compile(b);
      },
    });

    assert.equal(result.kind, "loaded");
    if (result.kind === "loaded") {
      assert.equal(result.compilePath, "streaming");
      assert.equal(streamingCompileCalls, 1);
    }
  });

  it("refuses tampered / modified bytes with artifact-mismatch with ZERO instantiate or compile calls", async () => {
    let compileCalls = 0;
    let instantiateCalls = 0;

    // Tamper with a single byte in memory
    const tamperedBytes = new Uint8Array(wasmBytes);
    const lastIdx = tamperedBytes.length - 1;
    tamperedBytes[lastIdx] = (tamperedBytes[lastIdx] ?? 0) ^ 0xff;

    const tamperedResponse = new Response(tamperedBytes, {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    });

    const result = await loadBundle({
      manifestData: manifest,
      wasmUrl: "http://localhost:3000/tampered.wasm",
      fetchFn: async () => tamperedResponse,
      compileFn: async (b) => {
        compileCalls++;
        return WebAssembly.compile(b);
      },
      instantiateFn: async (m, i) => {
        instantiateCalls++;
        return WebAssembly.instantiate(m, i);
      },
    });

    assert.equal(result.kind, "refused");
    if (result.kind === "refused") {
      assert.equal(result.outcome, "artifact-mismatch");
      assert.equal(result.expectedDigest, manifest.wasmDigest);
      assert.notEqual(result.digest, manifest.wasmDigest);
      assert.equal(compileCalls, 0);
      assert.equal(instantiateCalls, 0);
    }
  });

  it("refuses missing artifact file with missing-artifact with ZERO instantiate calls", async () => {
    let instantiateCalls = 0;

    const notFoundResponse = new Response("404 Not Found", {
      status: 404,
      statusText: "Not Found",
    });

    const result = await loadBundle({
      manifestData: manifest,
      wasmUrl: "http://localhost:3000/nonexistent.wasm",
      fetchFn: async () => notFoundResponse,
      instantiateFn: async (m, i) => {
        instantiateCalls++;
        return WebAssembly.instantiate(m, i);
      },
    });

    assert.equal(result.kind, "refused");
    if (result.kind === "refused") {
      assert.equal(result.outcome, "missing-artifact");
      assert.equal(instantiateCalls, 0);
    }
  });
});
