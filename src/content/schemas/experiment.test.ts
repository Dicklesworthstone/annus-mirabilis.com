import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  checkAccessibleEquivalence,
  ExperimentValidationError,
  validateActionContract,
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

test("Experiment: (experiment.ts:259) missing-visual-affordance rejected when visualAffordance empty, accepted with visualAffordance", () => {
  assert.throws(
    () =>
      checkAccessibleEquivalence({
        actionId: "act-1",
        visualAffordance: "   ",
        equivalentAffordance: "Type value into stepper",
        announcement: "Value updated",
      }),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-visual-affordance");
      return true;
    },
  );
  assert.doesNotThrow(() =>
    checkAccessibleEquivalence({
      actionId: "act-1",
      visualAffordance: "Drag slider handle",
      equivalentAffordance: "Type value into stepper",
      announcement: "Value updated",
    }),
  );
});

test("Experiment: (experiment.ts:325) invalid-action-contract rejected when raw is not object, accepted when valid", () => {
  assert.throws(
    () => validateActionContract("not-an-object"),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-action-contract");
      return true;
    },
  );
  assert.throws(
    () => validateActionContract(null),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-action-contract");
      return true;
    },
  );
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const accepted = validateActionContract(raw.actions[0]);
  assert.equal(accepted.actionId, "sample-displacement");
});

test("Experiment: (experiment.ts:336) missing-action-id rejected when actionId missing or whitespace, accepted with actionId", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const act = { ...raw.actions[0], actionId: "   " };
  assert.throws(
    () => validateActionContract(act),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-action-id");
      return true;
    },
  );
  act.actionId = "sample-displacement";
  const accepted = validateActionContract(act);
  assert.equal(accepted.actionId, "sample-displacement");
});

test("Experiment: (experiment.ts:366) missing-action-question rejected when question too short or missing, accepted with question", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const act = { ...raw.actions[0], question: "Why?" };
  assert.throws(
    () => validateActionContract(act),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-action-question");
      return true;
    },
  );
  act.question = "How does displacement change over time?";
  const accepted = validateActionContract(act);
  assert.equal(accepted.question, "How does displacement change over time?");
});

test("Experiment: (experiment.ts:400) missing-action-command-class rejected when commandClass missing, accepted with commandClass", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const act = { ...raw.actions[0], commandClass: "" };
  assert.throws(
    () => validateActionContract(act),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-action-command-class");
      return true;
    },
  );
  act.commandClass = "physical-intervention";
  const accepted = validateActionContract(act);
  assert.equal(accepted.commandClass, "physical-intervention");
});

test("Experiment: (experiment.ts:429) invalid-accepted-result rejected when outputs is not an array, accepted when array", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const act = {
    ...raw.actions[0],
    acceptedResult: {
      outputs: "not-an-array",
      allowedStatuses: ["value"],
    },
  };
  assert.throws(
    () => validateActionContract(act),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-accepted-result");
      return true;
    },
  );
  act.acceptedResult.outputs = ["meanSquaredDisplacement"];
  const accepted = validateActionContract(act);
  assert.deepEqual(accepted.acceptedResult.outputs, ["meanSquaredDisplacement"]);
});

test("Experiment: (experiment.ts:439) invalid-accepted-result rejected when allowedStatuses is empty, accepted with statuses", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const act = {
    ...raw.actions[0],
    acceptedResult: {
      outputs: ["meanSquaredDisplacement"],
      allowedStatuses: [],
    },
  };
  assert.throws(
    () => validateActionContract(act),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-accepted-result");
      return true;
    },
  );
  act.acceptedResult.allowedStatuses = ["value"];
  const accepted = validateActionContract(act);
  assert.deepEqual(accepted.acceptedResult.allowedStatuses, ["value"]);
});

test("Experiment: (experiment.ts:623) invalid-record rejected when raw is not an object, accepted when object", () => {
  assert.throws(
    () => validateExperiment("not-an-object"),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-record");
      return true;
    },
  );
  assert.throws(
    () => validateExperiment(null),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-record");
      return true;
    },
  );
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml");
  const accepted = validateExperiment(raw);
  assert.ok(accepted);
});

test("Experiment: (experiment.ts:634) missing-id rejected when id is not a string, accepted with id", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  delete raw.id;
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-id");
      return true;
    },
  );
  raw.id = "bm-01";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.id, "bm-01");
});

test("Experiment: (experiment.ts:642) invalid-instrument-id rejected when instrumentId format invalid, accepted for valid format", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.id = "bad_instrument_format";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-instrument-id");
      return true;
    },
  );
  raw.id = "bm-01";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.id, "bm-01");
});

test("Experiment: (experiment.ts:653) missing-title rejected when title missing or empty, accepted with title", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.title = "   ";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-title");
      return true;
    },
  );
  raw.title = "Valid Experiment Title";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.title, "Valid Experiment Title");
});

test("Experiment: (experiment.ts:660) missing-question rejected when explanatoryQuestion is missing or empty, accepted with question", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.explanatoryQuestion = "";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-question");
      return true;
    },
  );
  raw.explanatoryQuestion = "How do microscopic particles diffuse?";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.explanatoryQuestion, "How do microscopic particles diffuse?");
});

test("Experiment: (experiment.ts:668) missing-source-refs rejected when sourceRefs is not array, accepted when array", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.sourceRefs = "not-an-array";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-source-refs");
      return true;
    },
  );
  raw.sourceRefs = ["src-einstein-1905-sec-4"];
  const accepted = validateExperiment(raw);
  assert.deepEqual(accepted.sourceRefs, ["src-einstein-1905-sec-4"]);
});

test("Experiment: (experiment.ts:676) missing-argument-ids rejected when argumentIds is not array, accepted when array", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.argumentIds = null;
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-argument-ids");
      return true;
    },
  );
  raw.argumentIds = ["arg-diffusion-equilibrium"];
  const accepted = validateExperiment(raw);
  assert.deepEqual(accepted.argumentIds, ["arg-diffusion-equilibrium"]);
});

test("Experiment: (experiment.ts:684) invalid-schema-version rejected when schemaVersion not positive number, accepted with positive", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.schemaVersion = 0;
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-schema-version");
      return true;
    },
  );
  raw.schemaVersion = 1;
  const accepted = validateExperiment(raw);
  assert.equal(accepted.schemaVersion, 1);
});

test("Experiment: (experiment.ts:694) missing-parameters rejected when parameters empty or not array, accepted with parameters", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.parameters = [];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-parameters");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateExperiment(raw2);
  assert.ok(accepted.parameters.length > 0);
});

