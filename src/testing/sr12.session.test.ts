import { describe, expect, test } from "bun:test";
import { decodeSr12Settings, encodeSr12Settings } from "../experiments/sr12/permalink.ts";
import { createSr12Session, type PreparedSr12Example } from "../experiments/sr12/session.ts";
import rawExample from "../generated/sr12-example.json";
import { C_SI } from "../physics/reference/fields.ts";

const example = rawExample as unknown as PreparedSr12Example;

describe("SR-12 session, permalink, and state lifecycle", () => {
  test("initializes session with accepted snapshot from prepared example", () => {
    const session = createSr12Session("test-sr12-init", example);
    const snap = session.getSnapshot().accepted;
    expect(snap).not.toBeNull();
    expect(snap?.experimentId).toBe("sr-12");

    const p = session.acceptedParameters();
    expect(p.mode).toBe("neutral-conductor");
    expect(p.chargeDensity).toBe(0);
    expect(p.currentDensityX).toBe(1);
    expect(p.boost).toBeCloseTo(0.6 * C_SI, 1);
  });

  test("apply updates state and creates appropriate command classes", () => {
    const session = createSr12Session("test-sr12-apply", example);
    const initialRunId = session.getSnapshot().accepted?.runId;

    // Observer change: changing boost
    const res = session.apply({ boost: 0.8 * C_SI });
    expect(res.kind).toBe("accepted");
    expect(session.getSnapshot().accepted?.runId).toBe(initialRunId);

    // Presentation change: changing mode and unit layer
    const presRes = session.apply({ mode: "convection", unitLayer: "gaussian" });
    expect(presRes.kind).toBe("accepted");
    expect(session.acceptedParameters().unitLayer).toBe("gaussian");
    expect(session.acceptedParameters().mode).toBe("convection");

    // Setup change: changing current density
    const setupRes = session.apply({ currentDensityX: 2.5 });
    expect(setupRes.kind).toBe("accepted");
    expect(session.acceptedParameters().currentDensityX).toBe(2.5);
  });

  test("permalink encode/decode roundtrips accurately", () => {
    const p = example.parameters;
    const link = encodeSr12Settings(p);
    expect(link).toContain("mode=neutral-conductor");
    expect(link).toContain("v=0.6");
    expect(link).toContain("jx=1");

    const decoded = decodeSr12Settings(link);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") {
      expect(decoded.parameters.mode).toBe("neutral-conductor");
      expect(decoded.parameters.chargeDensity).toBe(0);
      expect(decoded.parameters.currentDensityX).toBe(1);
      expect(decoded.parameters.boost).toBeCloseTo(0.6 * C_SI, 1);
    }
  });

  test("permalink decoding handles empty and invalid parameters", () => {
    expect(decodeSr12Settings("").kind).toBe("none");
    expect(decodeSr12Settings("?").kind).toBe("none");
    expect(decodeSr12Settings("?other=123").kind).toBe("none");
    expect(decodeSr12Settings("?v=1.5").kind).toBe("invalid");
  });

  test("invalid parameters return refusal on session.apply", () => {
    const session = createSr12Session("test-sr12-refusal", example);

    // Superluminal boost
    const res1 = session.apply({ boost: 1.2 * C_SI });
    expect(res1.kind).toBe("refused");

    // Non-finite input
    const res2 = session.apply({ chargeDensity: Number.NaN });
    expect(res2.kind).toBe("refused");

    // Superluminal carrier in convection
    const res3 = session.apply({ carrierVelocityX: 1.5 * C_SI });
    expect(res3.kind).toBe("refused");
  });
});
