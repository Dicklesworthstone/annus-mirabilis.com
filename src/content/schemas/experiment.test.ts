import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ExperimentValidationError,
  validateConstantSet,
  validateDataCell,
  validateExperiment,
  validateHistoricalDataset,
  validateScenario,
  validateTour,
} from "./experiment.ts";
import { strictParse } from "./strictParse.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.resolve(__dirname, "__fixtures__/experiment");

// ============================================================================
// 1. EXPERIMENT MANIFEST TESTS
// ============================================================================

test("Experiment: valid YAML manifest passes schema validation", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml");
  const exp = validateExperiment(raw);

  assert.equal(exp.id, "bm-01");
  assert.equal(exp.title, "Tracer Ensemble in Microscopic Diffusion");
  assert.equal(exp.parameters.length, 4);
  assert.equal(exp.outputs.length, 2);
  assert.ok(exp.outputs.some((o) => o.primary));
  assert.equal(exp.realRate.natural, true);
  if (exp.realRate.natural) {
    assert.equal(typeof exp.realRate.scaleBar.length, "number");
    assert.equal(typeof exp.realRate.scaleBar.unit, "string");
  }
  assert.equal(exp.notModeled.length, 3);
  assert.equal(exp.views.length, 3);
  assert.deepEqual(
    exp.views.map((v) => v.kind),
    ["svg", "canvas", "table"],
  );
  assert.equal(exp.actions.length, 1);
  assert.equal(exp.actions[0]?.actionId, "sample-displacement");
  assert.equal(exp.actions[0]?.family, "probability-diffusion");
  assert.ok("enabled" in exp.predictMode && exp.predictMode.enabled);
  if ("enabled" in exp.predictMode && exp.predictMode.enabled) {
    assert.equal(exp.predictMode.prompts.length, 1);
    assert.equal(exp.predictMode.prompts[0]?.candidates.length, 3);
  }
});

test("Experiment: Planted Negative - empty notModeled fails audit", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.notModeled = [];

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "empty-not-modeled");
      return true;
    },
  );
});

test("Experiment: Planted Negative - three view without spatial justification or webgl fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  // Add a three view without spatialJustification
  raw.views.push({
    id: "three-view",
    kind: "three",
    consumes: ["tracerPositions"],
    requires: ["webgl"],
  });

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-spatial-justification");
      return true;
    },
  );

  // Add spatialJustification but omit webgl from requires
  raw.views[raw.views.length - 1] = {
    id: "three-view",
    kind: "three",
    consumes: ["tracerPositions"],
    spatialJustification: "3D trajectories show spatial dispersion",
    requires: [],
  };

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "three-view-missing-webgl");
      return true;
    },
  );
});

test("Experiment: Planted Negative - canvas view without canvas-2d fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  const canvasView = raw.views.find((v: any) => v.kind === "canvas");
  canvasView.requires = []; // Omit canvas-2d

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "canvas-view-missing-canvas-2d");
      return true;
    },
  );
});

test("Experiment: Planted Negative - canvas or three without fallback table/text view fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  // Remove table view, keeping only canvas view
  raw.views = [
    {
      id: "canvas-view",
      kind: "canvas",
      consumes: ["tracerPositions"],
      requires: ["canvas-2d"],
    },
  ];

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "canvas-or-three-missing-fallback-view");
      return true;
    },
  );
});

test("Experiment: Planted Negative - all views requiring capabilities fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.views = [
    {
      id: "canvas-1",
      kind: "canvas",
      consumes: ["tracerPositions"],
      requires: ["canvas-2d"],
    },
    {
      id: "three-1",
      kind: "three",
      consumes: ["tracerPositions"],
      spatialJustification: "3D view",
      requires: ["webgl"],
    },
    {
      id: "table-1",
      kind: "table",
      consumes: ["tracerPositions"],
    },
  ];

  // If table view illegally declares a requirement, all views have requirements
  raw.views[2].requires = ["canvas-2d"];

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "table-text-view-declares-capability");
      return true;
    },
  );
});

test("Experiment: Planted Negative - predictMode candidate count not equal to 3 fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  // Drop to 2 candidates
  raw.predictMode.prompts[0].candidates.pop();

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "predict-candidates-count");
      return true;
    },
  );
});

test("Experiment: Planted Negative - predict candidate missing separatingAssumption fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  delete raw.predictMode.prompts[0].candidates[0].separatingAssumption;

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-separating-assumption");
      return true;
    },
  );
});

test("Experiment: Planted Negative - predictMode exemption without reason fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.predictMode = { exempt: true, reason: "" };

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-predict-exemption-reason");
      return true;
    },
  );
});

