import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Me03Boundary = "body-alone" | "radiation" | "combined-isolated-system";
export type Me03RadiationDisposition = "escapes" | "retained" | "partly-retained";
export type Me03Mode = "1905" | "four-momentum" | "box-1906";
export type Me03CardId =
  | "me-03-card-radium"
  | "me-03-card-sun"
  | "me-03-card-coal"
  | "me-03-card-candle"
  | "me-03-card-bulb"
  | "me-03-heated-sealed-box"
  | "me-03-sealed-lamp-and-mirror";

export type Me03PulseSystem = "single-pulse" | "two-collinear" | "two-opposite";
export type Me03Notation = "printed" | "modern";

export type Me03Parameters = Readonly<{
  boundary: Me03Boundary;
  disposition: Me03RadiationDisposition;
  emittedEnergy: number; // L
  inputEnergy: number; // Ein
  cardId: Me03CardId;
  mode: Me03Mode;
  pulseSystem: Me03PulseSystem;
  notation: Me03Notation;
  boxMass: number; // M in kg, default 1.0
  boxLength: number; // ell in m, default 1.0
  pulseEnergy: number; // E in J, default 1.0
  assignLightMass: boolean; // default true
  magnification: number; // factor, default 1e17
}>;

export const ME03_DEFAULTS: Me03Parameters = Object.freeze({
  boundary: "body-alone",
  disposition: "escapes",
  emittedEnergy: 1.0,
  inputEnergy: 0.0,
  cardId: "me-03-card-radium",
  mode: "1905",
  pulseSystem: "two-opposite",
  notation: "printed",
  boxMass: 1.0,
  boxLength: 1.0,
  pulseEnergy: 1.0,
  assignLightMass: true,
  magnification: 1e17,
});

export const ME03_CLASSES: Readonly<Record<keyof Me03Parameters, ParameterClass>> = Object.freeze({
  boundary: "measurement",
  disposition: "input",
  emittedEnergy: "input",
  inputEnergy: "input",
  cardId: "input",
  mode: "input",
  pulseSystem: "input",
  notation: "presentation",
  boxMass: "input",
  boxLength: "input",
  pulseEnergy: "input",
  assignLightMass: "input",
  magnification: "presentation",
});

export const ME03_QUESTION =
  "When energy leaves a body, which system loses mass, and which does not?";

export const ME03_NOT_MODELED: readonly string[] = Object.freeze([
  "gravitational weighing",
  "wall stresses, or external work beyond declared inputs",
  "nuclear and chemical mechanisms beyond cited energies",
  "heat losses not declared",
  "neutrino and solar-wind mass loss",
  "the practical measurability of tiny mass changes",
  "the 1905 argument's premises (inherited, not re-derived)",
  "non-inertial or accelerated frames",
]);

export const ME03_MODEL = Object.freeze({
  id: "me-03-boundary-ledger-v1",
  constantSetId: "modern-si-2019",
  label: "System boundary energy ledger · reference model, host calculation",
  source: "src/physics/reference/massEnergy.ts",
});

export const ME03_FOUR_MOMENTUM_MODEL = Object.freeze({
  id: "four-momentum-modern",
  constantSetId: "modern-si-2019",
  label: "Modern four-momentum invariant mass (labeled later formalism)",
  source: "src/physics/reference/massEnergy.ts",
});

export const ME03_BOX_MODEL = Object.freeze({
  id: "me-03-box-1906-v1",
  constantSetId: "modern-si-2019",
  label: "1906 photon-in-a-box extension · reference model, host calculation",
  source: "src/physics/reference/massEnergy.ts",
});

const contract = (
  unit: string,
  semanticKind: string,
  ownerId: string,
  statuses: OutputContract["statuses"] = ["value"],
): OutputContract =>
  Object.freeze({ unit, semanticKind, ownerId, statuses: Object.freeze([...statuses]) });

