import { expect, test } from "bun:test";
import assert from "node:assert/strict";
import { getConstantSet } from "../../physics/reference/constants.ts";
import { radiationEntropyVolumeChange } from "../../physics/reference/radiation/entropy.ts";
import {
  regimeRelativeErrors,
  wienFrequencyEnergyDensity,
} from "../../physics/reference/radiation/spectra.ts";
import { spectralConstantsSI } from "../../physics/reference/radiation/spectralConstants.ts";
import { LQ06_READER_WEAVE } from "../../reader/weave/coefficientMatchPassages.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../permalink/codec.ts";
import { restoreTape, tapeForSettings } from "../permalink/sessionTape.ts";
import { createSessionWeave } from "../weave/sessionSource.ts";
import { LQ06_DEFAULTS, LQ06_PRESETS, type Lq06Parameters } from "./definition.ts";
import { prepareLinkedCoefficientExample } from "./linkedSettings.ts";
import { decodeLq06Settings, encodeLq06Settings } from "./permalink.ts";
import { createLq06Session, evaluateLq06 } from "./session.ts";
import { LQ06_TAPE } from "./tape.ts";

const matched: Lq06Parameters = {
  ...LQ06_DEFAULTS,
  selectedSubexpression: "N_E_over_R_beta_nu",
};
const affected = ["effectiveIndependentCount", "radiationEntropy", "entropyVolumeCoefficient"];
const retained = [
  "quantumEnergy",
  "quantumEnergyEv",
  "gasEntropy",
  "gasEntropyVolumeCoefficient",
  "meanQuantumEnergyWien",
  "meanQuantumEnergyWienEv",
  "moleculeMeanKineticEnergyEv",
  "meanEnergyRatio",
  "ratioAt600THz",
];

test("a correct expression cannot certify a radiation correspondence outside Wien", () => {
  const settings = { ...matched, frequency: 2e14, temperature: 6000, volumeRatio: 1 };
  const outputs = evaluateLq06(settings);
  for (const quantityId of affected) {
    const result = outputs.find((item) => item.quantityId === quantityId);
    assert.equal(result?.status, "outside-domain");
    if (result?.status !== "outside-domain") throw new Error("Expected a typed domain result");
    expect(result.condition).toBe("outside-wien-regime");
    expect(result.domainKind).toBe("model");
    expect(result.reason).toContain("1%");
    expect(Object.hasOwn(result, "value")).toBe(false);
  }
  const verdict = outputs.find((item) => item.quantityId === "correspondenceVerdict");
  assert.equal(verdict?.status, "not-applicable");
  if (verdict?.status !== "not-applicable") throw new Error("Expected no correspondence verdict");
  expect(verdict.reason).toContain("only in the Wien regime");
  for (const id of retained)
    expect(outputs.find((item) => item.quantityId === id)?.status).toBe("value");
  expect(outputs.find((item) => item.quantityId === "gasEntropy")).toMatchObject({ value: 0 });
  const meanRatio = outputs.find((item) => item.quantityId === "meanEnergyRatio");
  assert.equal(meanRatio?.status, "value");
  if (meanRatio?.status !== "value") throw new Error("Expected a formal mean-energy ratio");
  expect(meanRatio.value).toBeCloseTo(2, 12);
});

test("both volume endpoints agree with the existing entropy owner's admission for both constant sets", () => {
  for (const constantSetId of ["modern-si-2019", "einstein-1905-light-quanta-printed"]) {
    const constants = getConstantSet(constantSetId);
    for (const [temperature, volumeRatio, admitted] of [
      [5000, 0.5, true],
      [5000, 0.25, false], // Initially dilute; compression leaves the regime.
      [7000, 10, false], // Finally dilute; expansion cannot repair the initial state.
      [3000, 1, true],
    ] as const) {
      const density = wienFrequencyEnergyDensity(matched.frequency, temperature, constants);
      assert.equal(density.status, "value");
      if (density.status !== "value") throw new Error("Expected a representable test density");
      const V0 = 0.01;
      const dNu = 1e10;
      const energy = density.value * V0 * dNu;
      const owned = radiationEntropyVolumeChange(
        { E: energy, nu: matched.frequency, V0, V: V0 * volumeRatio, dNu },
        spectralConstantsSI(constants),
        { epsilonW: 0.01 },
      );
      expect(owned.status === "value").toBe(admitted);
      const outputs = evaluateLq06({
        ...matched,
        radiationEnergy: energy,
        temperature,
        volumeRatio,
        constantSetId,
      });
      const result = outputs.find((item) => item.quantityId === "radiationEntropy");
      expect(result?.status === "value").toBe(admitted);
      if (owned.status === "value" && result?.status === "value") {
        if (typeof result.value !== "number") throw new Error("Expected a scalar entropy");
        assert.ok(
          Math.abs(result.value - owned.deltaS) <= Math.max(Math.abs(owned.deltaS) * 1e-12, 1e-30),
        );
      }
    }
  }
});

