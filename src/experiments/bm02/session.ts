/**
 * BM-02, the osmotic partition (am-bm-02-osmotic-partition-n13x). This
 * module composes the real owner functions in
 * src/physics/reference/diffusion.ts into one accepted snapshot; it never
 * recomputes a physical law itself. A view renders this snapshot only.
 *
 * Historical constant-set support (`einstein-1905-brownian-printed`) is
 * NOT implemented here: that set is reserved but not yet built
 * (src/physics/reference/constants.ts explicitly throws
 * `constant-set-not-registered` for it, owned by am-ref-constants-xik).
 * This session only accepts `modern-si-2019`; the historical comparison
 * from this bead's acceptance criteria is deferred, not faked.
 */

import { getConstantSet } from "../../physics/reference/constants";
import { osmoticPressure } from "../../physics/reference/diffusion/distributions";
import {
  CLASSICAL_SUSPENDED_BODIES,
  type DiluteDomain,
  diluteDomainCheck,
  hydrostaticHead,
  osmoticPressureClassicalExpectation,
  partitionForce,
  type RouteAEvaluation,
  STANDARD_GRAVITY,
  volumeFraction,
} from "../../physics/reference/diffusion/routeA";
import type { ScientificResult } from "../results/types";

export const SOLVENT_DENSITY_KG_M3 = 998;
export const PHI_MAX = 0.01;
export const PHI_MAX_JUSTIFICATION =
  "For hard spheres, Pi/(n kB T) = 1 + 4*phi + O(phi^2), so the ideal law is within about 4% at phi = 0.01.";

export type OsmoticModel = "molecular-kinetic" | "classical-thermodynamics-suspended-bodies";

export type Bm02Inputs = Readonly<{
  Np: number;
  /** Accessible volume, in cubic micrometres (μm^3). */
  V_um3: number;
  /** Temperature, in kelvin. */
  T: number;
  /** Particle radius, in micrometres (μm). */
  a_um: number;
  /** Partition area, in square micrometres (μm^2). */
  A_um2: number;
  model: OsmoticModel;
  constantSetId: "modern-si-2019";
}>;

export const DEFAULT_BM02_INPUTS: Bm02Inputs = Object.freeze({
  Np: 1000,
  V_um3: 1_000_000,
  T: 293.15,
  a_um: 0.5,
  A_um2: 10_000,
  model: "molecular-kinetic",
  constantSetId: "modern-si-2019",
});

/**
 * A 0.01 mol/L sugar solution at 293.15 K, same law, a molecular-scale
 * radius. 0.01 mol/L = 10 mol/m^3; times the modern, exact Avogadro
 * constant (6.02214076e23 /mol) gives n = 6.02214076e24 m^-3. Np and
 * V_um3 are chosen so Np / (V_um3 * 1e-18) equals that exactly, with Np a
 * whole particle count: 602214076000 / (100000 * 1e-18) = 6.02214076e24.
 */
export const SUGAR_0P01M_INPUTS: Bm02Inputs = Object.freeze({
  Np: 602_214_076_000,
  V_um3: 100_000,
  T: 293.15,
  a_um: 0.0005, // 0.5 nm
  A_um2: 10_000,
  model: "molecular-kinetic",
  constantSetId: "modern-si-2019",
});

const UM3_TO_M3 = 1e-18;
const UM2_TO_M2 = 1e-12;
const UM_TO_M = 1e-6;

export type Bm02Snapshot = Readonly<{
  inputs: Bm02Inputs;
  numberDensity: ScientificResult;
  volumeFraction: ScientificResult;
  domain: DiluteDomain | RouteAEvaluation;
  osmoticPressure: RouteAEvaluation;
  partitionForce: RouteAEvaluation;
  hydrostaticHead: RouteAEvaluation;
}>;

function numberDensityResult(Np: number, V_m3: number): ScientificResult {
  const identity = {
    quantityId: "numberDensity",
    unit: "m-3",
    semanticKind: "particle-number-density",
    ownerId: "bm02.session",
  };
  if (!Number.isSafeInteger(Np) || Np < 0 || !Number.isFinite(V_m3) || V_m3 <= 0) {
    return Object.freeze({
      ...identity,
      status: "outside-domain",
      condition: "Np a nonnegative integer, V > 0",
      domainKind: "input",
      reason: "Use a whole particle count and a positive accessible volume.",
      boundary: { alternativeModel: "Use finite inputs inside the stated dilute model." },
    });
  }
  const density = Np / V_m3;
  if (!Number.isFinite(density)) {
    return Object.freeze({
      ...identity,
      status: "outside-domain",
      condition: "binary64-range",
      domainKind: "numerical",
      reason: "This result is outside the representable numerical range.",
      boundary: { alternativeModel: "Use finite inputs inside the stated dilute model." },
    });
  }
  return Object.freeze({ ...identity, status: "value", value: density });
}