test("Experiment: (experiment.ts:708) invalid-parameter rejected when parameter element not an object, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.parameters[0] = "not-a-parameter-object";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-parameter");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateExperiment(raw2);
  assert.ok(accepted.parameters[0]?.id);
});

test("Experiment: (experiment.ts:717) missing-param-id rejected when parameter id missing or empty, accepted with id", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.parameters[0].id = "   ";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-param-id");
      return true;
    },
  );
  raw.parameters[0].id = "temperature";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.parameters[0]?.id, "temperature");
});

test("Experiment: (experiment.ts:725) missing-param-quantity-id rejected when quantityId missing or empty, accepted with quantityId", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.parameters[0].quantityId = "";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-param-quantity-id");
      return true;
    },
  );
  raw.parameters[0].quantityId = "temperature";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.parameters[0]?.quantityId, "temperature");
});

test("Experiment: (experiment.ts:733) missing-model-domain rejected when modelDomain missing or not object, accepted with domain", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  delete raw.parameters[0].modelDomain;
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-model-domain");
      return true;
    },
  );
  raw.parameters[0].modelDomain = { min: 273.15, max: 373.15 };
  const accepted = validateExperiment(raw);
  assert.equal(accepted.parameters[0]?.modelDomain.min, 273.15);
});

test("Experiment: (experiment.ts:741) missing-visual-range rejected when visualRange missing or not object, accepted with range", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  delete raw.parameters[0].visualRange;
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-visual-range");
      return true;
    },
  );
  raw.parameters[0].visualRange = { min: 280, max: 320 };
  const accepted = validateExperiment(raw);
  assert.equal(accepted.parameters[0]?.visualRange.min, 280);
});

test("Experiment: (experiment.ts:749) missing-param-mapping rejected when mapping missing or not object, accepted with mapping", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  delete raw.parameters[0].mapping;
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-param-mapping");
      return true;
    },
  );
  raw.parameters[0].mapping = { kind: "linear" };
  const accepted = validateExperiment(raw);
  assert.equal(accepted.parameters[0]?.mapping.kind, "linear");
});

test("Experiment: (experiment.ts:758) invalid-param-mapping-kind rejected when mapping kind unknown, accepted with standard kind", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.parameters[0].mapping = { kind: "exponential" };
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-param-mapping-kind");
      return true;
    },
  );
  raw.parameters[0].mapping = { kind: "log" };
  const accepted = validateExperiment(raw);
  assert.equal(accepted.parameters[0]?.mapping.kind, "log");
});

test("Experiment: (experiment.ts:766) invalid-command-class rejected when commandClass unknown, accepted with standard class", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.parameters[0].commandClass = "unknown-command-class";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-command-class");
      return true;
    },
  );
  raw.parameters[0].commandClass = "setup-change";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.parameters[0]?.commandClass, "setup-change");
});

test("Experiment: (experiment.ts:837) missing-outputs rejected when outputs empty or not array, accepted with outputs", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.outputs = [];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-outputs");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateExperiment(raw2);
  assert.ok(accepted.outputs.length > 0);
});

test("Experiment: (experiment.ts:852) invalid-output rejected when output item not an object, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.outputs[0] = "not-an-output-object";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-output");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateExperiment(raw2);
  assert.ok(accepted.outputs[0]?.id);
});

test("Experiment: (experiment.ts:861) missing-output-id rejected when output id missing or whitespace, accepted with id", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.outputs[0].id = "   ";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-output-id");
      return true;
    },
  );
  raw.outputs[0].id = "tracerPositions";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.outputs[0]?.id, "tracerPositions");
});

test("Experiment: (experiment.ts:869) missing-output-quantity-id rejected when output quantityId missing, accepted with quantityId", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.outputs[0].quantityId = "";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-output-quantity-id");
      return true;
    },
  );
  raw.outputs[0].quantityId = "displacement";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.outputs[0]?.quantityId, "displacement");
});

test("Experiment: (experiment.ts:877) missing-allowed-statuses rejected when allowedStatuses empty, accepted with statuses", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.outputs[0].allowedStatuses = [];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-allowed-statuses");
      return true;
    },
  );
  raw.outputs[0].allowedStatuses = ["value"];
  const accepted = validateExperiment(raw);
  assert.deepEqual(accepted.outputs[0]?.allowedStatuses, ["value"]);
});

test("Experiment: (experiment.ts:886) invalid-output-status rejected when status unknown, accepted for standard status", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.outputs[0].allowedStatuses = ["unknown-status"];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-output-status");
      return true;
    },
  );
  raw.outputs[0].allowedStatuses = ["value", "outside-domain"];
  const accepted = validateExperiment(raw);
  assert.deepEqual(accepted.outputs[0]?.allowedStatuses, ["value", "outside-domain"]);
});

test("Experiment: (experiment.ts:929) missing-assumptions rejected when assumptions is not array, accepted when array", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.assumptions = "not-an-array";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-assumptions");
      return true;
    },
  );
  raw.assumptions = [{ id: "asm-stokes", label: "Stokes law holds" }];
  const accepted = validateExperiment(raw);
  assert.equal(accepted.assumptions.length, 1);
});

test("Experiment: (experiment.ts:937) missing-admitted-domain rejected when admittedDomain empty or whitespace, accepted with domain", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.admittedDomain = "   ";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-admitted-domain");
      return true;
    },
  );
  raw.admittedDomain = "Microscopic particles suspended in fluid at room temperature.";
  const accepted = validateExperiment(raw);
  assert.equal(
    accepted.admittedDomain,
    "Microscopic particles suspended in fluid at room temperature.",
  );
});

test("Experiment: (experiment.ts:947) missing-owner rejected when owner missing or not object, accepted with owner", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  delete raw.owner;
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-owner");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateExperiment(raw2);
  assert.ok(accepted.owner.kind);
});

test("Experiment: (experiment.ts:957) invalid-owner-kind rejected when owner kind unknown, accepted for valid kinds", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.owner.kind = "unsupported-owner";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-owner-kind");
      return true;
    },
  );
  raw.owner.kind = "reference-evaluator";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.owner.kind, "reference-evaluator");
});

test("Experiment: (experiment.ts:966) missing-static-reason rejected when static owner lacks staticReason, accepted with reason", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.owner = {
    kind: "static",
    staticReason: "   ",
  };
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-static-reason");
      return true;
    },
  );
  raw.owner.staticReason = "Purely theoretical derivation with analytical closed form.";
  const accepted = validateExperiment(raw);
  assert.equal(
    accepted.owner.staticReason,
    "Purely theoretical derivation with analytical closed form.",
  );
});

