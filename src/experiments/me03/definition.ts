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

/** The instrument's four readings, shown on the reader's detail setting. Mirrored in
 * content/editorial/readings-owners/am-me-03-system-boundary-0arb.yaml, which the readings audit reads. */
export const ME03_CAPTION = Object.freeze({
  r0: "Energy that leaves a body takes mass with it. Draw the boundary around the body alone and it gets lighter; draw it around the body and the light it gave off, and nothing is lost.",
  r1: "The mass–energy paper concludes that a body giving off energy L loses mass L/V², that it does not matter that the energy leaves as radiation, and that, if the theory is right, radiation carries inertia from the body that emits it to the body that absorbs it. The instrument keeps the accounting honest by making you choose where the boundary goes. With 1 J emitted and the boundary around the body alone, the body's energy falls by 1 J and its mass by 1.11 × 10^{−17} kg. Around the radiation alone, 1 J arrives, and the lab gives it no rest mass in the 1905 account, saying so rather than inventing one. Around the body and its light together, an isolated system, nothing changes. In the four-momentum lens, a modern addition, two opposite pulses of total energy 1 J have an invariant mass of 1.11 × 10^{−17} kg, which is where the body's lost mass went. The energy-source cards apply ΔE/c² to cited modern transfers: a radium-226 alpha decay of 4.871 MeV changes mass by 8.68 × 10^{−30} kg; the Sun's 3.828 × 10^{26} W takes away 4.26 × 10^{9} kg each second; a kilogram of coal burned at 30 MJ, 3.34 × 10^{−10} kg; a candle for an hour, 3.20 × 10^{−12} kg; a 100 W bulb for a year, 3.51 × 10^{−8} kg. In the 1906 photon-in-a-box mode (credit: Poincaré 1900), a pulse crossing a floating box shows that the centre of mass stays put only if the light is given the mass E/c².",
  r2: "The rule is Δm = ΔE/c², with c² = (2.998 × 10^{8})² = 8.988 × 10^{16} m²/s², so 1 J corresponds to 1/(8.988 × 10^{16}) = 1.11 × 10^{−17} kg. The sign follows the boundary. A body that emits 1 J has 1 J less inside its boundary, so its mass falls by 1.11 × 10^{−17} kg. Move the boundary around the body and its light, and the energy inside does not change, so neither does the mass: the joule left the body but not the system. Now the cards. The radium decay releases 4.871 × 10^{6} × 1.602 × 10^{−19} = 7.80 × 10^{−13} J, which divided by c² is 8.68 × 10^{−30} kg, about 2 parts in 100 000 of the radium atom's mass. The Sun radiates 3.828 × 10^{26} J each second, and dividing by c² gives 4.26 × 10^{9} kg, some four million tonnes a second. The bulb uses 100 W × 31 557 600 s = 3.156 × 10^{9} J in a year, which is 3.51 × 10^{−8} kg, about 35 micrograms. Now the 1906 box argument. A box of mass 1 kg and length 1 m floats free. A pulse of 1 J leaves one end carrying momentum E/c = 1/(2.998 × 10^{8}) = 3.34 × 10^{−9} kg·m/s, so the box recoils the other way at 3.34 × 10^{−9} m/s. The pulse takes l/c = 3.34 × 10^{−9} s to cross, and in that time the box moves back 3.34 × 10^{−9} × 3.34 × 10^{−9} = 1.11 × 10^{−17} m, which is El/(Mc²). When the pulse is absorbed at the far end, the box stops. Nothing outside acted on the box, so the centre of mass of the whole system cannot have moved. The box's backward step is balanced only if the pulse carried a mass m across the length l with ml = M × 1.11 × 10^{−17} m, so m = 1.11 × 10^{−17} kg = E/c². Switch that assignment off and the lab shows the centre of mass moving by 1.11 × 10^{−17} m, which an isolated system cannot do.",
  r3: "The 1905 conclusions are conditional. The paper says it is not excluded that bodies whose energy content varies greatly, radium salts for instance, could test the theory, and that if the theory corresponds to the facts, radiation carries inertia between the emitting and absorbing bodies. It gives no rest mass to free radiation; the invariant mass of a system of light belongs to the later four-momentum language. The box is Einstein's 1906 argument (credit: Poincaré 1900): his paper credits Poincaré's remark of 1900 that electromagnetic energy behaves like a fluid with inertia. The energy-source values are modern and cited on each card; none was measured in 1905, and the mass changes of chemical and everyday transfers are far too small to weigh.",
});
