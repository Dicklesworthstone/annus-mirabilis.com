import { describe, expect, test } from "bun:test";
import { LQ06_DEFAULTS } from "../lq06/definition.ts";
import { createLq06Session } from "../lq06/session.ts";
import { LQ06_TAPE } from "../lq06/tape.ts";
import { ME01_TAPE } from "../me01/tape.ts";
import { ME03_TAPE } from "../me03/tape.ts";
import { ExperimentRuntimeError } from "../refusal.ts";
import { replayTape } from "./replay.ts";
import {
  calculateNewRun,
  createSessionReplayRunner,
  type LabTapeBinding,
  replayTapeOnSession,
  restoreTape,
  type TapeSession,
  tapeForSettings,
  tapeStateDigestV2,
  tapeStateOf,
} from "./sessionTape.ts";
import type { TapeV2 } from "./types.ts";

function shared(binding: LabTapeBinding, parameters: object = binding.defaults): TapeV2 {
  const tape = tapeForSettings(binding, parameters);
  if (!tape) throw new Error("The real owner did not accept these test settings.");
  return tape;
}

function thrown(action: () => unknown): ExperimentRuntimeError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ExperimentRuntimeError);
    return error as ExperimentRuntimeError;
  }
  throw new Error("Expected the real replay runner to refuse.");
}

describe("current-model calculations own their new scientific run", () => {
  test("calculating unchanged settings twice creates two real runs in the existing owner", () => {
    const owner = ME03_TAPE.createSession("me03-calculate-current-model");
    let previous = owner.getSnapshot().accepted?.runId;
    for (let i = 0; i < 2; i++) {
      const result = calculateNewRun(ME03_TAPE, owner, owner.acceptedParameters());
      expect(result.kind).toBe("calculated");
      if (result.kind !== "calculated") throw new Error(result.notice);
      expect(result.runId).toBe(owner.getSnapshot().accepted?.runId);
      expect(result.runId).not.toBe(previous);
      expect(owner.getSnapshot().accepted).toMatchObject({
        instanceId: "me03-calculate-current-model",
        parentRunId: previous,
        final: true,
        parameters: ME03_TAPE.defaults,
      });
      previous = result.runId;
    }
  });

  test("explicitly calculating an incompatible record bypasses its historical check and accepts every control", () => {
    const owner = ME03_TAPE.createSession("me03-incompatible-record");
    const before = owner.getSnapshot();
    const old: TapeV2 = {
      ...shared(ME03_TAPE),
      modelIdentity: { modelId: "older-boundary-model", modelVersion: 0 },
      events: [
        {
          actionIndex: 1,
          commandClass: "measurement-change",
          paramId: "boundary",
          value: "radiation",
        },
        {
          actionIndex: 2,
          commandClass: "presentation-change",
          paramId: "notation",
          value: "modern",
        },
      ],
      acceptedCheckpoint: {
        acceptedActionIndex: 2,
        acceptedInputRevision: 2,
        digest: "host:ffffffffffffffff",
      },
    };
    expect(replayTapeOnSession(ME03_TAPE, owner, old).kind).toBe("refusal");
    expect(owner.getSnapshot()).toBe(before);
    const result = replayTapeOnSession(ME03_TAPE, owner, old, { forceNewRun: true });
    expect(result.kind).toBe("success");
    if (result.kind !== "success") throw new Error(result.notice);
    expect(result.isNewRun).toBe(true);
    expect(result.runId).toBe(owner.getSnapshot().accepted?.runId);
    expect(result.runId).not.toBe(before.accepted?.runId);
    expect(result.acceptedCheckpoint.digest).not.toBe(old.acceptedCheckpoint.digest);
    expect(result.executedEventCount).toBe(2);
    expect(owner.acceptedParameters()).toEqual({
      ...ME03_TAPE.defaults,
      boundary: "radiation",
      notation: "modern",
    });
  });

  test("ordinary observer-only restoration reports the actual preserved run", () => {
    const owner = ME01_TAPE.createSession("me01-ordinary-observer-restore");
    const before = owner.getSnapshot().accepted?.runId;
    const result = replayTapeOnSession(
      ME01_TAPE,
      owner,
      shared(ME01_TAPE, { ...ME01_TAPE.defaults, frameSpeed: 0.2 }),
    );
    expect(result.kind).toBe("success");
    if (result.kind !== "success") throw new Error(result.notice);
    expect(result.isNewRun).toBe(false);
    expect(result.runId).toBe(before);
    expect(result.runId).toBe(owner.getSnapshot().accepted?.runId);
  });

  test("an owner without an explicit fork is refused before apply or rollback", () => {
    const real = ME03_TAPE.createSession("me03-no-fork");
    let applies = 0;
    const owner: TapeSession = {
      acceptedParameters: real.acceptedParameters,
      getSnapshot: real.getSnapshot,
      apply(input) {
        applies++;
        return real.apply(input);
      },
    };
    const before = owner.getSnapshot();
    const result = replayTapeOnSession(ME03_TAPE, owner, shared(ME03_TAPE), { forceNewRun: true });
    expect(result).toMatchObject({ kind: "invalid", reason: "new-run-unsupported" });
    expect(calculateNewRun(ME03_TAPE, owner, ME03_TAPE.defaults).kind).toBe("not-restored");
    expect(applies).toBe(0);
    expect(owner.getSnapshot()).toBe(before);
  });

  test("a no-op fork cannot be rescued by later setup events and never touches the live owner", () => {
    const owner = ME03_TAPE.createSession("me03-no-op-fork-live");
    const before = owner.getSnapshot();
    let trialEvents = 0;
    const broken: LabTapeBinding = {
      ...ME03_TAPE,
      createSession(instanceId) {
        const trial = ME03_TAPE.createSession(instanceId);
        return {
          ...trial,
          startNewRun: () => ({ kind: "accepted" }),
          apply(input) {
            trialEvents++;
            return trial.apply(input);
          },
        };
      },
    };
    const request: TapeV2 = {
      ...shared(ME03_TAPE),
      events: [
        { actionIndex: 1, commandClass: "setup-change", paramId: "emittedEnergy", value: 2 },
      ],
    };
    const result = replayTapeOnSession(broken, owner, request, { forceNewRun: true });
    expect(result).toMatchObject({ kind: "invalid", reason: "new-run-not-created" });
    expect(trialEvents).toBe(0);
    expect(owner.getSnapshot()).toBe(before);
  });

  test("settings-only planning has no invented scientific run identity", () => {
    const owner = ME03_TAPE.createSession("me03-planning-identity");
    const full = createSessionReplayRunner(ME03_TAPE, owner);
    const plan = {
      environment: full.environment,
      applyInitialConditions: full.applyInitialConditions,
      applyEvent: full.applyEvent,
      getAcceptedCheckpoint: full.getAcceptedCheckpoint,
      getCurrentState: full.getCurrentState,
    };
    const result = replayTape(shared(ME03_TAPE), plan);
    expect(result).toMatchObject({ kind: "success", runId: null, isNewRun: false });
    expect(replayTape(shared(ME03_TAPE), plan, { forceNewRun: true })).toMatchObject({
      kind: "invalid",
      reason: "new-run-unsupported",
    });
  });
});