test("Experiment: Planted Negative - gridParameterId missing, mismatched, or chained fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  // Missing target
  raw.parameters[3].mapping.gridParameterId = "nonExistentParam";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-grid-parameter");
      return true;
    },
  );

  // Mismatched dimension (temperature vs time)
  raw.parameters[3].mapping.gridParameterId = "temperature";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "grid-parameter-dimension-mismatch");
      return true;
    },
  );

  // Chained grid step
  const chainedRaw = strictParse(yaml, "yaml") as any;
  chainedRaw.parameters.push({
    id: "baseTime",
    label: "Base Time",
    accessibleName: "Base time",
    accessibleDescription: "Base time",
    quantityId: "time",
    displayUnit: "s",
    modelDomain: { min: 0.001, max: 0.1 },
    visualRange: { min: 0.001, max: 0.1 },
    default: 0.01,
    mapping: { kind: "linear" },
    role: "independent",
    commandClass: "setup-change",
  });
  chainedRaw.parameters[2].mapping = { kind: "step", gridParameterId: "baseTime" };
  chainedRaw.parameters[3].mapping = { kind: "step", gridParameterId: "gridStep" };
  assert.throws(
    () => validateExperiment(chainedRaw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "grid-parameter-chain-forbidden");
      return true;
    },
  );
});

test("Experiment: Planted Negative - traceRows exceeding 12 rows fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  // Create 13 trace rows
  const rows = [];
  for (let i = 0; i < 13; i++) {
    rows.push({
      label: `Row ${i}`,
      expression: `expr_${i}`,
      value: i,
      unit: "m",
    });
  }
  raw.owner.traceRows = rows;

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "trace-rows-exceeded");
      return true;
    },
  );
});

test("Experiment: Planted Negative - pseudocode kernel function declaring module/exportName fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.owner.kernelFunctions[0] = {
    displayRole: "pseudocode",
    module: "src/some/module.ts",
    exportName: "someFunc",
  };

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "pseudocode-with-exec-fields");
      return true;
    },
  );
});

test("Experiment: Planted Negative - preset scenarioId mismatch fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.presets[0].scenarioId = "different-scenario-id";

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "preset-scenario-id-mismatch");
      return true;
    },
  );
});

test("Experiment: Planted Negative - drag-only action without accessible alternative fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.actions = [
    {
      actionId: "drag-particle",
      family: "probability-diffusion",
      question: "What happens when you drag the particle?",
      inputs: ["temperature"],
      commandClass: "physical-intervention",
      acceptedResult: {
        outputs: ["tracerPositions"],
        allowedStatuses: ["value"],
      },
      visualAffordance: "Drag the particle on canvas",
      equivalentAffordance: "Drag the pointer across the screen",
      announcement: "Particle dragged",
    },
  ];

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "drag-only-action-forbidden");
      return true;
    },
  );
});

test("Experiment: Planted Negative - action missing equivalent affordance fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.actions = [
    {
      actionId: "adjust-temperature",
      family: "probability-diffusion",
      question: "How does temperature affect diffusion?",
      inputs: ["temperature"],
      commandClass: "physical-intervention",
      acceptedResult: {
        outputs: ["tracerPositions"],
        allowedStatuses: ["value"],
      },
      visualAffordance: "Drag the temperature slider",
      equivalentAffordance: "",
      announcement: "Temperature adjusted",
    },
  ];

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-equivalent-affordance");
      return true;
    },
  );
});

test("Experiment: Planted Negative - duplicate actionId in actions fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.actions = [raw.actions[0], { ...raw.actions[0] }];

  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "duplicate-action-id");
      return true;
    },
  );
});

test("Experiment: Planted Negative - missing primary output fails with missing-primary-output", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  for (const out of raw.outputs) out.primary = false;
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-primary-output");
      return true;
    },
  );
});

test("Experiment: Planted Negative - missing realRate fails with missing-real-rate", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  delete raw.realRate;
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-real-rate");
      return true;
    },
  );
});

test("Experiment: Planted Negative - natural: true without scaleBar fails with missing-real-rate-scalebar", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.realRate = { natural: true, quantity: "diffusivity" };
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-real-rate-scalebar");
      return true;
    },
  );
});

// ============================================================================
// 2. SCENARIO TESTS
// ============================================================================

test("Scenario: valid Scenario passes schema validation", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml");
  const scen = validateScenario(raw);

  assert.equal(scen.id, "bm-01-golden");
  assert.equal(scen.kind, "modern-golden");
  assert.equal(scen.constantSetId, "modern-si-2019");
  assert.equal(scen.seed, "9007199254740992");
  assert.equal(scen.allocationId, "alloc-brownian-default-v1");
});

test("Scenario: Planted Negative - numeric seed in JSON/YAML is rejected", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.seed = 9007199254740992; // Passed as number

  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "numeric-seed-rejected");
      return true;
    },
  );
});

test("Scenario: Planted Negative - stochastic scenario missing allocationId fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  delete raw.allocationId;

  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "stochastic-missing-allocation-id");
      return true;
    },
  );
});

