import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { WasmArtifactManifest } from "../src/workers/protocol/provenance.ts";
import { buildWasmArtifacts } from "./build-wasm-artifacts.ts";
import {
  CHOSEN_POLICY_MAX_BYTES,
  evaluateSizeBudget,
  MAX_ALLOWED_DRIFT_RATIO,
} from "./wasm-artifacts/sizeBudget.ts";

describe("buildWasmArtifacts build, gates, and reproducibility", () => {
  const tempBase = process.env.AM_TEST_TMP ?? process.env.TMPDIR ?? tmpdir();
  if (!existsSync(tempBase)) {
    mkdirSync(tempBase, { recursive: true });
  }
  const fixturesBase = join(import.meta.dirname, "../src/testing/fixtures/wasm");

  it("builds slim WASM artifact and writes content-addressed files matching manifest", async () => {
    const tempDir = mkdtempSync(join(tempBase, "build-test-"));
    const outputBaseDir = join(tempDir, "wasm");

    const summary = await buildWasmArtifacts({
      outputBaseDir,
    });

    assert.equal(summary.bundleId, "fs-annus-diffusion");
    assert.equal(summary.hashPrefix, summary.wasmDigest.slice(0, 16));
    assert.equal(existsSync(summary.wasmPath), true);
    assert.equal(existsSync(summary.manifestPath), true);
    assert.equal(summary.reproducible, true);
  });

  it("two-root reproducibility check passes when outputs are byte-identical", async () => {
    const tempDir = mkdtempSync(join(tempBase, "build-repro-"));
    const runDir = join(tempDir, "run-1");

    const summary = await buildWasmArtifacts({
      runDir,
      outputBaseDir: join(tempDir, "wasm"),
    });

    assert.equal(summary.reproducible, true);
    assert.equal(existsSync(join(runDir, "root-a", "fs_annus_diffusion_bg.wasm")), true);
    assert.equal(existsSync(join(runDir, "root-b", "fs_annus_diffusion_bg.wasm")), true);
  });

  it("refuses to reuse an existing non-empty run directory", async () => {
    const tempDir = mkdtempSync(join(tempBase, "build-reuse-"));
    const runDir = join(tempDir, "run-existing");
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, "dummy.txt"), "existing content");

    await assert.rejects(
      async () => {
        await buildWasmArtifacts({
          runDir,
          outputBaseDir: join(tempDir, "wasm"),
        });
      },
      { message: /Run directory already exists and is not empty/ },
    );
  });

  it("refuses missing binding document", async () => {
    const tempDir = mkdtempSync(join(tempBase, "build-missing-doc-"));

    await assert.rejects(
      async () => {
        await buildWasmArtifacts({
          bindingDocPath: join(tempDir, "nonexistent-doc.md"),
          outputBaseDir: join(tempDir, "wasm"),
        });
      },
      { message: /FrankenSim binding document not found/ },
    );
  });

  it("capability matrix gate refuses unadmitted exports or not-started status", async () => {
    const tempDir = mkdtempSync(join(tempBase, "build-matrix-refuse-"));
    const fixtureDoc = join(tempDir, "BINDING.md");
    writeFileSync(
      fixtureDoc,
      `\`\`\`capability-matrix
- capabilityId: diffusion.brownian-frames
  family: "Diffusion and stochastic transport"
  instrumentId: bm-01
  upstreamStatus: new-upstream
  owner: "fs_wasm::brownian_frames"
  nativeTestTarget: "none"
  browserExport: brownian_frames
  admittedDomain: "n_particles in 1..10000"
  sourceReference: "ref"
  releaseArtifact: fs-annus-diffusion
  acceptanceState: not-started
\`\`\`
`,
      "utf8",
    );

    await assert.rejects(
      async () => {
        await buildWasmArtifacts({
          bindingDocPath: fixtureDoc,
          outputBaseDir: join(tempDir, "wasm"),
        });
      },
      { message: /Capability matrix admission gate refused build/ },
    );
  });

  describe("size budget and drift gate evaluation (am-fs-slim-artifact-0yh requirement 8)", () => {
    it("rejects fixture manifest exceeding absolute policy budget with typed code absolute-budget-exceeded", () => {
      const fixturePath = join(fixturesBase, "manifest-exceeds-max-bytes.json");
      const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as WasmArtifactManifest;

      const result = evaluateSizeBudget(fixture.sizeBudget, fixture.wasmBytes);

      // Assert typed refusal code and status, not string matching
      assert.equal(result.passed, false);
      assert.equal(result.status, "absolute-budget-exceeded");
      assert.equal(result.code, "absolute-budget-exceeded");
      assert.equal(result.maxBytes, CHOSEN_POLICY_MAX_BYTES);
      assert.ok(result.totalBundleBytes > result.maxBytes);
    });

    it("rejects fixture manifest exceeding 10% drift bound under maxBytes with typed code drift-budget-exceeded", () => {
      const fixturePath = join(fixturesBase, "manifest-exceeds-drift.json");
      const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as WasmArtifactManifest;

      const result = evaluateSizeBudget(fixture.sizeBudget, fixture.wasmBytes);

      // Assert typed refusal code and status
      assert.equal(result.passed, false);
      assert.equal(result.status, "drift-budget-exceeded");
      assert.equal(result.code, "drift-budget-exceeded");
      assert.equal(result.maxBytes, CHOSEN_POLICY_MAX_BYTES);
      assert.ok(result.totalBundleBytes <= result.maxBytes);
      assert.ok(result.driftRatio > MAX_ALLOWED_DRIFT_RATIO);
    });

    it("accepts good fixture manifest under both absolute budget and 10% drift", () => {
      const fixturePath = join(fixturesBase, "manifest-valid-budget.json");
      const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as WasmArtifactManifest;

      const result = evaluateSizeBudget(fixture.sizeBudget, fixture.wasmBytes);

      // Assert accepted status
      assert.equal(result.passed, true);
      assert.equal(result.status, "ok");
      assert.equal(result.code, undefined);
      assert.equal(result.maxBytes, CHOSEN_POLICY_MAX_BYTES);
      assert.ok(result.totalBundleBytes <= result.maxBytes);
      assert.ok(result.driftRatio <= MAX_ALLOWED_DRIFT_RATIO);
    });
  });
});