describe("new-run validation precedes the accepting owner", () => {
  test("(sessionTape.ts:69) invalid canonical settings throw parameters-rejected before starting a run", () => {
    const owner = ME03_TAPE.createSession("me03-new-run-invalid-settings");
    const before = owner.getSnapshot();
    const runner = createSessionReplayRunner(ME03_TAPE, owner);
    const invalid = { ...shared(ME03_TAPE).initialConditions, emittedEnergy: -1 };
    const error = thrown(() => runner.startNewRun?.(invalid));
    expect(error.code).toBe("parameters-rejected");
    expect(error.experimentId).toBe("me-03");
    expect(owner.getSnapshot()).toBe(before);
    expect(
      calculateNewRun(ME03_TAPE, owner, { ...ME03_TAPE.defaults, emittedEnergy: -1 }).kind,
    ).toBe("not-restored");
    expect(owner.getSnapshot()).toBe(before);
  });

  test("(sessionTape.ts:221) owner refusal throws parameters-rejected and keeps its repair sentence", () => {
    const real = ME03_TAPE.createSession("me03-refusing-owner");
    const before = real.getSnapshot();
    const runner = createSessionReplayRunner(ME03_TAPE, {
      ...real,
      apply: () => ({
        kind: "refused",
        refusal: { details: { requirements: "Keep the last accepted boundary." } },
      }),
    });
    const error = thrown(() => runner.applyInitialConditions(shared(ME03_TAPE).initialConditions));
    expect(error.code).toBe("parameters-rejected");
    expect(error.experimentId).toBe("me-03");
    expect(runner.refusalSentence()).toBe("Keep the last accepted boundary.");
    expect(real.getSnapshot()).toBe(before);
  });

  test("(sessionTape.ts:237) a new ID without a complete final acceptance throws new-run-not-accepted", () => {
    for (const defect of ["pending", "partial", "stale-parameters"] as const) {
      const owner = ME03_TAPE.createSession(`me03-invalid-receipt-${defect}`);
      const runner = createSessionReplayRunner(ME03_TAPE, {
        ...owner,
        getSnapshot() {
          const view = owner.getSnapshot();
          return {
            ...view,
            pending: defect === "pending",
            accepted: view.accepted && {
              ...view.accepted,
              final: defect !== "partial",
              parameters:
                defect === "stale-parameters"
                  ? { ...ME03_TAPE.defaults, emittedEnergy: 99 }
                  : view.accepted.parameters,
            },
          };
        },
      });
      const error = thrown(() => runner.startNewRun?.(shared(ME03_TAPE).initialConditions));
      expect(error.code).toBe("new-run-not-accepted");
      expect(error.experimentId).toBe("me-03");
      expect(runner.refusalSentence()).toContain("complete recorded settings");
    }
  });
});