test("Scenario: Planted Negative - bitwise comparison with tolerance fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.expected.outputs[0].comparisonKind = "bitwise";
  raw.expected.outputs[0].tolerance = {
    relative: 0.01,
    rationale: "Bitwise does not allow tolerance",
  };

  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "bitwise-tolerance-forbidden");
      return true;
    },
  );
});

test("Scenario: Planted Negative - rounds-to comparison on modern-golden fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.expected.outputs[0].comparisonKind = "rounds-to";
  raw.expected.outputs[0].printedValue = "5.35";
  raw.expected.outputs[0].printedPrecision = { decimals: 2 };

  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "rounds-to-non-historical");
      return true;
    },
  );
});

test("Scenario: Planted Negative - historical fixture missing provenance or transcription fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.kind = "historical-fixture";

  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "historical-missing-provenance");
      return true;
    },
  );

  raw.provenance = { paper: "brownian-motion", sectionId: "bm-sec-01", printedPage: 549 };

  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "historical-missing-transcription");
      return true;
    },
  );
});

test("Scenario: Planted Negative - identity scenario with invalid routes fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.kind = "identity";
  raw.routes = [{ routeId: "r1", owner: "owner-1", description: "Route 1" }]; // Only 1 route

  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "identity-routes-count");
      return true;
    },
  );

  // 2 routes sharing same owner
  raw.routes = [
    { routeId: "r1", owner: "same-owner", description: "Route 1" },
    { routeId: "r2", owner: "same-owner", description: "Route 2" },
  ];

  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "identity-routes-same-owner");
      return true;
    },
  );
});

test("Scenario: Planted Negative - discrimination scenario with same owner on hypotheses fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.kind = "discrimination";
  raw.hypotheses = [
    {
      id: "h1",
      label: "Hyp 1",
      owner: "owner-same",
      modelIdentity: "m1",
      circumstancesInWhichItWorks: "c1",
      historicalStatus: "original-1905",
    },
    {
      id: "h2",
      label: "Hyp 2",
      owner: "owner-same",
      modelIdentity: "m2",
      circumstancesInWhichItWorks: "c2",
      historicalStatus: "contemporary-alternative",
    },
  ];
  raw.observation = { observableId: "diffusivity", inputs: {}, procedure: "measure" };
  raw.expected = { outcome: "discriminates" };

  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "discrimination-hypotheses-same-owner");
      return true;
    },
  );
});

test("Scenario: Planted Negative - retired constantSet field is rejected", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.constantSet = raw.constantSetId;
  delete raw.constantSetId;

  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "retired-constant-set-field");
      return true;
    },
  );
});

test("Scenario: (experiment.ts:1941) missing-id rejected when id is missing or empty, accepted with id", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.id = "   ";
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-id");
      return true;
    },
  );
  raw.id = "valid-scenario-id";
  const accepted = validateScenario(raw);
  assert.equal(accepted.id, "valid-scenario-id");
});

test("Scenario: (experiment.ts:1949) invalid-scenario-kind rejected when kind is unknown, accepted for standard kinds", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.kind = "unsupported-scenario-kind";
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-scenario-kind");
      return true;
    },
  );
  raw.kind = "modern-golden";
  const accepted = validateScenario(raw);
  assert.equal(accepted.kind, "modern-golden");
});

test("Scenario: (experiment.ts:1960) adversarial-missing-plausible-mistake rejected when mistake empty, accepted with mistake", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.kind = "adversarial";
  raw.intendedFailure = "Violates energy conservation";
  delete raw.plausibleMistake;
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "adversarial-missing-plausible-mistake");
      return true;
    },
  );
  raw.plausibleMistake = "Omitting back-EMF term";
  const accepted = validateScenario(raw);
  assert.equal(accepted.plausibleMistake, "Omitting back-EMF term");
});

test("Scenario: (experiment.ts:1968) adversarial-missing-intended-failure rejected when failure empty, accepted with failure", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.kind = "adversarial";
  raw.plausibleMistake = "Omitting back-EMF term";
  delete raw.intendedFailure;
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "adversarial-missing-intended-failure");
      return true;
    },
  );
  raw.intendedFailure = "Current diverges at high frequency";
  const accepted = validateScenario(raw);
  assert.equal(accepted.intendedFailure, "Current diverges at high frequency");
});

test("Scenario: (experiment.ts:1987) missing-constant-set-id rejected when empty or missing, accepted with valid id", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.constantSetId = "";
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-constant-set-id");
      return true;
    },
  );
  raw.constantSetId = "einstein-1905-brownian-printed";
  const accepted = validateScenario(raw);
  assert.equal(accepted.constantSetId, "einstein-1905-brownian-printed");
});