function unresolvedVolumeFractionDomain(): RouteAEvaluation {
  return Object.freeze({
    result: Object.freeze({
      quantityId: "volumeFraction",
      unit: "1",
      semanticKind: "solute-volume-fraction",
      ownerId: "diffusion.diluteDomainCheck",
      status: "outside-domain",
      condition: "a finite volume fraction",
      domainKind: "input",
      reason: "The volume fraction could not be computed from the given inputs.",
      boundary: { alternativeModel: "Use finite, positive Np, radius, and volume." },
    }),
  });
}

/**
 * `DiluteDomain` (a real admitted/refused check) always carries `phi`;
 * `RouteAEvaluation` (an input refusal in the same shape every other owner
 * call returns) never does. This is the discriminant this module uses
 * everywhere it needs to tell the two apart — never the presence of
 * `admitted` alone, since that would misclassify a refusal as a check.
 */
function isDiluteDomain(d: DiluteDomain | RouteAEvaluation): d is DiluteDomain {
  return "phi" in d;
}

function outsideDomainReasonOf(evaluation: RouteAEvaluation): string {
  return evaluation.result.status === "outside-domain" ? evaluation.result.reason : "";
}

/**
 * Composes one accepted snapshot for the given inputs. Every physical
 * quantity comes from a call into src/physics/reference/diffusion; this
 * function only converts units (μm^3 to m^3, μm^2 to m^2, μm to m) and
 * decides, from the dilute-domain check, whether the pressure/force/head
 * owners are even called for this input revision.
 */
export function computeBm02Snapshot(inputs: Bm02Inputs): Bm02Snapshot {
  const V_m3 = inputs.V_um3 * UM3_TO_M3;
  const a_m = inputs.a_um * UM_TO_M;
  const A_m2 = inputs.A_um2 * UM2_TO_M2;

  const n = numberDensityResult(inputs.Np, V_m3);
  const phiEval = volumeFraction(inputs.Np, a_m, V_m3);
  const phi = phiEval.result.status === "value" ? (phiEval.result.value as number) : Number.NaN;

  const domain: DiluteDomain | RouteAEvaluation = Number.isFinite(phi)
    ? diluteDomainCheck(phi, PHI_MAX, {
        Np: inputs.Np,
        a: a_m,
        V: V_m3,
        justification: PHI_MAX_JUSTIFICATION,
      })
    : unresolvedVolumeFractionDomain();

  const admitted = isDiluteDomain(domain) && domain.admitted;
  const set = getConstantSet(inputs.constantSetId);

  function pressureFor(model: OsmoticModel): RouteAEvaluation {
    if (model === "classical-thermodynamics-suspended-bodies") {
      return osmoticPressureClassicalExpectation();
    }
    if (!admitted) {
      const boundaryDetail = isDiluteDomain(domain)
        ? `Admissible boundary at these settings: at most ${domain.maxAdmittedCount} particles, or at least ${domain.minAdmittedVolume.toExponential(4)} m^3 of accessible volume.`
        : outsideDomainReasonOf(domain);
      return Object.freeze({
        result: Object.freeze({
          quantityId: "osmoticPressure",
          unit: "Pa",
          semanticKind: "ideal-osmotic-pressure",
          ownerId: "diffusion.osmoticPressure",
          status: "outside-domain",
          condition: `volume fraction <= ${PHI_MAX}`,
          domainKind: "model",
          reason: `Above phi = ${PHI_MAX}, particle interactions and excluded volume are not modeled by the ideal dilute law. ${boundaryDetail}`,
          boundary: { alternativeModel: "Reduce the particle count or increase the volume." },
        }),
      });
    }
    return osmoticPressure(
      { n: n.status === "value" ? (n.value as number) : Number.NaN, T: inputs.T },
      set,
    );
  }

  const pi = pressureFor(inputs.model);
  const piValue = pi.result.status === "value" ? (pi.result.value as number) : undefined;

  const force: RouteAEvaluation =
    piValue === undefined ? Object.freeze({ result: pi.result }) : partitionForce(piValue, A_m2);
  const head: RouteAEvaluation =
    piValue === undefined
      ? Object.freeze({ result: pi.result })
      : hydrostaticHead(piValue, SOLVENT_DENSITY_KG_M3, STANDARD_GRAVITY);

  return Object.freeze({
    inputs,
    numberDensity: n,
    volumeFraction: phiEval.result,
    domain,
    osmoticPressure: pi,
    partitionForce: force,
    hydrostaticHead: head,
  });
}

export { CLASSICAL_SUSPENDED_BODIES };
