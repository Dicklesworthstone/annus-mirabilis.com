import { expect, test } from "bun:test";
import {
  calculateTapeAsNewRun,
  replayTapeOnSession,
  tapeForSettings,
  tapeStateDigestV2,
} from "../permalink/sessionTape.ts";
import type { TapeV2 } from "../permalink/types.ts";
import { me03ComparisonParameters } from "./comparison.ts";
import { fromMe03Draft, toMe03Draft } from "./controls.ts";
import { ME03_DEFAULTS, type Me03Parameters } from "./definition.ts";
import { validateMe03Parameters } from "./parameters.ts";
import { decodeMe03Settings, encodeMe03Settings } from "./permalink.ts";
import { createMe03Session } from "./session.ts";
import { ME03_TAPE } from "./tape.ts";

const modern: Me03Parameters = {
  ...ME03_DEFAULTS,
  mode: "four-momentum",
  pulseSystem: "single-pulse",
  emittedEnergy: 1e16,
};

test("the modern session publishes the recoil owner and recovers from an impossible budget", () => {
  const session = createMe03Session("modern-emission", modern);
  const before = session.getSnapshot().accepted;
  expect(
    before?.outputs.find((output) => output.quantityId === "emitterRecoilVelocity")?.status,
  ).toBe("value");
  expect(
    before?.outputs.find((output) => output.quantityId === "radiationMassChange")?.status,
  ).toBe("value");
  expect(session.apply({ ...modern, emittedEnergy: 8e16 }).kind).toBe("accepted");
  const refused = session.getSnapshot().accepted;
  expect(refused?.outputs.find((output) => output.quantityId === "massChange")?.status).toBe(
    "outside-domain",
  );
  expect(refused?.outputs.find((output) => output.quantityId === "invariantMass")?.status).toBe(
    "value",
  );
  expect(session.apply({ ...modern, emittedEnergy: 8e16, initialEmitterMass: 2 }).kind).toBe(
    "accepted",
  );
  expect(
    session.getSnapshot().accepted?.outputs.find((output) => output.quantityId === "massChange")
      ?.status,
  ).toBe("value");
});

test("malformed mass input leaves the accepted run untouched and draft NaN is not repaired", () => {
  const session = createMe03Session("modern-invalid-mass", modern);
  const before = session.getSnapshot().accepted;
  for (const initialEmitterMass of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "1kg", null]) {
    expect(session.apply({ ...modern, initialEmitterMass }).kind).toBe("refused");
    expect(session.getSnapshot().accepted).toBe(before);
  }
  const badDraft = fromMe03Draft({ ...toMe03Draft(modern), initialEmitterMass: "" });
  expect(Number.isNaN(badDraft.initialEmitterMass)).toBe(true);
  expect(validateMe03Parameters(badDraft).kind).toBe("refused");
});

test("zero emission is admitted only in the modern lens", () => {
  expect(validateMe03Parameters({ ...modern, emittedEnergy: 0 }).kind).toBe("accepted");
  expect(validateMe03Parameters({ ...ME03_DEFAULTS, emittedEnergy: 0 }).kind).toBe("refused");
});

test("historical heating and disposition are saved but inactive in modern isolated emission", () => {
  const session = createMe03Session("modern-saved-historical", modern);
  const outputs = session.getSnapshot().accepted?.outputs;
  expect(session.apply({ ...modern, inputEnergy: 40, disposition: "retained" }).kind).toBe(
    "accepted",
  );
  expect(session.getSnapshot().accepted?.outputs).toEqual(outputs);
  expect(
    session.apply({
      ...modern,
      mode: "1905",
      inputEnergy: 40,
      disposition: "retained",
      boundary: "combined-isolated-system",
    }).kind,
  ).toBe("accepted");
  const energy = session
    .getSnapshot()
    .accepted?.outputs.find((output) => output.quantityId === "energyChange");
  expect(energy?.status === "value" && energy.value).toBe(40);
});

