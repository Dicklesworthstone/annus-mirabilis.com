import { describe, expect, it } from "bun:test";
import { mainAuditDimensions, runDimensionAudit } from "../../../scripts/audit-dimensions.ts";
import { prod, quot, rel, root, sym } from "./__fixtures__/tree.ts";
import type { QuantityRegistryMap } from "./check.ts";

const quantities: QuantityRegistryMap = {
  length: { id: "length", dimension: ["1", "0", "0", "0", "0", "0"] },
  energy: { id: "energy", dimension: ["2", "1", "-2", "0", "0", "0"] },
  force: { id: "force", dimension: ["1", "1", "-2", "0", "0", "0"] },
  boltzmannConstant: { id: "boltzmannConstant", dimension: ["2", "1", "-2", "-1", "0", "0"] },
  temperature: { id: "temperature", dimension: ["0", "0", "0", "1", "0", "0"] },
  viscosity: { id: "viscosity", dimension: ["-1", "1", "-1", "0", "0", "0"] },
  particleRadius: { id: "particleRadius", dimension: ["1", "0", "0", "0", "0", "0"] },
  diffusionCoefficient: { id: "diffusionCoefficient", dimension: ["2", "0", "-1", "0", "0", "0"] },
  volumeRatio: {
    id: "volumeRatio",
    dimension: ["0", "0", "0", "0", "0", "0"],
    dimensionlessKind: "ratio",
  },
  pureNumber: {
    id: "pureNumber",
    dimension: ["0", "0", "0", "0", "0", "0"],
    dimensionlessKind: "pure-number",
  },
};

describe("audit-dimensions reports per-status counts and fails on inconsistency", () => {
  it("GOOD CASE: Stokes-Einstein and cube-root composition keep the audit green", async () => {
    const summary = await runDimensionAudit([
      {
        id: "eq-stokes-einstein",
        paper: "brownian-motion",
        quantities,
        tree: quot(
          prod(sym("boltzmannConstant"), sym("temperature")),
          prod(sym("viscosity"), sym("particleRadius")),
        ),
      },
      {
        id: "eq-three-cube-roots",
        paper: "brownian-motion",
        quantities,
        tree: prod(root(sym("length"), 3), root(sym("length"), 3), root(sym("length"), 3)),
      },
    ]);
    expect(summary.ok).toBe(true);
    expect(summary.consistent).toBe(2);
    expect(summary.inconsistent).toBe(0);
    expect(summary.semanticMismatch).toBe(0);
  });

  it("PLANTED: one inconsistent equation names the length slot and fails the audit", async () => {
    const summary = await runDimensionAudit([
      {
        id: "eq-energy-equals-force",
        paper: "brownian-motion",
        quantities,
        tree: rel(sym("energy"), sym("force")),
      },
    ]);
    expect(summary.ok).toBe(false);
    expect(summary.inconsistent).toBe(1);
    expect(summary.consistent).toBe(0);
  });

  it("PLANTED: cancelled-units vs pure-number is a semantic mismatch, not a pass", async () => {
    const summary = await runDimensionAudit([
      {
        id: "eq-ratio-equals-pure-number",
        paper: "light-quanta",
        quantities,
        tree: rel(sym("volumeRatio"), sym("pureNumber")),
      },
    ]);
    expect(summary.ok).toBe(false);
    expect(summary.semanticMismatch).toBe(1);
  });

  it("unsupported-check is a review flag, never a pass and never an inconsistency", async () => {
    const summary = await runDimensionAudit([
      {
        id: "eq-bare-matrix",
        paper: "special-relativity",
        quantities,
        tree: { kind: "matrix" },
      },
    ]);
    expect(summary.ok).toBe(true);
    expect(summary.unsupportedCheck).toBe(1);
    expect(summary.inconsistent).toBe(0);
  });

  describe("CLI execution via scripts/audit-dimensions.ts --corpus", () => {
    const fixturesDir = new URL("__fixtures__", import.meta.url).pathname;

    it("CLI exits 0 on consistent fixture", async () => {
      const corpusPath = `${fixturesDir}/audit-consistent.json`;
      const result = await mainAuditDimensions(["--corpus", corpusPath]);
      expect(result.exitCode).toBe(0);
      expect(result.summary.consistent).toBe(1);
      expect(result.summary.inconsistent).toBe(0);
      expect(result.summary.semanticMismatch).toBe(0);
      expect(result.summary.ok).toBe(true);
    });

    it("CLI exits 1 on inconsistent fixture", async () => {
      const corpusPath = `${fixturesDir}/audit-inconsistent.json`;
      const result = await mainAuditDimensions(["--corpus", corpusPath]);
      expect(result.exitCode).toBe(1);
      expect(result.summary.consistent).toBe(0);
      expect(result.summary.inconsistent).toBe(1);
      expect(result.summary.ok).toBe(false);
    });

    it("CLI exits 1 on semantic-mismatch fixture", async () => {
      const corpusPath = `${fixturesDir}/audit-mismatch.json`;
      const result = await mainAuditDimensions(["--corpus", corpusPath]);
      expect(result.exitCode).toBe(1);
      expect(result.summary.consistent).toBe(0);
      expect(result.summary.semanticMismatch).toBe(1);
      expect(result.summary.ok).toBe(false);
    });
  });
});
