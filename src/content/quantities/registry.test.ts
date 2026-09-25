import { describe, expect, test } from "bun:test";
import {
  combine,
  type Dimension,
  dimension,
  isDimensionless,
  power,
  rational,
  sameDimension,
} from "../dimensions/rational.ts";
import { validateQuantity } from "../schemas/argument.ts";
import {
  FRAME_SUFFIXES,
  getQuantity,
  getQuantityRegistry,
  isRegisteredQuantityId,
  loadQuantityRegistry,
  QuantityRegistryError,
  RESERVED_SPELLINGS,
  UnknownQuantityError,
} from "./registry.ts";
import {
  getLegacySpellings,
  legacySpellingMessage,
  resolveQuantityId,
} from "./resolveQuantityId.ts";

function dimOf(id: string): Dimension {
  const q = getQuantity(id);
  if (q.dimensionStatus === "state-dependent" || !q.dimension) {
    throw new Error(`${id} has no fixed dimension (dimensionStatus: ${q.dimensionStatus}).`);
  }
  return dimension(q.dimension.map((s) => `${s.num}/${s.den}`));
}
function gaussianDimOf(id: string): Dimension {
  const q = getQuantity(id);
  if (!q.gaussianDimension) throw new Error(`${id} has no gaussianDimension.`);
  return dimension(q.gaussianDimension.map((s) => `${s.num}/${s.den}`));
}
function emuDimOf(id: string): Dimension {
  const q = getQuantity(id);
  if (!q.emuDimension) throw new Error(`${id} has no emuDimension.`);
  return dimension(q.emuDimension.map((s) => `${s.num}/${s.den}`));
}
const HALF = rational(1n, 2n);
const R = (n: bigint, d = 1n) => rational(n, d);

describe("registry loads and every record validates", () => {
  test("the real registry loads without throwing (schema validation for every record)", () => {
    const registry = getQuantityRegistry();
    expect(registry.ids.length).toBeGreaterThan(0);
  });
  test("every id is unique and lower camel case", () => {
    const registry = getQuantityRegistry();
    const seen = new Set<string>();
    for (const id of registry.ids) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
      expect(/^[a-z][a-zA-Z0-9]*$/.test(id)).toBe(true);
    }
  });
  test("frame-tag suffixes agree with frame fields", () => {
    const registry = getQuantityRegistry();
    for (const q of registry.quantities.values()) {
      for (const [suffix, expectedFrame] of Object.entries(FRAME_SUFFIXES)) {
        if (q.id.endsWith(suffix)) expect(q.frame).toBe(expectedFrame);
      }
    }
  });

  test("reject: (registry.ts:64) throws frame-suffix-mismatch when quantity id suffix disagrees with frame field", () => {
    const fixtureDir = new URL("./__fixtures__/frame-suffix-mismatch", import.meta.url).pathname;
    try {
      loadQuantityRegistry(fixtureDir);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(QuantityRegistryError);
      expect((err as QuantityRegistryError).code).toBe("frame-suffix-mismatch");
      expect((err as QuantityRegistryError).message).toContain("ends with");
    }
  });
});

