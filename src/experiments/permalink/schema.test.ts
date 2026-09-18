/**
 * Tape Schema V2 Validation Tests (Accept/Reject Pairs per Throw Site).
 *
 * Governed by am-muyh, am-inst-permalink-tape-s677, and doctrine 8 (typed refusal states).
 * Every throw site in src/experiments/permalink/schema.ts is exercised by an accept/reject pair.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { FIXTURE_TEACHING_TAPE_EINSTEIN_08 } from "./fixture.ts";
import {
  MAX_PERMALINK_TAPE_EVENTS,
  MAX_PREDICTION_SKETCH_POINTS,
  MAX_PREDICTION_VALUES_COUNT,
  TapeValidationError,
  validateTapeV2,
} from "./schema.ts";
import type { TapeControlEvent, TapeV2 } from "./types.ts";

function cloneTape(tape: TapeV2 = FIXTURE_TEACHING_TAPE_EINSTEIN_08): Record<string, unknown> {
  return JSON.parse(JSON.stringify(tape)) as Record<string, unknown>;
}

describe("Tape Schema V2 Validation (schema.ts)", () => {
  // 1. Top-Level Tape Structure
  test("tape-not-object: rejects non-object raw payload (schema.ts:44)", () => {
    assert.throws(
      () => validateTapeV2(null),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-not-object");
        assert.match(err.message, /Tape payload must be an object/);
        return true;
      },
    );
    assert.throws(
      () => validateTapeV2("not-an-object"),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-not-object");
        return true;
      },
    );
    assert.throws(
      () => validateTapeV2([]),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-not-object");
        return true;
      },
    );

    // Accept counterpart
    const valid = validateTapeV2(cloneTape());
    assert.equal(valid.tapeVersion, 2);
  });

  test("tape-version-unsupported: rejects non-v2 tapeVersion (schema.ts:51)", () => {
    const raw = cloneTape();
    raw.tapeVersion = 1;
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-version-unsupported");
        assert.match(err.message, /Unsupported tape version "1"/);
        return true;
      },
    );

    // Accept counterpart
    raw.tapeVersion = 2;
    const valid = validateTapeV2(raw);
    assert.equal(valid.tapeVersion, 2);
  });

  test("tape-missing-experiment-id: rejects missing or empty experimentId (schema.ts:60)", () => {
    const raw = cloneTape();
    raw.experimentId = "";
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-experiment-id");
        return true;
      },
    );
    raw.experimentId = 123;
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-experiment-id");
        return true;
      },
    );

    // Accept counterpart
    raw.experimentId = "bm-01";
    assert.equal(validateTapeV2(raw).experimentId, "bm-01");
  });

  test("tape-missing-mode: rejects missing or empty mode (schema.ts:69)", () => {
    const raw = cloneTape();
    raw.mode = "";
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-mode");
        return true;
      },
    );

    // Accept counterpart
    raw.mode = "bm-01:default";
    assert.equal(validateTapeV2(raw).mode, "bm-01:default");
  });

  test("tape-mode-is-preset-id: rejects preset id passed as mode (schema.ts:80)", () => {
    const raw = cloneTape();
    raw.mode = "bm-01-cold-preset";
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-mode-is-preset-id");
        assert.match(err.message, /appears to be a preset id/);
        return true;
      },
    );
    raw.mode = "bm-01-cold-viscous";
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-mode-is-preset-id");
        return true;
      },
    );

    // Accept counterpart
    raw.mode = "bm-01:cold-viscous";
    assert.equal(validateTapeV2(raw).mode, "bm-01:cold-viscous");
  });

  // 2. Model Identity
  test("tape-missing-model-identity: rejects non-object modelIdentity (schema.ts:89)", () => {
    const raw = cloneTape();
    raw.modelIdentity = null;
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-model-identity");
        return true;
      },
    );
    raw.modelIdentity = "model-identity";
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-model-identity");
        return true;
      },
    );

    // Accept counterpart
    raw.modelIdentity = { modelId: "m1", modelVersion: 1 };
    assert.equal(validateTapeV2(raw).modelIdentity.modelId, "m1");
  });

  test("tape-missing-model-id: rejects missing or empty modelId (schema.ts:97)", () => {
    const raw = cloneTape();
    raw.modelIdentity = { modelId: "  ", modelVersion: 1 };
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-model-id");
        return true;
      },
    );

    // Accept counterpart
    raw.modelIdentity = { modelId: "diffusion-v1", modelVersion: 1 };
    assert.equal(validateTapeV2(raw).modelIdentity.modelId, "diffusion-v1");
  });

  test("tape-missing-model-version: rejects non-finite modelVersion (schema.ts:104)", () => {
    const raw = cloneTape();
    raw.modelIdentity = { modelId: "m1", modelVersion: NaN };
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-model-version");
        return true;
      },
    );
    raw.modelIdentity = { modelId: "m1", modelVersion: "1" };
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-model-version");
        return true;
      },
    );

    // Accept counterpart
    raw.modelIdentity = { modelId: "m1", modelVersion: 2 };
    assert.equal(validateTapeV2(raw).modelIdentity.modelVersion, 2);
  });

  // 3. Constants & Seeds
  test("tape-missing-constant-set-id: rejects missing constantSetId (schema.ts:121)", () => {
    const raw = cloneTape();
    raw.constantSetId = "";
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-constant-set-id");
        return true;
      },
    );

    // Accept counterpart
    raw.constantSetId = "cs-1905";
    assert.equal(validateTapeV2(raw).constantSetId, "cs-1905");
  });

  test("u64-invalid-format: rejects malformed seed format via U64ValidationError (schema.ts:134)", () => {
    const raw = cloneTape();
    raw.seed = "not-a-number";
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "u64-invalid-format");
        return true;
      },
    );

    // Accept counterpart
    raw.seed = "1905";
    assert.equal(validateTapeV2(raw).seed, "1905");
  });

  test("u64-invalid-format: rejects non-string seed via generic catch (schema.ts:136)", () => {
    const raw = cloneTape();
    raw.seed = 1905;
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "u64-not-string");
        return true;
      },
    );

    // Accept counterpart
    raw.seed = "18446744073709551615";
    assert.equal(validateTapeV2(raw).seed, "18446744073709551615");
  });

  // 4. Stream Version & Allocation ID
  test("tape-missing-stream-version: rejects missing streamVersion (schema.ts:141)", () => {
    const raw = cloneTape();
    raw.streamVersion = null;
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-stream-version");
        return true;
      },
    );

    // Accept counterpart (both number and string allowed)
    raw.streamVersion = 1;
    assert.equal(validateTapeV2(raw).streamVersion, 1);
    raw.streamVersion = "v1";
    assert.equal(validateTapeV2(raw).streamVersion, "v1");
  });

  test("tape-missing-allocation-id: rejects missing allocationId (schema.ts:148)", () => {
    const raw = cloneTape();
    raw.allocationId = "  ";
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-allocation-id");
        return true;
      },
    );

    // Accept counterpart
    raw.allocationId = "alloc-1";
    assert.equal(validateTapeV2(raw).allocationId, "alloc-1");
  });

  // 5. Replay Grid
  test("tape-invalid-replay-grid: rejects non-object replayGrid (schema.ts:159)", () => {
    const raw = cloneTape();
    raw.replayGrid = "not-an-object";
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-replay-grid");
        assert.match(err.message, /replayGrid must be an object/);
        return true;
      },
    );

    // Accept counterpart (omitted or valid object)
    delete raw.replayGrid;
    assert.equal(validateTapeV2(raw).replayGrid, undefined);
  });

  test("tape-invalid-replay-grid: rejects non-positive baseSpacing (schema.ts:171)", () => {
    const raw = cloneTape();
    raw.replayGrid = { baseSpacing: 0, horizon: 10 };
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-replay-grid");
        assert.match(err.message, /baseSpacing must be a positive number/);
        return true;
      },
    );
    raw.replayGrid = { baseSpacing: -0.5, horizon: 10 };
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-replay-grid");
        return true;
      },
    );

    // Accept counterpart
    raw.replayGrid = { baseSpacing: 0.05, horizon: 10 };
    assert.equal(validateTapeV2(raw).replayGrid?.baseSpacing, 0.05);
  });

  test("tape-invalid-replay-grid: rejects non-positive horizon (schema.ts:178)", () => {
    const raw = cloneTape();
    raw.replayGrid = { baseSpacing: 0.01, horizon: 0 };
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-replay-grid");
        assert.match(err.message, /horizon must be a positive number/);
        return true;
      },
    );

    // Accept counterpart
    raw.replayGrid = { baseSpacing: 0.01, horizon: 25.0 };
    assert.equal(validateTapeV2(raw).replayGrid?.horizon, 25.0);
  });

  // 6. Initial Conditions
  test("tape-missing-initial-conditions: rejects non-object initialConditions (schema.ts:196)", () => {
    const raw = cloneTape();
    raw.initialConditions = null;
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-initial-conditions");
        return true;
      },
    );
    raw.initialConditions = [];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-initial-conditions");
        return true;
      },
    );

    // Accept counterpart
    raw.initialConditions = { temperatureK: 300 };
    assert.equal(validateTapeV2(raw).initialConditions.temperatureK, 300);
  });

  test("tape-invalid-initial-condition: rejects non-number/non-string values (schema.ts:205)", () => {
    const raw = cloneTape();
    raw.initialConditions = { invalidVal: [1, 2, 3] };
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-initial-condition");
        assert.match(err.message, /must be a number or string/);
        return true;
      },
    );

    // Accept counterpart
    raw.initialConditions = { stateStr: "ambient", stateNum: 293 };
    const valid = validateTapeV2(raw);
    assert.equal(valid.initialConditions.stateStr, "ambient");
    assert.equal(valid.initialConditions.stateNum, 293);
  });

  test("tape-invalid-initial-condition: rejects non-finite number values (schema.ts:212)", () => {
    const raw = cloneTape();
    raw.initialConditions = { infVal: Infinity };
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-initial-condition");
        assert.match(err.message, /must be a finite number/);
        return true;
      },
    );

    // Accept counterpart
    raw.initialConditions = { temp: 298.15 };
    assert.equal(validateTapeV2(raw).initialConditions.temp, 298.15);
  });

  // 7. Preset ID
  test("tape-invalid-preset-id: rejects empty presetId when provided (schema.ts:225)", () => {
    const raw = cloneTape();
    raw.presetId = "   ";
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-preset-id");
        return true;
      },
    );

    // Accept counterpart (omitted or valid string)
    delete raw.presetId;
    assert.equal(validateTapeV2(raw).presetId, undefined);
    raw.presetId = "preset-benchmark";
    assert.equal(validateTapeV2(raw).presetId, "preset-benchmark");
  });

  // 8. Events Array & Items
  test("tape-missing-events: rejects non-array events (schema.ts:236)", () => {
    const raw = cloneTape();
    raw.events = null;
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-events");
        return true;
      },
    );

    // Accept counterpart
    raw.events = [];
    assert.deepEqual(validateTapeV2(raw).events, []);
  });

  test("tape-events-exceeded: rejects events array exceeding MAX_PERMALINK_TAPE_EVENTS (schema.ts:243)", () => {
    const raw = cloneTape();
    const eventTemplate: TapeControlEvent = {
      actionIndex: 0,
      commandClass: "physical-intervention",
      paramId: "p",
      value: 1,
    };
    raw.events = Array.from({ length: MAX_PERMALINK_TAPE_EVENTS + 1 }, (_, i) => ({
      ...eventTemplate,
      actionIndex: i,
    }));
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-events-exceeded");
        assert.match(err.message, /exceeding the maximum bound/);
        return true;
      },
    );

    // Accept counterpart: exactly 256 events
    raw.events = Array.from({ length: MAX_PERMALINK_TAPE_EVENTS }, (_, i) => ({
      ...eventTemplate,
      actionIndex: i,
    }));
    assert.equal(validateTapeV2(raw).events.length, MAX_PERMALINK_TAPE_EVENTS);
  });

  test("tape-invalid-event: rejects non-object event item (schema.ts:256)", () => {
    const raw = cloneTape();
    raw.events = [null];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-event");
        return true;
      },
    );

    // Accept counterpart
    raw.events = [
      {
        actionIndex: 0,
        commandClass: "physical-intervention",
        paramId: "dt",
        value: 0.1,
      },
    ];
    assert.equal(validateTapeV2(raw).events.length, 1);
  });

  test("tape-invalid-action-index: rejects negative or non-integer actionIndex (schema.ts:265)", () => {
    const raw = cloneTape();
    raw.events = [
      {
        actionIndex: -1,
        commandClass: "physical-intervention",
        paramId: "dt",
        value: 0.1,
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-action-index");
        return true;
      },
    );

    // Accept counterpart
    raw.events = [
      {
        actionIndex: 0,
        commandClass: "physical-intervention",
        paramId: "dt",
        value: 0.1,
      },
    ];
    assert.equal(validateTapeV2(raw).events[0]?.actionIndex, 0);
  });

  test("tape-events-out-of-order: rejects events with decreasing actionIndex (schema.ts:272)", () => {
    const raw = cloneTape();
    raw.events = [
      {
        actionIndex: 5,
        commandClass: "physical-intervention",
        paramId: "dt",
        value: 0.1,
      },
      {
        actionIndex: 3,
        commandClass: "physical-intervention",
        paramId: "dt",
        value: 0.2,
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-events-out-of-order");
        assert.match(err.message, /ordered by logical actionIndex/);
        return true;
      },
    );

    // Accept counterpart (monotonically non-decreasing)
    raw.events = [
      {
        actionIndex: 3,
        commandClass: "physical-intervention",
        paramId: "dt",
        value: 0.1,
      },
      {
        actionIndex: 5,
        commandClass: "physical-intervention",
        paramId: "dt",
        value: 0.2,
      },
    ];
    assert.equal(validateTapeV2(raw).events.length, 2);
  });

  test("tape-missing-param-id: rejects missing paramId in event (schema.ts:281)", () => {
    const raw = cloneTape();
    raw.events = [
      {
        actionIndex: 0,
        commandClass: "physical-intervention",
        paramId: "   ",
        value: 0.1,
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-param-id");
        return true;
      },
    );

    // Accept counterpart
    raw.events = [
      {
        actionIndex: 0,
        commandClass: "physical-intervention",
        paramId: "param-1",
        value: 0.1,
      },
    ];
    assert.equal(validateTapeV2(raw).events[0]?.paramId, "param-1");
  });

  test("tape-invalid-command-class: rejects unknown commandClass in event (schema.ts:289)", () => {
    const raw = cloneTape();
    raw.events = [
      {
        actionIndex: 0,
        commandClass: "unsupported-cmd",
        paramId: "p",
        value: 1,
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-command-class");
        return true;
      },
    );

    // Accept counterpart
    raw.events = [
      {
        actionIndex: 0,
        commandClass: "physical-intervention",
        paramId: "p",
        value: 1,
      },
    ];
    assert.equal(validateTapeV2(raw).events[0]?.commandClass, "physical-intervention");
  });

  test("tape-invalid-event-value: rejects non-number/non-string event values (schema.ts:297)", () => {
    const raw = cloneTape();
    raw.events = [
      {
        actionIndex: 0,
        commandClass: "physical-intervention",
        paramId: "p",
        value: { nested: true },
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-event-value");
        assert.match(err.message, /must be a number or string/);
        return true;
      },
    );

    // Accept counterpart
    raw.events = [
      {
        actionIndex: 0,
        commandClass: "physical-intervention",
        paramId: "p",
        value: "active",
      },
    ];
    assert.equal(validateTapeV2(raw).events[0]?.value, "active");
  });

  test("tape-invalid-event-value: rejects non-finite event values (schema.ts:304)", () => {
    const raw = cloneTape();
    raw.events = [
      {
        actionIndex: 0,
        commandClass: "physical-intervention",
        paramId: "p",
        value: NaN,
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-event-value");
        assert.match(err.message, /must be finite/);
        return true;
      },
    );

    // Accept counterpart
    raw.events = [
      {
        actionIndex: 0,
        commandClass: "physical-intervention",
        paramId: "p",
        value: 42.5,
      },
    ];
    assert.equal(validateTapeV2(raw).events[0]?.value, 42.5);
  });

  // 9. Predictions
  test("tape-invalid-predictions: rejects non-array predictions when present (schema.ts:326)", () => {
    const raw = cloneTape();
    raw.predictions = "not-an-array";
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-predictions");
        return true;
      },
    );

    // Accept counterpart
    delete raw.predictions;
    assert.equal(validateTapeV2(raw).predictions, undefined);
  });

  test("tape-invalid-prediction: rejects non-object prediction item (schema.ts:337)", () => {
    const raw = cloneTape();
    raw.predictions = [null];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-prediction");
        return true;
      },
    );

    // Accept counterpart
    raw.predictions = [
      {
        promptId: "prompt-1",
        form: "candidate",
        payload: { candidateId: "c1" },
      },
    ];
    assert.equal(validateTapeV2(raw).predictions?.length, 1);
  });

  test("tape-missing-prompt-id: rejects missing promptId in prediction (schema.ts:346)", () => {
    const raw = cloneTape();
    raw.predictions = [
      {
        promptId: "",
        form: "candidate",
        payload: { candidateId: "c1" },
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-prompt-id");
        return true;
      },
    );

    // Accept counterpart
    raw.predictions = [
      {
        promptId: "prompt-valid",
        form: "candidate",
        payload: { candidateId: "c1" },
      },
    ];
    assert.equal(validateTapeV2(raw).predictions?.[0]?.promptId, "prompt-valid");
  });

  test("tape-invalid-prediction-form: rejects unsupported prediction form (schema.ts:354)", () => {
    const raw = cloneTape();
    raw.predictions = [
      {
        promptId: "p1",
        form: "invalid-form",
        payload: {},
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-prediction-form");
        assert.match(err.message, /Must be candidate, sketch, verbal, or values/);
        return true;
      },
    );

    // Accept counterpart
    raw.predictions = [
      {
        promptId: "p1",
        form: "candidate",
        payload: { candidateId: "c1" },
      },
    ];
    assert.equal(validateTapeV2(raw).predictions?.[0]?.form, "candidate");
  });

  // 10. Teaching Tape Ref
  test("tape-invalid-teaching-ref: rejects non-object teachingTapeRef (schema.ts:376)", () => {
    const raw = cloneTape();
    raw.teachingTapeRef = null;
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-teaching-ref");
        assert.match(err.message, /teachingTapeRef must be an object/);
        return true;
      },
    );

    // Accept counterpart
    delete raw.teachingTapeRef;
    assert.equal(validateTapeV2(raw).teachingTapeRef, undefined);
  });

  test("tape-invalid-teaching-ref: rejects empty tapeId in teachingTapeRef (schema.ts:384)", () => {
    const raw = cloneTape();
    raw.teachingTapeRef = { tapeId: "   ", stepIndex: 0 };
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-teaching-ref");
        assert.match(err.message, /tapeId is required/);
        return true;
      },
    );

    // Accept counterpart
    raw.teachingTapeRef = { tapeId: "tape-teach-1", stepIndex: 0 };
    assert.equal(validateTapeV2(raw).teachingTapeRef?.tapeId, "tape-teach-1");
  });

  test("tape-invalid-teaching-ref: rejects negative stepIndex in teachingTapeRef (schema.ts:391)", () => {
    const raw = cloneTape();
    raw.teachingTapeRef = { tapeId: "tape-teach-1", stepIndex: -1 };
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-teaching-ref");
        assert.match(err.message, /stepIndex must be a non-negative integer/);
        return true;
      },
    );

    // Accept counterpart
    raw.teachingTapeRef = { tapeId: "tape-teach-1", stepIndex: 2 };
    assert.equal(validateTapeV2(raw).teachingTapeRef?.stepIndex, 2);
  });

  // 11. Accepted Checkpoint
  test("tape-missing-accepted-checkpoint: rejects missing acceptedCheckpoint (schema.ts:409)", () => {
    const raw = cloneTape();
    delete raw.acceptedCheckpoint;
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-missing-accepted-checkpoint");
        return true;
      },
    );

    // Accept counterpart
    raw.acceptedCheckpoint = {
      acceptedActionIndex: 0,
      acceptedInputRevision: 0,
      digest: "blake3:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    };
    assert.equal(validateTapeV2(raw).acceptedCheckpoint.acceptedActionIndex, 0);
  });

  test("tape-invalid-accepted-action-index: rejects invalid acceptedActionIndex (schema.ts:421)", () => {
    const raw = cloneTape();
    const ac = raw.acceptedCheckpoint as Record<string, unknown>;
    ac.acceptedActionIndex = -1;
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-accepted-action-index");
        return true;
      },
    );

    // Accept counterpart
    ac.acceptedActionIndex = 5;
    assert.equal(validateTapeV2(raw).acceptedCheckpoint.acceptedActionIndex, 5);
  });

  test("tape-invalid-accepted-input-revision: rejects invalid acceptedInputRevision (schema.ts:432)", () => {
    const raw = cloneTape();
    const ac = raw.acceptedCheckpoint as Record<string, unknown>;
    ac.acceptedInputRevision = -2;
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-accepted-input-revision");
        return true;
      },
    );

    // Accept counterpart
    ac.acceptedInputRevision = 3;
    assert.equal(validateTapeV2(raw).acceptedCheckpoint.acceptedInputRevision, 3);
  });

  test("tape-invalid-checkpoint-digest: rejects malformed checkpoint digest (schema.ts:439)", () => {
    const raw = cloneTape();
    const ac = raw.acceptedCheckpoint as Record<string, unknown>;
    ac.digest = "sha256-invalid-no-prefix";
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "tape-invalid-checkpoint-digest");
        assert.match(err.message, /must start with "host:" or "blake3:"/);
        return true;
      },
    );

    // Accept counterpart
    ac.digest = "host:sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    assert.equal(validateTapeV2(raw).acceptedCheckpoint.digest, ac.digest);
  });

  // 12. Prediction Payloads Validation
  test("prediction-payload-not-object: rejects non-object prediction payload (schema.ts:482)", () => {
    const raw = cloneTape();
    raw.predictions = [
      {
        promptId: "p1",
        form: "candidate",
        payload: "not-an-object",
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "prediction-payload-not-object");
        return true;
      },
    );

    // Accept counterpart
    raw.predictions = [
      {
        promptId: "p1",
        form: "candidate",
        payload: { candidateId: "c1" },
      },
    ];
    assert.equal(validateTapeV2(raw).predictions?.length, 1);
  });

  test("prediction-free-text-forbidden: rejects free-text fields in prediction payload (schema.ts:492)", () => {
    const raw = cloneTape();
    raw.predictions = [
      {
        promptId: "p1",
        form: "candidate",
        payload: { candidateId: "c1", freeText: "hello" },
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "prediction-free-text-forbidden");
        return true;
      },
    );
    raw.predictions = [
      {
        promptId: "p1",
        form: "candidate",
        payload: { candidateId: "c1", note: "some note" },
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "prediction-free-text-forbidden");
        return true;
      },
    );

    // Accept counterpart
    raw.predictions = [
      {
        promptId: "p1",
        form: "candidate",
        payload: { candidateId: "c1" },
      },
    ];
    assert.equal(validateTapeV2(raw).predictions?.length, 1);
  });

  test("prediction-missing-candidate-id: rejects missing candidateId in candidate payload (schema.ts:502)", () => {
    const raw = cloneTape();
    raw.predictions = [
      {
        promptId: "p1",
        form: "candidate",
        payload: { candidateId: "   " },
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "prediction-missing-candidate-id");
        return true;
      },
    );

    // Accept counterpart
    raw.predictions = [
      {
        promptId: "p1",
        form: "candidate",
        payload: { candidateId: "cand-hypothesis-2" },
      },
    ];
    assert.equal(validateTapeV2(raw).predictions?.length, 1);
  });

  test("prediction-missing-sketch-points: rejects non-array sketch points (schema.ts:512)", () => {
    const raw = cloneTape();
    raw.predictions = [
      {
        promptId: "p1",
        form: "sketch",
        payload: { points: null },
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "prediction-missing-sketch-points");
        return true;
      },
    );

    // Accept counterpart
    raw.predictions = [
      {
        promptId: "p1",
        form: "sketch",
        payload: { points: [[0, 0]] },
      },
    ];
    assert.equal(validateTapeV2(raw).predictions?.length, 1);
  });

  test("prediction-sketch-points-exceeded: rejects sketch points exceeding MAX_PREDICTION_SKETCH_POINTS (schema.ts:519)", () => {
    const raw = cloneTape();
    const excessivePoints = Array.from(
      { length: MAX_PREDICTION_SKETCH_POINTS + 1 },
      (_, i) => [i, i] as [number, number],
    );
    raw.predictions = [
      {
        promptId: "p1",
        form: "sketch",
        payload: { points: excessivePoints },
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "prediction-sketch-points-exceeded");
        return true;
      },
    );

    // Accept counterpart: exactly 256 points
    const validPoints = Array.from(
      { length: MAX_PREDICTION_SKETCH_POINTS },
      (_, i) => [i, i] as [number, number],
    );
    raw.predictions = [
      {
        promptId: "p1",
        form: "sketch",
        payload: { points: validPoints },
      },
    ];
    assert.equal(validateTapeV2(raw).predictions?.length, 1);
  });

  test("prediction-invalid-sketch-point: rejects non-tuple or non-finite sketch point (schema.ts:536)", () => {
    const raw = cloneTape();
    raw.predictions = [
      {
        promptId: "p1",
        form: "sketch",
        payload: { points: [[0, 1], [2]] }, // missing y coordinate
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "prediction-invalid-sketch-point");
        return true;
      },
    );
    raw.predictions = [
      {
        promptId: "p1",
        form: "sketch",
        payload: { points: [[0, NaN]] },
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "prediction-invalid-sketch-point");
        return true;
      },
    );

    // Accept counterpart
    raw.predictions = [
      {
        promptId: "p1",
        form: "sketch",
        payload: {
          points: [
            [0.5, 1.5],
            [2.0, 3.0],
          ],
        },
      },
    ];
    assert.equal(validateTapeV2(raw).predictions?.length, 1);
  });

  test("prediction-invalid-verbal-choice: rejects negative or non-integer choiceIndex (schema.ts:552)", () => {
    const raw = cloneTape();
    raw.predictions = [
      {
        promptId: "p1",
        form: "verbal",
        payload: { choiceIndex: -1 },
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "prediction-invalid-verbal-choice");
        return true;
      },
    );

    // Accept counterpart
    raw.predictions = [
      {
        promptId: "p1",
        form: "verbal",
        payload: { choiceIndex: 2, choiceText: "option C" },
      },
    ];
    assert.equal(validateTapeV2(raw).predictions?.length, 1);
  });

  test("prediction-missing-values: rejects non-array values (schema.ts:565)", () => {
    const raw = cloneTape();
    raw.predictions = [
      {
        promptId: "p1",
        form: "values",
        payload: { values: null },
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "prediction-missing-values");
        return true;
      },
    );

    // Accept counterpart
    raw.predictions = [
      {
        promptId: "p1",
        form: "values",
        payload: { values: [[1, 42.0]] },
      },
    ];
    assert.equal(validateTapeV2(raw).predictions?.length, 1);
  });

  test("prediction-values-count-exceeded: rejects values exceeding MAX_PREDICTION_VALUES_COUNT (schema.ts:572)", () => {
    const raw = cloneTape();
    const excessiveValues = Array.from(
      { length: MAX_PREDICTION_VALUES_COUNT + 1 },
      (_, i) => [i, i * 1.5] as [number, number],
    );
    raw.predictions = [
      {
        promptId: "p1",
        form: "values",
        payload: { values: excessiveValues },
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "prediction-values-count-exceeded");
        return true;
      },
    );

    // Accept counterpart: exactly 64 items
    const validValues = Array.from(
      { length: MAX_PREDICTION_VALUES_COUNT },
      (_, i) => [i, i * 1.5] as [number, number],
    );
    raw.predictions = [
      {
        promptId: "p1",
        form: "values",
        payload: { values: validValues },
      },
    ];
    assert.equal(validateTapeV2(raw).predictions?.length, 1);
  });

  test("prediction-invalid-value-item: rejects non-tuple or non-finite value item (schema.ts:589)", () => {
    const raw = cloneTape();
    raw.predictions = [
      {
        promptId: "p1",
        form: "values",
        payload: { values: [[1, "bad"]] },
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "prediction-invalid-value-item");
        return true;
      },
    );
    raw.predictions = [
      {
        promptId: "p1",
        form: "values",
        payload: { values: [[1, Infinity]] },
      },
    ];
    assert.throws(
      () => validateTapeV2(raw),
      (err: unknown) => {
        assert.ok(err instanceof TapeValidationError);
        assert.equal(err.code, "prediction-invalid-value-item");
        return true;
      },
    );

    // Accept counterpart
    raw.predictions = [
      {
        promptId: "p1",
        form: "values",
        payload: {
          values: [
            [1, 3.5],
            [2, 2.5],
          ],
        },
      },
    ];
    assert.equal(validateTapeV2(raw).predictions?.length, 1);
  });
});