test("Scenario: (experiment.ts:2070) invalid-constant-set-mixing rejected when mixing invalid, accepted when declared with reason", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.constantSetMixing = { declared: false, reason: "" };
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-constant-set-mixing");
      return true;
    },
  );
  raw.constantSetMixing = { declared: true, reason: "Comparing historical parameters against CODATA 2018" };
  const accepted = validateScenario(raw);
  assert.equal(accepted.constantSetMixing?.declared, true);
  assert.equal(accepted.constantSetMixing?.reason, "Comparing historical parameters against CODATA 2018");
});

test("Scenario: (experiment.ts:2125) misprint-missing-evidence rejected when misprint lacks reading or receiptRef, accepted with evidence", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.kind = "historical-fixture";
  raw.provenance = { paper: "brownian-motion", sectionId: "sec-1", printedPage: 550 };
  raw.transcription = { status: "verified-suspected-misprint", facsimilePage: 550 };
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "misprint-missing-evidence");
      return true;
    },
  );
  raw.transcription.printedReading = "0.0016";
  raw.transcription.receiptRef = "receipt-ap-17-549-misprint";
  raw.expected = { outputs: [{ outputId: "D", comparisonKind: "rounds-to", printedValue: "0.0016", printedPrecision: { decimals: 4 } }] };
  const accepted = validateScenario(raw);
  assert.equal(accepted.transcription?.status, "verified-suspected-misprint");
});

test("Scenario: (experiment.ts:2159) editorial-input-missing-fields rejected when source or reason missing, accepted when present", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.editorialInputs = [{ source: "Editorial note 1" }]; // missing reason
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "editorial-input-missing-fields");
      return true;
    },
  );
  raw.editorialInputs[0].reason = "Converts historical units to modern SI";
  const accepted = validateScenario(raw);
  assert.equal(accepted.editorialInputs?.length, 1);
});

test("Scenario: (experiment.ts:2173) documented-alternative-missing-printed-rep rejected when printedRepresentation missing, accepted with rep", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.documentedAlternatives = [{ description: "Alternative formula form" }];
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "documented-alternative-missing-printed-rep");
      return true;
    },
  );
  raw.documentedAlternatives[0].printedRepresentation = "D = RT / (6 pi eta N r)";
  const accepted = validateScenario(raw);
  assert.equal(accepted.documentedAlternatives?.length, 1);
});

test("Scenario: (experiment.ts:2221) discrimination-missing-hypotheses rejected when fewer than 2 hypotheses, accepted with 2", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.kind = "discrimination";
  raw.hypotheses = [
    { id: "h1", label: "Hyp 1", owner: "owner-1", modelIdentity: "m1", circumstancesInWhichItWorks: "c1", historicalStatus: "original-1905" },
  ];
  raw.observation = { observableId: "diffusivity", inputs: {}, procedure: "measure" };
  raw.expected = { outcome: "discriminates" };
  raw.tolerance = { relative: 0.05, rationale: "apparatus limit" };
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "discrimination-missing-hypotheses");
      return true;
    },
  );
  raw.hypotheses.push({ id: "h2", label: "Hyp 2", owner: "owner-2", modelIdentity: "m2", circumstancesInWhichItWorks: "c2", historicalStatus: "contemporary-alternative" });
  const accepted = validateScenario(raw);
  assert.equal(accepted.hypotheses?.length, 2);
});

test("Scenario: (experiment.ts:2244) discrimination-missing-observation rejected when observation missing, accepted with observation", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.kind = "discrimination";
  raw.hypotheses = [
    { id: "h1", label: "Hyp 1", owner: "owner-1", modelIdentity: "m1", circumstancesInWhichItWorks: "c1", historicalStatus: "original-1905" },
    { id: "h2", label: "Hyp 2", owner: "owner-2", modelIdentity: "m2", circumstancesInWhichItWorks: "c2", historicalStatus: "contemporary-alternative" },
  ];
  delete raw.observation;
  raw.expected = { outcome: "discriminates" };
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "discrimination-missing-observation");
      return true;
    },
  );
  raw.observation = { observableId: "diffusivity", inputs: {}, procedure: "measure" };
  raw.tolerance = { relative: 0.05, rationale: "apparatus limit" };
  const accepted = validateScenario(raw);
  assert.equal(accepted.observation?.observableId, "diffusivity");
});

test("Scenario: (experiment.ts:2287) missing-expected rejected when expected block missing, accepted with expected", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  delete raw.expected;
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-expected");
      return true;
    },
  );
  raw.expected = { outputs: [{ outputId: "D", comparisonKind: "bitwise" }] };
  const accepted = validateScenario(raw);
  assert.equal(accepted.expected.outputs.length, 1);
});