test("M0 settings round-trip and pre-recoil links receive the explicit default", () => {
  const parameters = { ...modern, initialEmitterMass: 2.5 };
  const query = encodeMe03Settings(parameters);
  expect(query).toContain("M0=2.5");
  const decoded = decodeMe03Settings(query);
  expect(decoded.kind === "settings" && decoded.parameters.initialEmitterMass).toBe(2.5);
  const older = decodeMe03Settings("?mode=four-momentum&pulses=single-pulse&L=90000000000000000");
  expect(older.kind).toBe("settings");
  if (older.kind !== "settings") throw new Error("Legacy settings were not loaded.");
  expect(older.parameters.initialEmitterMass).toBe(1);
  const session = createMe03Session("legacy-modern-large-energy", older.parameters);
  expect(
    session.getSnapshot().accepted?.outputs.find((output) => output.quantityId === "massChange")
      ?.status,
  ).toBe("outside-domain");
  expect(decodeMe03Settings("?mode=four-momentum&M0=bad").kind).toBe("invalid");
});

test("only the new inactive mass field can migrate in an older complete comparison", () => {
  const { initialEmitterMass: _mass, ...oldSettings } = ME03_DEFAULTS;
  expect(me03ComparisonParameters(oldSettings)).toEqual(ME03_DEFAULTS);
  const { emittedEnergy: _energy, ...incomplete } = oldSettings;
  expect(() => me03ComparisonParameters(incomplete)).toThrow();
  expect(
    createMe03Session("legacy-prepared", oldSettings as Me03Parameters).acceptedParameters()
      .initialEmitterMass,
  ).toBe(1);
});

test("legacy admission rejects getters and custom prototypes before reading values", () => {
  const { initialEmitterMass: _mass, ...oldSettings } = ME03_DEFAULTS;
  let getterCalls = 0;
  const accessor = { ...oldSettings };
  Object.defineProperty(accessor, "emittedEnergy", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 1;
    },
  });
  expect(validateMe03Parameters(accessor).kind).toBe("refused");
  expect(() => me03ComparisonParameters(accessor)).toThrow("boundary-comparison-evidence");
  expect(getterCalls).toBe(0);
  const customPrototype = Object.create(
    { inherited: true },
    Object.getOwnPropertyDescriptors(oldSettings),
  );
  expect(validateMe03Parameters(customPrototype).kind).toBe("refused");
  expect(() => me03ComparisonParameters(customPrototype)).toThrow("boundary-comparison-evidence");
  expect(me03ComparisonParameters(Object.assign(Object.create(null), oldSettings))).toEqual(
    ME03_DEFAULTS,
  );
});

test("an older tape keeps its old identity and can explicitly calculate a new mass-aware run", () => {
  const current = tapeForSettings(ME03_TAPE, modern);
  if (!current) throw new Error("The modern setup must be shareable.");
  const { initialEmitterMass: _mass, ...legacyConditions } = current.initialConditions;
  const legacy: TapeV2 = {
    ...current,
    modelIdentity: { ...current.modelIdentity, artifactDigest: `host:sha256:${"0".repeat(64)}` },
    initialConditions: legacyConditions,
    acceptedCheckpoint: {
      ...current.acceptedCheckpoint,
      digest: tapeStateDigestV2(legacyConditions, 0),
    },
  };
  const session = createMe03Session("legacy-tape-target");
  const before = session.getSnapshot().accepted;
  expect(replayTapeOnSession(ME03_TAPE, session, legacy).kind).not.toBe("success");
  expect(session.getSnapshot().accepted).toBe(before);
  const recalculated = calculateTapeAsNewRun(ME03_TAPE, session, { tape: legacy });
  expect(recalculated.kind).toBe("calculated");
  expect(session.acceptedParameters().initialEmitterMass).toBe(1);
  expect(session.acceptedParameters().emittedEnergy).toBe(modern.emittedEnergy);
  expect(
    session
      .getSnapshot()
      .accepted?.outputs.find((output) => output.quantityId === "emitterRecoilVelocity")?.status,
  ).toBe("value");
  expect(legacy.modelIdentity.artifactDigest).toBe(`host:sha256:${"0".repeat(64)}`);
});
