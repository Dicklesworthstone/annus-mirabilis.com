import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";

export type Me03Boundary = "body-alone" | "radiation" | "combined-isolated-system";
export type Me03RadiationDisposition = "escapes" | "retained" | "partly-retained";
export type Me03Mode = "1905" | "four-momentum";
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
    presetId: "me-03-card-radium",
    label: "Radium-226 Alpha Decay",
    description: "Nuclear alpha decay Q = 4.871 MeV per event (5.229 mg per mole).",
    parameterValues: Object.freeze({
      cardId: "me-03-card-radium" as const,
      boundary: "body-alone" as const,
      disposition: "escapes" as const,
    }),
  }),
  Object.freeze({
    presetId: "me-03-card-sun",
    label: "The Sun (Radiated Luminosity)",
    description: "Radiated power of 3.828 × 10^26 W carries away 4.259 × 10^9 kg each second.",
    parameterValues: Object.freeze({
      cardId: "me-03-card-sun" as const,
      boundary: "body-alone" as const,
      disposition: "escapes" as const,
    }),
  }),
  Object.freeze({
    presetId: "me-03-card-coal",
    label: "Burning Coal (24–35 MJ/kg)",
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
    label: "A Burning Candle (80 W)",
    description: "Heat output of 80 W for 1 hour carries off 3.20 ng of mass.",
    parameterValues: Object.freeze({
      cardId: "me-03-card-candle" as const,
      boundary: "body-alone" as const,
      disposition: "escapes" as const,
    }),
  }),
  Object.freeze({
    presetId: "me-03-card-bulb",
    label: "100 W Light Bulb (1 Year)",
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
});

export const ME03_CAPTION = Object.freeze({
  r0: "Energy that leaves a body takes mass with it. Draw the line around the body and its light together, and nothing is lost.",
  r1: "Three system boundaries: the emitting body alone, the emitted radiation, and the combined isolated enclosure. The energy-source cards trace mass loss across nuclear, radiant, chemical, and electrical transfers.",
  r2: "Each card's mass change Δm = ΔE / c² evaluated from its cited energy transfer. In closed but non-isolated systems (radium decay, light bulb), energy crosses without matter transfer; inside isolated systems, internal transfer leaves total mass unchanged.",
  r3: "Einstein 1905 paper 4 conditional conclusions on radium and inertia conveyance; modern four-momentum invariant mass of two opposite pulses P_μ P^μ = (L/c)² giving system invariant mass m = L/c².",
});
