/** Route A (§§1–3): osmotic partition, configuration, drift–diffusion balance. */
import type { DomainKind, ScientificResult } from "../../../experiments/results/types.ts";
import { type ConstantSet, thermalConstant } from "../constants.ts";

export const STANDARD_GRAVITY = 9.80665;
export const CLASSICAL_SUSPENDED_BODIES = "classical-thermodynamics-suspended-bodies";
export const DRIFT_ONLY_NO_KICKS = "drift-only-no-kicks";

export type RouteAEvaluation = Readonly<{
  result: ScientificResult;
  constantSetId?: string;
  modelIdentity?: string;
  modelNote?: string;
}>;

const identities = {
  partitionForce: ["N", "osmotic-partition-force"],
  hydrostaticHead: ["m", "equivalent-column-height"],
  volumeFraction: ["1", "solute-volume-fraction"],
  osmoticPressure: ["Pa", "ideal-osmotic-pressure"],
  freeEnergy: ["J", "configurational-free-energy"],
  mobility: ["kg-1 s", "stokes-mobility"],
  driftVelocity: ["m/s", "force-drift"],
  particleFlux: ["m-2 s-1", "total-particle-flux"],
  driftFlux: ["m-2 s-1", "advective-particle-flux"],
  diffusionFlux: ["m-2 s-1", "diffusive-particle-flux"],
  probabilityDensity: ["1/m", "coordinate-density"],
  osmoticDecayLength: ["m", "osmotic-force-length"],
  kineticDecayLength: ["m", "kick-kinetic-length"],
  kickDiffusivity: ["m2/s", "kick-diffusivity"],
  diffusionCoefficient: ["m2/s", "latent-diffusivity"],
} as const;
type Quantity = keyof typeof identities;

function identity(quantityId: Quantity, owner: string) {
  return {
    quantityId,
    unit: identities[quantityId][0],
    semanticKind: identities[quantityId][1],
    ownerId: `diffusion.${owner}`,
  };
}
function wrap(
  result: ScientificResult,
  extra?: { set?: ConstantSet; modelIdentity?: string; modelNote?: string },
): RouteAEvaluation {
  return Object.freeze({
    result: Object.freeze(result),
    ...(extra?.set ? { constantSetId: extra.set.id } : {}),
    ...(extra?.modelIdentity ? { modelIdentity: extra.modelIdentity } : {}),
    ...(extra?.modelNote ? { modelNote: extra.modelNote } : {}),
  });
}
function outside(
  q: Quantity,
  owner: string,
  condition: string,
  reason: string,
  kind: DomainKind = "input",
  set?: ConstantSet,
): RouteAEvaluation {
  return wrap(
    {
      ...identity(q, owner),
      status: "outside-domain",
      condition,
      domainKind: kind,
      reason,
      boundary: {
        alternativeModel: "Use finite inputs inside the stated dilute independent-particle model.",
      },
    },
    set ? { set } : {},
  );
}
function number(
  q: Quantity,
  owner: string,
  value: number,
  set?: ConstantSet,
  extra?: { modelIdentity?: string; modelNote?: string },
): RouteAEvaluation {
  if (!Number.isFinite(value)) {
    return outside(
      q,
      owner,
      "binary64-range",
      "This result is outside the representable numerical range.",
      "numerical",
      set,
    );
  }
  return wrap(
    { ...identity(q, owner), status: "value", value },
    { ...(set ? { set } : {}), ...extra },
  );
}

export function partitionForce(Pi: number, A: number): RouteAEvaluation {
  if (![Pi, A].every((v) => Number.isFinite(v)) || Pi < 0 || A <= 0) {
    return outside(
      "partitionForce",
      "partitionForce",
      "Pi >= 0 and A > 0",
      "Use a nonnegative pressure and a positive partition area.",
    );
  }
  return number("partitionForce", "partitionForce", Pi * A);
}

export function hydrostaticHead(Pi: number, rho: number, g = STANDARD_GRAVITY): RouteAEvaluation {
  if (![Pi, rho, g].every((v) => Number.isFinite(v)) || Pi < 0 || rho <= 0 || g <= 0) {
    return outside(
      "hydrostaticHead",
      "hydrostaticHead",
      "Pi >= 0, rho > 0, g > 0",
      "Use a nonnegative pressure, a positive solvent density, and a positive gravity.",
    );
  }
  return wrap(
    {
      ...identity("hydrostaticHead", "hydrostaticHead"),
      status: "value",
      value: Pi / (rho * g),
    },
    {
      modelNote: "Equivalent solvent column height, not a manometer in the apparatus.",
    },
  );
}

