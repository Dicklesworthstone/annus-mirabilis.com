/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/physics/energyLedger.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Removed patent-specific catalog kernels and energy dispatcher.
 * - Preserved generic port-Hamiltonian energy ledger types, steady power balance verification, discrete passivity validation, and timestep convergence checking.
 */

import { areDimensionsEqual, DIM_POWER, parseUnitToDimension } from "../units/qty.ts";

export type EnergyAvailability =
  | "exact"
  | "kernel-partial"
  | "steady-power"
  | "unavailable";

export type EnergyBalanceReport =
  | {
      readonly kind: "port-hamiltonian";
      readonly dHdtWatts: number;
      readonly netPortPowerWatts: number;
      readonly dissipationWatts: number;
      readonly residualWatts: number;
      readonly toleranceWatts: number;
      readonly balanced: boolean;
    }
  | {
      readonly kind: "steady-state";
      readonly residualWatts: number;
      readonly toleranceWatts: number;
      readonly balanced: boolean;
    }
  | {
      readonly kind: "unavailable";
      readonly reason: string;
    };

export interface PortHamiltonianReport {
  readonly availability: EnergyAvailability;
  readonly runtimeSource?: "wasm" | "ts-fallback" | "unloaded";
  readonly storedEnergyAvailable: boolean;
  readonly inputPowerAvailable: boolean;
  readonly dissipatedPowerAvailable: boolean;
  readonly dissipationLabel?: string;
  readonly energy: {
    readonly kineticJoules: number;
    readonly potentialJoules: number;
    readonly electromagneticJoules: number;
    readonly thermalJoules: number;
    readonly totalHamiltonianJoules: number;
  };
  readonly inputPowerWatts: number;
  readonly dissipatedPowerWatts: number;
  readonly outputPowerWatts: number | null;
  readonly netPowerRateWatts: number;
  readonly strainEnergyDensityJPerM3?: number;
  readonly balance: EnergyBalanceReport;
  readonly stateDigest: string;
  readonly digestKind: "host" | "blake3";
  readonly reason?: string;
}

export function emptyHamiltonianReport(
  reason = "Energy data unavailable for this experiment.",
): PortHamiltonianReport {
  return {
    availability: "unavailable",
    storedEnergyAvailable: false,
    inputPowerAvailable: false,
    dissipatedPowerAvailable: false,
    energy: {
      kineticJoules: 0,
      potentialJoules: 0,
      electromagneticJoules: 0,
      thermalJoules: 0,
      totalHamiltonianJoules: 0,
    },
    inputPowerWatts: 0,
    dissipatedPowerWatts: 0,
    outputPowerWatts: null,
    netPowerRateWatts: 0,
    balance: { kind: "unavailable", reason },
    stateDigest: "unavailable",
    digestKind: "host",
    reason,
  };
}

/**
 * A steady power residual in watts, never a transient ΔH claim in joules.
 * Tolerance is 10 nW absolute plus the larger 1e-8 relative scale.
 */
export function measureSteadyPowerBalance(
  inputWatts: number,
  outputWatts: number,
): PortHamiltonianReport["balance"] {
  if (![inputWatts, outputWatts].every((value) => Number.isFinite(value) && value >= 0)) {
    return { kind: "unavailable", reason: "Steady power ports must be finite and nonnegative." };
  }
  const residualWatts = inputWatts - outputWatts;
  const toleranceWatts = 1e-8 * Math.max(1, inputWatts, outputWatts);
  return {
    kind: "steady-state",
    residualWatts,
    toleranceWatts,
    balanced: Math.abs(residualWatts) <= toleranceWatts,
  };
}

export interface DiscretePassivityCheck {
  readonly passed: boolean;
  readonly powerInWatts: number;
  readonly powerOutWatts: number;
  readonly powerDissipatedWatts: number;
  readonly dHdtWatts: number;
  readonly residualWatts: number;
  readonly toleranceWatts: number;
  readonly passivityViolated: boolean;
  readonly energyInjectedWatts?: number;
  readonly refusalReason?: string;
}

/**
 * Validates discrete power balance and passivity across energetic ports.
 * For passive physical systems:
 * 1. Dissipation must be non-negative (no spontaneous energy generation / injection).
 * 2. Power balance residual: Pin - Pout - Pdiss - dH/dt must be zero within tolerance.
 * Deliberate energy injection (e.g. negative dissipation or ungrounded work) is caught.
 */