test("Experiment: (experiment.ts:974) static-owner-has-functions rejected when static owner declares kernel functions, accepted without functions", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.owner = {
    kind: "static",
    staticReason: "Pure theoretical derivation",
    kernelFunctions: [
      {
        displayRole: "reference",
        language: "typescript",
        name: "evalDiffusivity",
        module: "src/physics/reference/brownian.ts",
        exportName: "evalDiffusivity",
      },
    ],
  };
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "static-owner-has-functions");
      return true;
    },
  );
  raw.owner.kernelFunctions = [];
  const accepted = validateExperiment(raw);
  assert.equal(accepted.owner.kind, "static");
});

test("Experiment: (experiment.ts:982) static-owner-has-trace rejected when static owner declares trace rows, accepted without trace", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.owner = {
    kind: "static",
    staticReason: "Pure theoretical derivation",
    traceScenarioId: "scenario-01",
  };
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "static-owner-has-trace");
      return true;
    },
  );
  delete raw.owner.traceScenarioId;
  const accepted = validateExperiment(raw);
  assert.equal(accepted.owner.kind, "static");
});

test("Experiment: (experiment.ts:998) invalid-kernel-function rejected when function item is not object, accepted when object", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.owner.kernelFunctions = ["not-an-object"];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-kernel-function");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateExperiment(raw2);
  assert.ok(accepted);
});

test("Experiment: (experiment.ts:1007) invalid-kernel-display-role rejected when displayRole unknown, accepted for valid role", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.owner.kernelFunctions[0].displayRole = "unknown-role";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-kernel-display-role");
      return true;
    },
  );
  raw.owner.kernelFunctions[0].displayRole = "reference-implementation";
  const accepted = validateExperiment(raw);
  const kf0 = accepted.owner.kernelFunctions?.[0];
  if (!kf0) throw new Error("expected accepted.owner.kernelFunctions[0] to be defined");
  assert.equal(kf0.displayRole, "reference-implementation");
});

test("Experiment: (experiment.ts:1027) missing-ts-kernel-fields rejected when TS kernel lacks module/exportName, accepted with both", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.owner.kernelFunctions = [
    {
      displayRole: "reference-implementation",
      language: "ts",
      module: "",
      exportName: "",
    },
  ];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-ts-kernel-fields");
      return true;
    },
  );
  raw.owner.kernelFunctions[0].module = "src/physics/reference/brownian.ts";
  raw.owner.kernelFunctions[0].exportName = "evalDiffusivity";
  const accepted = validateExperiment(raw);
  const kf0 = accepted.owner.kernelFunctions?.[0];
  if (!kf0) throw new Error("expected accepted.owner.kernelFunctions[0] to be defined");
  assert.equal(kf0.module, "src/physics/reference/brownian.ts");
});

test("Experiment: (experiment.ts:1036) missing-rust-kernel-fields rejected when Rust kernel lacks fields, accepted with all", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.owner.kernelFunctions = [
    {
      displayRole: "reference-implementation",
      language: "rust",
      crate: "frankensim-core",
    },
  ];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-rust-kernel-fields");
      return true;
    },
  );
  raw.owner.kernelFunctions[0] = {
    displayRole: "reference-implementation",
    language: "rust",
    crate: "frankensim-core",
    path: "src/diffusion.rs",
    fnName: "step_diffusion",
    revision: "v1.0.0",
  };
  const accepted = validateExperiment(raw);
  const kf0 = accepted.owner.kernelFunctions?.[0];
  if (!kf0) throw new Error("expected accepted.owner.kernelFunctions[0] to be defined");
  assert.equal(kf0.crate, "frankensim-core");
});

test("Experiment: (experiment.ts:1044) missing-kernel-language rejected when language not ts or rust, accepted with valid language", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.owner.kernelFunctions = [
    {
      displayRole: "reference-implementation",
      language: "python",
    },
  ];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-kernel-language");
      return true;
    },
  );
  raw.owner.kernelFunctions = [
    {
      displayRole: "reference-implementation",
      language: "ts",
      module: "src/physics/reference/brownian.ts",
      exportName: "evalDiffusivity",
    },
  ];
  const accepted = validateExperiment(raw);
  const kf0 = accepted.owner.kernelFunctions?.[0];
  if (!kf0) throw new Error("expected accepted.owner.kernelFunctions[0] to be defined");
  assert.equal(kf0.language, "ts");
});

test("Experiment: (experiment.ts:1103) missing-views rejected when views empty or not array, accepted with views", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.views = [];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-views");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateExperiment(raw2);
  assert.ok(accepted.views.length > 0);
});

test("Experiment: (experiment.ts:1119) invalid-view rejected when view element not object, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.views[0] = "not-a-view-object";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-view");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateExperiment(raw2);
  assert.ok(accepted.views[0]?.id);
});

test("Experiment: (experiment.ts:1128) invalid-view-kind rejected when view kind unknown, accepted with standard kind", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.views[0].kind = "webgl-mesh";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-view-kind");
      return true;
    },
  );
  raw.views[0].kind = "svg";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.views[0]?.kind, "svg");
});

test("Experiment: (experiment.ts:1178) svg-view-declares-capability rejected when svg declares requires, accepted without requires", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const svgView = raw.views.find((v: any) => v.kind === "svg");
  svgView.requires = ["canvas-2d"];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "svg-view-declares-capability");
      return true;
    },
  );
  delete svgView.requires;
  const accepted = validateExperiment(raw);
  assert.ok(accepted);
});

test("Experiment: (experiment.ts:1210) all-views-require-capabilities invariant ensures at least one view has no capabilities requirement", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const accepted = validateExperiment(raw);
  assert.ok(accepted.views.some((v) => !v.requires || v.requires.length === 0));
});

test("Experiment: (experiment.ts:1231) missing-real-rate-quantity rejected when natural: true lacks quantity, accepted with quantity", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.realRate = { natural: true, quantity: "   ", scaleBar: { length: 1, unit: "m" } };
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-real-rate-quantity");
      return true;
    },
  );
  raw.realRate.quantity = "length";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.realRate.natural, true);
});

test("Experiment: (experiment.ts:1255) invalid-real-rate rejected when natural not boolean, accepted with boolean", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.realRate = { natural: "neither-true-nor-false" };
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-real-rate");
      return true;
    },
  );
  raw.realRate = { natural: false };
  const accepted = validateExperiment(raw);
  assert.equal(accepted.realRate.natural, false);
});

