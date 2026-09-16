import { describe, expect, test } from "bun:test";
import { SR08_DEFAULTS } from "../experiments/sr08/definition.ts";
import { validateSr08Parameters } from "../experiments/sr08/parameters.ts";
import { createSr08Session, snapshotOutputs } from "../experiments/sr08/session.ts";
import { C_SI } from "../physics/reference/fields.ts";

describe("SR-08 session store and parameter validation", () => {
  test("create session initializes default snapshot with valid outputs", () => {
    const session = createSr08Session();
    const snap = session.getSnapshot().accepted;
    expect(snap).toBeDefined();
    expect(snap?.parameters).toBeDefined();
    expect(snap?.outputs.length).toBe(11);
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

  test("snapshot outputs match evaluateSr08", () => {
    const outputs = snapshotOutputs(SR08_DEFAULTS);
    expect(outputs.length).toBe(11);
    const eMoving = outputs.find((o) => o.quantityId === "electricFieldMoving");
    expect(eMoving?.status).toBe("value");
  });
});
