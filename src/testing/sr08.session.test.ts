import { describe, expect, test } from "bun:test";
import { SR08_DEFAULTS, SR08_OUTPUTS } from "../experiments/sr08/definition.ts";
import { parseSr08Draft, SR08_NUMBER_FIELDS, sr08Draft } from "../experiments/sr08/draft.ts";
import { SR08_FORCE_LEDGER_OUTPUTS } from "../experiments/sr08/forceLedger.ts";
import { validateSr08Parameters } from "../experiments/sr08/parameters.ts";
import {
  createSr08Session,
  SR08_SESSION_OUTPUTS,
  snapshotOutputs,
} from "../experiments/sr08/session.ts";
import { C_SI } from "../physics/reference/fields.ts";

/**
 * Cross-file contract invariant:
 * Every output registered by SR-08 across definition and force ledger contracts
 * must appear in store publications and solver snapshots, and no unregistered
 * output may leak in.
 */
const REGISTERED_OUTPUT_IDS = Object.freeze(new Set(Object.keys(SR08_SESSION_OUTPUTS)));

function assertOutputRegistryParity(
  outputs: readonly { quantityId: string; status: string; unit?: string; semanticKind?: string }[],
) {
  const snapshotOutputIds = new Set(outputs.map((o) => o.quantityId));

  // Count matches registry cardinality, derived from contract rather than hardcoded
  expect(outputs.length).toBe(REGISTERED_OUTPUT_IDS.size);
  expect(snapshotOutputIds.size).toBe(REGISTERED_OUTPUT_IDS.size);

  // Every output registered by SR-08 appears in the snapshot
  for (const id of REGISTERED_OUTPUT_IDS) {
    expect(snapshotOutputIds.has(id)).toBe(true);
  }

  // Every output in the snapshot is registered -- nothing unregistered leaks in
  for (const output of outputs) {
    expect(REGISTERED_OUTPUT_IDS.has(output.quantityId)).toBe(true);
    const contract = SR08_SESSION_OUTPUTS[output.quantityId as keyof typeof SR08_SESSION_OUTPUTS];
    expect(contract).toBeDefined();
    expect(contract.statuses).toContain(output.status as "value" | "outside-domain");
    if (output.unit !== undefined) {
      expect(output.unit).toBe(contract.unit);
    }
    if (output.semanticKind !== undefined) {
      expect(output.semanticKind).toBe(contract.semanticKind);
    }
  }
}

describe("SR-08 session store and parameter validation", () => {
  test("create session initializes default snapshot with valid outputs matching registered contract", () => {
    const session = createSr08Session();
    const snap = session.getSnapshot().accepted;
    expect(snap).toBeDefined();
    expect(snap?.parameters).toBeDefined();
    expect(snap?.outputs).toBeDefined();
    if (snap?.outputs) {
      assertOutputRegistryParity(snap.outputs);
    }
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

  test("snapshot outputs match evaluateSr08 and satisfy registered output contracts", () => {
    const outputs = snapshotOutputs(SR08_DEFAULTS);
    assertOutputRegistryParity(outputs);

    const eMoving = outputs.find((o) => o.quantityId === "electricFieldMoving");
    expect(eMoving?.status).toBe("value");
    const fMoving = outputs.find((o) => o.quantityId === "electricForceMoving");
    expect(fMoving?.status).toBe("value");
  });
});

describe("SR-08 numeric draft parsing and non-coercion", () => {
  test("round-trips default parameters through draft formatting and parsing", () => {
    const draft = sr08Draft(SR08_DEFAULTS, C_SI);
    const parsed = parseSr08Draft(draft, SR08_DEFAULTS, C_SI);
    expect(parsed.kind).toBe("accepted");
    if (parsed.kind === "accepted") {
      expect(parsed.data.boost).toBeCloseTo(SR08_DEFAULTS.boost, 9);
      expect(parsed.data.electricFieldY).toBe(SR08_DEFAULTS.electricFieldY);
      expect(parsed.data.testCharge).toBe(SR08_DEFAULTS.testCharge);
    }
  });

  test("refuses empty strings and whitespace for every numeric field without blank-to-zero coercion", () => {
    const baseDraft = sr08Draft(SR08_DEFAULTS, C_SI);
    for (const field of SR08_NUMBER_FIELDS) {
      for (const blank of ["", "   ", "\t", "\n"]) {
        const invalidDraft = { ...baseDraft, [field]: blank };
        const parsed = parseSr08Draft(invalidDraft, SR08_DEFAULTS, C_SI);
        expect(parsed.kind).toBe("refused");
        if (parsed.kind === "refused") {
          expect(parsed.message).toContain("empty field is not zero");
          expect(parsed.message).toContain(field);
        }
      }
    }
  });

  test("refuses non-numeric and unparseable strings for every numeric field without coercing to zero", () => {
    const baseDraft = sr08Draft(SR08_DEFAULTS, C_SI);
    for (const field of SR08_NUMBER_FIELDS) {
      for (const junk of ["1junk", "NaN", "Infinity", "0x10", "1e", "-", "."]) {
        const invalidDraft = { ...baseDraft, [field]: junk };
        const parsed = parseSr08Draft(invalidDraft, SR08_DEFAULTS, C_SI);
        expect(parsed.kind).toBe("refused");
      }
    }
  });

  test("explicit zero remains valid and accepted across all fields", () => {
    const baseDraft = sr08Draft(SR08_DEFAULTS, C_SI);
    for (const field of SR08_NUMBER_FIELDS) {
      const draftWithZero = { ...baseDraft, [field]: "0" };
      const parsed = parseSr08Draft(draftWithZero, SR08_DEFAULTS, C_SI);
      expect(parsed.kind).toBe("accepted");
      if (parsed.kind === "accepted") {
        expect(parsed.data[field]).toBe(0);
      }
    }
  });
});
