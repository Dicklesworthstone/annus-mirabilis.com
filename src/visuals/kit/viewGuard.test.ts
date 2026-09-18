import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { auditViewComponentSource } from "./viewGuard.ts";

describe("viewGuard refusal throw sites (am-muyh)", () => {
  describe("forbidden-physics-import (viewGuard.ts:163)", () => {
    test("reject: (viewGuard.ts:163) reports forbidden-physics-import when file imports from physics/reference", () => {
      const forbiddenSource = ["..", "physics", "reference", "diffusion", "distributions.ts"].join(
        "/",
      );
      const code = `import { stokesEinsteinD } from "${forbiddenSource}";`;
      const violations = auditViewComponentSource("src/visuals/BadComponent.tsx", code);
      const v = violations.find((item) => item.rule === "forbidden-physics-import");
      assert.ok(v, "Must report forbidden-physics-import");
      assert.equal(v?.line, 1);
    });

    test("accept: clean UI view imports without reference physics pass", () => {
      const code = 'import React from "react";\nimport { LinePlot } from "./LinePlot.tsx";';
      const violations = auditViewComponentSource("src/visuals/GoodComponent.tsx", code);
      const v = violations.find((item) => item.rule === "forbidden-physics-import");
      assert.equal(v, undefined);
    });
  });

  describe("recompute-emitted-energy (viewGuard.ts:215)", () => {
    test("reject: (viewGuard.ts:215) reports recompute-emitted-energy when view calculates energy locally", () => {
      const formula = ["h", "*", "nu"].join(" ");
      const code = `const energy = ${formula};`;
      const violations = auditViewComponentSource("src/visuals/EnergyView.tsx", code);
      const v = violations.find((item) => item.rule === "recompute-emitted-energy");
      assert.ok(v, "Must report recompute-emitted-energy");
      assert.equal(v?.line, 1);
    });

    test("accept: views displaying precomputed energy from props pass", () => {
      const code = "const energy = props.energyValue;";
      const violations = auditViewComponentSource("src/visuals/EnergyView.tsx", code);
      const v = violations.find((item) => item.rule === "recompute-emitted-energy");
      assert.equal(v, undefined);
    });
  });

  describe("raw-position-binning (viewGuard.ts:228)", () => {
    test("reject: (viewGuard.ts:228) reports raw-position-binning when component defines binPositions", () => {
      const fnName = ["bin", "Positions"].join("");
      const code = `function ${fnName}(positions: number[]) { return []; }`;
      const violations = auditViewComponentSource("src/visuals/HistogramView.tsx", code);
      const v = violations.find((item) => item.rule === "raw-position-binning");
      assert.ok(v, "Must report raw-position-binning");
      assert.equal(v?.line, 1);
    });

    test("accept: views taking pre-binned histogram data pass", () => {
      const code = "function renderHistogram(data: HistogramBinData) { return null; }";
      const violations = auditViewComponentSource("src/visuals/HistogramView.tsx", code);
      const v = violations.find((item) => item.rule === "raw-position-binning");
      assert.equal(v, undefined);
    });
  });
});