test("Experiment: (experiment.ts:1265) missing-predict-mode rejected when predictMode missing or not object, accepted with predictMode", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  delete raw.predictMode;
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-predict-mode");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateExperiment(raw2);
  assert.ok(accepted.predictMode);
});

test("Experiment: (experiment.ts:1287) missing-predict-prompts rejected when enabled is true but prompts empty, accepted with prompts", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.predictMode = { enabled: true, prompts: [] };
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-predict-prompts");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateExperiment(raw2);
  assert.ok("enabled" in accepted.predictMode && accepted.predictMode.prompts.length > 0);
});

test("Experiment: (experiment.ts:1301) invalid-predict-prompt rejected when prompt element is not object, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.predictMode.prompts[0] = "not-a-prompt-object";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-predict-prompt");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateExperiment(raw2);
  assert.ok("enabled" in accepted.predictMode && accepted.predictMode.prompts[0]?.promptId);
});

test("Experiment: (experiment.ts:1310) missing-prompt-id rejected when promptId is missing, accepted with promptId", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  delete raw.predictMode.prompts[0].promptId;
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-prompt-id");
      return true;
    },
  );
  raw.predictMode.prompts[0].promptId = "bm-01-predict-radius-effect";
  const accepted = validateExperiment(raw);
  assert.ok("enabled" in accepted.predictMode && accepted.predictMode.prompts[0]?.promptId);
});

test("Experiment: (experiment.ts:1319) invalid-predict-prompt-id rejected when promptId format invalid, accepted with valid format", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.predictMode.prompts[0].promptId = "invalid_prompt_id";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-predict-prompt-id");
      return true;
    },
  );
  raw.predictMode.prompts[0].promptId = "bm-01-predict-radius-effect";
  const accepted = validateExperiment(raw);
  assert.ok("enabled" in accepted.predictMode && accepted.predictMode.prompts[0]?.promptId);
});

test("Experiment: (experiment.ts:1329) missing-prompt-target rejected when neither controlId nor actionId present, accepted with controlId", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  delete raw.predictMode.prompts[0].controlId;
  delete raw.predictMode.prompts[0].actionId;
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-prompt-target");
      return true;
    },
  );
  raw.predictMode.prompts[0].controlId = "particleRadius";
  const accepted = validateExperiment(raw);
  assert.ok("enabled" in accepted.predictMode && accepted.predictMode.prompts[0]?.controlId);
});

test("Experiment: (experiment.ts:1337) duplicate-prompt-target rejected when multiple prompts target same control/action, accepted when targets unique", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const p0 = raw.predictMode.prompts[0];
  raw.predictMode.prompts = [
    p0,
    {
      ...p0,
      promptId: "bm-01-predict-temperature-effect",
      controlId: p0.controlId,
    },
  ];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "duplicate-prompt-target");
      return true;
    },
  );
  raw.predictMode.prompts[1].controlId = "temperature";
  const accepted = validateExperiment(raw);
  assert.ok("enabled" in accepted.predictMode && accepted.predictMode.prompts.length === 2);
});

test("Experiment: (experiment.ts:1363) invalid-candidate rejected when candidate element not object, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.predictMode.prompts[0].candidates[0] = "not-a-candidate-object";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-candidate");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateExperiment(raw2);
  assert.ok(
    "enabled" in accepted.predictMode && accepted.predictMode.prompts[0]?.candidates[0]?.id,
  );
});

test("Experiment: (experiment.ts:1372) missing-candidate-id rejected when candidate id missing or whitespace, accepted with id", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.predictMode.prompts[0].candidates[0].id = "   ";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-candidate-id");
      return true;
    },
  );
  raw.predictMode.prompts[0].candidates[0].id = "halves";
  const accepted = validateExperiment(raw);
  assert.ok(
    "enabled" in accepted.predictMode &&
      accepted.predictMode.prompts[0]?.candidates[0]?.id === "halves",
  );
});

test("Experiment: (experiment.ts:1380) duplicate-candidate-id rejected when candidate id repeated, accepted when unique", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.predictMode.prompts[0].candidates[1].id = raw.predictMode.prompts[0].candidates[0].id;
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "duplicate-candidate-id");
      return true;
    },
  );
  raw.predictMode.prompts[0].candidates[1].id = "quarters";
  const accepted = validateExperiment(raw);
  assert.ok(
    "enabled" in accepted.predictMode &&
      accepted.predictMode.prompts[0]?.candidates[1]?.id === "quarters",
  );
});

test("Experiment: (experiment.ts:1430) invalid-predict-mode rejected when neither enabled nor exempt, accepted with exempt", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.predictMode = { neither: "enabled-nor-exempt" };
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-predict-mode");
      return true;
    },
  );
  raw.predictMode = { exempt: true, reason: "Expository verification instrument" };
  const accepted = validateExperiment(raw);
  assert.ok("exempt" in accepted.predictMode && accepted.predictMode.exempt);
});

test("Experiment: (experiment.ts:1454) missing-preset-id rejected when preset lacks presetId, accepted with presetId", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  delete raw.presets[0].presetId;
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-preset-id");
      return true;
    },
  );
  raw.presets[0].presetId = "bm-01-standard-water";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.presets[0]?.presetId, "bm-01-standard-water");
});

test("Experiment: (experiment.ts:1463) invalid-preset-id rejected when presetId format invalid, accepted with valid format", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.presets[0].presetId = "invalid_preset_id";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-preset-id");
      return true;
    },
  );
  raw.presets[0].presetId = "bm-01-standard-water";
  raw.presets[0].scenarioId = "bm-01-standard-water";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.presets[0]?.presetId, "bm-01-standard-water");
});

test("Experiment: (experiment.ts:1505) missing-refusal-acceptance-case rejected when outputs allow non-value but acceptanceCases empty, accepted with case", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.acceptanceCases = [];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-refusal-acceptance-case");
      return true;
    },
  );
  raw.acceptanceCases = ["bm-01-refusal-outside-domain"];
  const accepted = validateExperiment(raw);
  assert.ok(accepted.acceptanceCases?.length === 1);
});

test("Experiment: (experiment.ts:1520) invalid-mode rejected when mode element is not an object, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.modes = ["not-a-mode-object"];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-mode");
      return true;
    },
  );
  raw.modes = [
    {
      id: "bm-01:standard",
      label: "Standard Model",
      historicalStatus: "original-1905",
    },
  ];
  const accepted = validateExperiment(raw);
  assert.equal(accepted.modes?.[0]?.id, "bm-01:standard");
});