export const ME03_OUTPUTS: Readonly<Record<string, OutputContract>> = Object.freeze({
  energyChange: contract("J", "energy-change", "massEnergy.boundaryLedger", [
    "value",
    "outside-domain",
  ]),
  massChange: contract("kg", "mass-change", "massEnergy.boundaryLedger", [
    "value",
    "not-applicable",
    "outside-domain",
  ]),
  radiationEnergyChange: contract("J", "radiation-energy-change", "massEnergy.boundaryLedger", [
    "value",
    "outside-domain",
  ]),
  radiationMassChange: contract("kg", "radiation-mass-change", "massEnergy.boundaryLedger", [
    "not-applicable",
    "outside-domain",
  ]),
  systemEnergyChange: contract("J", "system-energy-change", "massEnergy.boundaryLedger", [
    "value",
    "outside-domain",
  ]),
  systemMassChange: contract("kg", "system-mass-change", "massEnergy.boundaryLedger", [
    "value",
    "outside-domain",
  ]),
  invariantMass: contract("kg", "invariant-mass", "massEnergy.fourMomentum", [
    "value",
    "outside-domain",
  ]),
  boxDisplacement: contract("m", "box-displacement", "massEnergy.box", ["value", "outside-domain"]),
  centerOfMassShift: contract("m", "center-of-mass-shift", "massEnergy.box", [
    "value",
    "outside-domain",
  ]),
  recoilSpeed: contract("m/s", "recoil-speed", "massEnergy.box", ["value", "outside-domain"]),
  pulseFlightTime: contract("s", "pulse-flight-time", "massEnergy.box", [
    "value",
    "outside-domain",
  ]),
  pulseMomentum: contract("kg·m/s", "pulse-momentum", "massEnergy.box", [
    "value",
    "outside-domain",
  ]),
  lightMassAssigned: contract("kg", "light-mass-assigned", "massEnergy.box", [
    "value",
    "outside-domain",
  ]),
});

export const ME03_PRESETS = Object.freeze([
  Object.freeze({
    presetId: "me-03-sealed-lamp-and-mirror",
    label: "Sealed lamp and mirror (Internal transfer)",
    description:
      "Combined isolated system where light is emitted and absorbed inside the enclosure.",
    parameterValues: Object.freeze({
      boundary: "combined-isolated-system" as const,
      disposition: "retained" as const,
      cardId: "me-03-sealed-lamp-and-mirror" as const,
      mode: "1905" as const,
    }),
  }),
  Object.freeze({
    presetId: "me-03-heated-sealed-box",
    label: "Heated sealed box (External energy input)",
    description:
      "Energy enters through leads while no matter crosses the sealed boundary; mass increases by Ein/c^2.",
    parameterValues: Object.freeze({
      boundary: "combined-isolated-system" as const,
      disposition: "retained" as const,
      inputEnergy: 1.0,
      cardId: "me-03-heated-sealed-box" as const,
      mode: "1905" as const,
    }),
  }),
  Object.freeze({
    presetId: "me-03-four-momentum-opposite-pulses",
    label: "Four-momentum: Two opposite pulses",
    description:
      "Modern invariant mass of a system of two equal and opposite light pulses: m = L/c^2.",
    parameterValues: Object.freeze({
      mode: "four-momentum" as const,
      pulseSystem: "two-opposite" as const,
      emittedEnergy: 1.0,
    }),
  }),
  Object.freeze({
    presetId: "me-03-box-1906",
    label: "1906 Photon-in-a-box thought experiment",
    description:
      "A light pulse traverses a closed box of length l and mass M. Poincaré (1900) and Einstein (1906) zero center-of-mass shift check.",
    parameterValues: Object.freeze({
      mode: "box-1906" as const,
      boxMass: 1.0,
      boxLength: 1.0,
      pulseEnergy: 1.0,
      assignLightMass: true,
      magnification: 1e17,
    }),
  }),
  Object.freeze({
    presetId: "me-03-card-radium",
    label: "Radium-226 alpha decay",
    description: "Nuclear alpha decay Q = 4.871 MeV per event (5.229 mg per mole).",
    parameterValues: Object.freeze({
      cardId: "me-03-card-radium" as const,
      boundary: "body-alone" as const,
      disposition: "escapes" as const,
    }),
  }),
  Object.freeze({
    presetId: "me-03-card-sun",
    label: "The Sun (radiated luminosity)",
    description: "Radiated power of 3.828 × 10^26 W carries away 4.259 × 10^9 kg each second.",
    parameterValues: Object.freeze({
      cardId: "me-03-card-sun" as const,
      boundary: "body-alone" as const,
      disposition: "escapes" as const,
    }),
  }),
  Object.freeze({
    presetId: "me-03-card-coal",
    label: "Burning coal (24–35 MJ/kg)",
    description:
      "Combustion heat release carries away (2.670–3.894) × 10^-10 kg per kilogram burned.",
    parameterValues: Object.freeze({
      cardId: "me-03-card-coal" as const,
      boundary: "body-alone" as const,
      disposition: "escapes" as const,
    }),
  }),
  Object.freeze({
    presetId: "me-03-card-candle",
    label: "A burning candle (80 W)",
    description: "Heat output of 80 W for 1 hour carries off 3.20 ng of mass.",
    parameterValues: Object.freeze({
      cardId: "me-03-card-candle" as const,
      boundary: "body-alone" as const,
      disposition: "escapes" as const,
    }),
  }),
  Object.freeze({
    presetId: "me-03-card-bulb",
    label: "A 100 W light bulb (one year)",
    description: "100 W continuous operation for one Julian year carries off 35.1 µg.",
    parameterValues: Object.freeze({
      cardId: "me-03-card-bulb" as const,
      boundary: "body-alone" as const,
      disposition: "escapes" as const,
    }),
  }),
]);

