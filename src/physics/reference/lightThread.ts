/**
 * Cross-paper light thread (master plan §14.2).
 * Composes the registered wave owners; does not reimplement their boost law.
 * The quantum comparison is a modern synthesis, never a premise of September 1905.
 */
export type LightThreadParameters = Readonly<{
  frequencyHz: number;
  pulseEnergyJ: number;
  beta: number;
  angleDeg: number;
}>;

export const LIGHT_THREAD_DEFAULTS: LightThreadParameters = Object.freeze({
  frequencyHz: 5e14,
  pulseEnergyJ: 1,
  beta: 0.6,
  angleDeg: 0,
});

/** These are interactive admission bounds, not boundaries of physical possibility. */
export const LIGHT_THREAD_BOUNDS = Object.freeze({
  frequencyHz: Object.freeze({ min: 1e6, max: 1e24 }),
  pulseEnergyJ: Object.freeze({ min: 1e-24, max: 1e6 }),
  beta: Object.freeze({ min: -0.999999, max: 0.999999 }),
  angleDeg: Object.freeze({ min: 0, max: 180 }),
});

export type LightThreadRefusal = Readonly<{
  kind: "refused";
  parameterId: string;
  reason: string;
}>;

export function validateLightThreadParameters(
  input: unknown,
): Readonly<{ kind: "accepted"; parameters: LightThreadParameters }> | LightThreadRefusal {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return Object.freeze({
      kind: "refused",
      parameterId: "parameters",
      reason: "Supply all four numeric settings.",
    });
  }
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!Object.hasOwn(LIGHT_THREAD_BOUNDS, key)) {
      return Object.freeze({
        kind: "refused",
        parameterId: key,
        reason: `Unknown light-thread setting: ${key}.`,
      });
    }
  }
  for (const [key, bounds] of Object.entries(LIGHT_THREAD_BOUNDS)) {
    const value = record[key];
    if (
      !Object.hasOwn(record, key) ||
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < bounds.min ||
      value > bounds.max
    ) {
      return Object.freeze({
        kind: "refused",
        parameterId: key,
        reason: `${key} must be a finite number between ${bounds.min} and ${bounds.max}. These are this instrument's admission bounds.`,
      });
    }
  }
  return Object.freeze({
    kind: "accepted",
    parameters: Object.freeze({
      frequencyHz: record.frequencyHz as number,
      pulseEnergyJ: record.pulseEnergyJ as number,
      beta: record.beta as number,
      angleDeg: record.angleDeg as number,
    }),
  });
}

/** Explicit dependencies make the cross-paper join testable without an alternate wave law. */
export type LightThreadOwners = Readonly<{
  constantSetId: "modern-si-2019";
  planckConstant: number;
  speedOfLight: number;
  frequencyFactor: (beta: number, thetaRad: number) => number;
  energyFactor: (beta: number, thetaRad: number) => number;
}>;

export const LIGHT_THREAD_QUANTITIES = Object.freeze({
  frequencyStationary: {
    label: "Frequency in the source frame",
    unit: "Hz",
    semanticKind: "frequency",
  },
  frequencyMoving: {
    label: "Frequency in the moving frame",
    unit: "Hz",
    semanticKind: "frequency",
  },
  energyStationary: {
    label: "Pulse energy in the source frame",
    unit: "J",
    semanticKind: "energy",
  },
  energyMoving: { label: "Pulse energy in the moving frame", unit: "J", semanticKind: "energy" },
  quantumEnergyStationary: { label: "hν in the source frame", unit: "J", semanticKind: "energy" },
  quantumEnergyMoving: { label: "hν in the moving frame", unit: "J", semanticKind: "energy" },
  quantumRatioStationary: { label: "E/(hν) in the source frame", unit: "1", semanticKind: "ratio" },
  quantumRatioMoving: { label: "E′/(hν′) in the moving frame", unit: "1", semanticKind: "ratio" },
  frequencyFactor: { label: "Frequency transformation factor", unit: "1", semanticKind: "ratio" },
  energyFactor: { label: "Energy transformation factor", unit: "1", semanticKind: "ratio" },
  pulseEnergyEquivalent: {
    label: "Pulse energy divided by c² (not its rest mass)",
    unit: "kg",
    semanticKind: "mass",
  },
  pulseInvariantMass: {
    label: "Invariant mass of a unidirectional light pulse",
    unit: "kg",
    semanticKind: "mass",
  },
  oppositePulseEnergyMoving: {
    label: "Opposite equal pulse: moving-frame energy",
    unit: "J",
    semanticKind: "energy",
  },
  pairEnergyStationary: {
    label: "Balanced pair: source-frame energy",
    unit: "J",
    semanticKind: "energy",
  },
  pairEnergyMoving: {
    label: "Balanced pair: moving-frame energy",
    unit: "J",
    semanticKind: "energy",
  },
  pairInvariantMass: { label: "Balanced pair: invariant mass", unit: "kg", semanticKind: "mass" },
  bodyMassLoss: {
    label: "Body's mass decrease for balanced emission",
    unit: "kg",
    semanticKind: "mass",
  },
});
for (const quantity of Object.values(LIGHT_THREAD_QUANTITIES)) Object.freeze(quantity);