test("Experiment: (experiment.ts:1529) missing-mode-id rejected when mode lacks id, accepted with id", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.modes = [
    {
      label: "Standard Model",
      historicalStatus: "original-1905",
    },
  ];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-mode-id");
      return true;
    },
  );
  raw.modes[0].id = "bm-01:standard";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.modes?.[0]?.id, "bm-01:standard");
});

test("Experiment: (experiment.ts:1538) invalid-mode-id rejected when mode id format invalid, accepted with valid format", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.modes = [
    {
      id: "invalid_mode_format",
      label: "Standard Model",
      historicalStatus: "original-1905",
    },
  ];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-mode-id");
      return true;
    },
  );
  raw.modes[0].id = "bm-01:standard";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.modes?.[0]?.id, "bm-01:standard");
});

test("Experiment: (experiment.ts:1546) invalid-historical-status rejected when historicalStatus unknown, accepted for valid status", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.modes = [
    {
      id: "bm-01:standard",
      label: "Standard Model",
      historicalStatus: "invented-status",
    },
  ];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-historical-status");
      return true;
    },
  );
  raw.modes[0].historicalStatus = "contemporary-alternative";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.modes?.[0]?.historicalStatus, "contemporary-alternative");
});

test("Experiment: (experiment.ts:1555) missing-lens-label rejected when later-development mode lacks lensLabel, accepted with lensLabel", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.modes = [
    {
      id: "bm-01:relativistic",
      label: "Relativistic Diffusion",
      historicalStatus: "later-development",
      lensLabel: "   ",
    },
  ];
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-lens-label");
      return true;
    },
  );
  raw.modes[0].lensLabel = "Post-1905 perspective";
  const accepted = validateExperiment(raw);
  assert.equal(accepted.modes?.[0]?.lensLabel, "Post-1905 perspective");
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

test("Scenario: (experiment.ts:1932) invalid-record rejected when raw is not an object, accepted when object", () => {
  assert.throws(
    () => validateScenario("not-an-object" as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-record");
      return true;
    },
  );
  assert.throws(
    () => validateScenario(null as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-record");
      return true;
    },
  );
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml");
  const accepted = validateScenario(raw);
  assert.ok(accepted);
});

test("Scenario: (experiment.ts:1942) missing-id rejected when id is missing or empty, accepted with id", () => {
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
  raw.constantSetMixing = {
    declared: true,
    reason: "Comparing historical parameters against CODATA 2018",
  };
  const accepted = validateScenario(raw);
  assert.equal(accepted.constantSetMixing?.declared, true);
  assert.equal(
    accepted.constantSetMixing?.reason,
    "Comparing historical parameters against CODATA 2018",
  );
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
  raw.expected = {
    outputs: [
      {
        outputId: "D",
        comparisonKind: "rounds-to",
        printedValue: "0.0016",
        printedPrecision: { decimals: 4 },
      },
    ],
  };
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
    {
      id: "h1",
      label: "Hyp 1",
      owner: "owner-1",
      modelIdentity: "m1",
      circumstancesInWhichItWorks: "c1",
      historicalStatus: "original-1905",
    },
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
  raw.hypotheses.push({
    id: "h2",
    label: "Hyp 2",
    owner: "owner-2",
    modelIdentity: "m2",
    circumstancesInWhichItWorks: "c2",
    historicalStatus: "contemporary-alternative",
  });
  const accepted = validateScenario(raw);
  assert.equal(accepted.hypotheses?.length, 2);
});

test("Scenario: (experiment.ts:2244) discrimination-missing-observation rejected when observation missing, accepted with observation", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.kind = "discrimination";
  raw.hypotheses = [
    {
      id: "h1",
      label: "Hyp 1",
      owner: "owner-1",
      modelIdentity: "m1",
      circumstancesInWhichItWorks: "c1",
      historicalStatus: "original-1905",
    },
    {
      id: "h2",
      label: "Hyp 2",
      owner: "owner-2",
      modelIdentity: "m2",
      circumstancesInWhichItWorks: "c2",
      historicalStatus: "contemporary-alternative",
    },
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
  if (!accepted.expected.outputs) {
    throw new Error("expected accepted.expected.outputs to be defined");
  }
  assert.equal(accepted.expected.outputs.length, 1);
});

test("Scenario: (experiment.ts:2298) discrimination-missing-outcome rejected when outcome invalid or missing, accepted with valid outcome", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "scenario-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.kind = "discrimination";
  raw.hypotheses = [
    {
      id: "h1",
      label: "Hyp 1",
      owner: "owner-1",
      modelIdentity: "m1",
      circumstancesInWhichItWorks: "c1",
      historicalStatus: "original-1905",
    },
    {
      id: "h2",
      label: "Hyp 2",
      owner: "owner-2",
      modelIdentity: "m2",
      circumstancesInWhichItWorks: "c2",
      historicalStatus: "contemporary-alternative",
    },
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
    outputs: [{ outputId: "D", comparisonKind: "tolerance", tolerance: {} }],
  };
  assert.throws(
    () => validateScenario(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "tolerance-comparison-missing-spec");
      return true;
    },
  );
  raw.expected.outputs[0].tolerance = {
    relative: 0.01,
    rationale: "Experimental tolerance requirement",
  };
  const accepted = validateScenario(raw);
  const out0 = accepted.expected.outputs?.[0];
  if (!out0) throw new Error("expected accepted.expected.outputs[0] to be defined");
  assert.equal(out0.comparisonKind, "tolerance");
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
  const out0 = accepted.expected.outputs?.[0];
  if (!out0) throw new Error("expected accepted.expected.outputs[0] to be defined");
  assert.equal(out0.comparisonKind, "rounds-to");
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
  const out0 = accepted.expected.outputs?.[0];
  if (!out0) throw new Error("expected accepted.expected.outputs[0] to be defined");
  assert.equal(out0.printedValue, "1.5");
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
  const out0 = accepted.expected.outputs?.[0];
  if (!out0) throw new Error("expected accepted.expected.outputs[0] to be defined");
  assert.equal(out0.roundingConvention, "half-even");
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
  const out0 = accepted.expected.outputs?.[0];
  if (!out0) throw new Error("expected accepted.expected.outputs[0] to be defined");
  assert.equal(out0.comparisonKind, "bitwise");
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

test("HistoricalDataset: (experiment.ts:2723) invalid-record rejected when raw is not an object, accepted when object", () => {
  assert.throws(
    () => validateHistoricalDataset("not-an-object" as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-record");
      return true;
    },
  );
  assert.throws(
    () => validateHistoricalDataset(null as any),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-record");
      return true;
    },
  );
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml");
  const accepted = validateHistoricalDataset(raw);
  assert.ok(accepted);
});