export const ME03_PROMPTS = Object.freeze({
  sealedBox: Object.freeze({
    promptId: "me-03-predict-sealed-box",
    question:
      "A sealed box holds a battery-powered lamp and a mirror. When the lamp lights up inside, does the box's total mass change?",
    candidates: Object.freeze([
      Object.freeze({
        id: "decreases",
        label: "It decreases, because the lamp sends out energy.",
      }),
      Object.freeze({
        id: "stays-the-same",
        label: "It stays the same, because the energy is still inside.",
      }),
      Object.freeze({
        id: "increases",
        label: "It increases, because light has been added.",
      }),
    ]),
    settledCandidateId: "stays-the-same",
    explanation:
      "The energy only moves inside the boundary. Light emitted by the lamp is absorbed by the mirror and walls inside the sealed enclosure, so no energy crosses the outer boundary and the box's total mass is unchanged.",
  }),
  boxLightMass: Object.freeze({
    promptId: "me-03-predict-box-light-mass",
    controlId: "assignLightMass",
    question:
      "A light pulse crosses a closed, isolated box and is absorbed at the far wall; the box recoils while the pulse is in flight. What happens to the center of mass of the whole system?",
    candidates: Object.freeze([
      Object.freeze({
        id: "com-shifts",
        label:
          "The box moves and the center of mass permanently shifts, violating momentum conservation.",
        description:
          "Without mass assigned to the photon, the box's recoil displacement moves the system center of mass with no external force.",
        separatingAssumption: "Light carries momentum but no equivalent mass E/c^2.",
      }),
      Object.freeze({
        id: "com-stationary",
        label:
          "The center of mass stays exactly stationary because the light pulse transfers mass E/c².",
        description:
          "Assigning inertial mass m = E/c^2 to the pulse exactly cancels the box's displacement, preserving the center of mass.",
        separatingAssumption: "Energy transfer is equivalent to mass transfer m = E/c^2.",
      }),
      Object.freeze({
        id: "box-does-not-move",
        label:
          "The box never moves because light pressure is a pure wave phenomenon with no mechanical recoil.",
        description: "Rejects mechanical momentum transfer from light emission.",
        separatingAssumption: "Radiation exerts no reaction force on an emitting body.",
      }),
    ]),
    settledCandidateId: "com-stationary",
    explanation:
      "Poincaré (1900) and Einstein (1906) showed that unless electromagnetic radiation carries mass m = E/c², an isolated system could propel its own center of mass through space without any external force.",
  }),
});

export const ME03_CAPTION = Object.freeze({
  r0: "Energy that leaves a body takes mass with it. Draw the line around the body and its light together, and nothing is lost.",
  r1: "Three system boundaries: the emitting body alone, the emitted radiation, and the combined isolated enclosure. The energy-source cards trace mass loss across nuclear, radiant, chemical, and electrical transfers. In the 1906 photon-in-a-box mode (credit: Poincaré 1900), assigning mass E/c² to radiation preserves exact center-of-mass immobility.",
  r2: "Each card's mass change Δm = ΔE / c² evaluated from its cited energy transfer. In closed but non-isolated systems (radium decay, light bulb), energy crosses without matter transfer; inside isolated systems, internal transfer leaves total mass unchanged. In the 1906 box argument, recoil displacement Δx = -E l / (M c²) requires light mass m = E/c² so total center of mass shift ΔX = 0.",
  r3: "Einstein's 1905 paper draws a conditional conclusion: a body that emits energy L loses mass L/c², radium salts might put this to the test, and radiation carries inertia from the emitting to the absorbing body. In the modern four-momentum lens, two opposite pulses of total energy L have invariant mass L/c², so the system inside the boundary keeps its mass while the light stays inside. Einstein's 1906 argument (credit: Poincaré 1900) reaches the inertia of radiation from the rule that the centre of mass of an isolated system does not move.",
});
