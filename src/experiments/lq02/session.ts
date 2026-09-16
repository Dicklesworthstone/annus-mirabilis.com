/**
 * LQ-02, the classical mode-energy allocation with the cutoff
 * (am-lq-02-mode-allocation-vy60). This module composes the real owner
 * functions in src/physics/reference/radiation into one accepted snapshot;
 * it never recomputes a physical law itself. A view renders this snapshot
 * only.
 *
 * The historical/1904 constant sets (`einstein-1905-light-quanta-printed`,
 * `planck-1900-1901-printed`) are NOT read through the constant-set
 * registry here: both are reserved but unregistered
 * (src/physics/reference/constants.ts throws `constant-set-not-registered`
 * for them, owned by am-ref-constants-xik). The historical Avogadro
 * readout below still works honestly, because
 * `avogadroFromPlanckConstants()` computes it from Einstein's printed §2
 * constants directly, without going through that registry -- it is not
 * faked, but the mode `lq-02:1904` desk and the Planck 1900-1901 printed
 * comparison are deferred, not built here.
 */

import type { ConstantSet } from "../../physics/reference/constants";
import { getConstantSet } from "../../physics/reference/constants";
import {
  avogadroFromPlanckConstants,
  classicalCutoffEnergyDensity,
  classicalTotalEnergy,
  meanResonatorEnergy,
  regimeRelativeErrors,
} from "../../physics/reference/radiation";
import type {
  AvogadroReadout,
  RadiationOutsideDomain,
  RadiationResult,
} from "../../physics/reference/radiation/types";

export type { AvogadroReadout, RadiationOutsideDomain, RadiationResult };

export type Lq02Inputs = Readonly<{
  /** Temperature, in kelvin. */
  T: number;
  /** Highest resonator frequency (the modern lens: a mode cutoff), in Hz. */
  nuCutoff: number;
  /** A probe frequency at or below nuCutoff, for the "share above" comparison, in Hz. */
  probeFrequency: number;
  constantSetId: "modern-si-2019";
}>;

export const DEFAULT_LQ02_INPUTS: Lq02Inputs = Object.freeze({
  T: 1500,
  nuCutoff: 1e14,
  probeFrequency: 1e13,
  constantSetId: "modern-si-2019",
});

export type Lq02Snapshot = Readonly<{
  inputs: Lq02Inputs;
  meanResonatorEnergy: ReturnType<typeof meanResonatorEnergy> | RadiationOutsideDomain;
  energyUpToCutoff: RadiationResult<number>;
  energyUpToProbe: RadiationResult<number>;
  shareAboveProbe: RadiationResult<number>;
  tenfoldWidenedEnergy: RadiationResult<number>;
  growthRatio: number | null;
  regimeBoundaries: Readonly<{ classicalBoundaryX: number; wienBoundaryX: number }>;
  avogadro: AvogadroReadout;
}>;

function deriveShareAboveProbe(
  cutoff: RadiationResult<number>,
  probe: RadiationResult<number>,
): RadiationResult<number> {
  const quantityId = "energyShareAboveProbe";
  const unit = "1";
  if (cutoff.status !== "value" || probe.status !== "value") {
    return Object.freeze({
      status: "outside-domain",
      quantityId,
      unit,
      condition: "cutoff-or-probe-not-value",
      domainKind: "input",
      reason:
        "The share above the probe frequency needs both the cutoff and probe energies to be finite values.",
    });
  }
  if (probe.value > cutoff.value) {
    return Object.freeze({
      status: "outside-domain",
      quantityId,
      unit,
      condition: "probe-above-cutoff",
      domainKind: "input",
      reason: "The probe frequency must be at or below the cutoff frequency.",
    });
  }
  return Object.freeze({
    status: "value",
    quantityId,
    unit,
    value: (cutoff.value - probe.value) / cutoff.value,
    linearRepresentable: true,
  });
}

/**
 * `meanResonatorEnergy` (the owner function) always returns `status:
 * "value"`, trusting its caller for T's domain -- unlike
 * `classicalCutoffEnergyDensity`, which validates T itself. Composing
 * both into one snapshot without this guard would let a nonpositive T
 * silently produce a negative "value" energy here while the cutoff energy
 * correctly refuses, an inconsistency of exactly the kind a reader has no
 * way to detect.
 */
function meanResonatorEnergyResult(
  T: number,
  set: ConstantSet,
): ReturnType<typeof meanResonatorEnergy> | RadiationOutsideDomain {
  if (!Number.isFinite(T) || T <= 0) {
    return Object.freeze({
      status: "outside-domain",
      quantityId: "meanResonatorEnergy",
      unit: "J",
      condition: "nonpositive-temperature",
      domainKind: "physical",
      reason: `Temperature must be positive and finite (got ${T}).`,
    });
  }
  return meanResonatorEnergy(T, set);
}

function deriveGrowthRatio(
  tenfold: RadiationResult<number>,
  base: RadiationResult<number>,
): number | null {
  if (tenfold.status === "value" && base.status === "value" && base.value !== 0) {
    return tenfold.value / base.value;
  }
  return null;
}

/**
 * Composes one accepted snapshot for the given inputs. Every physical
 * quantity comes from a call into src/physics/reference/radiation; this
 * function only derives arithmetic ratios and shares from those results
 * (never a new physical law) and decides which owner calls to make.
 */
export function computeLq02Snapshot(inputs: Lq02Inputs): Lq02Snapshot {
  const set = getConstantSet(inputs.constantSetId);

  const mean = meanResonatorEnergyResult(inputs.T, set);
  const energyUpToCutoff = classicalCutoffEnergyDensity(inputs.nuCutoff, inputs.T, set);
  const energyUpToProbe = classicalCutoffEnergyDensity(inputs.probeFrequency, inputs.T, set);
  const tenfoldWidenedEnergy = classicalCutoffEnergyDensity(inputs.nuCutoff * 10, inputs.T, set);
  const shareAboveProbe = deriveShareAboveProbe(energyUpToCutoff, energyUpToProbe);
  const growthRatio = deriveGrowthRatio(tenfoldWidenedEnergy, energyUpToCutoff);

  const regime = regimeRelativeErrors(inputs.nuCutoff, inputs.T, set);
  const avogadro = avogadroFromPlanckConstants();

  return Object.freeze({
    inputs,
    meanResonatorEnergy: mean,
    energyUpToCutoff,
    energyUpToProbe,
    shareAboveProbe,
    tenfoldWidenedEnergy,
    growthRatio,
    regimeBoundaries: Object.freeze({
      classicalBoundaryX: regime.rayleighJeansBoundaryX,
      wienBoundaryX: regime.wienBoundaryX,
    }),
    avogadro,
  });
}

/**
 * "Remove the upper limit": the classical total over [0, infinity)
 * diverges. This is a distinct action from computeLq02Snapshot, never a
 * field of it, so the caller can keep the last accepted finite-range
 * snapshot visible alongside this refusal.
 */
export function removeUpperLimit(inputs: Lq02Inputs): RadiationResult<number> {
  const set = getConstantSet(inputs.constantSetId);
  return classicalTotalEnergy(inputs.T, set);
}
