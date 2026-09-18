import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertScenarioCoverage,
  buildFixtureIndex,
  deriveScenarioCoverageMarkdown,
  parseScenarioCoverageMarkdown,
  resolveScenarioFixture,
} from "./scenario-registry/coverageDerivation.ts";

const ROOT = process.cwd();
const DOC_PATH = join(ROOT, "docs/SCENARIO_COVERAGE.md");

const EXPECTED_BUILT_IDS = [
  "diffusion-einstein-1905-printed",
  "diffusion-einstein-1905-modern-kb",
  "scenario-golden-brownian",
  "kinematics-boost-0.6c",
  "diffusion-identity-apparent-speed",
  "diffusion-adversarial-half-diffusivity",
  "diffusion-adversarial-1um-radius",
  "sr-02-emf-first-order-agreement",
  "sr-02-emf-discriminates-at-0.6c",
  "shelf-fizeau-fresnel-versus-relativistic",
] as const;

const EXPECTED_OWED_IDS = [
  "radiation-planck-avogadro",
  "photoelectric-stopping-4.3v",
  "suspension-einstein-1905-thesis",
  "suspension-einstein-1906-supplement",
  "suspension-einstein-1911-correction",
  "photoelectric-neutral-2eV",
  "waves-doppler-mirror",
  "electron-transverse-mass",
  "waves-energy-doppler-identity",
  "mass-energy-0.6c",
  "diffusion-adversarial-radial-gaussian",
  "inference-adversarial-camera-noise",
  "inference-adversarial-inversion-bias",
  "radiation-adversarial-entropy-constant",
  "radiation-adversarial-jacobian",
  "radiation-adversarial-locked-positions",
  "waves-adversarial-light-complex-longitudinal",
  "waves-adversarial-light-complex-moving-transverse",
  "waves-adversarial-moving-mirror",
  "electron-adversarial-force-components",
  "runtime-adversarial-observer-change",
  "mass-energy-adversarial-low-speed-proxy",
  "u64-adversarial-json-number-seed",
  "fields-adversarial-neutral-conductor",
] as const;

describe("scenario coverage: built-versus-owed derivation", () => {
  test("docs/SCENARIO_COVERAGE.md matches live fixture state on disk (34 total: 10 built, 24 owed)", () => {
    const doc = readFileSync(DOC_PATH, "utf8");
    const stats = assertScenarioCoverage(doc, ROOT);

    expect(stats.total).toBe(34);
    expect(stats.built).toBe(10);
    expect(stats.owed).toBe(24);

    const rows = parseScenarioCoverageMarkdown(doc);
    const byId = new Map(rows.map((r) => [r.scenarioId, r]));

    for (const builtId of EXPECTED_BUILT_IDS) {
      const row = byId.get(builtId);
      expect(row).toBeDefined();
      expect(row?.fixtureStatus).toBe("built");
      const resolution = resolveScenarioFixture(builtId, ROOT);
      expect(resolution.exists).toBe(true);
    }

    for (const owedId of EXPECTED_OWED_IDS) {
      const row = byId.get(owedId);
      expect(row).toBeDefined();
      expect(row?.fixtureStatus).toBe("owed");
      const resolution = resolveScenarioFixture(owedId, ROOT);
      expect(resolution.exists).toBe(false);
    }

    // Assert that the file is strictly derived and has no uncommitted manual drift
    const derived = deriveScenarioCoverageMarkdown(doc, ROOT);
    expect(doc).toBe(derived);
  });

  test("planted negative: fails on overclaim when a fabricated scenario is marked built", () => {
    const fabricatedId = "fabricated-overclaim-scenario-test";
    const syntheticDoc = [
      "# Test Coverage Table",
      "",
      "| Row | Scenario id | Fixture | Status |",
      "| --- | --- | --- | --- |",
      `| Fabricated | ${fabricatedId} | built | non-existent fixture |`,
    ].join("\n");

    expect(() => assertScenarioCoverage(syntheticDoc, ROOT)).toThrow(
      new RegExp(`Overclaim detected.*"${fabricatedId}"`),
    );
  });

  test("fails on overclaim if an owed scenario is fraudulently marked built", () => {
    const doc = readFileSync(DOC_PATH, "utf8");
    // Fraudulently mark an owed scenario as built
    const tampered = doc.replace(
      "| radiation-planck-avogadro | owed |",
      "| radiation-planck-avogadro | built |",
    );

    expect(() => assertScenarioCoverage(tampered, ROOT)).toThrow(
      /Overclaim detected.*"radiation-planck-avogadro"/,
    );
  });

  test("fails on underclaim if a built scenario is marked owed", () => {
    const doc = readFileSync(DOC_PATH, "utf8");
    // Mark a built scenario as owed
    const tampered = doc.replace(
      "| kinematics-boost-0.6c | built |",
      "| kinematics-boost-0.6c | owed |",
    );

    expect(() => assertScenarioCoverage(tampered, ROOT)).toThrow(
      /Underclaim detected.*"kinematics-boost-0.6c"/,
    );
  });

  test("fails if a row is missing the built/owed status", () => {
    const syntheticDoc = [
      "# Test Coverage Table",
      "",
      "| Row | Scenario id | Fixture | Status |",
      "| --- | --- | --- | --- |",
      "| Unmarked | kinematics-boost-0.6c | pending | pending |",
    ].join("\n");

    expect(() => assertScenarioCoverage(syntheticDoc, ROOT)).toThrow(
      /missing a valid built\/owed fixture status/,
    );
  });

  test("fixture index resolves across all four required fixture directories", () => {
    const index = buildFixtureIndex(ROOT);

    // 1. content/scenarios
    expect(index.get("diffusion-einstein-1905-printed")).toContain("content/scenarios");
    expect(index.get("kinematics-boost-0.6c")).toContain("content/scenarios");

    // 2. src/testing/scenario-fixtures
    expect(index.get("scenario-golden-brownian")).toContain("src/testing/scenario-fixtures");
    expect(index.get("diffusion-identity-apparent-speed")).toContain(
      "src/testing/scenario-fixtures",
    );
    expect(index.get("diffusion-adversarial-1um-radius")).toContain(
      "src/testing/scenario-fixtures",
    );
    expect(index.get("sr-02-emf-first-order-agreement")).toContain("src/testing/scenario-fixtures");
  });
});
