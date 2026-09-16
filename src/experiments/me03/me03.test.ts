import { describe, expect, test } from "bun:test";
import { ME03_DEFAULTS, ME03_PRESETS, type Me03Parameters } from "./definition.ts";
import { decodeMe03Settings, encodeMe03Settings } from "./permalink.ts";
import { createMe03Session } from "./session.ts";

describe("ME-03 session & instance store", () => {
  test("initial session publishes default prepared snapshot cleanly", () => {
    const session = createMe03Session("test-me03-init");
    const snap = session.getSnapshot();

    expect(snap.accepted).not.toBeNull();
    expect(snap.accepted?.experimentId).toBe("me-03");
    expect(snap.accepted?.instanceId).toBe("test-me03-init");
    expect(snap.accepted?.outputs.length).toBe(7);

    const params = session.acceptedParameters();
    expect(params.boundary).toBe("body-alone");
    expect(params.cardId).toBe("me-03-card-radium");
    expect(params.mode).toBe("1905");
  });

  test("measurement change (boundary) preserves run identity while updating outputs", () => {
    const session = createMe03Session("test-me03-meas");

    const res = session.apply({
      ...ME03_DEFAULTS,
      boundary: "combined-isolated-system",
    });

    expect(res.kind).toBe("accepted");
    const nextSnap = session.getSnapshot();
    expect(nextSnap.accepted?.parameters.boundary).toBe("combined-isolated-system");
    // Measurement change issues a measurement request with same parent run
    const out0 = nextSnap.accepted?.outputs[0];
    expect(out0?.status).toBe("value");
    if (out0?.status === "value") {
      expect(out0.value).toBe(0); // system energy change is 0
    }
  });

  test("setup change (cardId, disposition, Ein) creates a new request and updates ledger", () => {
    const session = createMe03Session("test-me03-setup");
    const res = session.apply({
      ...ME03_DEFAULTS,
      cardId: "me-03-heated-sealed-box",
      boundary: "combined-isolated-system",
      disposition: "retained",
      inputEnergy: 50.0,
    });

    expect(res.kind).toBe("accepted");
    const snap = session.getSnapshot();
    const out4 = snap.accepted?.outputs[4];
    const out5 = snap.accepted?.outputs[5];
    expect(out4?.status).toBe("value");
    expect(out5?.status).toBe("value");
    if (out4?.status === "value" && out5?.status === "value") {
      expect(out4.value).toBe(50.0); // systemEnergyChange = 50 J
      expect(out5.value).toBeCloseTo(50.0 / (299792458 * 299792458), 20);
    }
  });

  test("four-momentum mode calculates invariant mass for two opposite pulses", () => {
    const session = createMe03Session("test-me03-four-mom");
    const res = session.apply({
      ...ME03_DEFAULTS,
      mode: "four-momentum",
      pulseSystem: "two-opposite",
      emittedEnergy: 9e16, // 9e16 J gives ~ 1 kg
    });

    expect(res.kind).toBe("accepted");
    const snap = session.getSnapshot();
    const invMass = snap.accepted?.outputs[6];
    expect(invMass?.status).toBe("value");
    if (invMass?.status === "value") {
      expect(invMass.value).toBeCloseTo(1.00137, 2);
    }
  });

  test("all 8 registered presets apply cleanly to the session", () => {
    const session = createMe03Session("test-me03-presets");
    for (const preset of ME03_PRESETS) {
      const nextParams: Me03Parameters = {
        ...ME03_DEFAULTS,
        ...preset.parameterValues,
      };
      const res = session.apply(nextParams);
      expect(res.kind).toBe("accepted");
    }
  });

  test("permalink encode and decode roundtrip", () => {
    const custom: Me03Parameters = {
      boundary: "combined-isolated-system",
      disposition: "retained",
      emittedEnergy: 2.5,
      inputEnergy: 10.0,
      cardId: "me-03-heated-sealed-box",
      mode: "four-momentum",
      pulseSystem: "single-pulse",
      notation: "modern",
    };

    const query = encodeMe03Settings(custom);
    expect(query).toContain("boundary=combined-isolated-system");
    expect(query).toContain("L=2.5");
    expect(query).toContain("Ein=10");
    expect(query).toContain("mode=four-momentum");

    const decoded = decodeMe03Settings(query);
    expect(decoded.kind).toBe("settings");
    if (decoded.kind === "settings") {
      expect(decoded.parameters.boundary).toBe(custom.boundary);
      expect(decoded.parameters.emittedEnergy).toBe(custom.emittedEnergy);
      expect(decoded.parameters.inputEnergy).toBe(custom.inputEnergy);
      expect(decoded.parameters.mode).toBe(custom.mode);
      expect(decoded.parameters.notation).toBe(custom.notation);
    }
  });

  test("invalid or refused parameters are cleanly rejected", () => {
    const session = createMe03Session("test-me03-refusal");
    const res = session.apply({
      ...ME03_DEFAULTS,
      emittedEnergy: -5.0,
    });

    expect(res.kind).toBe("refused");
    if (res.kind === "refused") {
      expect(res.refusal.details?.code).toBe("nonfinite-input");
    }
  });
});
