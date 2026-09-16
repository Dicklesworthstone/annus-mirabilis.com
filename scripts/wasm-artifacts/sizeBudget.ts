/**
 * WASM Size Budget and Drift Evaluator (am-fs-slim-artifact-0yh requirement 8).
 *
 * NOTE ON BUDGET VALUES:
 * The 500 KB (500,000 bytes) ceiling is a CHOSEN policy budget constraint,
 * NOT an experimental or physical measurement. It is an engineering and editorial
 * constraint chosen to guarantee fast worker download and instant compilation
 * across low-bandwidth (3G/LTE) mobile devices.
 *
 * The 10% drift threshold (driftRatio <= 0.10) ensures that incremental changes
 * to the WASM artifact do not unexpectedly bloat the payload relative to baseline
 * recorded bytes without explicit revision of the budget.
 */

export interface WasmSizeBudget {
  readonly maxBytes: number;
  readonly fullPackageBytes?: number | undefined;
  readonly recordedBytes: number;
  readonly jsGlueBytes?: number | undefined;
  readonly totalBundleBytes?: number | undefined;
}

export type SizeBudgetFailureCode = "absolute-budget-exceeded" | "drift-budget-exceeded";

export type SizeBudgetStatus = "ok" | SizeBudgetFailureCode;

export interface SizeBudgetEvaluation {
  readonly status: SizeBudgetStatus;
  readonly passed: boolean;
  readonly code?: SizeBudgetFailureCode | undefined;
  readonly totalBundleBytes: number;
  readonly maxBytes: number;
  readonly recordedBytes: number;
  readonly wasmBytes: number;
  readonly driftRatio: number;
  readonly message: string;
}

/** 500 KB policy ceiling: a design choice, NOT a physical measurement. */
export const CHOSEN_POLICY_MAX_BYTES = 500_000;

/** 10% maximum permissible drift relative to baseline recorded size. */
export const MAX_ALLOWED_DRIFT_RATIO = 0.1;

/**
 * Pure evaluator for WASM artifact size budget and drift constraints.
 *
 * Evaluates:
 * 1. Absolute budget ceiling: totalBundleBytes must not exceed maxBytes.
 *    If exceeded, returns status "absolute-budget-exceeded".
 * 2. Drift ceiling: recordedBytes must not drift more than 10% above baseline wasmBytes.
 *    If exceeded (while under maxBytes), returns status "drift-budget-exceeded".
 * 3. Otherwise returns status "ok" with passed: true.
 */
export function evaluateSizeBudget(
  sizeBudget: WasmSizeBudget,
  wasmBytes: number,
  options: {
    readonly maxAllowedDrift?: number;
  } = {},
): SizeBudgetEvaluation {
  const maxBytes = sizeBudget.maxBytes;
  const recordedBytes = sizeBudget.recordedBytes;
  const totalBundleBytes = sizeBudget.totalBundleBytes ?? recordedBytes;
  const maxDrift = options.maxAllowedDrift ?? MAX_ALLOWED_DRIFT_RATIO;

  // Compute drift relative to baseline wasmBytes
  const baseline = Math.max(1, wasmBytes);
  const drift = Math.max(0, recordedBytes - baseline);
  const driftRatio = drift / baseline;

  // 1. Check absolute budget cap first
  if (totalBundleBytes > maxBytes) {
    return {
      status: "absolute-budget-exceeded",
      passed: false,
      code: "absolute-budget-exceeded",
      totalBundleBytes,
      maxBytes,
      recordedBytes,
      wasmBytes,
      driftRatio,
      message: `Total bundle size (${totalBundleBytes} B) exceeds maximum policy budget (${maxBytes} B).`,
    };
  }

  // 2. Check 10% drift bound
  if (driftRatio > maxDrift) {
    return {
      status: "drift-budget-exceeded",
      passed: false,
      code: "drift-budget-exceeded",
      totalBundleBytes,
      maxBytes,
      recordedBytes,
      wasmBytes,
      driftRatio,
      message: `Recorded size (${recordedBytes} B) drifted ${(driftRatio * 100).toFixed(1)}% above baseline (${wasmBytes} B), exceeding the ${(maxDrift * 100).toFixed(0)}% drift threshold.`,
    };
  }

  return {
    status: "ok",
    passed: true,
    totalBundleBytes,
    maxBytes,
    recordedBytes,
    wasmBytes,
    driftRatio,
    message: `WASM bundle size (${totalBundleBytes} B) is strictly within budget (${maxBytes} B) and drift is ${(driftRatio * 100).toFixed(1)}%.`,
  };
}