test("the declared constant set determines the Wien boundary, including printed beta", () => {
  const settings = { ...matched, temperature: 6300, volumeRatio: 1 };
  for (const [constantSetId, admitted] of [
    ["modern-si-2019", false],
    ["einstein-1905-light-quanta-printed", true],
  ] as const) {
    expect(
      regimeRelativeErrors(settings.frequency, settings.temperature, getConstantSet(constantSetId))
        .wienAdmitted,
    ).toBe(admitted);
    const verdict = evaluateLq06({ ...settings, constantSetId }).find(
      (item) => item.quantityId === "correspondenceVerdict",
    );
    expect(verdict?.status).toBe(admitted ? "value" : "not-applicable");
  }
});

test("deep-Wien inputs do not lose admission when a raw spectral density would underflow", () => {
  const settings = { ...matched, frequency: 5e15, temperature: 100, volumeRatio: 0.0001 };
  expect(
    regimeRelativeErrors(
      settings.frequency,
      settings.temperature,
      getConstantSet(settings.constantSetId),
    ).x,
  ).toBeGreaterThan(1000);
  const results = evaluateLq06(settings);
  expect(results.every((item) => item.status === "value")).toBe(true);
  const session = createLq06Session("wien-domain-boundary");
  const before = session.getSnapshot();
  for (const volumeRatio of [0, Number.MIN_VALUE]) {
    expect(session.apply({ volumeRatio }).kind).toBe("refused");
    expect(session.getSnapshot()).toBe(before);
  }
});

test("domain exit and recovery update accepted results and source pointers together", () => {
  const session = createLq06Session("wien-domain-weave");
  const source = createSessionWeave(session, LQ06_READER_WEAVE);
  expect(session.apply(matched).kind).toBe("accepted");
  const initial = session.getSnapshot().accepted;
  expect(session.apply({ temperature: 5000, volumeRatio: 0.25 }).kind).toBe("accepted");
  const state = source.getSnapshot();
  assert.equal(state.kind, "ready");
  if (state.kind !== "ready") throw new Error("Expected accepted partial results");
  expect(state.accepted).toBe(session.getSnapshot().accepted);
  expect(state.derived.flags["lq06-s6-entropy-match"]?.lit).toBe(false);
  expect(state.derived.flags["lq06-s6-effective-count"]?.lit).toBe(false);
  expect(state.derived.flags["lq06-s6-mean-quantum-energy"]?.lit).toBe(true);
  expect(state.accepted).not.toBe(initial);
  const outside = session.getSnapshot();
  expect(session.apply({ temperature: -1 }).kind).toBe("refused");
  expect(session.getSnapshot()).toBe(outside);
  expect(session.apply({ volumeRatio: 0.5 }).kind).toBe("accepted");
  const recovered = source.getSnapshot();
  assert.equal(recovered.kind, "ready");
  if (recovered.kind !== "ready") throw new Error("Expected an admitted correspondence");
  expect(recovered.derived.flags["lq06-s6-entropy-match"]?.lit).toBe(true);
  expect(session.acceptedParameters().selectedSubexpression).toBe("N_E_over_R_beta_nu");
});

test("shared out-of-regime settings retain their exact inputs and typed non-values", () => {
  const parameters = { ...matched, frequency: 2e14, temperature: 6000 };
  const decoded = decodeLq06Settings(encodeLq06Settings(parameters));
  assert.equal(decoded.kind, "settings");
  if (decoded.kind !== "settings") throw new Error("Expected complete shared settings");
  const original = {
    sourceDigest: `source:sha256:${"a".repeat(64)}`,
    parameters: LQ06_DEFAULTS,
    results: [],
    stepIndex: 0,
    simulationTime: 0,
  };
  const linked = prepareLinkedCoefficientExample(original, decoded.parameters);
  assert.equal(linked.kind, "accepted");
  if (linked.kind !== "accepted") throw new Error("Expected an accepted domain-exit example");
  const restored = createLq06Session("linked-outside-wien", linked.example);
  expect(restored.acceptedParameters()).toEqual(parameters);
  expect(restored.getSnapshot().accepted?.outputs).toEqual(evaluateLq06(parameters));
  expect(original.parameters).toBe(LQ06_DEFAULTS);
  for (const preset of Object.values(LQ06_PRESETS)) {
    const verdict = evaluateLq06(preset.parameters).find(
      (item) => item.quantityId === "correspondenceVerdict",
    );
    if (preset.parameters.selectedSubexpression !== "none")
      expect(verdict).toMatchObject({ status: "value", value: 1 });
  }
});

test("bounded tape replay restores a domain exit without resurrecting an earlier successful count", () => {
  const parameters = { ...matched, frequency: 2e14, temperature: 6000 };
  const tape = tapeForSettings(LQ06_TAPE, parameters);
  assert.ok(tape);
  const encoded = encodeTapePermalink(tape);
  expect(encoded.length).toBeLessThan(4096);
  const decoded = decodeTapePermalink(`https://example.test/lab/lq-06/?tape=${encoded}`);
  assert.equal(decoded.kind, "success");
  if (decoded.kind !== "success") throw new Error("Expected a decoded tape link");
  const owner = createLq06Session("wien-domain-replay");
  expect(owner.apply(matched).kind).toBe("accepted");
  expect(restoreTape(LQ06_TAPE, owner, decoded.tape)).toEqual({ kind: "restored" });
  expect(owner.acceptedParameters()).toEqual(parameters);
  expect(owner.getSnapshot().accepted?.outputs).toEqual(evaluateLq06(parameters));
});
