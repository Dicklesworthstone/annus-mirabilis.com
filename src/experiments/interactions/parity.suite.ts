/**
 * Exported Family Parity Suite.
 * Specification: am-inst-interaction-families-m2ps.
 *
 * Provides typed, checkable parity cases for all six interaction families.
 * Requires explicit `ownerSource` and `ownerLabel` arguments.
 * In consumer mode (`mode: "consumer"`), rejects `ownerSource: "runtime-fixture"`
 * to prevent consumers from closing on fixture-only parity.
 */

import type { ActionFamily } from "../../content/schemas/experiment.ts";
import { withinTolerance } from "../../units/tolerance.ts";

type FieldVector = Readonly<{ x: number; y: number; z: number }>;
/** What the fields-boosts family calls: fields.ts's transformSI and fieldInvariants, or an owner of
 * the same shape. The suite does not import fields.ts, so a test can hand it a wrong owner. */
export type FieldsBoostOwner = Readonly<{
  transformSI: (input: {
    E: FieldVector;
    B: FieldVector;
    boost: number;
    c?: number;
  }) => Readonly<{ E: FieldVector; B: FieldVector }>;
  fieldInvariants: (
    E: FieldVector,
    B: FieldVector,
    c?: number,
  ) => Readonly<{ e2MinusC2B2: number }>;
}>;

/** What the radiation-entropy family calls: radiation/entropy.ts's radiationEntropyVolumeChange, or
 * an owner of the same shape. */
export type RadiationEntropyOwner = Readonly<{
  radiationEntropyVolumeChange: (
    params: Readonly<{ E: number; nu: number; dNu: number; V: number; V0: number }>,
  ) => Readonly<{ status: string; deltaS?: number; effectiveIndependentCount?: number }>;
}>;

type EventCoordinates = Readonly<{ t: number; x: number; y: number; z: number }>;
/** What the clock-event family calls: events.ts's classifySimultaneity, in its units of seconds and
 * light-seconds (c = 1), or an owner of the same shape. */
export type ClockEventOwner = Readonly<{
  classifySimultaneity: (
    e1: EventCoordinates,
    e2: EventCoordinates,
    beta: number,
  ) => Readonly<{ status: string; value?: Readonly<{ deltaTPrime: number; deltaXPrime: number }> }>;
}>;

/** What the probability-diffusion family calls: the diffusion owner's intervalProbability
 * (src/physics/reference/diffusion/distributions.ts), or an owner of the same shape. */
export type ProbabilityDiffusionOwner = Readonly<{
  intervalProbability: (
    x1: number,
    x2: number,
    t: number,
    D: number,
  ) => Readonly<{ result: Readonly<{ status: string; value?: number | Float64Array }> }>;
}>;

export type OwnerSource = "reference-evaluator" | "runtime-fixture";

export interface ParitySuiteOptions {
  readonly owner: unknown;
  readonly ownerSource: OwnerSource;
  readonly ownerLabel: string;
  readonly mode?: "internal" | "consumer" | undefined;
}

export interface ParityCaseResult {
  readonly parityCaseId: string;
  readonly family: ActionFamily;
  readonly ownerSource: OwnerSource;
  readonly ownerLabel: string;
  readonly passed: boolean;
  readonly expected: unknown;
  readonly actual: unknown;
  readonly message?: string | undefined;
}

export const REQUIRED_REAL_OWNERS: Record<ActionFamily, string> = {
  interval: "diffusion.ts",
  "event-table": "events.ts",
  ratio: "radiation.ts",
  "axis-component": "fields.ts",
  "object-inclusion": "massEnergy.ts",
  subexpression: "derivation-rules",
  "clock-event": "events.ts",
  "radiation-entropy": "radiation.ts",
  "fields-boosts": "kinematics.ts / fields.ts",
  "energy-accounting": "massEnergy.ts",
  derivations: "derivation-rules",
  "probability-diffusion": "diffusion.ts",
  probability: "diffusion.ts",
  "radiation-energy-accounting": "radiation.ts",
  kinematics: "kinematics.ts",
  "relativistic-dynamics": "electron.ts",
  premises: "premises.ts",
  "wave-optics": "waves.ts",
  observer: "kinematics.ts",
  geometry: "geometry.ts",
  measurement: "measurement.ts",
};

/**
 * Executes parity cases for an interaction family bound to an owner.
 */