export type LightThreadQuantityId = keyof typeof LIGHT_THREAD_QUANTITIES;
export type LightThreadSnapshot = Readonly<{
  parameters: LightThreadParameters;
  constantSetId: "modern-si-2019";
  ownerId: "light-thread";
  execution: "host-calculation";
  values: Readonly<Record<LightThreadQuantityId, number>>;
}>;
export type LightThreadEvaluation =
  | Readonly<{ kind: "accepted"; snapshot: LightThreadSnapshot }>
  | LightThreadRefusal
  | Readonly<{ kind: "unavailable"; reason: string }>;

/**
 * One admitted snapshot supplies every panel. E is the energy of ONE pulse.
 * The September bridge adds a distinct, equal, opposite pulse: total energy 2E.
 * Its zero net source-frame momentum is essential to ΔM = 2E/c² without recoil.
 * E/(hν) is an energy ratio, not an inferred integer photon count.
 */
export function evaluateLightThread(
  input: unknown,
  owners: LightThreadOwners,
): LightThreadEvaluation {
  const checked = validateLightThreadParameters(input);
  if (checked.kind !== "accepted") return checked;
  const p = checked.parameters;
  const h = owners.planckConstant;
  const c = owners.speedOfLight;
  if (
    owners.constantSetId !== "modern-si-2019" ||
    !Number.isFinite(h) ||
    h <= 0 ||
    !Number.isFinite(c) ||
    c <= 0
  ) {
    return Object.freeze({
      kind: "unavailable",
      reason: "The light thread requires the registered modern SI constant set.",
    });
  }
  const theta = (p.angleDeg / 180) * Math.PI;
  const qFrequency = owners.frequencyFactor(p.beta, theta);
  const qEnergy = owners.energyFactor(p.beta, theta);
  const qOpposite = owners.energyFactor(p.beta, Math.PI - theta);
  if (![qFrequency, qEnergy, qOpposite].every((q) => Number.isFinite(q) && q > 0)) {
    return Object.freeze({
      kind: "unavailable",
      reason: "The wave owner did not return finite positive transformation factors.",
    });
  }
  const frequencyMoving = p.frequencyHz * qFrequency;
  const energyMoving = p.pulseEnergyJ * qEnergy;
  const quantumEnergyStationary = h * p.frequencyHz;
  const quantumEnergyMoving = h * frequencyMoving;
  const pulseEnergyEquivalent = p.pulseEnergyJ / c / c;
  const pairEnergyStationary = 2 * p.pulseEnergyJ;
  const oppositePulseEnergyMoving = p.pulseEnergyJ * qOpposite;
  const values = Object.freeze({
    frequencyStationary: p.frequencyHz,
    frequencyMoving,
    energyStationary: p.pulseEnergyJ,
    energyMoving,
    quantumEnergyStationary,
    quantumEnergyMoving,
    quantumRatioStationary: p.pulseEnergyJ / quantumEnergyStationary,
    quantumRatioMoving: energyMoving / quantumEnergyMoving,
    frequencyFactor: qFrequency,
    energyFactor: qEnergy,
    pulseEnergyEquivalent,
    pulseInvariantMass: 0,
    oppositePulseEnergyMoving,
    pairEnergyStationary,
    pairEnergyMoving: energyMoving + oppositePulseEnergyMoving,
    pairInvariantMass: 2 * pulseEnergyEquivalent,
    bodyMassLoss: 2 * pulseEnergyEquivalent,
  });
  if (
    !Object.entries(values).every(
      ([key, value]) => Number.isFinite(value) && (value > 0 || key === "pulseInvariantMass"),
    )
  ) {
    return Object.freeze({
      kind: "unavailable",
      reason:
        "This calculation exceeds the numerical representation; no partial snapshot was accepted.",
    });
  }
  return Object.freeze({
    kind: "accepted",
    snapshot: Object.freeze({
      parameters: p,
      constantSetId: owners.constantSetId,
      ownerId: "light-thread",
      execution: "host-calculation",
      values,
    }),
  });
}

/** A versioned, bounded, deterministic bookmark; never admits unknown or duplicate fields. */
export function encodeLightThreadParameters(parameters: LightThreadParameters): string {
  const checked = validateLightThreadParameters(parameters);
  if (checked.kind !== "accepted") throw new RangeError(checked.reason);
  const query = new URLSearchParams({ lt: "1" });
  for (const [key, value] of Object.entries(checked.parameters)) query.set(key, String(value));
  return query.toString();
}

export function decodeLightThreadParameters(
  query: string,
): ReturnType<typeof validateLightThreadParameters> {
  const refuse = (reason: string): LightThreadRefusal =>
    Object.freeze({ kind: "refused", parameterId: "permalink", reason });
  if (query.length > 1024) return refuse("This light-thread bookmark is too long.");
  const search = new URLSearchParams(query);
  if (search.getAll("lt").length !== 1 || search.get("lt") !== "1")
    return refuse("This bookmark uses an unsupported light-thread version.");
  for (const key of search.keys()) {
    if (key !== "lt" && !Object.hasOwn(LIGHT_THREAD_BOUNDS, key))
      return refuse(`Unknown bookmark setting: ${key}.`);
    if (search.getAll(key).length !== 1) return refuse(`Repeated bookmark setting: ${key}.`);
  }
  const parameters: Record<string, number> = {};
  for (const key of Object.keys(LIGHT_THREAD_BOUNDS)) {
    const raw = search.get(key);
    if (raw === null || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw))
      return refuse(`Missing or invalid bookmark setting: ${key}.`);
    parameters[key] = Number(raw);
  }
  return validateLightThreadParameters(parameters);
}