export function volumeFraction(Np: number, a: number, V: number): RouteAEvaluation {
  if (!Number.isSafeInteger(Np) || Np < 0 || ![a, V].every((v) => Number.isFinite(v) && v > 0)) {
    return outside(
      "volumeFraction",
      "volumeFraction",
      "Np a nonnegative integer, a > 0, V > 0",
      "Use a whole particle count and positive radius and volume.",
    );
  }
  return number("volumeFraction", "volumeFraction", (Np * (4 / 3) * Math.PI * a * a * a) / V);
}

export function hardSphereVirialCorrection(phi: number): number {
  return 4 * phi + 10 * phi * phi;
}

export type DiluteDomain = Readonly<{
  admitted: boolean;
  phi: number;
  phiMax: number;
  virialCorrectionAtBound: number;
  maxAdmittedCount: number;
  minAdmittedVolume: number;
  justification: string;
}>;

export function diluteDomainCheck(
  phi: number,
  phiMax: number,
  input: { Np: number; a: number; V: number; justification: string },
): DiluteDomain | RouteAEvaluation {
  const { Np, a, V, justification } = input;
  if (
    ![phi, phiMax, a, V].every((v) => Number.isFinite(v)) ||
    phi < 0 ||
    phiMax <= 0 ||
    !Number.isSafeInteger(Np) ||
    Np < 0 ||
    a <= 0 ||
    V <= 0 ||
    !justification.trim()
  ) {
    return outside(
      "volumeFraction",
      "diluteDomainCheck",
      "phiMax > 0 with a recorded justification",
      "Declare a positive volume-fraction bound and why it is admitted. There is no hidden default.",
    );
  }
  const particleVolume = (4 / 3) * Math.PI * a * a * a;
  const maxAdmittedCount = Math.floor((phiMax * V) / particleVolume);
  const minAdmittedVolume = (Np * particleVolume) / phiMax;
  return Object.freeze({
    admitted: phi <= phiMax,
    phi,
    phiMax,
    virialCorrectionAtBound: hardSphereVirialCorrection(phiMax),
    maxAdmittedCount,
    minAdmittedVolume,
    justification,
  });
}

export function osmoticPressureClassicalExpectation(): RouteAEvaluation {
  return number("osmoticPressure", "osmoticPressureClassicalExpectation", 0, undefined, {
    modelIdentity: CLASSICAL_SUSPENDED_BODIES,
    modelNote:
      "Classical thermodynamics of suspended bodies assigns zero osmotic pressure. What decides between this model and the molecular one is the section-5 displacements, and later Perrin's sedimentation equilibrium of 1908-1909 as dated later evidence. The classical model is left standing as a labeled alternative.",
  });
}

export type ConfigurationVolume = Readonly<{
  npLnV: RouteAEvaluation;
  freeEnergyTerm: RouteAEvaluation;
  deltaF: RouteAEvaluation;
  pressure: RouteAEvaluation;
  volumeIndependentFactor: ScientificResult;
  momentumIntegrals: ScientificResult;
  freeEnergyOffset: ScientificResult;
}>;

export function configurationVolumeTerm(
  { Np, V, V0, T }: { Np: number; V: number; V0: number; T: number },
  set: ConstantSet,
): ConfigurationVolume | RouteAEvaluation {
  if (
    !Number.isSafeInteger(Np) ||
    Np < 0 ||
    ![V, V0, T].every((v) => Number.isFinite(v) && v > 0)
  ) {
    return outside(
      "freeEnergy",
      "configurationVolumeTerm",
      "Np a nonnegative integer, V > 0, V0 > 0, T > 0",
      "Use a whole particle count and positive volumes and temperature.",
      "input",
      set,
    );
  }
  const kT = thermalConstant(set).value * T;
  const symbolic = (
    expressionRef: string,
    unspecifiedSymbols: readonly string[],
  ): ScientificResult =>
    Object.freeze({
      ...identity("freeEnergy", "configurationVolumeTerm"),
      status: "symbolic" as const,
      expressionRef,
      unspecifiedSymbols,
    });
  return Object.freeze({
    npLnV: number("freeEnergy", "configurationVolumeTerm", Np * Math.log(V), set),
    freeEnergyTerm: number("freeEnergy", "configurationVolumeTerm", -kT * Np * Math.log(V), set),
    deltaF: number("freeEnergy", "configurationVolumeTerm", -kT * Np * Math.log(V / V0), set),
    pressure: number("osmoticPressure", "configurationVolumeTerm", (Np * kT) / V, set),
    volumeIndependentFactor: symbolic("configuration-factor-J", ["J"]),
    momentumIntegrals: symbolic("momentum-integrals", ["p"]),
    freeEnergyOffset: symbolic("free-energy-offset", ["F0"]),
  });
}

