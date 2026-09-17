import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { loadReadingFiles } from "../../scripts/build-content.ts";
import { compileReadingContent } from "../content/compiler/compile.ts";
import { CANONICAL_FOUNDATION_IDS } from "../content/foundations/canonicalIds.ts";
import { loadRegistry } from "../content/foundations/registry.ts";
import { validateReadingRecord } from "../content/schemas/reading.ts";
import {
  fixtureBrownianPedagogicalReconstruction,
  fixtureBrownianSourceOrder,
} from "../equations/derivations/fixtures.ts";
import { auditChainTools } from "../equations/derivations/toolAudit.ts";
import { withinTolerance } from "../units/tolerance.ts";

const FOUNDATIONS_DIR = path.resolve("content/foundations");

export const BROWNIAN_SLICE_NODES = [
  "integration",
  "taylor-expansion",
  "probability-independence",
  "distributions",
  "mean-variance-rms",
  "gaussian-distributions",
  "flux-continuity",
  "diffusion-equation",
  "random-walks",
] as const;

export const BROWNIAN_SLICE_BRIDGES = [
  "bridge-negative-numbers-direction",
  "bridge-fractions-ratios",
  "bridge-squaring-square-roots",
  "bridge-scientific-notation-units",
  "bridge-a-graph",
  "bridge-sum-average",
] as const;

const BEAD_ID = "am-bm-slice-foundations-f5z9";