test("HistoricalDataset: (experiment.ts:2733) missing-id rejected when id is missing or whitespace, accepted with id", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.id = "   ";
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-id");
      return true;
    },
  );
  raw.id = "perrin-1909-table-1";
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.id, "perrin-1909-table-1");
});

test("HistoricalDataset: (experiment.ts:2741) missing-title rejected when title missing or empty, accepted with title", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.title = "";
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-title");
      return true;
    },
  );
  raw.title = "Valid Title";
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.title, "Valid Title");
});

test("HistoricalDataset: (experiment.ts:2724) invalid-evidence-status rejected when status unknown, accepted for valid statuses", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.evidenceStatus = "unverified-lore";
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-evidence-status");
      return true;
    },
  );
  raw.evidenceStatus = "modern-observation";
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.evidenceStatus, "modern-observation");
});

test("HistoricalDataset: a withdrawn record keeps its rows and must say when and why it was withdrawn", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const rowCount = raw.rows.length;
  raw.evidenceStatus = "withdrawn";
  // missing-withdrawal: no withdrawal block at all, then a reason with no date, then an empty reason.
  for (const withdrawal of [
    undefined,
    { reason: "Rows could not be traced to the printed table." },
    { date: "2026-09-24", reason: "  " },
    { date: "24 September 2026", reason: "Rows could not be traced to the printed table." },
  ]) {
    raw.withdrawal = withdrawal;
    if (withdrawal === undefined) delete raw.withdrawal;
    assert.throws(
      () => validateHistoricalDataset(raw),
      (err: any) => {
        assert.ok(err instanceof ExperimentValidationError);
        assert.equal(err.code, "missing-withdrawal");
        return true;
      },
    );
  }
  raw.withdrawal = { date: "2026-09-24", reason: "Rows could not be traced to the printed table." };
  const withdrawn = validateHistoricalDataset(raw);
  assert.equal(withdrawn.evidenceStatus, "withdrawn");
  assert.deepEqual(withdrawn.withdrawal, {
    date: "2026-09-24",
    reason: "Rows could not be traced to the printed table.",
  });
  // Withdrawal is not deletion: the rows stay on the record for review.
  assert.equal(withdrawn.rows.length, rowCount);
  assert.ok(rowCount > 0);
});

test("HistoricalDataset: unexpected-withdrawal rejected on a standing measurement, absent when none is given", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.evidenceStatus = "historical-measurement";
  raw.withdrawal = { date: "2026-09-24", reason: "A reason on a record that stands." };
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "unexpected-withdrawal");
      return true;
    },
  );
  delete raw.withdrawal;
  const standing = validateHistoricalDataset(raw);
  assert.equal(standing.evidenceStatus, "historical-measurement");
  assert.equal(standing.withdrawal, undefined);
});

test("HistoricalDataset: (experiment.ts:2734) missing-publications rejected when publications empty or non-array, accepted with entries", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.publications = [];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-publications");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateHistoricalDataset(raw2);
  assert.equal(accepted.publications.length, 1);
});

test("HistoricalDataset: (experiment.ts:2748) invalid-publication rejected when publication is not an object, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.publications = ["not-a-publication-object"];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-publication");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateHistoricalDataset(raw2);
  assert.equal(accepted.publications[0]?.id, "perrin-1909-ann-chim");
});

test("HistoricalDataset: (experiment.ts:2756) missing-publication-id rejected when publication id is missing or empty, accepted with id", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.publications[0].id = "   ";
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-publication-id");
      return true;
    },
  );
  raw.publications[0].id = "perrin-1909-ann-chim";
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.publications[0]?.id, "perrin-1909-ann-chim");
});

test("HistoricalDataset: (experiment.ts:2779) missing-publication-locator rejected when locator missing or not object, accepted with locator", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  delete raw.publications[0].locator;
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-publication-locator");
      return true;
    },
  );
  raw.publications[0].locator = { kind: "table", number: 1 };
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.publications[0]?.locator.kind, "table");
});

test("HistoricalDataset: (experiment.ts:2798) missing-unnumbered-table-page rejected when unnumbered-table lacks page number, accepted with page", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.publications[0].locator = { kind: "unnumbered-table" };
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-unnumbered-table-page");
      return true;
    },
  );
  raw.publications[0].locator = {
    kind: "unnumbered-table",
    page: 42,
    caption: "Table without number",
  };
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.publications[0]?.locator.kind, "unnumbered-table");
});

test("HistoricalDataset: (experiment.ts:2807) missing-text-locator-fields rejected when text locator lacks page or sentence, accepted with both", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.publications[0].locator = { kind: "text", page: 12 };
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-text-locator-fields");
      return true;
    },
  );
  raw.publications[0].locator = { kind: "text", page: 12, sentence: 3 };
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.publications[0]?.locator.kind, "text");
});

test("HistoricalDataset: (experiment.ts:2815) invalid-locator-kind rejected when locator kind unknown, accepted with standard kind", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.publications[0].locator = { kind: "footnote-reference", number: 4 };
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-locator-kind");
      return true;
    },
  );
  raw.publications[0].locator = { kind: "figure", number: 2 };
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.publications[0]?.locator.kind, "figure");
});

test("HistoricalDataset: (experiment.ts:2857) invalid-primary-publication-id rejected when primaryPublicationId does not match any publication, accepted when matched", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.primaryPublicationId = "unregistered-pub-id";
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-primary-publication-id");
      return true;
    },
  );
  raw.primaryPublicationId = "perrin-1909-ann-chim";
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.primaryPublicationId, "perrin-1909-ann-chim");
});

test("HistoricalDataset: (experiment.ts:2873) invalid-series rejected when series item is not an object, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.series = ["not-a-series-object"];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-series");
      return true;
    },
  );
  raw.series = [
    { id: "series-a", publicationId: "perrin-1909-ann-chim", description: "First run" },
  ];
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.series?.length, 1);
});

test("HistoricalDataset: (experiment.ts:2881) missing-series-id rejected when series lacks id or is empty, accepted with id", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.series = [{ id: "  ", publicationId: "perrin-1909-ann-chim" }];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-series-id");
      return true;
    },
  );
  raw.series = [{ id: "series-01", publicationId: "perrin-1909-ann-chim" }];
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.series?.[0]?.id, "series-01");
});