function isExactDecimal(text: string): boolean {
  return /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(text);
}

function multiplyExactDecimal(left: string, right: string): string {
  const scale = (s: string) => {
    const i = s.indexOf(".");
    return i === -1 ? 0 : s.length - i - 1;
  };
  const digits = (s: string) => BigInt(s.replace(".", ""));
  const product = digits(left) * digits(right);
  const places = scale(left) + scale(right);
  let out = product.toString();
  if (places === 0) return out;
  if (out.length <= places) out = out.padStart(places + 1, "0");
  const cut = out.length - places;
  const whole = out.slice(0, cut);
  const frac = out.slice(cut).replace(/0+$/, "");
  return frac.length === 0 ? whole : `${whole}.${frac}`;
}

export type FactorRatio = Readonly<{
  decimal?: string;
  ln: number;
  log10: number;
  representableDouble: number | null;
}>;

export function configurationFactorRatio(
  Np: number,
  ratio: string,
): FactorRatio | RouteAEvaluation {
  if (!Number.isSafeInteger(Np) || Np < 0 || !isExactDecimal(ratio) || Number(ratio) <= 0) {
    return outside(
      "freeEnergy",
      "configurationFactorRatio",
      "Np a nonnegative integer and ratio a positive exact decimal",
      "Give the volume ratio as an exact decimal string.",
    );
  }
  const ln = Np * Math.log(Number(ratio));
  const log10 = ln / Math.LN10;
  let decimal: string | undefined;
  if (Np <= 12) {
    decimal = "1";
    for (let i = 0; i < Np; i++) decimal = multiplyExactDecimal(decimal, ratio);
  }
  const dbl = Math.exp(ln);
  return Object.freeze({
    ...(decimal === undefined ? {} : { decimal }),
    ln,
    log10,
    representableDouble: Number.isFinite(dbl) ? dbl : null,
  });
}

export type LockedCluster = Readonly<{
  locked: RouteAEvaluation;
  independent: RouteAEvaluation;
}>;

export function lockedClusterPressure(
  V: number,
  T: number,
  set: ConstantSet,
): LockedCluster | RouteAEvaluation {
  if (![V, T].every((v) => Number.isFinite(v) && v > 0)) {
    return outside(
      "osmoticPressure",
      "lockedClusterPressure",
      "V > 0 and T > 0",
      "Use a positive volume and temperature.",
      "input",
      set,
    );
  }
  const kT = thermalConstant(set).value * T;
  return Object.freeze({
    locked: number("osmoticPressure", "lockedClusterPressure", kT / V, set, {
      modelIdentity: "locked-cluster",
      modelNote:
        "Perfectly locked particles move as one unit, so the factor ratio is V/V0 and the pressure is k_B T / V.",
    }),
    independent: outside(
      "osmoticPressure",
      "lockedClusterPressure",
      "independence-premise-removed",
      "The independent-particle pressure N_p k_B T / V is not defined once particles are locked as one unit. Pressure counts independently placed units.",
      "model",
      set,
    ),
  });
}

export function stokesMobility(eta: number, a: number): RouteAEvaluation {
  if (![eta, a].every((v) => Number.isFinite(v) && v > 0)) {
    return outside(
      "mobility",
      "stokesMobility",
      "eta > 0 and a > 0",
      "Use a positive viscosity and radius.",
    );
  }
  return number("mobility", "stokesMobility", 1 / (6 * Math.PI * eta * a));
}

