import { describe, expect, test } from "bun:test";
import { ArgumentSchemaError, validateMisconception } from "../content/schemas/argument.ts";

/**
 * am-read-misconception-callouts-a3o acceptance criteria this file proves directly, against the
 * real compiler-facing validator (src/content/schemas/argument.ts, not a bead-local re-check):
 * "Every entry carries `intervention` with all four `defaultsReviewed` judgments and a
 * `reviewRecordId`; a fixture missing any judgment fails with the judgment named" and "Every
 * compiled `Misconception` carries `whereItIsTrue`; an absent value fails compilation."
 */
function validRaw(): Record<string, unknown> {
  return {
    id: "misc-schema-check",
    paper: "brownian-motion",
    temptingClaims: ["A tempting claim."],
    whyTempting: "Because it reads that way at a glance.",
    whereItIsTrue: "none",
    whatIsTrue: { r0: "a", r1: "b", r2: "c" },
    staticTreatment: { reason: "No instrument is attached." },
    anchors: ["s1"],
    resultIds: [],
    sources: [],
    intervention: {
      defaultsReviewed: {
        model: "Judgment about the model.",
        labels: "Judgment about the labels.",
        defaultControls: "Judgment about the default controls.",
        feedback: "Judgment about the feedback.",
      },
      reviewRecordId: "rr-schema-check",
    },
    authorship: { draftedBy: [{ id: "agent-x", kind: "model", modelId: "claude-sonnet-5" }] },
    reviewState: "draft",
  };
}

describe("validateMisconception: the real compiler gate, not a bead-local re-check", () => {
  test("a well-formed fixture compiles", () => {
    const compiled = validateMisconception(validRaw());
    expect(compiled.id).toBe("misc-schema-check");
    expect(compiled.whereItIsTrue).toBe("none");
  });

  test("each missing defaultsReviewed judgment fails, naming that judgment", () => {
    for (const judgment of ["model", "labels", "defaultControls", "feedback"] as const) {
      const raw = validRaw();
      const intervention = raw.intervention as Record<string, unknown>;
      const defaultsReviewed = { ...(intervention.defaultsReviewed as Record<string, unknown>) };
      delete defaultsReviewed[judgment];
      raw.intervention = { ...intervention, defaultsReviewed };

      let caught: unknown;
      try {
        validateMisconception(raw);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(ArgumentSchemaError);
      const err = caught as ArgumentSchemaError;
      expect(err.code).toBe("missing-defaults-reviewed-judgment");
      expect(err.message).toContain(judgment);
    }
  });

  test("a missing reviewRecordId fails compilation", () => {
    const raw = validRaw();
    const intervention = { ...(raw.intervention as Record<string, unknown>) };
    delete intervention.reviewRecordId;
    raw.intervention = intervention;

    expect(() => validateMisconception(raw)).toThrow(ArgumentSchemaError);
    try {
      validateMisconception(raw);
    } catch (err) {
      expect((err as ArgumentSchemaError).code).toBe("missing-review-record-id");
    }
  });

  test("a missing whereItIsTrue fails compilation -- every compiled entry must carry it", () => {
    const raw = validRaw();
    delete raw.whereItIsTrue;
    expect(() => validateMisconception(raw)).toThrow(ArgumentSchemaError);
    try {
      validateMisconception(raw);
    } catch (err) {
      expect((err as ArgumentSchemaError).code).toBe("missing-where-it-is-true");
    }
  });

  test("the literal 'none' for whereItIsTrue is accepted, not rejected", () => {
    const compiled = validateMisconception(validRaw());
    expect(compiled.whereItIsTrue).toBe("none");
  });

  test("neither instrumentIds nor staticTreatment fails compilation", () => {
    const raw = validRaw();
    delete raw.staticTreatment;
    expect(() => validateMisconception(raw)).toThrow(ArgumentSchemaError);
    try {
      validateMisconception(raw);
    } catch (err) {
      expect((err as ArgumentSchemaError).code).toBe("missing-misconception-treatment");
    }
  });
});