test("Scenario: (experiment.ts:2298) discrimination-missing-outcome rejected when outcome invalid or missing, accepted with valid outcome", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.kind = "discrimination";
  raw.hypotheses = [
    { id: "h1", label: "Hyp 1", owner: "owner-1", modelIdentity: "m1", circumstancesInWhichItWorks: "c1", historicalStatus: "original-1905" },
    { id: "h2", label: "Hyp 2", owner: "owner-2", modelIdentity: "m2", circumstancesInWhichItWorks: "c2", historicalStatus: "contemporary-alternative" },
  ];
  raw.observation = { observableId: "diffusivity", inputs: {}, procedure: "measure" };
  raw.tolerance = { relative: 0.05, rationale: "apparatus limit" };
  raw.expected = { outcome: "unknown-outcome" };
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "discrimination-missing-outcome");
      return true;
    },
  );
  raw.expected.outcome = "discriminates";
  const accepted = validateScenario(raw);
  assert.equal(accepted.expected.outcome, "discriminates");
});

test("Scenario: (experiment.ts:2346) tolerance-comparison-missing-spec rejected when tolerance spec invalid, accepted with rationale", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.expected = {
    outputs: [
      { outputId: "D", comparisonKind: "tolerance", tolerance: {} },
    ],
  };
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "tolerance-comparison-missing-spec");
      return true;
    },
  );
  raw.expected.outputs[0].tolerance = { relative: 0.01, rationale: "Experimental tolerance requirement" };
  const accepted = validateScenario(raw);
  assert.equal(accepted.expected.outputs[0]?.comparisonKind, "tolerance");
});

test("Scenario: (experiment.ts:2363) rounds-to-tolerance-forbidden rejected when tolerance supplied, accepted without tolerance", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.kind = "historical-fixture";
  raw.provenance = { paper: "brownian-motion", sectionId: "sec-1", printedPage: 550 };
  raw.transcription = { status: "verified", facsimilePage: 550 };
  raw.expected = {
    outputs: [
      {
        outputId: "D",
        comparisonKind: "rounds-to",
        printedValue: "1.5",
        printedPrecision: { decimals: 1 },
        tolerance: { absolute: 0.01 },
      },
    ],
  };
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "rounds-to-tolerance-forbidden");
      return true;
    },
  );
  delete raw.expected.outputs[0].tolerance;
  const accepted = validateScenario(raw);
  assert.equal(accepted.expected.outputs[0]?.comparisonKind, "rounds-to");
});

test("Scenario: (experiment.ts:2371) rounds-to-missing-printed-spec rejected when printedValue missing, accepted with spec", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.kind = "historical-fixture";
  raw.provenance = { paper: "brownian-motion", sectionId: "sec-1", printedPage: 550 };
  raw.transcription = { status: "verified", facsimilePage: 550 };
  raw.expected = {
    outputs: [
      {
        outputId: "D",
        comparisonKind: "rounds-to",
      },
    ],
  };
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "rounds-to-missing-printed-spec");
      return true;
    },
  );
  raw.expected.outputs[0].printedValue = "1.5";
  raw.expected.outputs[0].printedPrecision = { decimals: 1 };
  const accepted = validateScenario(raw);
  assert.equal(accepted.expected.outputs[0]?.printedValue, "1.5");
});

test("Scenario: (experiment.ts:2379) half-even-missing-reason rejected when reason missing, accepted with reason", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.kind = "historical-fixture";
  raw.provenance = { paper: "brownian-motion", sectionId: "sec-1", printedPage: 550 };
  raw.transcription = { status: "verified", facsimilePage: 550 };
  raw.expected = {
    outputs: [
      {
        outputId: "D",
        comparisonKind: "rounds-to",
        printedValue: "1.5",
        printedPrecision: { decimals: 1 },
        roundingConvention: "half-even",
      },
    ],
  };
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "half-even-missing-reason");
      return true;
    },
  );
  raw.expected.outputs[0].roundingReason = "Banker's rounding applied by author";
  const accepted = validateScenario(raw);
  assert.equal(accepted.expected.outputs[0]?.roundingConvention, "half-even");
});

test("Scenario: (experiment.ts:2415) invalid-comparison-kind rejected when kind unknown, accepted for bitwise", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.expected = {
    outputs: [
      {
        outputId: "D",
        comparisonKind: "invalid-comparison",
      },
    ],
  };
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-comparison-kind");
      return true;
    },
  );
  raw.expected.outputs[0].comparisonKind = "bitwise";
  const accepted = validateScenario(raw);
  assert.equal(accepted.expected.outputs[0]?.comparisonKind, "bitwise");
});

// ============================================================================
// 3. HISTORICAL DATASET TESTS
// ============================================================================

test("HistoricalDataset: valid dataset with all 3 cell kinds passes validation", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml");
  const ds = validateHistoricalDataset(raw);

  assert.equal(ds.id, "perrin-1909-table-1");
  assert.equal(ds.evidenceStatus, "historical-measurement");
  assert.equal(ds.columns.length, 3);
  assert.equal(ds.rows.length, 2);
  assert.equal(ds.rows[0]?.cells[0]?.kind, "number");
  assert.equal(ds.rows[1]?.cells[1]?.kind, "missing");
  assert.equal(ds.rows[1]?.cells[2]?.kind, "bound");
  assert.equal(ds.allowedInferenceModelIds.length, 1);
  assert.equal(ds.addressesResults?.length, 1);
});