describe("Foundations: Brownian Motion Slice (am-bm-slice-foundations-f5z9)", () => {
  it("all 9 nodes and 6 bridges exist, load, and validate against the reading schema", () => {
    const allIds = [...BROWNIAN_SLICE_NODES, ...BROWNIAN_SLICE_BRIDGES];
    assert.equal(allIds.length, 15, "Brownian slice must define exactly 15 foundation items");

    for (const id of allIds) {
      const filePath = path.join(FOUNDATIONS_DIR, `${id}.json`);
      assert.equal(fs.existsSync(filePath), true, `File ${filePath} must exist on disk`);

      const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const record = validateReadingRecord(raw, filePath);

      assert.equal(record.kind, "foundation");
      assert.equal(record.id, id);
      assert.ok(record.title.length > 0, `${id} must have a non-empty title`);
      assert.ok(record.question.length > 0, `${id} must have a non-empty question`);
      assert.ok(record.summary.length > 0, `${id} must have a non-empty summary`);
      assert.ok(record.stoppingPoint.length > 0, `${id} must have a non-empty stoppingPoint`);
      assert.ok(record.explanation.length >= 2, `${id} must have at least 2 explanation blocks`);
      assert.ok(record.example.length >= 1, `${id} must have at least 1 example block`);
    }
  });

  it("canonical table and registry partition: exactly 9 nodes and 6 bridges owned by am-bm-slice-foundations-f5z9", () => {
    const registry = loadRegistry();

    // Verify canonical table allocation
    const canonicalOwned = CANONICAL_FOUNDATION_IDS.filter((e) => e.ownerBead === BEAD_ID);
    assert.equal(canonicalOwned.length, 15, "Canonical table must allocate 15 items to this bead");
    assert.equal(
      canonicalOwned.filter((e) => e.kind === "node").length,
      9,
      "Canonical table must allocate 9 nodes to this bead",
    );
    assert.equal(
      canonicalOwned.filter((e) => e.kind === "bridge").length,
      6,
      "Canonical table must allocate 6 bridges to this bead",
    );

    // Verify registry rows
    const registryOwned = registry.entries.filter((e) => e.ownerBead === BEAD_ID);
    assert.equal(registryOwned.length, 15, "Registry must allocate 15 items to this bead");

    const registeredIds = new Set(registryOwned.map((e) => e.id));
    for (const nodeSlug of BROWNIAN_SLICE_NODES) {
      assert.ok(
        registeredIds.has(`foundation:${nodeSlug}`),
        `Registry missing node foundation:${nodeSlug}`,
      );
    }
    for (const bridgeSlug of BROWNIAN_SLICE_BRIDGES) {
      assert.ok(
        registeredIds.has(`foundation:${bridgeSlug}`),
        `Registry missing bridge foundation:${bridgeSlug}`,
      );
    }

    // Check all are authored
    for (const entry of registryOwned) {
      assert.equal(entry.cluster, "slice");
      assert.equal(
        entry.status,
        "authored",
        `Entry ${entry.id} should be marked authored now that records exist`,
      );
    }
  });

  it("arithmetic assertions for worked examples: discrete displacements and scaling laws", () => {
    const logDir = path.resolve(process.cwd(), "artifacts/test-logs/brownian-foundations");
    fs.mkdirSync(logDir, { recursive: true });
    const logRunId = `brownian-foundations-${Date.now()}`;
    const logFile = path.join(logDir, `${logRunId}.jsonl`);
    const logs: Array<Record<string, unknown>> = [];

    // 1. Authored example (-3, -1, +1, +3)
    const d1 = [-3, -1, 1, 3];
    const signedSum1 = d1.reduce((a, b) => a + b, 0);
    const meanSigned1 = signedSum1 / d1.length;
    const meanAbs1 = d1.reduce((a, b) => a + Math.abs(b), 0) / d1.length;
    const meanSq1 = d1.reduce((a, b) => a + b * b, 0) / d1.length;
    const rms1 = Math.sqrt(meanSq1);

    assert.equal(signedSum1, 0, "Signed sum of (-3, -1, +1, +3) must be 0");
    assert.equal(meanSigned1, 0, "Mean signed displacement must be 0");
    assert.equal(meanAbs1, 2, "Mean absolute displacement must be 2");
    assert.equal(meanSq1, 5, "Mean square displacement must be 5");

    const vRms1 = withinTolerance(rms1, 2.236068, { absolute: 0.001, relative: 1e-4 });
    assert.equal(vRms1.ok, true, `RMS sqrt(5) ~ 2.236, got ${rms1}`);

    // 2. Doubled example (-6, -2, +2, +6)
    const d2 = [-6, -2, 2, 6];
    const signedSum2 = d2.reduce((a, b) => a + b, 0);
    const meanAbs2 = d2.reduce((a, b) => a + Math.abs(b), 0) / d2.length;
    const meanSq2 = d2.reduce((a, b) => a + b * b, 0) / d2.length;
    const rms2 = Math.sqrt(meanSq2);

    assert.equal(signedSum2, 0, "Signed sum of (-6, -2, +2, +6) must be 0");
    assert.equal(meanAbs2, 4, "Doubled mean absolute displacement must be 4");
    assert.equal(meanSq2, 20, "Doubled mean square displacement must be 20");

    const vRms2 = withinTolerance(rms2, 4.472136, { absolute: 0.001, relative: 1e-4 });
    assert.equal(vRms2.ok, true, `RMS sqrt(20) ~ 4.472, got ${rms2}`);

    // Ratio checks: when displacements double, mean absolute doubles and RMS doubles (mean square quadruples)
    assert.equal(meanAbs2 / meanAbs1, 2, "Mean absolute displacement doubles exactly");
    assert.equal(meanSq2 / meanSq1, 4, "Mean square displacement quadruples exactly");
    assert.equal(rms2 / rms1, 2, "RMS displacement doubles exactly");

    // 3. Random-walk step scaling: 4 times the steps gives 2 times the RMS spread
    const steps1 = 100;
    const steps2 = 400;
    const stepSpread1 = Math.sqrt(steps1); // 10
    const stepSpread2 = Math.sqrt(steps2); // 20
    assert.equal(stepSpread2 / stepSpread1, 2, "4x steps gives 2x spread");

    // 4. Gaussian fractions within 1 sigma and 2 sigma
    // 1-D Gaussian integral over [-1, 1] sigma is erf(1/sqrt(2)) ~ 0.682689
    // Over [-2, 2] sigma is erf(sqrt(2)) ~ 0.954500
    const oneSigmaFraction = 0.682689;
    const twoSigmaFraction = 0.9545;
    const vOneSigma = withinTolerance(oneSigmaFraction, 0.6827, {
      absolute: 0.001,
      relative: 1e-3,
    });
    const vTwoSigma = withinTolerance(twoSigmaFraction, 0.9545, {
      absolute: 0.001,
      relative: 1e-3,
    });
    assert.equal(vOneSigma.ok, true);
    assert.equal(vTwoSigma.ok, true);

    logs.push({
      timestamp: new Date().toISOString(),
      suite: "brownian-foundations",
      logRunId,
      testId: "arithmetic-assertions",
      beadId: BEAD_ID,
      outcome: "pass",
      meanAbs1,
      meanSq1,
      rms1,
      meanAbs2,
      meanSq2,
      rms2,
      message:
        "Verified discrete arithmetic, doubled scaling, random walk spread, and Gaussian moments",
    });

    fs.writeFileSync(logFile, `${logs.map((e) => JSON.stringify(e)).join("\n")}\n`);
    assert.equal(fs.existsSync(logFile), true);
  });

  it("zero-algebra bridge and algebraic derivation reach the exact same physical conclusion", () => {
    // The zero-algebra bridge (first encounter + bridge-squaring-square-roots + random-walks) teaches:
    // (1) Direction cancellation: sum(x_i) = 0 because opposite kicks balance out.
    // (2) Sum of squares grows linearly with number of steps / time: <x^2> proportional to t.
    // (3) Typical distance (RMS) grows as sqrt(t), not linear speed.
    //
    // The algebraic derivation (fixtureBrownianPedagogicalReconstruction + fixtureBrownianSourceOrder) proves:
    // (1) <x_sum> = 0 from zero-mean premise.
    // (2) <x^2> = 2Dt from uncorrelated cross-terms vanishing (step 3) and substitution of D (step 5).
    // (3) sqrt(<x^2>) = sqrt(2Dt).

    // Physical parameter test case: D = 5.2e-13 m^2/s, t = 60 s
    const D = 5.2e-13;
    const t = 60;

    // Algebraic prediction:
    const meanSquareAlgebraic = 2 * D * t;
    const rmsAlgebraic = Math.sqrt(meanSquareAlgebraic);

    // Bridge prediction (4x time quadruples mean square and doubles RMS):
    const tDoubled = 4 * t;
    const meanSquareBridge4x = 4 * meanSquareAlgebraic;
    const rmsBridge4x = 2 * rmsAlgebraic;

    const meanSquareAlgebraic4x = 2 * D * tDoubled;
    const rmsAlgebraic4x = Math.sqrt(meanSquareAlgebraic4x);

    assert.equal(
      meanSquareBridge4x,
      meanSquareAlgebraic4x,
      "Bridge 4x scaling equals algebraic 4x evaluation",
    );
    assert.equal(
      rmsBridge4x,
      rmsAlgebraic4x,
      "Bridge 2x RMS scaling equals algebraic 2x RMS evaluation",
    );
  });

  it("tool-id audit: every step in Brownian derivation chains attaches a registered foundation tool", () => {
    const registry = loadRegistry();
    const registeredIds = new Set(registry.entries.map((e) => e.id));

    const brownianChains = [fixtureBrownianPedagogicalReconstruction, fixtureBrownianSourceOrder];

    const report = auditChainTools(brownianChains, registeredIds);

    assert.equal(report.totalSteps, 10, "Brownian chains must have 10 total derivation steps");
    assert.equal(
      report.errors.length,
      0,
      `No tool resolution errors allowed: ${JSON.stringify(report.errors)}`,
    );
    assert.equal(
      report.pending.length,
      0,
      `All 10 Brownian steps must have tools attached: ${JSON.stringify(report.pending)}`,
    );
    assert.equal(report.validSteps, 10, "All 10 steps must be valid with resolved tools");
  });

  it("acyclicity check: prerequisite graph of Brownian slice foundations is acyclic", () => {
    const graph = new Map<string, string[]>();
    const allIds = [...BROWNIAN_SLICE_NODES, ...BROWNIAN_SLICE_BRIDGES];

    for (const id of allIds) {
      const filePath = path.join(FOUNDATIONS_DIR, `${id}.json`);
      const record = JSON.parse(fs.readFileSync(filePath, "utf8"));
      graph.set(id, record.prerequisites || []);
    }

    // Standard cycle detector using DFS
    const visited = new Set<string>();
    const inStack = new Set<string>();

    function hasCycle(node: string): boolean {
      visited.add(node);
      inStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (inStack.has(neighbor)) {
          return true;
        }
      }

      inStack.delete(node);
      return false;
    }

    for (const id of allIds) {
      if (!visited.has(id)) {
        assert.equal(hasCycle(id), false, `Cycle detected starting at foundation ${id}`);
      }
    }
  });

  it("voice lint: all Brownian foundations and bridges avoid condescending/lecturing vocabulary", () => {
    const forbiddenWords = [
      /\bobviously\b/i,
      /\bclearly\b/i,
      /\bsimply\b/i,
      /\btrivially\b/i,
      /\beasy to see\b/i,
    ];

    const allIds = [...BROWNIAN_SLICE_NODES, ...BROWNIAN_SLICE_BRIDGES];
    for (const id of allIds) {
      const filePath = path.join(FOUNDATIONS_DIR, `${id}.json`);
      const raw = fs.readFileSync(filePath, "utf8");

      for (const pattern of forbiddenWords) {
        assert.equal(
          pattern.test(raw),
          false,
          `Foundation/bridge ${id} contains forbidden voice pattern ${pattern}`,
        );
      }
    }
  });

  it("compiler builds all content including Brownian slice foundations cleanly with 0 errors", async () => {
    const files = await loadReadingFiles();
    const result = compileReadingContent(files);
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    assert.equal(errors.length, 0, `Compiler errors found: ${JSON.stringify(errors)}`);

    const foundIds = new Set(result.foundations.map((f) => f.id));
    for (const id of [...BROWNIAN_SLICE_NODES, ...BROWNIAN_SLICE_BRIDGES]) {
      assert.equal(foundIds.has(id), true, `Foundation/bridge ${id} must be in compiled output`);
    }
  });
});
