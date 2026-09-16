import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

/** LQ-01's executable host-reference parameters. */
export type Lq01Parameters = Readonly<{
  A1: number;
  A2: number;
  delta: number;
  wavelength: number;
  separation: number;
  screenDistance: number;
  readout: "time-average" | "instantaneous";
  t: number;
  P: number;
  r: number;
  mode: "interference" | "spreading";
  screenPosition: "center" | "first-min" | "first-max";
}>;

export const LQ01_DEFAULTS: Lq01Parameters = Object.freeze({
  A1: 1.0,
  A2: 1.0,
  delta: 0.0,
  wavelength: 1.0,
  separation: 3.0,
  screenDistance: 100.0,
  readout: "time-average",
  t: 0.0,
  P: 1.0,
  r: 1.0,
  mode: "interference",
  screenPosition: "center",
});

export const LQ01_PARAMETER_CLASSES: Readonly<Record<keyof Lq01Parameters, ParameterClass>> =
  Object.freeze({
    A1: "input",
    A2: "input",
    delta: "input",
    wavelength: "input",
    separation: "input",
    screenDistance: "input",
    readout: "input",
    t: "input",
    P: "input",
    r: "input",
    mode: "input",
    screenPosition: "input",
  });
export const LQ01_CLASSES = LQ01_PARAMETER_CLASSES;

export const LQ01_BUDGET = Object.freeze({ workUnits: 1_000_000, allocationBytes: 8_000_000 });

export const LQ01_MODEL = Object.freeze({
  id: "lq01-wave-description-v1",
  constantSetId: "modern-si-2019",
  ownerKind: "host-reference",
  label: "Wave description and energy spreading, host calculation",
  source: "src/workers/operations/lq01.ts",
  assumptions: Object.freeze([
    "Linear superposition holds for the scalar wave field.",
    "The two sources are monochromatic and mutually coherent.",
    "Observation times are long compared with optical periods for time-averaged readouts.",
    "Energy radiates isotropically from point sources into non-absorbing free space.",
    "These are consequences of a continuous wave model, not quantum-mechanical claims.",
  ]),
});

function contract(
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract {
  return Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });
}

export const LQ01_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  centerIntensity: contract("1", "incidentPower", "radiation.twoSourceIntensity", [
    "value",
    "outside-domain",
  ]),
  fringeVisibility: contract("1", "visibility", "radiation.fringeVisibility", ["value"]),
  fringeSpacing: contract("lambda", "fringeSpacing", "radiation.fringeSpacingSmallAngle", [
    "value",
    "outside-domain",
  ]),
  pointSourceIntensity: contract("W/m2", "incidentPower", "radiation.inverseSquareIntensity", [
    "value",
    "outside-domain",
  ]),
  shellPower: contract("W", "incidentPower", "radiation.shellPowerIdentity", [
    "value",
    "outside-domain",
  ]),
  instantaneousCenterIntensity: contract("1", "incidentPower", "radiation.twoSourceIntensity", [
    "value",
    "outside-domain",
  ]),
  smallAperturePower: contract("W", "incidentPower", "radiation.aperturePower", [
    "value",
    "outside-domain",
  ]),
  exactDiskPower: contract("W", "incidentPower", "radiation.aperturePower", [
    "value",
    "outside-domain",
  ]),
  relativeDifference: contract("1", "dimensionlessRatio", "radiation.aperturePower", [
    "value",
    "outside-domain",
  ]),
  pathDifference: contract("lambda", "displacement1d", "radiation.twoSourceIntensity", ["value"]),
  selectedPositionIntensity: contract("1", "incidentPower", "radiation.twoSourceIntensity", [
    "value",
    "outside-domain",
  ]),
  screenIntensity: contract("1", "coordinate-intensity", "radiation.twoSourceIntensity", [
    "value",
    "outside-domain",
  ]),
});

export const LQ01_PRESETS = Object.freeze({
  "equal-amplitudes": Object.freeze({
    id: "lq-01-equal-amplitudes",
    label: "Equal amplitudes in phase (A1 = A2 = 1, delta = 0)",
    parameters: LQ01_DEFAULTS,
  }),
  "phase-shifted": Object.freeze({
    id: "lq-01-phase-shifted",
    label: "Half-wave phase shift (A1 = A2 = 1, delta = pi)",
    parameters: Object.freeze({ ...LQ01_DEFAULTS, delta: Math.PI }),
  }),
  "unequal-amplitudes": Object.freeze({
    id: "lq-01-unequal-amplitudes",
    label: "Unequal amplitudes (A1 = 1, A2 = 0.5, delta = 0)",
    parameters: Object.freeze({ ...LQ01_DEFAULTS, A2: 0.5 }),
  }),
  "inverse-square-spreading": Object.freeze({
    id: "lq-01-inverse-square-spreading",
    label: "Inverse-square spherical spreading (P = 1 W, r = 1 m)",
    parameters: Object.freeze({ ...LQ01_DEFAULTS, mode: "spreading" as const }),
  }),
  "instantaneous-snapshot": Object.freeze({
    id: "lq-01-instantaneous-snapshot",
    label: "Instantaneous field snapshot (t = 0)",
    parameters: Object.freeze({ ...LQ01_DEFAULTS, readout: "instantaneous" as const, t: 0 }),
  }),
});

export const LQ01_PROMPTS = Object.freeze({
  "phase-shift": Object.freeze({
    id: "lq-01-predict-phase-shift",
    question:
      "Two equal waves meet at the center of the screen. What happens to the intensity there when the phase difference goes from 0 to π?",
    controlId: "delta",
    candidates: Object.freeze([
      Object.freeze({
        id: "unchanged",
        label: "It stays the same",
        description: "Interference does not change the total brightness at the center",
        relation: "⟨I⟩(π) = ⟨I⟩(0)",
      }),
      Object.freeze({
        id: "halves",
        label: "It halves",
        description: "Shifting one wave cancels half the incoming radiant power",
        relation: "⟨I⟩(π) = 0.5 * ⟨I⟩(0)",
      }),
      Object.freeze({
        id: "drops-to-zero",
        label: "It drops to zero",
        description: "Equal waves out of phase by half a cycle cancel completely",
        relation: "⟨I⟩(π) = 0",
      }),
    ]),
  }),
  "inverse-square": Object.freeze({
    id: "lq-01-predict-inverse-square",
    question:
      "The source keeps its power. What happens to the intensity when the distance from it doubles?",
    controlId: "r",
    candidates: Object.freeze([
      Object.freeze({
        id: "halves",
        label: "It halves",
        description: "Intensity falls in linear proportion to distance",
        relation: "I ∝ r^(-1)",
      }),
      Object.freeze({
        id: "quarters",
        label: "It drops to a quarter",
        description: "Energy spreads over the spherical area 4*pi*r^2",
        relation: "I ∝ r^(-2)",
      }),
      Object.freeze({
        id: "unchanged",
        label: "It stays the same",
        description: "Power radiates without geometric dilution",
        relation: "I ∝ r^0",
      }),
    ]),
  }),
});