describe("dimensions", () => {
  test("diffusionCoefficient is L^2 T^-1 and rmsDisplacement1d is L; sqrt(D*t) is L", () => {
    expect(
      sameDimension(dimOf("diffusionCoefficient"), dimension(["2", "0", "-1", "0", "0", "0"])),
    ).toBe(true);
    expect(
      sameDimension(dimOf("rmsDisplacement1d"), dimension(["1", "0", "0", "0", "0", "0"])),
    ).toBe(true);
    const dt = combine(dimOf("diffusionCoefficient"), dimOf("elapsedTime"));
    expect(sameDimension(power(dt, HALF), dimOf("rmsDisplacement1d"))).toBe(true);
  });

  test("the three radiation energy-density kinds are pairwise distinct dimensions", () => {
    const a = dimOf("frequencyEnergyDensity");
    const b = dimOf("wavelengthEnergyDensity");
    const c = dimOf("logIntervalEnergyDensity");
    expect(sameDimension(a, b)).toBe(false);
    expect(sameDimension(a, c)).toBe(false);
    expect(sameDimension(b, c)).toBe(false);
  });

  test("molarGasConstant equals avogadroConstant * boltzmannConstant dimensionally, and equally avogadroNumberEstimate * boltzmannConstant; both Avogadro quantities are N^-1", () => {
    const R_dim = dimOf("molarGasConstant");
    expect(
      sameDimension(R_dim, combine(dimOf("avogadroConstant"), dimOf("boltzmannConstant"))),
    ).toBe(true);
    expect(
      sameDimension(R_dim, combine(dimOf("avogadroNumberEstimate"), dimOf("boltzmannConstant"))),
    ).toBe(true);
    const nInverse = dimension(["0", "0", "0", "0", "0", "-1"]);
    expect(sameDimension(dimOf("avogadroConstant"), nInverse)).toBe(true);
    expect(sameDimension(dimOf("avogadroNumberEstimate"), nInverse)).toBe(true);
  });

  test("wienConstantBeta * frequency / temperature is dimensionless", () => {
    const combined = combine(
      combine(dimOf("wienConstantBeta"), dimOf("frequency")),
      dimOf("temperature"),
      -1,
    );
    expect(isDimensionless(combined)).toBe(true);
  });

  test("electricFieldStationary and magneticFieldStationary share a Gaussian dimension and differ in SI dimension", () => {
    expect(
      sameDimension(
        gaussianDimOf("electricFieldStationary"),
        gaussianDimOf("magneticFieldStationary"),
      ),
    ).toBe(true);
    expect(sameDimension(dimOf("electricFieldStationary"), dimOf("magneticFieldStationary"))).toBe(
      false,
    );
  });

  test("elementaryCharge has Gaussian dimension M^1/2 L^3/2 T^-1", () => {
    expect(
      sameDimension(
        gaussianDimOf("elementaryCharge"),
        dimension(["3/2", "1/2", "-1", "0", "0", "0"]),
      ),
    ).toBe(true);
  });

  test("in electromagnetic dimensions, gramEquivalentCharge * stoppingPotentialMagnitude is an energy per amount, the dimension of molarGasConstant * wienConstantBeta * frequency; in Gaussian dimensions elementaryCharge * stoppingPotentialMagnitude is an energy", () => {
    const emuProduct = combine(
      emuDimOf("gramEquivalentCharge"),
      emuDimOf("stoppingPotentialMagnitude"),
    );
    const energyPerAmount = combine(
      combine(dimOf("molarGasConstant"), dimOf("wienConstantBeta")),
      dimOf("frequency"),
    );
    expect(sameDimension(emuProduct, energyPerAmount)).toBe(true);
    const gaussianProduct = combine(
      gaussianDimOf("elementaryCharge"),
      gaussianDimOf("stoppingPotentialMagnitude"),
    );
    expect(sameDimension(gaussianProduct, dimension(["2", "1", "-2", "0", "0", "0"]))).toBe(true);
  });

  test("osmoticDecayLength and kineticDecayLength are both L and remain distinct records", () => {
    expect(
      sameDimension(dimOf("osmoticDecayLength"), dimension(["1", "0", "0", "0", "0", "0"])),
    ).toBe(true);
    expect(
      sameDimension(dimOf("kineticDecayLength"), dimension(["1", "0", "0", "0", "0", "0"])),
    ).toBe(true);
    expect(getQuantity("osmoticDecayLength").id).not.toBe(getQuantity("kineticDecayLength").id);
  });

  test("a state-dependent quantity has no dimension, and binding it as a parameter should be a caller-side rejection (documented here, not owned by this registry)", () => {
    const q = getQuantity("configurationIntegral");
    expect(q.dimensionStatus).toBe("state-dependent");
    expect(q.dimension).toBeUndefined();
    expect(q.dimensionNote && q.dimensionNote.length > 0).toBe(true);
  });

  test("lagrangeMultiplier * radiationEnergy has the dimension of radiationEntropy; fourierAmplitude shares radiationElectricField's SI and Gaussian dimensions; pulseMomentum * speedOfLight is an energy", () => {
    expect(
      sameDimension(
        combine(dimOf("lagrangeMultiplier"), dimOf("radiationEnergy")),
        dimOf("radiationEntropy"),
      ),
    ).toBe(true);
    expect(sameDimension(dimOf("fourierAmplitude"), dimOf("radiationElectricField"))).toBe(true);
    expect(
      sameDimension(gaussianDimOf("fourierAmplitude"), gaussianDimOf("radiationElectricField")),
    ).toBe(true);
    expect(
      sameDimension(
        combine(dimOf("pulseMomentum"), dimOf("speedOfLight")),
        dimension(["2", "1", "-2", "0", "0", "0"]),
      ),
    ).toBe(true);
  });

  test("diffusionCoefficient * timeStep / gridSpacing^2 has the dimension of stabilityRatio", () => {
    const lhs = combine(
      combine(dimOf("diffusionCoefficient"), dimOf("timeStep")),
      power(dimOf("gridSpacing"), R(2n)),
      -1,
    );
    expect(sameDimension(lhs, dimOf("stabilityRatio"))).toBe(true);
    expect(isDimensionless(dimOf("stabilityRatio"))).toBe(true);
  });

  test("stepRms^2 / stepInterval has the dimension of diffusionCoefficient", () => {
    const lhs = combine(power(dimOf("stepRms"), R(2n)), dimOf("stepInterval"), -1);
    expect(sameDimension(lhs, dimOf("diffusionCoefficient"))).toBe(true);
  });

  test("speedOfLightSquared has the dimension of speedOfLight squared, and emittedEnergyRestFrame / speedOfLightSquared has the dimension of inertialMassDecrease", () => {
    expect(sameDimension(dimOf("speedOfLightSquared"), power(dimOf("speedOfLight"), R(2n)))).toBe(
      true,
    );
    expect(
      sameDimension(
        combine(dimOf("emittedEnergyRestFrame"), dimOf("speedOfLightSquared"), -1),
        dimOf("inertialMassDecrease"),
      ),
    ).toBe(true);
  });

  test("molesPerVolume * molarGasConstant * temperature has the dimension of osmoticPressure", () => {
    const lhs = combine(
      combine(dimOf("molesPerVolume"), dimOf("molarGasConstant")),
      dimOf("temperature"),
    );
    expect(sameDimension(lhs, dimOf("osmoticPressure"))).toBe(true);
  });

  test("entropyVolumeCoefficient has the dimension of entropy, and entropyVolumeCoefficient / universalEntropyConstant is dimensionless", () => {
    expect(sameDimension(dimOf("entropyVolumeCoefficient"), dimOf("entropy"))).toBe(true);
    expect(
      isDimensionless(
        combine(dimOf("entropyVolumeCoefficient"), dimOf("universalEntropyConstant"), -1),
      ),
    ).toBe(true);
  });

  test("each of the five rate records is T^-1, and absorbedLightEnergy / (molarGasConstant * wienConstantBeta * frequency) has the dimension of ionizedGramMolecules (amount)", () => {
    const perTime = dimension(["0", "0", "-1", "0", "0", "0"]);
    for (const id of [
      "quantumRate",
      "absorbedQuantumRate",
      "emittedQuantumRate",
      "emissionRate",
      "ionizationRate",
    ]) {
      expect(sameDimension(dimOf(id), perTime)).toBe(true);
    }
    const denom = combine(
      combine(dimOf("molarGasConstant"), dimOf("wienConstantBeta")),
      dimOf("frequency"),
    );
    const lhs = combine(dimOf("absorbedLightEnergy"), denom, -1);
    expect(sameDimension(lhs, dimOf("ionizedGramMolecules"))).toBe(true);
    expect(
      sameDimension(dimOf("ionizedGramMolecules"), dimension(["0", "0", "0", "0", "0", "1"])),
    ).toBe(true);
  });

  test("ansatzTimeSpaceCoefficient * frameSpeed is dimensionless, and speedDeficitFromLight has the dimension of speedOfLight", () => {
    expect(isDimensionless(combine(dimOf("ansatzTimeSpaceCoefficient"), dimOf("frameSpeed")))).toBe(
      true,
    );
    expect(sameDimension(dimOf("speedDeficitFromLight"), dimOf("speedOfLight"))).toBe(true);
  });

  test("spacetimeIntervalSquared has the dimension of eventSeparationSpatial squared and of (speedOfLight * eventSeparationTemporal) squared", () => {
    const s2 = dimOf("spacetimeIntervalSquared");
    expect(sameDimension(s2, power(dimOf("eventSeparationSpatial"), R(2n)))).toBe(true);
    expect(
      sameDimension(
        s2,
        power(combine(dimOf("speedOfLight"), dimOf("eventSeparationTemporal")), R(2n)),
      ),
    ).toBe(true);
  });

  test("wavePhase is dimensionless, and waveAngularFrequency*Time has its dimension in either frame", () => {
    expect(isDimensionless(dimOf("wavePhase"))).toBe(true);
    expect(
      sameDimension(
        combine(dimOf("waveAngularFrequencyStationary"), dimOf("coordinateTimeStationary")),
        dimOf("wavePhase"),
      ),
    ).toBe(true);
    expect(
      sameDimension(
        combine(dimOf("waveAngularFrequencyMoving"), dimOf("coordinateTimeMoving")),
        dimOf("wavePhase"),
      ),
    ).toBe(true);
  });
});

