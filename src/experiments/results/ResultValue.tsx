import type React from "react";
import { ResultStatusNote } from "./ResultStatusNote.tsx";
import type { ScientificResult } from "./types.ts";

export interface ResultValueProps {
  readonly result: ScientificResult;
  readonly snapshotVersion?: number | undefined;
  readonly className?: string | undefined;
}

function formatFinite(value: number): string {
  if (!Number.isFinite(value)) {
    throw new TypeError("ResultValue refuses nonfinite numbers; use a typed status instead.");
  }
  return String(value);
}

/**
 * Presentational display of a typed result. Non-value statuses render
 * ResultStatusNote. Numeric formatting of precision and intervals belongs to
 * am-ver-precision-display-5e5; this component never computes physics and never
 * substitutes NaN, Infinity, or zero for a typed status.
 */
export function ResultValue({
  result,
  snapshotVersion,
  className = "result-value",
}: ResultValueProps): React.JSX.Element {
  if (result.status !== "value") {
    return <ResultStatusNote result={result} snapshotVersion={snapshotVersion} />;
  }

  const body =
    typeof result.value === "number"
      ? formatFinite(result.value)
      : Array.from(result.value, formatFinite).join(", ");

  return (
    <span
      className={className}
      data-snapshot-version={snapshotVersion !== undefined ? snapshotVersion : undefined}
    >
      {body}
      {result.unit.length > 0 ? ` ${result.unit}` : ""}
    </span>
  );
}