test("HistoricalDataset: Planted Negative - bare number in cell array is rejected", () => {
  assert.throws(
    () => validateDataCell(42 as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "bare-number-cell-rejected");
      return true;
    },
  );
});

test("DataCell: (experiment.ts:2626) invalid-data-cell rejected when raw is not an object, accepted when valid", () => {
  assert.throws(
    () => validateDataCell("not-an-object" as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-data-cell");
      return true;
    },
  );
  assert.throws(
    () => validateDataCell(null as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-data-cell");
      return true;
    },
  );
  const accepted = validateDataCell({ kind: "number", value: 42 });
  assert.equal(accepted.kind, "number");
  assert.equal(accepted.value, 42);
});

test("DataCell: (experiment.ts:2638) missing-cell-number-value rejected on non-numeric value, accepted when valid", () => {
  assert.throws(
    () => validateDataCell({ kind: "number", value: "not-a-number" } as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-cell-number-value");
      return true;
    },
  );
  assert.throws(
    () => validateDataCell({ kind: "number", value: Number.NaN } as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-cell-number-value");
      return true;
    },
  );
  const accepted = validateDataCell({ kind: "number", value: 3.14159, originalToken: "3.14" });
  assert.equal(accepted.kind, "number");
  assert.equal(accepted.value, 3.14159);
  assert.equal(accepted.originalToken, "3.14");
});

test("DataCell: (experiment.ts:2652) missing-cell-reason rejected when reason missing or empty, accepted with reason", () => {
  assert.throws(
    () => validateDataCell({ kind: "missing" } as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-cell-reason");
      return true;
    },
  );
  assert.throws(
    () => validateDataCell({ kind: "missing", reason: "   " } as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-cell-reason");
      return true;
    },
  );
  const accepted = validateDataCell({ kind: "missing", reason: "Data point lost during exposure" });
  assert.equal(accepted.kind, "missing");
  assert.equal(accepted.reason, "Data point lost during exposure");
});

test("DataCell: (experiment.ts:2662) invalid-bound-direction rejected when direction not upper/lower, accepted when valid", () => {
  assert.throws(
    () => validateDataCell({ kind: "bound", direction: "sideways", value: 10 } as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-bound-direction");
      return true;
    },
  );
  const acceptedUpper = validateDataCell({ kind: "bound", direction: "upper", value: 10 });
  assert.equal(acceptedUpper.kind, "bound");
  assert.equal(acceptedUpper.direction, "upper");
});

test("DataCell: (experiment.ts:2670) missing-bound-value rejected on non-numeric value, accepted with number", () => {
  assert.throws(
    () => validateDataCell({ kind: "bound", direction: "lower", value: "bad" } as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-bound-value");
      return true;
    },
  );
  assert.throws(
    () => validateDataCell({ kind: "bound", direction: "lower", value: Number.NaN } as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-bound-value");
      return true;
    },
  );
  const acceptedLower = validateDataCell({ kind: "bound", direction: "lower", value: 0.05 });
  assert.equal(acceptedLower.kind, "bound");
  assert.equal(acceptedLower.value, 0.05);
});

test("DataCell: (experiment.ts:2684) invalid-cell-kind rejected on unknown kind, accepted for known kinds", () => {
  assert.throws(
    () => validateDataCell({ kind: "unsupported-cell-type" } as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-cell-kind");
      return true;
    },
  );
  const numCell = validateDataCell({ kind: "number", value: 1 });
  const missCell = validateDataCell({ kind: "missing", reason: "omitted" });
  const bndCell = validateDataCell({ kind: "bound", direction: "upper", value: 2 });
  assert.equal(numCell.kind, "number");
  assert.equal(missCell.kind, "missing");
  assert.equal(bndCell.kind, "bound");
});

test("HistoricalDataset: Planted Negative - cell count mismatch against columns fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  // Add an extra cell in row 0
  raw.rows[0].cells.push({ kind: "number", value: 99.9 });

  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "cell-count-mismatch");
      return true;
    },
  );
});

test("HistoricalDataset: Planted Negative - publication locator missing table/figure number fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  delete raw.publications[0].locator.number;

  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-table-figure-number");
      return true;
    },
  );
});

test("HistoricalDataset: Planted Negative - reported-fit column missing fitDescription fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  delete raw.columns[2].fitDescription;

  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-fit-description");
      return true;
    },
  );
});

test("HistoricalDataset: Planted Negative - retired boolean derived flag is rejected", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.columns[0].derived = true;

  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "retired-derived-boolean-flag");
      return true;
    },
  );
});