describe("distinctness", () => {
  const pairs: readonly (readonly [string, string])[] = [
    ["transverseForceComoving", "transverseForceLaboratory"],
    ["properTimeElapsed", "coordinateTimeStationary"],
    ["frequency", "angularFrequency"],
    ["meanSquareDisplacement1d", "displacementVariance1d"],
    ["latentPosition1d", "measuredPosition1d"],
    ["avogadroConstant", "avogadroNumberEstimate"],
    ["kickDiffusivity", "diffusionCoefficient"],
    ["driftFluxComponent", "diffusionFluxComponent"],
    ["systemEnergy", "microstateEnergy"],
    ["speedRatio", "lorentzFactor"],
    ["timeStep", "observationInterval"],
    ["longAveragingInterval", "temperature"],
    ["relativeViscosity", "suspensionViscosityCoefficient"],
    ["speedOfLightSquared", "speedOfLight"],
    ["stepInterval", "timeStep"],
    ["stepInterval", "observationInterval"],
    ["intervalProbability", "probabilityDensity"],
    ["meanDisplacement1d", "rmsDisplacement1d"],
    ["ionizationRate", "ionizedGramMolecules"],
    ["kolmogorovDistance", "maxProbabilityDifference"],
    ["scaleFactorUnknown", "fieldScaleFactorUnknown"],
    ["chargeVelocityStationary", "chargeVelocityMoving"],
    ["molesPerVolume", "numberDensity"],
  ];
  for (const [a, b] of pairs) {
    test(`${a} is a distinct record from ${b}`, () => {
      expect(getQuantity(a).id).not.toBe(getQuantity(b).id);
    });
  }

  test("apparentSpeedRatio is distinct from both apparentSpeed and speedRatio", () => {
    const ids = new Set([
      getQuantity("apparentSpeedRatio").id,
      getQuantity("apparentSpeed").id,
      getQuantity("speedRatio").id,
    ]);
    expect(ids.size).toBe(3);
  });

  test("four energies (meanResonatorEnergy, meanResonatorEnergyAtFrequency, meanQuantumEnergyWien, quantumEnergy) are four distinct records", () => {
    const ids = new Set(
      [
        "meanResonatorEnergy",
        "meanResonatorEnergyAtFrequency",
        "meanQuantumEnergyWien",
        "quantumEnergy",
      ].map((id) => getQuantity(id).id),
    );
    expect(ids.size).toBe(4);
  });

  test("entropyVolumeCoefficient, effectiveIndependentCount, entropy, and universalEntropyConstant are four distinct records", () => {
    const ids = new Set(
      [
        "entropyVolumeCoefficient",
        "effectiveIndependentCount",
        "entropy",
        "universalEntropyConstant",
      ].map((id) => getQuantity(id).id),
    );
    expect(ids.size).toBe(4);
  });

  test("the five T^-1 rate records are pairwise distinct", () => {
    const ids = new Set(
      [
        "quantumRate",
        "absorbedQuantumRate",
        "emittedQuantumRate",
        "emissionRate",
        "ionizationRate",
      ].map((id) => getQuantity(id).id),
    );
    expect(ids.size).toBe(5);
  });

  test("spacetimeIntervalSquared is distinct from observationInterval, stepInterval, longAveragingInterval, intervalProbability, and logIntervalEnergyDensity", () => {
    const ids = new Set(
      [
        "spacetimeIntervalSquared",
        "observationInterval",
        "stepInterval",
        "longAveragingInterval",
        "intervalProbability",
        "logIntervalEnergyDensity",
      ].map((id) => getQuantity(id).id),
    );
    expect(ids.size).toBe(6);
  });

  test("wavePhase, fourierPhase, and propagationAngleStationary are three distinct angles", () => {
    const ids = new Set(
      ["wavePhase", "fourierPhase", "propagationAngleStationary"].map((id) => getQuantity(id).id),
    );
    expect(ids.size).toBe(3);
    expect(getQuantity("wavePhase").frame).toBe("frame-independent");
  });
});

