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
        relation: "I ~ 1/r",
      }),
      Object.freeze({
        id: "quarters",
        label: "It drops to a quarter",
        description: "Energy spreads over the sphere’s area, 4πr²",
        relation: "I ~ 1/r²",
      }),
      Object.freeze({
        id: "unchanged",
        label: "It stays the same",
        description: "Power radiates without geometric dilution",
        relation: "I ~ r⁰",
      }),
    ]),
  }),
});

/**
 * The instrument's four readings (R0 to R3), checked against the introduction of the light paper
 * (transcript ap-17-132, Annalen pp. 132–133) and against the owner at the defaults (after
 * 457ef810): 4 averaged at the centre and 8 at t = 0 for two unit waves in phase, fringes 33.3λ
 * apart, 0.0796 W/m² at 1 m from 1 W, the full 1 W through every sphere, and 7.96 × 10^{−6} W
 * through 1 cm². The readings-owners record am-lq-01-wave-description-kv2r.yaml carries the same text.
 */
export const LQ01_CAPTION = Object.freeze({
  r0: "Treat light as a continuous wave and two sources make bright and dark stripes, while the light of one source spreads ever thinner over larger and larger spheres. Einstein granted that this picture explains everything purely optical, and asked whether it could still fail where light is produced or absorbed.",
  r1: "The light paper opens by setting the wave theory beside the atomic picture of matter. In Maxwell's theory the energy of light is a continuous function of space: from a point source it spreads over an ever larger volume, while the energy of a body is a sum over a finite number of atoms and electrons. Einstein wrote that the wave theory, working with continuous functions of space, has proved itself excellently for purely optical phenomena and will probably never be replaced by another theory. He then added the caveat this instrument shows: optical observations concern averages over time, not instantaneous values. Two coherent unit waves in phase give an averaged intensity of 4 at the centre, in units of one wave's average, while at one instant the same point swings between 0 and 8 in every cycle; the bright fringes are 33.3 wavelengths apart on a screen 100 wavelengths from sources 3 wavelengths apart. One point source of 1 W spreads to 0.0796 W/m^{2} at 1 m, and the whole sphere around it always receives the full 1 W. His question was whether this continuous picture, confirmed for diffraction, reflection, refraction and dispersion, would still hold for the production and transformation of light.",
  r2: "Start with one wave. At a fixed point its field rises and falls as A cos(ωt), and its square, which carries the energy, goes as A^{2} cos^{2}(ωt). Over a whole cycle cos^{2} averages to 1/2, so the average of the square is A^{2}/2. The instrument measures intensity in units of that average for a wave of amplitude 1, so one unit wave reads 1 on average and 2 at its peak. Now two unit waves arrive in step at the centre of the screen. The fields add first: the total is 2 cos(ωt), and its square is 4 cos^{2}(ωt). In the instrument's units that swings between 0 and 8 in every cycle and averages to 4, which is twice the 1 + 1 you would get by adding the two intensities; the extra 2 is the cross term 2A_{1}A_{2} cos δ with the phase difference δ = 0. Shift one wave by half a cycle, δ = π, and the cross term is −2: the average is 0, a dark stripe. Along the screen the difference in path changes the phase, and the bright stripes repeat each time it grows by one wavelength. For sources d = 3 wavelengths apart and a screen L = 100 wavelengths away, the spacing is λL/d = 100/3 = 33.3 wavelengths. For the spreading, take a point source radiating P = 1 W equally in every direction. At distance r the power crosses a sphere of area 4πr^{2}, so the intensity is P/(4πr^{2}) = 1/(4π × 1^{2}) = 0.0796 W/m^{2} at 1 m, a quarter of that at 2 m, and the total over the sphere is 1 W at every radius. A window of 1 cm^{2}, that is 10^{−4} m^{2}, at 1 m receives about 0.0796 × 10^{−4} = 7.96 × 10^{−6} W; the exact figure for a flat disc differs by about 2 parts in 100 000. As r grows, the energy through any small window keeps falling without limit. The next paragraph of the paper replaces that continuous thinning with a hypothesis: a finite number of energy quanta, localized at points, which move without dividing and are absorbed or produced only as wholes.",
  r3: "The purely optical phenomena Einstein names are diffraction, reflection, refraction and dispersion. He kept the wave theory for them, writing that it would probably never be replaced, and confined his doubt to the production and transformation of light: black-body radiation, photoluminescence and the production of cathode rays by ultraviolet light. He called his own proposal a heuristic point of view, not a proof that light is not a wave. The two-source arrangement is Young's, from the first years of the nineteenth century; the field theory is Maxwell's of 1865, and Hertz produced its waves in 1888. The later dispute over whether single quanta interfere belongs to the history after 1905 and is not part of this paper.",
});