test("HistoricalDataset: Planted Negative - absent allowedInferenceModelIds fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  delete raw.allowedInferenceModelIds;

  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-allowed-inference-models");
      return true;
    },
  );
});

test("HistoricalDataset: Planted Negative - forbidden result relations (confirmed/proved) fail", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.addressesResults[0].relation = "confirmed";

  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-result-relation");
      return true;
    },
  );
});

// ============================================================================
// 4. TOUR TESTS
// ============================================================================

test("Tour: valid Tour passes schema validation", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "tour-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml");
  const tour = validateTour(raw);

  assert.equal(tour.id, "tour-brownian-overview");
  assert.equal(tour.budget, "fifteen-minutes");
  assert.equal(tour.steps.length, 2);
  assert.equal(tour.requiresEquations, false);
});

test("Tour: Planted Negative - fifteen-minutes tour with requiresEquations: true fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "tour-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.requiresEquations = true;

  assert.throws(
    () => validateTour(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "fifteen-minutes-requires-equations-forbidden");
      return true;
    },
  );
});

test("Tour: Planted Negative - step declaring both promptId and tourPrediction fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "tour-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.steps[1].tourPrediction = "Custom prediction question";

  assert.throws(
    () => validateTour(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "prompt-id-and-tour-prediction-collision");
      return true;
    },
  );
});

test("Tour: Planted Negative - step declaring both tapeId and presetId fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "tour-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.steps[0].instrumentPreset.tapeId = "some-tape";

  assert.throws(
    () => validateTour(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "tape-and-preset-both-present");
      return true;
    },
  );
});

test("Tour: (experiment.ts:3404) invalid-record rejected when raw is not an object, accepted when valid", () => {
  assert.throws(
    () => validateTour("not-an-object" as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-record");
      return true;
    },
  );
  assert.throws(
    () => validateTour(null as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-record");
      return true;
    },
  );
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "tour-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml");
  const accepted = validateTour(raw);
  assert.equal(accepted.id, "tour-brownian-overview");
});

test("Tour: (experiment.ts:3409) missing-id rejected when id is missing or empty, accepted with id", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "tour-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.id = "   ";
  assert.throws(
    () => validateTour(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-id");
      return true;
    },
  );
  raw.id = "custom-tour-id";
  const accepted = validateTour(raw);
  assert.equal(accepted.id, "custom-tour-id");
});

test("Tour: (experiment.ts:3412) invalid-tour-budget rejected when budget is unknown, accepted for standard budgets", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "tour-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.budget = "two-hours";
  assert.throws(
    () => validateTour(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-tour-budget");
      return true;
    },
  );
  raw.budget = "one-evening";
  const accepted = validateTour(raw);
  assert.equal(accepted.budget, "one-evening");
});

test("Tour: (experiment.ts:3432) missing-completion-statement rejected when completionStatement is missing or empty, accepted with statement", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "tour-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  delete raw.completionStatement;
  assert.throws(
    () => validateTour(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-completion-statement");
      return true;
    },
  );
  raw.completionStatement = "You have completed the tour.";
  const accepted = validateTour(raw);
  assert.equal(accepted.completionStatement, "You have completed the tour.");
});

test("Tour: (experiment.ts:3441) missing-tour-steps rejected when steps is empty or not array, accepted with non-empty array", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "tour-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.steps = [];
  assert.throws(
    () => validateTour(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-tour-steps");
      return true;
    },
  );
  const accepted = validateTour(strictParse(yaml, "yaml"));
  assert.ok(accepted.steps.length > 0);
});

test("Tour: (experiment.ts:3454) invalid-tour-step rejected when step is not an object, accepted when step is valid object", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "tour-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.steps[0] = "not-an-object";
  assert.throws(
    () => validateTour(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-tour-step");
      return true;
    },
  );
  const accepted = validateTour(strictParse(yaml, "yaml"));
  assert.equal(typeof accepted.steps[0], "object");
});

test("Tour: (experiment.ts:3462) missing-step-anchor-id rejected when step anchorId is missing or empty, accepted with anchorId", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "tour-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.steps[0].anchorId = "";
  assert.throws(
    () => validateTour(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-step-anchor-id");
      return true;
    },
  );
  raw.steps[0].anchorId = "step-01-anchor";
  const accepted = validateTour(raw);
  assert.equal(accepted.steps[0]?.anchorId, "step-01-anchor");
});

test("Tour: (experiment.ts:3484) invalid-preset-id rejected when presetId format is malformed, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "tour-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.steps[0].instrumentPreset = {
    instrumentId: "bm-01",
    presetId: "invalid/preset/id",
  };
  assert.throws(
    () => validateTour(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-preset-id");
      return true;
    },
  );
  raw.steps[0].instrumentPreset.presetId = "bm-01-default-tracer";
  const accepted = validateTour(raw);
  assert.equal(accepted.steps[0]?.instrumentPreset?.presetId, "bm-01-default-tracer");
});