describe("model artifacts", () => {
  test("apparentSpeed and apparentSpeedRatio carry modelArtifact: true and a note", () => {
    for (const id of ["apparentSpeed", "apparentSpeedRatio"]) {
      const q = getQuantity(id);
      expect(q.modelArtifact).toBe(true);
      expect(q.artifactNote && q.artifactNote.length > 0).toBe(true);
    }
  });
});

describe("legacy spellings", () => {
  test("every entry in legacy-spellings.yaml is absent from the registry ids and maps to an existing id", () => {
    const registry = getQuantityRegistry();
    for (const entry of getLegacySpellings().values()) {
      expect(registry.quantities.has(entry.spelling)).toBe(false);
      for (const canonicalId of entry.canonicalIds) {
        expect(registry.quantities.has(canonicalId)).toBe(true);
      }
    }
  });

  test('resolveQuantityId("gasConstant") returns legacy-spelling with molarGasConstant, message "use molarGasConstant"', () => {
    const result = resolveQuantityId("gasConstant");
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "legacy-spelling")
      expect(result.canonicalIds).toEqual(["molarGasConstant"]);
    expect(legacySpellingMessage("gasConstant")).toBe("use molarGasConstant");
  });

  test("avogadroNumber returns both avogadroNumberEstimate and avogadroConstant, and its message says which to choose", () => {
    const result = resolveQuantityId("avogadroNumber");
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "legacy-spelling") {
      expect(result.canonicalIds).toContain("avogadroNumberEstimate");
      expect(result.canonicalIds).toContain("avogadroConstant");
    }
    const message = legacySpellingMessage("avogadroNumber");
    expect(message).toContain("avogadroNumberEstimate");
    expect(message).toContain("avogadroConstant");
  });

  test("decayLength names both decay lengths", () => {
    const message = legacySpellingMessage("decayLength");
    expect(message).toContain("osmoticDecayLength");
    expect(message).toContain("kineticDecayLength");
  });

  test("acceleratingVoltage names acceleratingPotential", () => {
    const result = resolveQuantityId("acceleratingVoltage");
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "legacy-spelling")
      expect(result.canonicalIds).toEqual(["acceleratingPotential"]);
  });

  test('the typo "electricFieldStationry" returns unregistered, never a near match', () => {
    const result = resolveQuantityId("electricFieldStationry");
    expect(result).toEqual({ ok: false, kind: "unregistered" });
  });

  test("logFrequencyEnergyDensity returns unregistered and is never reported as a legacy spelling of logIntervalEnergyDensity; it is declared as frequencyEnergyDensity's representation field", () => {
    const result = resolveQuantityId("logFrequencyEnergyDensity");
    expect(result).toEqual({ ok: false, kind: "unregistered" });
    const freq = getQuantity("frequencyEnergyDensity");
    expect(freq.representationFields).toContain("logFrequencyEnergyDensity");
  });

  test("a representation field name that is also a registry id fails validation (checked at load time, not a runtime resolveQuantityId concern)", () => {
    // registry.ts's second loader pass throws representation-field-shadows-id at load time;
    // the real registry loading without throwing (see the top describe block) already proves
    // no declared representation field shadows an id.
    const registry = getQuantityRegistry();
    for (const q of registry.quantities.values()) {
      for (const rep of q.representationFields ?? []) {
        expect(registry.quantities.has(rep)).toBe(false);
      }
    }

    const baseValidQuantity = {
      name: "Test Quantity",
      description: "Test description",
      mathematicalKind: "scalar" as const,
      dimension: [
        { num: 0, den: 1 },
        { num: 0, den: 1 },
        { num: 0, den: 1 },
        { num: 0, den: 1 },
        { num: 0, den: 1 },
        { num: 0, den: 1 },
      ],
      dimensionlessKind: "ratio" as const,
    };

    // Planted throw: validateQuantity rejects representationFields entry that shadows its own ID
    expect(() => {
      validateQuantity({
        ...baseValidQuantity,
        id: "selfShadowingQuantity",
        representationFields: ["selfShadowingQuantity"],
      });
    }).toThrow(/representation-field-shadows-id/);

    // Planted throw: validateQuantity rejects representationFields entry that shadows an existing ID
    expect(() => {
      validateQuantity(
        {
          ...baseValidQuantity,
          id: "shadowingQuantity",
          representationFields: ["frequencyEnergyDensity"],
        },
        "Quantity",
        ["frequencyEnergyDensity"],
      );
    }).toThrow(/representation-field-shadows-id/);
  });

  test("a reserved spelling is never a registered record, and its note names the bead that adds it", () => {
    // The table may be empty: its last two entries were registered in dispatch 236. The two
    // assertions below it are what this test proves today; the loop binds any future entry.
    for (const [spelling, note] of Object.entries(RESERVED_SPELLINGS)) {
      expect(resolveQuantityId(spelling)).toEqual({ ok: false, kind: "unregistered" });
      expect(note).toMatch(/\bam-[a-z0-9-]+\b/);
    }
    // Kaufmann's A_m and A_e (p. 920) are no longer reserved: they are registered, with
    // dimensionStatus "undefined-in-source", once their records land.
    expect(Object.keys(RESERVED_SPELLINGS)).not.toContain("magneticDeflectability");
    expect(Object.keys(RESERVED_SPELLINGS)).not.toContain("electricDeflectability");
  });

  test('intervalSquared returns legacy-spelling with spacetimeIntervalSquared, message "use spacetimeIntervalSquared"', () => {
    const result = resolveQuantityId("intervalSquared");
    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "legacy-spelling")
      expect(result.canonicalIds).toEqual(["spacetimeIntervalSquared"]);
    expect(legacySpellingMessage("intervalSquared")).toBe("use spacetimeIntervalSquared");
  });
});