export function driftVelocity(mu: number, F: number): RouteAEvaluation {
  if (![mu, F].every(Number.isFinite) || mu <= 0) {
    return outside(
      "driftVelocity",
      "driftVelocity",
      "mu > 0 and F finite",
      "Use a positive mobility and a finite force.",
    );
  }
  return number("driftVelocity", "driftVelocity", mu * F);
}

export type FluxParts = Readonly<{
  total: RouteAEvaluation;
  drift: RouteAEvaluation;
  diffusion: RouteAEvaluation;
}>;

export function driftDiffusionFlux(
  n: number,
  dndx: number,
  F: number,
  mu: number,
  D: number,
): FluxParts | RouteAEvaluation {
  if (![n, dndx, F, mu, D].every(Number.isFinite) || n < 0 || mu <= 0 || D < 0) {
    return outside(
      "particleFlux",
      "driftDiffusionFlux",
      "n >= 0, mu > 0, D >= 0, finite F and dndx",
      "Use nonnegative density and diffusivity, positive mobility, and finite force and gradient.",
    );
  }
  const drift = n * mu * F;
  const diffusion = -D * dndx;
  return Object.freeze({
    total: number("particleFlux", "driftDiffusionFlux", drift + diffusion),
    drift: number("driftFlux", "driftDiffusionFlux", drift),
    diffusion: number("diffusionFlux", "driftDiffusionFlux", diffusion),
  });
}

export function equilibriumProfile(
  { n0, F, T, x }: { n0: number; F: number; T: number; x: number },
  set: ConstantSet,
): RouteAEvaluation {
  if (![n0, F, T, x].every(Number.isFinite) || n0 < 0 || T <= 0) {
    return outside(
      "probabilityDensity",
      "equilibriumProfile",
      "n0 >= 0, T > 0, finite F and x",
      "Use a nonnegative reference density and a positive temperature.",
      "input",
      set,
    );
  }
  const exponent = (F * x) / thermalConstant(set).value / T;
  if (Math.abs(exponent) > 700) {
    return outside(
      "probabilityDensity",
      "equilibriumProfile",
      "|F x / k_B T| > 700",
      "The linear density is outside binary64. Stay in log space or shorten the interval.",
      "numerical",
      set,
    );
  }
  return number("probabilityDensity", "equilibriumProfile", n0 * Math.exp(exponent), set);
}

export function osmoticEquilibriumProfile(
  x: number,
  width: number,
  force: number,
  temperature: number,
  total: number,
  set: ConstantSet,
): RouteAEvaluation {
  if (
    ![x, width, force, temperature, total].every(Number.isFinite) ||
    width <= 0 ||
    temperature <= 0 ||
    total < 0 ||
    x < 0 ||
    x > width
  ) {
    return outside(
      "probabilityDensity",
      "osmoticEquilibriumProfile",
      "box [0, W], T > 0, N_tot >= 0",
      "Evaluate inside a positive-width box at positive temperature.",
      "input",
      set,
    );
  }
  if (force === 0)
    return number("probabilityDensity", "osmoticEquilibriumProfile", total / width, set);
  const absL = Math.abs((thermalConstant(set).value * temperature) / force);
  // n = N_tot (1/λ) e^{x/λ} / (e^{W/λ} - 1) for F > 0, mirrored for F < 0.
  // Rewrite as (N_tot/λ) e^{z-w} / (1 - e^{-w}) so large W/λ never overflows an intermediate exp.
  const z = force > 0 ? x / absL : (width - x) / absL;
  const w = width / absL;
  const denom = -Math.expm1(-w);
  if (!(denom > 0)) {
    return outside(
      "probabilityDensity",
      "osmoticEquilibriumProfile",
      "W/lambda underflow",
      "The normalized profile's denominator is not a positive finite number.",
      "numerical",
      set,
    );
  }
  const logN = Math.log(total / absL) + (z - w) - Math.log(denom);
  if (!Number.isFinite(logN) || logN > 700) {
    return outside(
      "probabilityDensity",
      "osmoticEquilibriumProfile",
      "W/lambda too large",
      "The normalized profile overflowed binary64 even in log space.",
      "numerical",
      set,
    );
  }
  return number("probabilityDensity", "osmoticEquilibriumProfile", Math.exp(logN), set);
}

export type DecayLengths = Readonly<{
  osmotic: RouteAEvaluation;
  kinetic: RouteAEvaluation;
  kickStrength: number | null;
}>;