// ============================================================================
// 5. CONSTANT SET TESTS
// ============================================================================

test("ConstantSet: valid ConstantSet passes schema validation", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "constant-set-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml");
  const cs = validateConstantSet(raw);

  assert.equal(cs.id, "einstein-1905-brownian-printed");
  assert.equal(cs.entries.length, 2);
  assert.equal(cs.entries[0]?.printedStatus, "editorial-input");
  assert.equal(cs.entries[1]?.printedStatus, "printed");
});

test("ConstantSet: Planted Negative - retired constant set id fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "constant-set-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.id = "einstein-1905-brownian";

  assert.throws(
    () => validateConstantSet(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "retired-constant-set-id");
      return true;
    },
  );
});

test("ConstantSet: Planted Negative - exact-defined entry with uncertainty fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "constant-set-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.id = "modern-si-2019";
  raw.entries[0].kind = "exact-defined";
  raw.entries[0].uncertainty = 0.01;

  assert.throws(
    () => validateConstantSet(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "exact-defined-has-uncertainty");
      return true;
    },
  );
});

test("ConstantSet: Planted Negative - measured entry without uncertainty fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "constant-set-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  raw.id = "modern-si-2019";
  raw.entries[0].kind = "measured";
  delete raw.entries[0].uncertainty;

  assert.throws(
    () => validateConstantSet(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "measured-missing-uncertainty");
      return true;
    },
  );
});

test("ConstantSet: Planted Negative - printed-historical entry missing printedStatus fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "constant-set-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  delete raw.entries[0].printedStatus;

  assert.throws(
    () => validateConstantSet(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-printed-status");
      return true;
    },
  );
});

test("ConstantSet: Planted Negative - editorial-input missing reason or sensitivity fails", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "constant-set-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;

  delete raw.entries[0].reason;

  assert.throws(
    () => validateConstantSet(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "editorial-input-missing-reason-sensitivity");
      return true;
    },
  );
});

test("ConstantSet: (experiment.ts:3592) invalid-record rejected when raw is not an object, accepted when valid", () => {
  assert.throws(
    () => validateConstantSet("not-an-object" as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-record");
      return true;
    },
  );
  assert.throws(
    () => validateConstantSet(null as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-record");
      return true;
    },
  );
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "constant-set-valid.yaml"), "utf8");
  const accepted = validateConstantSet(strictParse(yaml, "yaml"));
  assert.equal(accepted.id, "einstein-1905-brownian-printed");
});

test("ConstantSet: (experiment.ts:3602) missing-id rejected when id is missing or empty, accepted with id", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "constant-set-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.id = "   ";
  assert.throws(
    () => validateConstantSet(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-id");
      return true;
    },
  );
  raw.id = "modern-si-2019";
  raw.entries[0].kind = "exact-defined";
  delete raw.entries[0].uncertainty;
  raw.entries[1].kind = "exact-defined";
  delete raw.entries[1].uncertainty;
  const accepted = validateConstantSet(raw);
  assert.equal(accepted.id, "modern-si-2019");
});

test("ConstantSet: (experiment.ts:3625) invalid-gas-constant-provenance rejected when provenance is invalid, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "constant-set-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.gasConstantProvenance = "guessed";
  assert.throws(
    () => validateConstantSet(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-gas-constant-provenance");
      return true;
    },
  );
  raw.gasConstantProvenance = "measured-without-counting-molecules";
  const accepted = validateConstantSet(raw);
  assert.equal(accepted.gasConstantProvenance, "measured-without-counting-molecules");
});

test("ConstantSet: (experiment.ts:3634) missing-entries rejected when entries is empty or not array, accepted with non-empty entries", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "constant-set-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.entries = [];
  assert.throws(
    () => validateConstantSet(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-entries");
      return true;
    },
  );
  const accepted = validateConstantSet(strictParse(yaml, "yaml"));
  assert.ok(accepted.entries.length > 0);
});

test("ConstantSet: (experiment.ts:3649) invalid-entry rejected when entry is not an object, accepted when entry is object", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "constant-set-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.entries[0] = "not-an-object";
  assert.throws(
    () => validateConstantSet(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-entry");
      return true;
    },
  );
  const accepted = validateConstantSet(strictParse(yaml, "yaml"));
  assert.equal(typeof accepted.entries[0], "object");
});

test("ConstantSet: (experiment.ts:3657) invalid-entry-kind rejected when entry kind is unknown, accepted for standard kinds", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "constant-set-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.entries[0].kind = "unsupported-kind";
  assert.throws(
    () => validateConstantSet(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-entry-kind");
      return true;
    },
  );
  const accepted = validateConstantSet(strictParse(yaml, "yaml"));
  assert.equal(accepted.entries[0]?.kind, "printed-historical");
});
