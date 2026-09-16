import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  CHOSEN_POLICY_MAX_BYTES,
  evaluateSizeBudget,
  MAX_ALLOWED_DRIFT_RATIO,
} from "../../../scripts/wasm-artifacts/sizeBudget.ts";
import type { WasmArtifactManifest } from "../../workers/protocol/provenance.ts";

const FIXTURES_DIR = join(import.meta.dirname, "../fixtures/wasm");

describe("WASM size budget gate (am-fs-slim-artifact-0yh requirement 8)", () => {
  it("rejects fixture manifest where total bundle bytes exceed maxBytes with typed status code", () => {
    const fixturePath = join(FIXTURES_DIR, "manifest-exceeds-max-bytes.json");
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as WasmArtifactManifest;

    const result = evaluateSizeBudget(fixture.sizeBudget, fixture.wasmBytes);

    assert.equal(result.passed, false);
    assert.equal(result.status, "absolute-budget-exceeded");
    assert.equal(result.code, "absolute-budget-exceeded");
    assert.equal(result.totalBundleBytes > result.maxBytes, true);
    assert.equal(result.maxBytes, CHOSEN_POLICY_MAX_BYTES);
    assert.match(result.message, /exceeds maximum policy budget/);
  });

  it("rejects fixture manifest exceeding 10% drift bound even when total bytes are under maxBytes", () => {
    const fixturePath = join(FIXTURES_DIR, "manifest-exceeds-drift.json");
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as WasmArtifactManifest;

    const result = evaluateSizeBudget(fixture.sizeBudget, fixture.wasmBytes);

    assert.equal(result.passed, false);
    assert.equal(result.status, "drift-budget-exceeded");
    assert.equal(result.code, "drift-budget-exceeded");
    assert.equal(result.totalBundleBytes <= result.maxBytes, true);
    assert.equal(result.driftRatio > MAX_ALLOWED_DRIFT_RATIO, true);
    assert.match(result.message, /drift threshold/);
  });

  it("accepts valid fixture manifest under maxBytes and within drift bound", () => {
    const fixturePath = join(FIXTURES_DIR, "manifest-valid-budget.json");
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as WasmArtifactManifest;

    const result = evaluateSizeBudget(fixture.sizeBudget, fixture.wasmBytes);

    assert.equal(result.passed, true);
    assert.equal(result.status, "ok");
    assert.equal(result.code, undefined);
    assert.equal(result.totalBundleBytes <= result.maxBytes, true);
    assert.equal(result.driftRatio <= MAX_ALLOWED_DRIFT_RATIO, true);
  });

  it("verifies live public/wasm/manifest.json satisfies both absolute policy budget and drift bounds", () => {
    const liveManifestPath = join(import.meta.dirname, "../../../public/wasm/manifest.json");
    const liveManifest = JSON.parse(readFileSync(liveManifestPath, "utf8")) as WasmArtifactManifest;

    const result = evaluateSizeBudget(liveManifest.sizeBudget, liveManifest.wasmBytes);

    assert.equal(result.passed, true);
    assert.equal(result.status, "ok");
    assert.equal(result.code, undefined);
    assert.equal(result.maxBytes, CHOSEN_POLICY_MAX_BYTES);
    assert.equal(result.totalBundleBytes <= CHOSEN_POLICY_MAX_BYTES, true);
    assert.equal(result.driftRatio <= MAX_ALLOWED_DRIFT_RATIO, true);
  });
});
