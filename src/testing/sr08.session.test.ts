import { describe, expect, test } from "bun:test";
import { SR08_DEFAULTS, SR08_OUTPUTS } from "../experiments/sr08/definition.ts";
import { parseSr08Draft, SR08_NUMBER_FIELDS, sr08Draft } from "../experiments/sr08/draft.ts";
import { SR08_FORCE_LEDGER_OUTPUTS } from "../experiments/sr08/forceLedger.ts";
import { validateSr08Parameters } from "../experiments/sr08/parameters.ts";
import { createSr08Session, snapshotOutputs } from "../experiments/sr08/session.ts";
import { C_SI } from "../physics/reference/fields.ts";

/**
 * Cross-file contract, same shape as catalogue.test.ts.
 * Do not re-derive this set from snapshotOutputs (that could never fail).
 * Registration lives in definition.ts and forceLedger.ts; the snapshot is
 * assembled independently in session.ts from evaluateSr08 + forceLedgerOutputs.
 * A new registered quantity that never reaches the snapshot, or a snapshot
 * quantity that was never registered, is a real bug this catches.
 */
const REGISTERED_OUTPUTS = Object.freeze({
  ...SR08_OUTPUTS,
  ...SR08_FORCE_LEDGER_OUTPUTS,
});
type RegisteredOutputId = keyof typeof REGISTERED_OUTPUTS;

function isRegisteredOutputId(id: string): id is RegisteredOutputId {
  return Object.hasOwn(REGISTERED_OUTPUTS, id);
}

function assertSnapshotMatchesRegistration(
  outputs: readonly {
    quantityId: string;
    status: string;
    unit: string;
    semanticKind: string;
  }[],
): void {
  const snapshotIds = outputs.map((output) => output.quantityId);
  const snapshotSet = new Set(snapshotIds);
  const registeredIds = Object.keys(REGISTERED_OUTPUTS);

  expect(snapshotIds.length).toBe(snapshotSet.size);
  expect(snapshotSet.size).toBe(registeredIds.length);

  for (const id of registeredIds) {
    expect(snapshotSet.has(id)).toBe(true);
  }
  for (const output of outputs) {
    expect(isRegisteredOutputId(output.quantityId)).toBe(true);
    if (!isRegisteredOutputId(output.quantityId)) continue;
    const contract = REGISTERED_OUTPUTS[output.quantityId];
    expect(contract.statuses).toContain(output.status);
    expect(output.unit).toBe(contract.unit);
    expect(output.semanticKind).toBe(contract.semanticKind);
  }
}

describe("SR-08 session store and parameter validation", () => {
  test("create session publishes every registered output and no unregistered one", () => {
    const session = createSr08Session();
    const snap = session.getSnapshot().accepted;
    expect(snap).toBeDefined();
    expect(snap?.parameters).toBeDefined();
    expect(Array.isArray(snap?.outputs)).toBe(true);
    assertSnapshotMatchesRegistration(snap?.outputs ?? []);
    expect(session.acceptedParameters().boost).toBe(0.6 * C_SI);
  });

  test("observer change keeps run identity", () => {
    const session = createSr08Session();
    const beforeRunId = session.getSnapshot().accepted?.runId;
    const applied = session.apply({
      ...session.acceptedParameters(),
      descriptionFrame: "moving",
    });
    expect(applied.kind).toBe("accepted");
    expect(session.getSnapshot().accepted?.runId).toBe(beforeRunId);
  });

  test("physical intervention (detector motion) advances revision", () => {
    const session = createSr08Session();
    const beforeRev = session.getSnapshot().accepted?.revisions.input ?? 0;
    const applied = session.apply({
      ...session.acceptedParameters(),
      detectorMotion: true,
      detectorSpeed: 100,
    });
    expect(applied.kind).toBe("accepted");
    expect(session.getSnapshot().accepted?.revisions.input).toBeGreaterThan(beforeRev);
  });

  test("superluminal parameter is refused", () => {
    const checked = validateSr08Parameters({
      ...SR08_DEFAULTS,
      boost: 1.1 * C_SI,
    });
    expect(checked.kind).toBe("refused");
    if (checked.kind === "refused") {
      expect(checked.refusal.code).toBe("invalid-parameter");
    }

    const session = createSr08Session("sr08-refuse");
    const res = session.apply({
      ...session.acceptedParameters(),
      boost: 1.1 * C_SI,
    });
    expect(res.kind).toBe("refused");
  });

  test("snapshotOutputs matches the registered SR-08 output contract", () => {
    const outputs = snapshotOutputs(SR08_DEFAULTS);
    assertSnapshotMatchesRegistration(outputs);
    const eMoving = outputs.find((o) => o.quantityId === "electricFieldMoving");
    expect(eMoving?.status).toBe("value");
  });

  describe("numeric fields: blank is not zero", () => {
    test("explicit numeric zero is accepted", () => {
      const checked = validateSr08Parameters({
        ...SR08_DEFAULTS,
        electricFieldX: 0,
        electricFieldZ: 0,
        magneticFieldX: 0,
      });
      expect(checked.kind).toBe("accepted");
      if (checked.kind === "accepted") {
        expect(checked.data.electricFieldX).toBe(0);
      }
    });

    test("a blank string is a typed refusal, not a silent 0", () => {
      for (const field of SR08_NUMBER_FIELDS) {
        const checked = validateSr08Parameters({
          ...SR08_DEFAULTS,
          [field]: "",
        });
        expect(checked.kind).toBe("refused");
        if (checked.kind === "refused") {
          expect(checked.refusal.code).toBe("invalid-parameter");
          expect(checked.refusal.affected.parameterIds).toContain(field);
        }
      }
    });

    test("draft parsing refuses empty fields rather than substituting zero", () => {
      const draft = sr08Draft(SR08_DEFAULTS, C_SI);
      const parsed = parseSr08Draft(draft, SR08_DEFAULTS, C_SI);
      expect(parsed.kind).toBe("accepted");
      for (const field of SR08_NUMBER_FIELDS) {
        for (const blank of ["", "   "]) {
          const result = parseSr08Draft({ ...draft, [field]: blank }, SR08_DEFAULTS, C_SI);
          expect(result.kind).toBe("refused");
          if (result.kind === "refused") {
            expect(result.message).toContain("empty field is not zero");
          }
        }
      }
    });
  });
});
