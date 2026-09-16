import type { DataCell } from "../schemas/experiment.ts";

export type MeanResult =
  | Readonly<{
      status: "value";
      value: number;
      count: number;
    }>
  | Readonly<{
      status: "not-applicable";
      reason: string;
      boundedRowIndices: readonly number[];
    }>;

export type UnboundedSubsetMeanResult = Readonly<{
  status: "value" | "not-applicable";
  mean?: number | undefined;
  rowsUsedCount: number;
  rowsExcludedCount: number;
  exclusions: readonly Readonly<{ rowIndex: number; reason: string }>[];
}>;

export type LinearFitResult =
  | Readonly<{
      status: "value";
      slope: number;
      intercept: number;
      rowsUsedCount: number;
      rowsExcludedCount: number;
      exclusions: readonly Readonly<{ rowIndex: number; reason: string }>[];
    }>
  | Readonly<{
      status: "not-applicable";
      reason: string;
      boundedRowIndices: readonly number[];
    }>;

/**
 * Computes arithmetic mean over DataCell series.
 * Strictly refuses with not-applicable if any cell is a bound, naming the affected rows.
 */
export function computeSeriesMean(cells: readonly DataCell[]): MeanResult {
  const boundedIndices: number[] = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell && cell.kind === "bound") {
      boundedIndices.push(i);
    }
  }

  if (boundedIndices.length > 0) {
    return {
      status: "not-applicable",
      reason:
        "this series contains a value the apparatus could only bound, so its mean is not defined by these rows",
      boundedRowIndices: boundedIndices,
    };
  }

  let sum = 0;
  let count = 0;

  for (const cell of cells) {
    if (cell.kind === "number") {
      sum += cell.value;
      count++;
    }
  }

  if (count === 0) {
    return {
      status: "not-applicable",
      reason: "no numeric values present in series",
      boundedRowIndices: [],
    };
  }

  return {
    status: "value",
    value: sum / count,
    count,
  };
}

/**
 * Computes mean over the explicitly requested unbounded subset, documenting all exclusions.
 */
export function computeUnboundedSubsetMean(cells: readonly DataCell[]): UnboundedSubsetMeanResult {
  const exclusions: { rowIndex: number; reason: string }[] = [];
  let sum = 0;
  let count = 0;

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell) continue;

    if (cell.kind === "bound") {
      exclusions.push({
        rowIndex: i,
        reason: `apparatus bound (${cell.direction}: ${cell.value}) excluded from unbounded subset`,
      });
    } else if (cell.kind === "missing") {
      exclusions.push({
        rowIndex: i,
        reason: `missing cell (${cell.reason}) excluded`,
      });
    } else if (cell.kind === "number") {
      sum += cell.value;
      count++;
    }
  }

  if (count === 0) {
    return {
      status: "not-applicable",
      rowsUsedCount: 0,
      rowsExcludedCount: exclusions.length,
      exclusions,
    };
  }

  return {
    status: "value",
    mean: sum / count,
    rowsUsedCount: count,
    rowsExcludedCount: exclusions.length,
    exclusions,
  };
}

/**
 * Computes linear fit y = slope * x + intercept.
 * Strictly refuses with not-applicable if any evaluated cell is a bound.
 */
export function computeLinearFit(
  xCells: readonly DataCell[],
  yCells: readonly DataCell[],
): LinearFitResult {
  if (xCells.length !== yCells.length) {
    throw new Error(
      `xCells length (${xCells.length}) does not match yCells length (${yCells.length}).`,
    );
  }

  const boundedIndices: number[] = [];
  for (let i = 0; i < xCells.length; i++) {
    const xc = xCells[i];
    const yc = yCells[i];
    if ((xc && xc.kind === "bound") || (yc && yc.kind === "bound")) {
      boundedIndices.push(i);
    }
  }

  if (boundedIndices.length > 0) {
    return {
      status: "not-applicable",
      reason:
        "this series contains a value the apparatus could only bound, so its fit is not defined by these rows",
      boundedRowIndices: boundedIndices,
    };
  }

  const validPairs: { x: number; y: number }[] = [];
  const exclusions: { rowIndex: number; reason: string }[] = [];

  for (let i = 0; i < xCells.length; i++) {
    const xc = xCells[i];
    const yc = yCells[i];
    if (!xc || !yc) continue;

    if (xc.kind === "number" && yc.kind === "number") {
      validPairs.push({ x: xc.value, y: yc.value });
    } else {
      const reason =
        xc.kind === "missing"
          ? `x missing: ${xc.reason}`
          : yc.kind === "missing"
            ? `y missing: ${yc.reason}`
            : "non-numeric cell";
      exclusions.push({ rowIndex: i, reason });
    }
  }

  const n = validPairs.length;
  if (n < 2) {
    return {
      status: "not-applicable",
      reason: "insufficient numeric pairs for linear fit (minimum 2 required)",
      boundedRowIndices: [],
    };
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const { x, y } of validPairs) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-15) {
    return {
      status: "not-applicable",
      reason: "zero variance in x values",
      boundedRowIndices: [],
    };
  }

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return {
    status: "value",
    slope,
    intercept,
    rowsUsedCount: n,
    rowsExcludedCount: exclusions.length,
    exclusions,
  };
}