describe("unknown ids", () => {
  test("lookup throws the typed error, with no label, prefix, or case-insensitive fallback", () => {
    expect(() => getQuantity("totallyUnknownQuantity")).toThrow(UnknownQuantityError);
    expect(() => getQuantity("SpeedOfLight")).toThrow(UnknownQuantityError); // wrong case never matches
    expect(() => getQuantity("speedOf")).toThrow(UnknownQuantityError); // a prefix never matches
  });
});

describe("strict binding invariants: anti-glyph, anti-label, and anti-token matching", () => {
  // Hard rule from AGENTS.md: "A similar glyph is never a binding key."
  test("mathematical glyphs, TeX symbols, Greek letters, and Unicode lookalikes are never binding keys", () => {
    const glyphs = [
      // TeX macro strings
      "\\eta",
      "\\nu",
      "\\lambda",
      "\\lambda_x",
      "\\beta",
      "\\gamma",
      "\\tau",
      "\\phi",
      "\\varphi",
      "\\rho",
      "\\kappa",
      "\\Delta t",
      "\\Delta x",
      // Unicode Greek letters
      "η",
      "ν",
      "λ",
      "β",
      "γ",
      "τ",
      "φ",
      "ρ",
      "κ",
      // Unicode mathematical italic letters (homoglyphs)
      "𝑐",
      "𝑘",
      "𝑁",
      "𝑅",
      "𝑇",
      "𝐸",
      "𝑃",
      "𝑉",
      "𝑣",
      "𝑤",
      "𝐷",
      "𝜂",
      "𝜈",
      "𝜆",
      "𝛽",
      // Single ASCII character symbols from historical papers
      "c",
      "V",
      "k",
      "N",
      "R",
      "T",
      "E",
      "P",
      "v",
      "w",
      "D",
      "h",
      "A",
      "B",
      "L",
    ];

    for (const glyph of glyphs) {
      expect(() => getQuantity(glyph)).toThrow(UnknownQuantityError);
      expect(isRegisteredQuantityId(glyph)).toBe(false);
      const res = resolveQuantityId(glyph);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.kind).toBe("unregistered");
      }
    }
  });

  test("lookup by human label or display name is strictly rejected", () => {
    const registry = getQuantityRegistry();
    const labels = [
      "Speed of Light",
      "Speed of light",
      "Viscosity",
      "Dynamic Viscosity",
      "Dynamic viscosity",
      "Diffusion Coefficient",
      "Diffusion coefficient",
      "Boltzmann Constant",
      "Avogadro's Number",
      "Avogadro Constant",
      "Molar Gas Constant",
      "Wavelength",
      "Frequency",
      "Temperature",
      "Absolute Temperature",
      "Radiation Energy",
      "Radiation Entropy",
    ];

    for (const label of labels) {
      expect(() => getQuantity(label)).toThrow(UnknownQuantityError);
      expect(isRegisteredQuantityId(label)).toBe(false);
      const res = resolveQuantityId(label);
      if (res.ok) {
        throw new Error(`Human label "${label}" unexpectedly resolved to a quantity.`);
      }
    }

    // Exhaustive check across every registered quantity: its human name is never a valid lookup key
    for (const q of registry.quantities.values()) {
      expect(() => getQuantity(q.name)).toThrow(UnknownQuantityError);
      expect(isRegisteredQuantityId(q.name)).toBe(false);
    }
  });

  test("donor defect: variableId.startsWith('var_' + id) and token prefix matching are strictly rejected", () => {
    const registry = getQuantityRegistry();
    const sampleIds = [
      "speedOfLight",
      "diffusionCoefficient",
      "temperature",
      "frequency",
      "molarGasConstant",
      "boltzmannConstant",
      "avogadroConstant",
    ];

    for (const id of sampleIds) {
      expect(registry.quantities.has(id)).toBe(true);

      // Donor Classic Patents defect pattern: startsWith("var_" + id)
      const varId = `var_${id}`;
      expect(() => getQuantity(varId)).toThrow(UnknownQuantityError);
      expect(isRegisteredQuantityId(varId)).toBe(false);
      expect(resolveQuantityId(varId)).toEqual({ ok: false, kind: "unregistered" });

      // Partial prefixes
      const half = id.slice(0, Math.floor(id.length / 2));
      if (half.length > 2) {
        expect(() => getQuantity(half)).toThrow(UnknownQuantityError);
        expect(isRegisteredQuantityId(half)).toBe(false);
      }

      // Suffix modifications
      const suffixed = `${id}_value`;
      expect(() => getQuantity(suffixed)).toThrow(UnknownQuantityError);
      expect(isRegisteredQuantityId(suffixed)).toBe(false);
    }
  });

  test("adversarial negative test: catches and refuses a naive donor/glyph binding resolver", () => {
    // A hypothetical naive/permissive donor resolver simulating Classic Patents flaws:
    // 1) glyph table fallback (e.g. "c" -> speedOfLight)
    // 2) donor variable prefix stripping: startsWith("var_")
    // 3) case-insensitive or human label normalization
    function naiveDonorResolver(key: string, registryIds: readonly string[]): string | undefined {
      // Flaw 1: glyph mapping
      const glyphTable: Record<string, string> = {
        c: "speedOfLight",
        𝑐: "speedOfLight",
        k: "boltzmannConstant",
        𝑘: "boltzmannConstant",
        R: "molarGasConstant",
        𝑅: "molarGasConstant",
        "\\eta": "suspensionViscosityCoefficient",
        η: "suspensionViscosityCoefficient",
        "\\nu": "frequency",
        ν: "frequency",
      };
      if (glyphTable[key]) return glyphTable[key];

      // Flaw 2: Classic Patents startsWith("var_") prefix matching
      if (key.startsWith("var_")) {
        const stripped = key.slice(4);
        if (registryIds.includes(stripped)) return stripped;
      }

      // Flaw 3: lowercase / label fuzzy matching
      const norm = key.toLowerCase().replace(/[\s_-]+/g, "");
      for (const id of registryIds) {
        if (id.toLowerCase() === norm) return id;
      }
      return undefined;
    }

    const registry = getQuantityRegistry();
    const testCases: readonly [string, string][] = [
      ["c", "speedOfLight"],
      ["𝑐", "speedOfLight"],
      ["k", "boltzmannConstant"],
      ["𝑘", "boltzmannConstant"],
      ["R", "molarGasConstant"],
      ["𝑅", "molarGasConstant"],
      ["\\eta", "suspensionViscosityCoefficient"],
      ["η", "suspensionViscosityCoefficient"],
      ["\\nu", "frequency"],
      ["ν", "frequency"],
      ["var_speedOfLight", "speedOfLight"],
      ["var_diffusionCoefficient", "diffusionCoefficient"],
      ["Speed of Light", "speedOfLight"],
      ["Diffusion Coefficient", "diffusionCoefficient"],
    ];

    for (const [permissiveKey, expectedTarget] of testCases) {
      // 1. Prove the adversarial condition: the naive donor resolver would incorrectly accept and bind this key
      const naiveMatch = naiveDonorResolver(permissiveKey, registry.ids);
      expect(naiveMatch).toBe(expectedTarget);

      // 2. Prove the canonical registry invariant: strictly rejects with UnknownQuantityError and unregistered
      expect(() => getQuantity(permissiveKey)).toThrow(UnknownQuantityError);
      expect(isRegisteredQuantityId(permissiveKey)).toBe(false);
      const resolved = resolveQuantityId(permissiveKey);
      expect(resolved.ok).toBe(false);
      if (!resolved.ok && resolved.kind !== "legacy-spelling") {
        expect(resolved.kind).toBe("unregistered");
      }
    }
  });
});