export function validateDiscretePassivityAndConservation(ports: {
  powerInWatts: number;
  powerOutWatts?: number;
  powerDissipatedWatts: number;
  dHdtWatts?: number;
  powerInUnit?: string;
  powerOutUnit?: string;
  powerDissipatedUnit?: string;
}): DiscretePassivityCheck {
  const pin = ports.powerInWatts;
  const pout = ports.powerOutWatts ?? 0;
  const pdiss = ports.powerDissipatedWatts;
  const dHdt = ports.dHdtWatts ?? 0;

  // Unit dimension checks if units are provided
  if (ports.powerInUnit) {
    const dim = parseUnitToDimension(ports.powerInUnit);
    if (!areDimensionsEqual(dim, DIM_POWER)) {
      return {
        passed: false,
        powerInWatts: pin,
        powerOutWatts: pout,
        powerDissipatedWatts: pdiss,
        dHdtWatts: dHdt,
        residualWatts: 0,
        toleranceWatts: 0,
        passivityViolated: false,
        refusalReason: `Unit mismatch on input power port: expected Power, received "${ports.powerInUnit}".`,
      };
    }
  }
  if (ports.powerOutUnit) {
    const dim = parseUnitToDimension(ports.powerOutUnit);
    if (!areDimensionsEqual(dim, DIM_POWER)) {
      return {
        passed: false,
        powerInWatts: pin,
        powerOutWatts: pout,
        powerDissipatedWatts: pdiss,
        dHdtWatts: dHdt,
        residualWatts: 0,
        toleranceWatts: 0,
        passivityViolated: false,
        refusalReason: `Unit mismatch on output power port: expected Power, received "${ports.powerOutUnit}".`,
      };
    }
  }
  if (ports.powerDissipatedUnit) {
    const dim = parseUnitToDimension(ports.powerDissipatedUnit);
    if (!areDimensionsEqual(dim, DIM_POWER)) {
      return {
        passed: false,
        powerInWatts: pin,
        powerOutWatts: pout,
        powerDissipatedWatts: pdiss,
        dHdtWatts: dHdt,
        residualWatts: 0,
        toleranceWatts: 0,
        passivityViolated: false,
        refusalReason: `Unit mismatch on dissipation port: expected Power, received "${ports.powerDissipatedUnit}".`,
      };
    }
  }

  // Non-finite check
  if (![pin, pout, pdiss, dHdt].every(Number.isFinite)) {
    return {
      passed: false,
      powerInWatts: pin,
      powerOutWatts: pout,
      powerDissipatedWatts: pdiss,
      dHdtWatts: dHdt,
      residualWatts: Number.NaN,
      toleranceWatts: 0,
      passivityViolated: false,
      refusalReason: "Non-finite port value in power balance evaluation.",
    };
  }

  // Passivity check: in passive systems, dissipation cannot be negative
  if (pdiss < -1e-9) {
    const injected = -pdiss;
    return {
      passed: false,
      powerInWatts: pin,
      powerOutWatts: pout,
      powerDissipatedWatts: pdiss,
      dHdtWatts: dHdt,
      residualWatts: pin - pout - pdiss - dHdt,
      toleranceWatts: 0,
      passivityViolated: true,
      energyInjectedWatts: injected,
      refusalReason: `UNPHYSICAL_ENERGY_INJECTION: Negative dissipation detected (${pdiss} W); system acts as an unphysical active source.`,
    };
  }

  if (pin < -1e-9) {
    return {
      passed: false,
      powerInWatts: pin,
      powerOutWatts: pout,
      powerDissipatedWatts: pdiss,
      dHdtWatts: dHdt,
      residualWatts: pin - pout - pdiss - dHdt,
      toleranceWatts: 0,
      passivityViolated: true,
      energyInjectedWatts: -pin,
      refusalReason: `UNPHYSICAL_ENERGY_INJECTION: Negative input power detected (${pin} W).`,
    };
  }

  const residualWatts = pin - pout - pdiss - dHdt;
  const toleranceWatts =
    1e-7 * Math.max(1, Math.abs(pin), Math.abs(pout), Math.abs(pdiss), Math.abs(dHdt));
  const passed = Math.abs(residualWatts) <= toleranceWatts;

  return {
    passed,
    powerInWatts: pin,
    powerOutWatts: pout,
    powerDissipatedWatts: pdiss,
    dHdtWatts: dHdt,
    residualWatts,
    toleranceWatts,
    passivityViolated: false,
    ...(!passed
      ? {
          refusalReason: `Energy conservation violation: power residual (${residualWatts.toPrecision(4)} W) exceeds tolerance (${toleranceWatts.toPrecision(4)} W).`,
        }
      : {}),
  };
}

export interface TimestepConvergenceReport {
  readonly converged: boolean;
  readonly estimatedOrder: number;
  readonly timesteps: readonly number[];
  readonly values: readonly number[];
  readonly errors: readonly number[];
  readonly monotonic: boolean;
  readonly refusalReason?: string;
}

/**
 * Validates timestep convergence of an energetic ODE / physical integration step
 * across 3 nested timesteps (dt, dt/2, dt/4).
 * Enforces monotonic error reduction and estimates order of convergence p.
 */
export function verifyTimestepConvergence<T>(
  stepper: (dt: number) => T,
  extractor: (result: T) => number,
  baseDt = 0.01,
): TimestepConvergenceReport {
  const dt1 = baseDt;
  const dt2 = baseDt / 2;
  const dt3 = baseDt / 4;

  const y1 = extractor(stepper(dt1));
  const y2 = extractor(stepper(dt2));
  const y3 = extractor(stepper(dt3));

  if (![y1, y2, y3].every(Number.isFinite)) {
    return {
      converged: false,
      estimatedOrder: 0,
      timesteps: [dt1, dt2, dt3],
      values: [y1, y2, y3],
      errors: [],
      monotonic: false,
      refusalReason: "Non-finite output encountered during timestep convergence test.",
    };
  }

  const diff1 = y1 - y2;
  const diff2 = y2 - y3;

  const err1 = Math.abs(diff1);
  const err2 = Math.abs(diff2);

  const monotonic = err2 < err1;
  const ratio = Math.abs(diff1) / Math.max(1e-15, Math.abs(diff2));
  const estimatedOrder = ratio > 1 ? Math.log2(ratio) : 0;

  // For convergence, errors must diminish monotonically as timestep shrinks (ratio > 1)
  const converged = monotonic && ratio > 1.05 && err2 < 0.05 * Math.max(1, Math.abs(y3));

  return {
    converged,
    estimatedOrder: Number(estimatedOrder.toFixed(2)),
    timesteps: [dt1, dt2, dt3],
    values: [y1, y2, y3],
    errors: [err1, err2],
    monotonic,
    ...(!converged
      ? {
          refusalReason: !monotonic
            ? `Timestep error increased as dt shrank from ${dt2} to ${dt3} (err1=${err1}, err2=${err2}); solver fails monotonic convergence.`
            : `Discretization error reduction ratio (${ratio.toFixed(2)}) is insufficient for convergence.`,
        }
      : {}),
  };
}