test("HistoricalDataset: (experiment.ts:2890) series-unknown-publication-id rejected when series publicationId is not declared, accepted with valid pub id", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.series = [{ id: "series-01", publicationId: "phantom-pub" }];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "series-unknown-publication-id");
      return true;
    },
  );
  raw.series = [{ id: "series-01", publicationId: "perrin-1909-ann-chim" }];
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.series?.[0]?.publicationId, "perrin-1909-ann-chim");
});

test("HistoricalDataset: (experiment.ts:2925) missing-digitizer rejected when digitizer block missing or not object, accepted with digitizer", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  delete raw.digitizer;
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-digitizer");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateHistoricalDataset(raw2);
  assert.equal(accepted.digitizer.name, "Editorial Team");
});

test("HistoricalDataset: (experiment.ts:2938) invalid-digitization-revision rejected when revision is not positive integer, accepted with positive integer", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.digitizer.digitizationRevision = 0;
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-digitization-revision");
      return true;
    },
  );
  raw.digitizer.digitizationRevision = 2;
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.digitizer.digitizationRevision, 2);
});

test("HistoricalDataset: (experiment.ts:2948) missing-columns rejected when columns array empty or non-array, accepted with columns", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.columns = [];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-columns");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateHistoricalDataset(raw2);
  assert.equal(accepted.columns.length, 3);
});

test("HistoricalDataset: (experiment.ts:2961) invalid-column rejected when column element is not an object, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.columns[0] = "not-a-column-object";
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-column");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateHistoricalDataset(raw2);
  assert.equal(accepted.columns[0]?.name, "Granule Radius");
});

test("HistoricalDataset: (experiment.ts:2977) invalid-column-role rejected when role not in COLUMN_ROLES, accepted for valid roles", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.columns[0].role = "imaginary-role";
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-column-role");
      return true;
    },
  );
  raw.columns[0].role = "observed";
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.columns[0]?.role, "observed");
});

test("HistoricalDataset: (experiment.ts:3010) invalid-row rejected when row item is not object with cells array, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.rows[0] = "not-a-row-object";
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-row");
      return true;
    },
  );
  const raw2 = strictParse(yaml, "yaml");
  const accepted = validateHistoricalDataset(raw2);
  assert.equal(accepted.rows.length, 2);
});

test("HistoricalDataset: (experiment.ts:3058) missing-result-statement rejected when addressesResults entry lacks statement, accepted with statement", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.addressesResults[0].statement = "   ";
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-result-statement");
      return true;
    },
  );
  raw.addressesResults[0].statement = "Direct experimental verification.";
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.addressesResults?.[0]?.statement, "Direct experimental verification.");
});

function makeValidFit() {
  const param: {
    name: string;
    quantityId: string;
    value: number;
    unit: string;
    source: string;
    sourceCitation?: string | undefined;
  } = {
    name: "mobility",
    quantityId: "mobility",
    value: 1.2e11,
    unit: "s/kg",
    source: "fitted-here",
  };
  return {
    id: "fit-perrin-mobility",
    label: "Linear least-squares fit",
    fitObjective: "Determine mobility from mean displacements",
    analysisDate: {
      type: "issue-publication",
      text: "1909",
      earliest: "1909-01-01",
      latest: "1909-12-31",
      precision: "year",
      source: "Annales de Chimie",
      verifiedAt: "2026-09-15",
    },
    rowsUsed: [0],
    rowsExcluded: [{ rowIndex: 1, reason: "Clouded emulsion" }],
    parameters: [param],
  };
}

test("HistoricalDataset: (experiment.ts:3081) invalid-fit rejected when fit is not an object, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.fits = ["not-a-fit-object"];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-fit");
      return true;
    },
  );
  raw.fits = [makeValidFit()];
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.length, 1);
});

test("HistoricalDataset: (experiment.ts:3089) missing-fit-id rejected when fit id missing or empty, accepted with id", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  fit.id = "   ";
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-fit-id");
      return true;
    },
  );
  fit.id = "valid-fit-id";
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.id, "valid-fit-id");
});

test("HistoricalDataset: (experiment.ts:3097) missing-fit-label rejected when fit label missing or empty, accepted with label", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  fit.label = "";
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-fit-label");
      return true;
    },
  );
  fit.label = "Linear fit";
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.label, "Linear fit");
});

test("HistoricalDataset: (experiment.ts:3105) missing-fit-objective rejected when fitObjective missing or empty, accepted with objective", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  fit.fitObjective = "   ";
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-fit-objective");
      return true;
    },
  );
  fit.fitObjective = "Estimate Avogadro number";
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.fitObjective, "Estimate Avogadro number");
});

test("HistoricalDataset: (experiment.ts:3128) fit-unknown-series-id rejected when seriesId not in series list, accepted when matching", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  raw.series = [{ id: "series-alpha", publicationId: "perrin-1909-ann-chim" }];
  const fit = makeValidFit();
  (fit as any).seriesId = "series-unknown";
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "fit-unknown-series-id");
      return true;
    },
  );
  (fit as any).seriesId = "series-alpha";
  fit.rowsUsed = [];
  fit.rowsExcluded = [];
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.seriesId, "series-alpha");
});

test("HistoricalDataset: (experiment.ts:3141) missing-rows-used rejected when rowsUsed is not array, accepted when array", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  delete (fit as any).rowsUsed;
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-rows-used");
      return true;
    },
  );
  fit.rowsUsed = [0];
  const accepted = validateHistoricalDataset(raw);
  assert.deepEqual(accepted.fits?.[0]?.rowsUsed, [0]);
});

test("HistoricalDataset: (experiment.ts:3149) missing-rows-excluded rejected when rowsExcluded is not array, accepted when array", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  delete (fit as any).rowsExcluded;
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-rows-excluded");
      return true;
    },
  );
  fit.rowsExcluded = [{ rowIndex: 1, reason: "Clouded emulsion" }];
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.rowsExcluded.length, 1);
});

test("HistoricalDataset: (experiment.ts:3160) invalid-row-used-index rejected when rowsUsed contains invalid index, accepted with valid index", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  fit.rowsUsed = [99];
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-row-used-index");
      return true;
    },
  );
  fit.rowsUsed = [0];
  const accepted = validateHistoricalDataset(raw);
  assert.deepEqual(accepted.fits?.[0]?.rowsUsed, [0]);
});

test("HistoricalDataset: (experiment.ts:3168) duplicate-row-used rejected when index repeated in rowsUsed, accepted when unique", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  fit.rowsUsed = [0, 0];
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "duplicate-row-used");
      return true;
    },
  );
  fit.rowsUsed = [0];
  const accepted = validateHistoricalDataset(raw);
  assert.deepEqual(accepted.fits?.[0]?.rowsUsed, [0]);
});