describe("settings-selected scientific constants", () => {
  const historical = {
    ...LQ06_DEFAULTS,
    constantSetId: "einstein-1905-light-quanta-printed",
  };

  test("the real LQ06 owner shares and restores the constants it actually used", () => {
    const tape = shared(LQ06_TAPE, historical);
    expect(tape.constantSetId).toBe(historical.constantSetId);
    const owner = createLq06Session("lq06-historical-round-trip");
    const modern = owner.getSnapshot().accepted;
    expect(restoreTape(LQ06_TAPE, owner, tape).kind).toBe("restored");
    expect(owner.acceptedParameters()).toEqual(historical);
    expect(owner.getSnapshot().accepted?.outputs).not.toEqual(modern?.outputs);
    const current = shared(LQ06_TAPE, owner.acceptedParameters());
    expect(current.constantSetId).toBe(historical.constantSetId);
    expect(current.acceptedCheckpoint.digest).toBe(tape.acceptedCheckpoint.digest);
    expect(restoreTape(LQ06_TAPE, owner, shared(LQ06_TAPE)).kind).toBe("restored");
    expect(owner.acceptedParameters()).toEqual(LQ06_DEFAULTS);
    expect(owner.getSnapshot().accepted?.outputs).toEqual(modern?.outputs);
  });

  test("a header cannot select different constants from its validated settings", () => {
    const owner = createLq06Session("lq06-lying-constant-header");
    const before = owner.getSnapshot();
    const tape = { ...shared(LQ06_TAPE, historical), constantSetId: "modern-si-2019" };
    const result = replayTapeOnSession(LQ06_TAPE, owner, tape);
    expect(result).toMatchObject({ kind: "refusal", refusalCode: "tape-constant-set-mismatch" });
    expect(owner.getSnapshot()).toBe(before);
  });

  test("a reference derives constants from its exact authored prefix, independent of envelope and later events", () => {
    const checkpointSettings = { ...historical, volumeRatio: 0.25 };
    const state = tapeStateOf(checkpointSettings);
    if (!state) throw new Error("Expected serializable settings.");
    const source: TapeV2 = {
      ...shared(LQ06_TAPE, historical),
      events: [
        { actionIndex: 1, commandClass: "measurement-change", paramId: "volumeRatio", value: 0.25 },
        {
          actionIndex: 2,
          commandClass: "setup-change",
          paramId: "constantSetId",
          value: "modern-si-2019",
        },
      ],
      acceptedCheckpoint: {
        acceptedActionIndex: 1,
        acceptedInputRevision: 2,
        digest: tapeStateDigestV2(state, 1),
      },
    };
    const envelope: TapeV2 = {
      ...source,
      initialConditions: shared(LQ06_TAPE).initialConditions,
      events: [],
      teachingTapeRef: { tapeId: "historical-prefix", stepIndex: 0 },
    };
    const owner = createLq06Session("lq06-historical-prefix");
    let resolutions = 0;
    const result = restoreTape(LQ06_TAPE, owner, envelope, () => {
      resolutions++;
      return source;
    });
    expect(result.kind).toBe("restored");
    expect(resolutions).toBe(1);
    expect(owner.acceptedParameters()).toEqual(checkpointSettings);
  });
});