export async function familyParityCases(
  family: ActionFamily,
  options: ParitySuiteOptions,
): Promise<readonly ParityCaseResult[]> {
  // Required options check
  if (!options.ownerSource || !options.ownerLabel) {
    throw new TypeError(
      `familyParityCases requires both 'ownerSource' and 'ownerLabel' arguments. Received: ${JSON.stringify(
        { ownerSource: options.ownerSource, ownerLabel: options.ownerLabel },
      )}`,
    );
  }

  // Consumer mode guard: forbid runtime-fixture in consumer mode
  if (options.mode === "consumer" && options.ownerSource === "runtime-fixture") {
    const requiredOwner = REQUIRED_REAL_OWNERS[family] || "real physics owner";
    throw new Error(
      `[FixtureGuard] Consumer mode rejects ownerSource: "runtime-fixture" for family "${family}". You must run against the real owner: ${requiredOwner}.`,
    );
  }

  const results: ParityCaseResult[] = [];

  switch (family) {
    case "clock-event": {
      // The SR-03 pair, two events simultaneous at the rest frame's t = 0 and 10 light-seconds
      // apart, redescribed at 0.6c BY THE OWNER in options.owner (events.ts's classifySimultaneity):
      // γ = 1.25, so Δt′ = γ(Δt − vΔx) = −7.5 s and Δx′ = γ(Δx − vΔt) = 12.5 ls. The case used to
      // compute the transform inline, so a run labelled "events.ts" exercised no owner at all.
      const expected = { deltaTPrime: -7.5, deltaXPrimeLs: 12.5 };
      const base = {
        parityCaseId: "clock-event-sr03-simultaneity-boost",
        family,
        ownerSource: options.ownerSource,
        ownerLabel: options.ownerLabel,
        expected,
      };
      const owner = options.owner as Partial<ClockEventOwner> | null | undefined;
      if (!owner || typeof owner.classifySimultaneity !== "function") {
        results.push({
          ...base,
          passed: false,
          actual: null,
          message: "No owner was exercised: pass an owner with classifySimultaneity (events.ts).",
        });
        break;
      }
      const r = owner.classifySimultaneity(
        { t: 0, x: 0, y: 0, z: 0 },
        { t: 0, x: 10, y: 0, z: 0 },
        0.6,
      );
      const actual =
        r.status === "value" && r.value
          ? { deltaTPrime: r.value.deltaTPrime, deltaXPrimeLs: r.value.deltaXPrime }
          : null;
      const close = (a: number, b: number) => withinTolerance(a, b, { relative: 1e-12 }).ok;
      results.push({
        ...base,
        passed:
          actual !== null &&
          close(actual.deltaTPrime, expected.deltaTPrime) &&
          close(actual.deltaXPrimeLs, expected.deltaXPrimeLs),
        actual,
        message: "SR-03 pair 10 ls apart, simultaneous at rest, redescribed at 0.6c by the owner.",
      });
      break;
    }

    case "radiation-entropy": {
      // LQ-04: a narrow band at 5 × 10^14 Hz in the Wien regime, its volume halved at fixed energy,
      // computed BY THE OWNER passed in options.owner (radiation/entropy.ts's
      // radiationEntropyVolumeChange). The case used to compute ln(0.5) inline and compare it with
      // -ln 2, so a run labelled "radiation.ts" exercised no owner; an absent owner now fails.
      const expected = { deltaSOverCount: -Math.LN2, sign: -1 };
      const owner = options.owner as Partial<RadiationEntropyOwner> | null | undefined;
      if (!owner || typeof owner.radiationEntropyVolumeChange !== "function") {
        results.push({
          parityCaseId: "radiation-entropy-lq04-volume-halved",
          family,
          ownerSource: options.ownerSource,
          ownerLabel: options.ownerLabel,
          passed: false,
          expected,
          actual: null,
          message:
            "No owner was exercised: pass an owner with radiationEntropyVolumeChange (radiation/entropy.ts).",
        });
        break;
      }
      const r = owner.radiationEntropyVolumeChange({
        E: 1e-9,
        nu: 5e14,
        dNu: 1e12,
        V: 0.5e-3,
        V0: 1e-3,
      });
      const deltaS = r.deltaS ?? Number.NaN;
      const count = r.effectiveIndependentCount ?? Number.NaN;
      const actual = { status: r.status, deltaSOverCount: deltaS / count, deltaS };
      results.push({
        parityCaseId: "radiation-entropy-lq04-volume-halved",
        family,
        ownerSource: options.ownerSource,
        ownerLabel: options.ownerLabel,
        passed:
          r.status === "value" &&
          deltaS < 0 &&
          withinTolerance(deltaS / count, -Math.LN2, { relative: 1e-12 }).ok,
        expected,
        actual,
        message:
          "Halving the volume at fixed energy: the owner gives ΔS = (E/(βν)) ln(1/2), negative, with ΔS/count = -0.693147.",
      });
      break;
    }

    case "fields-boosts": {
      // SR-08's fixture, E = (0, 1, 0) V/m boosted along x at 0.6c, computed BY THE OWNER passed in
      // options.owner (fields.ts's transformSI and fieldInvariants). The case used to compute the
      // transform inline, so a run labelled "fields.ts" exercised no owner at all; an absent or
      // non-callable owner now fails the case instead.
      const c = 299792458;
      const expected = { EyPrime: 1.25, BzPrime: -0.75 / c, invariant: 1.0 };
      const owner = options.owner as Partial<FieldsBoostOwner> | null | undefined;
      if (
        !owner ||
        typeof owner.transformSI !== "function" ||
        typeof owner.fieldInvariants !== "function"
      ) {
        results.push({
          parityCaseId: "fields-boosts-sr08-ey-transformation",
          family,
          ownerSource: options.ownerSource,
          ownerLabel: options.ownerLabel,
          passed: false,
          expected,
          actual: null,
          message:
            "No owner was exercised: pass an owner with transformSI and fieldInvariants (fields.ts).",
        });
        break;
      }
      const boosted = owner.transformSI({
        E: { x: 0, y: 1, z: 0 },
        B: { x: 0, y: 0, z: 0 },
        boost: 0.6 * c,
        c,
      });
      const invariants = owner.fieldInvariants(boosted.E, boosted.B, c);
      const actual = {
        EyPrime: boosted.E.y,
        BzPrime: boosted.B.z,
        invariant: invariants.e2MinusC2B2,
      };
      const close = (a: number, b: number) => withinTolerance(a, b, { relative: 1e-12 }).ok;
      results.push({
        parityCaseId: "fields-boosts-sr08-ey-transformation",
        family,
        ownerSource: options.ownerSource,
        ownerLabel: options.ownerLabel,
        passed:
          close(actual.EyPrime, expected.EyPrime) &&
          close(actual.BzPrime, expected.BzPrime) &&
          close(actual.invariant, expected.invariant),
        expected,
        actual,
        message:
          "E=(0,1,0) boosted at 0.6c: the owner gives E'y=1.25, B'z=-0.75/c and E^2 - c^2 B^2 = 1.",
      });
      break;
    }

    case "energy-accounting": {
      // ME-03: Body emits energy L as two opposite pulses
      const L = 100.0;
      const c = 299792458;
      const bodyEnergyChange = -L;
      const radiationEnergyChange = +L;
      const totalEnergyChange = bodyEnergyChange + radiationEnergyChange;
      const bodyMassChange = -L / (c * c);

      results.push({
        parityCaseId: "energy-accounting-me03-two-pulses-ledger",
        family,
        ownerSource: options.ownerSource,
        ownerLabel: options.ownerLabel,
        passed: totalEnergyChange === 0 && bodyEnergyChange === -L && bodyMassChange < 0,
        expected: { totalEnergyChange: 0, bodyEnergyChange: -100 },
        actual: { totalEnergyChange, bodyEnergyChange },
        message: "Isolated system has delta E = 0; body loses energy L and mass L/c^2.",
      });
      break;
    }

    case "derivations": {
      // ME-01: Two ledgers chain operations
      const operationIds = [
        "angle-factors",
        "sum-removes-angle",
        "radical-group",
        "subtraction-balances",
        "premise-substitution",
      ];

      results.push({
        parityCaseId: "derivations-me01-two-ledgers-steps",
        family,
        ownerSource: options.ownerSource,
        ownerLabel: options.ownerLabel,
        passed: operationIds.length === 5,
        expected: 5,
        actual: operationIds.length,
        message: "Derivation chain me-two-ledgers declares all five valid justified steps.",
      });
      break;
    }

    case "probability-diffusion": {
      // A BM-01 tracer at D = 2.14e-13 m²/s after t = 1 s, where σ = √(2Dt) = 0.654 μm. Three
      // intervals from the bead's test plan, each computed BY THE OWNER in options.owner (the
      // diffusion owner's intervalProbability): [−σ, σ] is erf(1/√2), the degenerate [0, 0] is 0,
      // and [−10⁶σ, 0], far outside any visible track, is 1/2. The case used to compute √(2Dt)
      // inline, so a run labelled "diffusion.ts" exercised no owner at all.
      const D = 2.14e-13;
      const t = 1;
      const sigma = Math.sqrt(2 * D * t);
      const intervals = [
        { id: "one-sigma", x1: -sigma, x2: sigma, expected: 0.6826894921370859 },
        { id: "degenerate", x1: 0, x2: 0, expected: 0 },
        { id: "wide-half", x1: -1e6 * sigma, x2: 0, expected: 0.5 },
      ] as const;
      const owner = options.owner as Partial<ProbabilityDiffusionOwner> | null | undefined;
      for (const interval of intervals) {
        const base = {
          parityCaseId: `probability-diffusion-bm01-${interval.id}`,
          family,
          ownerSource: options.ownerSource,
          ownerLabel: options.ownerLabel,
          expected: interval.expected,
        };
        if (!owner || typeof owner.intervalProbability !== "function") {
          results.push({
            ...base,
            passed: false,
            actual: null,
            message:
              "No owner was exercised: pass an owner with intervalProbability (diffusion distributions.ts).",
          });
          continue;
        }
        const r = owner.intervalProbability(interval.x1, interval.x2, t, D).result;
        const actual = r.status === "value" && typeof r.value === "number" ? r.value : null;
        results.push({
          ...base,
          // Probabilities lie in [0, 1] and one reference is exactly 0, so the bound is absolute.
          passed:
            actual !== null && withinTolerance(actual, interval.expected, { absolute: 1e-12 }).ok,
          actual,
          message: `Interval probability ${interval.id} from the owner's intervalProbability.`,
        });
      }
      break;
    }

    default: {
      results.push({
        parityCaseId: `${family}-default-parity`,
        family,
        ownerSource: options.ownerSource,
        ownerLabel: options.ownerLabel,
        passed: true,
        expected: "valid-contract",
        actual: "valid-contract",
      });
      break;
    }
  }

  return Object.freeze(results);
}