test("HistoricalDataset: (experiment.ts:3184) invalid-fit-exclusion rejected when exclusion item is not an object, accepted when object", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  fit.rowsExcluded = ["not-an-exclusion-object" as any];
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-fit-exclusion");
      return true;
    },
  );
  fit.rowsExcluded = [{ rowIndex: 1, reason: "Clouded emulsion" }];
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.rowsExcluded.length, 1);
});

test("HistoricalDataset: (experiment.ts:3197) invalid-row-excluded-index rejected when rowIndex is out of bounds, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  fit.rowsExcluded = [{ rowIndex: 99, reason: "Out of bounds" }];
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-row-excluded-index");
      return true;
    },
  );
  fit.rowsExcluded = [{ rowIndex: 1, reason: "Clouded emulsion" }];
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.rowsExcluded[0]?.rowIndex, 1);
});

test("HistoricalDataset: (experiment.ts:3213) duplicate-row-excluded rejected when rowIndex repeated in rowsExcluded, accepted when unique", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  fit.rowsExcluded = [
    { rowIndex: 1, reason: "Reason A" },
    { rowIndex: 1, reason: "Reason B" },
  ];
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "duplicate-row-excluded");
      return true;
    },
  );
  fit.rowsExcluded = [{ rowIndex: 1, reason: "Single reason" }];
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.rowsExcluded.length, 1);
});

test("HistoricalDataset: (experiment.ts:3247) missing-fit-parameters rejected when parameters empty or not array, accepted with parameters", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  fit.parameters = [];
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-fit-parameters");
      return true;
    },
  );
  fit.parameters = [
    {
      name: "mobility",
      quantityId: "mobility",
      value: 1.2e11,
      unit: "s/kg",
      source: "fitted-here",
    },
  ];
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.parameters.length, 1);
});

test("HistoricalDataset: (experiment.ts:3258) invalid-fit-parameter rejected when parameter element is not an object, accepted when valid", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  fit.parameters = ["not-a-param-object" as any];
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-fit-parameter");
      return true;
    },
  );
  fit.parameters = [
    {
      name: "mobility",
      quantityId: "mobility",
      value: 1.2e11,
      unit: "s/kg",
      source: "fitted-here",
    },
  ];
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.parameters[0]?.name, "mobility");
});

test("HistoricalDataset: (experiment.ts:3266) missing-fit-parameter-name rejected when parameter name missing or empty, accepted with name", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  const param0 = fit.parameters[0];
  if (!param0) throw new Error("expected fit.parameters[0] to be defined");
  param0.name = "   ";
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-fit-parameter-name");
      return true;
    },
  );
  param0.name = "mobility";
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.parameters[0]?.name, "mobility");
});

test("HistoricalDataset: (experiment.ts:3274) missing-fit-parameter-quantity-id rejected when quantityId missing or empty, accepted with quantityId", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  const param0 = fit.parameters[0];
  if (!param0) throw new Error("expected fit.parameters[0] to be defined");
  param0.quantityId = "";
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-fit-parameter-quantity-id");
      return true;
    },
  );
  param0.quantityId = "mobility";
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.parameters[0]?.quantityId, "mobility");
});

test("HistoricalDataset: (experiment.ts:3282) missing-fit-parameter-value rejected when value missing or NaN, accepted with number value", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  const param0 = fit.parameters[0];
  if (!param0) throw new Error("expected fit.parameters[0] to be defined");
  param0.value = NaN;
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-fit-parameter-value");
      return true;
    },
  );
  param0.value = 1.2e11;
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.parameters[0]?.value, 1.2e11);
});

test("HistoricalDataset: (experiment.ts:3290) missing-fit-parameter-unit rejected when unit is not a string, accepted with string unit", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  const param0 = fit.parameters[0];
  if (!param0) throw new Error("expected fit.parameters[0] to be defined");
  param0.unit = 42 as any;
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "missing-fit-parameter-unit");
      return true;
    },
  );
  param0.unit = "s/kg";
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.parameters[0]?.unit, "s/kg");
});

test("HistoricalDataset: (experiment.ts:3298) invalid-fit-parameter-source rejected when source not fitted-here or imported, accepted for valid source", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "dataset-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const fit = makeValidFit();
  const param0 = fit.parameters[0];
  if (!param0) throw new Error("expected fit.parameters[0] to be defined");
  param0.source = "estimated-from-graph";
  raw.fits = [fit];
  assert.throws(
    () => validateHistoricalDataset(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "invalid-fit-parameter-source");
      return true;
    },
  );
  param0.source = "imported";
  param0.sourceCitation = "Perrin (1909)";
  const accepted = validateHistoricalDataset(raw);
  assert.equal(accepted.fits?.[0]?.parameters[0]?.source, "imported");
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

test("Tour: (experiment.ts:3429) invalid-record rejected when raw is not an object, accepted when valid", () => {
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

test("Tour: (experiment.ts:3434) missing-id rejected when id is missing or empty, accepted with id", () => {
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

test("Tour: (experiment.ts:3509) invalid-preset-id rejected when presetId format is malformed, accepted when valid", () => {
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

test("ConstantSet: (experiment.ts:3617) invalid-record rejected when raw is not an object, accepted when valid", () => {
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

test("ConstantSet: (experiment.ts:3627) missing-id rejected when id is missing or empty, accepted with id", () => {
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

test("Experiment: a predict prompt's supportedCandidateId must be one of its own candidates (predict-supported-candidate-unknown)", () => {
  const yaml = fs.readFileSync(path.join(FIXTURES_DIR, "experiment-valid.yaml"), "utf8");
  const raw = strictParse(yaml, "yaml") as any;
  const prompt = raw.predictMode.prompts[0];
  // Absent: nothing is claimed, and nothing is invented.
  assert.equal(
    (validateExperiment(raw).predictMode as any).prompts[0].supportedCandidateId,
    undefined,
  );
  // One of its own candidates: kept.
  prompt.supportedCandidateId = prompt.candidates[1].id;
  const accepted = validateExperiment(raw) as any;
  assert.equal(accepted.predictMode.prompts[0].supportedCandidateId, prompt.candidates[1].id);
  // Anything else: refused, naming the prompt.
  prompt.supportedCandidateId = "not-a-candidate";
  assert.throws(
    () => validateExperiment(raw),
    (err: any) => {
      assert.ok(err instanceof ExperimentValidationError);
      assert.equal(err.code, "predict-supported-candidate-unknown");
      assert.ok(err.message.includes(prompt.promptId));
      return true;
    },
  );
});