export function decayLengths(
  {
    force,
    temperature,
    kickDiffusivity,
    mobility,
  }: { force: number; temperature: number; kickDiffusivity: number; mobility: number },
  set: ConstantSet,
): DecayLengths {
  const na = (q: Quantity, reason: string) =>
    wrap({
      ...identity(q, "decayLengths"),
      status: "not-applicable",
      reason,
    });
  if (
    ![force, temperature, kickDiffusivity, mobility].every(Number.isFinite) ||
    temperature <= 0 ||
    kickDiffusivity < 0 ||
    mobility <= 0
  ) {
    const bad = outside(
      "osmoticDecayLength",
      "decayLengths",
      "T > 0, mobility > 0, D_kicks >= 0",
      "Use a positive temperature and mobility and a nonnegative kick diffusivity.",
      "input",
      set,
    );
    return { osmotic: bad, kinetic: bad, kickStrength: null };
  }
  if (force === 0) {
    const reason = "no force, no gradient: the equilibrium profile is uniform";
    return {
      osmotic: na("osmoticDecayLength", reason),
      kinetic: na("kineticDecayLength", reason),
      kickStrength: null,
    };
  }
  const kT = thermalConstant(set).value * temperature;
  const osmotic = kT / Math.abs(force);
  const kinetic = kickDiffusivity / (mobility * Math.abs(force));
  const m = kickDiffusivity / (mobility * kT);
  return {
    osmotic: number("osmoticDecayLength", "decayLengths", osmotic, set),
    kinetic: number("kineticDecayLength", "decayLengths", kinetic, set),
    kickStrength: m,
  };
}

export type EquilibriumBalance = Readonly<{
  mobilityD: RouteAEvaluation;
  balanceD: RouteAEvaluation;
  relation: ScientificResult;
  agree: boolean | null;
  cancellationFactors: readonly string[] | null;
  kickStrength: number | null;
}>;

export function equilibriumBalance(
  {
    force,
    temperature,
    eta,
    a,
    kickDiffusivity,
  }: {
    force: number;
    temperature: number;
    eta: number;
    a: number;
    kickDiffusivity: number;
    profile?: string;
  },
  set: ConstantSet,
): EquilibriumBalance | RouteAEvaluation {
  if (
    ![force, temperature, eta, a, kickDiffusivity].every(Number.isFinite) ||
    temperature <= 0 ||
    eta <= 0 ||
    a <= 0 ||
    kickDiffusivity < 0
  ) {
    return outside(
      "diffusionCoefficient",
      "equilibriumBalance",
      "T > 0, eta > 0, a > 0, D_kicks >= 0",
      "Use positive temperature, viscosity, and radius.",
      "input",
      set,
    );
  }
  const muEval = stokesMobility(eta, a);
  if (muEval.result.status !== "value") return muEval;
  const mu = muEval.result.value as number;
  const kT = thermalConstant(set).value * temperature;
  const mobilityD = mu * kT;
  const relation: ScientificResult = Object.freeze({
    ...identity("diffusionCoefficient", "equilibriumBalance"),
    status: "symbolic",
    expressionRef: "D = mu k_B T",
    unspecifiedSymbols: Object.freeze(["D", "mu", "k_B", "T"]),
  });
  if (force === 0) {
    return {
      mobilityD: number("diffusionCoefficient", "equilibriumBalance", mobilityD, set),
      balanceD: wrap({
        ...identity("kickDiffusivity", "equilibriumBalance"),
        status: "not-applicable",
        reason:
          "0/0 is not an evaluation; the equilibrium construction relates two descriptions of the same state",
      }),
      relation,
      agree: null,
      cancellationFactors: null,
      kickStrength: kickDiffusivity / mobilityD,
    };
  }
  const lambdaKin = kickDiffusivity / (mu * Math.abs(force));
  const balanceD = mu * Math.abs(force) * lambdaKin;
  const m = kickDiffusivity / mobilityD;
  return {
    mobilityD: number("diffusionCoefficient", "equilibriumBalance", mobilityD, set),
    balanceD: number("kickDiffusivity", "equilibriumBalance", balanceD, set),
    relation,
    agree: Math.abs(m - 1) <= 1e-9,
    cancellationFactors: Object.freeze([`mu*|F|`, `k_B T / |F|`]),
    kickStrength: m,
  };
}
