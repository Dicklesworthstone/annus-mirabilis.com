import { withinTolerance } from "../../units/tolerance.ts";
import type { KernelIssue } from "./types.ts";
import { MAX_TRACE_ROWS } from "./types.ts";

export function checkTraceRowCount(
  instrumentId: string,
  functionName: string,
  rowCount: number,
): KernelIssue[] {
  if (rowCount <= MAX_TRACE_ROWS) return [];
  return [
    {
      code: "trace-rows-exceeded",
      instrumentId,
      functionName,
      message: `Instrument ${instrumentId}: trace for "${functionName}" declares ${rowCount} rows, exceeding the ${MAX_TRACE_ROWS}-row cap.`,
    },
  ];
}

export function checkTraceScenario(
  instrumentId: string,
  traceScenarioId: string | undefined,
  registered: readonly string[],
): KernelIssue[] {
  if (!traceScenarioId) return [];
  if (registered.includes(traceScenarioId)) return [];
  return [
    {
      code: "unregistered-trace-scenario",
      instrumentId,
      message: `Instrument ${instrumentId}: traceScenarioId "${traceScenarioId}" is not a registered scenario of this instrument.`,
    },
  ];
}

/** A trace row as the manifest writes it. */
export type TraceRowValue = Readonly<{
  label?: string | undefined;
  value?: unknown;
  unit?: string | undefined;
  quantityId?: string | undefined;
}>;

/** What the instrument's own worked example computed for a quantity. */
export type ComputedQuantity = Readonly<{ value: number; unit?: string | undefined }>;

/** The census this check examined, so a verdict over nothing cannot read as a clean one. */
export type TraceValueCensus = Readonly<{
  rows: number;
  /** Rows with a numeric value, a quantityId, a matching computed quantity and a matching unit. */
  comparable: number;
  agree: number;
  /** Rows skipped, by the reason they could not be compared. */
  noQuantityId: number;
  notNumeric: number;
  notComputed: number;
  unitMismatch: number;
}>;

/**
 * The relative tolerance a trace row is held to. Trace rows are written to about seven significant
 * figures by hand, so a row and the full-precision computation agree to roughly 1e-7; 1e-5 leaves
 * room for a row written to six figures and still refuses the error this check was built from, which
 * was off by a factor of a thousand.
 */
export const TRACE_VALUE_TOLERANCE = 1e-5;

/**
 * DOES A SHOWN TRACE ROW AGREE WITH WHAT THE INSTRUMENT COMPUTES? (am-1nnj, 2026-10-05.)
 *
 * A trace row is reader-facing arithmetic typed into a manifest, and until this existed nothing
 * recomputed one: the schema caps traceRows at 12 and says nothing about the numbers. BM-04 showed a
 * Stokes mobility of 1.057754e11 kg-1 s where its own generated worked example computes
 * 105891512.36985718 at the same defaults - a thousand times out, contradicting the row below it,
 * and present exactly once in the repository so no test pinned it.
 *
 * The comparison is against the instrument's OWN generated example rather than a fresh evaluation
 * here, because that file is what the lab displays beside the trace: a reader can see both numbers at
 * once, so they are the two that must agree. The caller supplies the computed quantities, which keeps
 * this function free of the filesystem and testable without one.
 *
 * A row is compared only when all four of its preconditions hold, and the census names each reason a
 * row was skipped, because a check that silently compares 7 of 23 rows and reports no error reads
 * exactly like one that checked them all.
 */
export function checkTraceValues(
  instrumentId: string,
  rows: readonly TraceRowValue[],
  computed: ReadonlyMap<string, ComputedQuantity>,
): Readonly<{ issues: KernelIssue[]; census: TraceValueCensus }> {
  const issues: KernelIssue[] = [];
  let comparable = 0;
  let agree = 0;
  let noQuantityId = 0;
  let notNumeric = 0;
  let notComputed = 0;
  let unitMismatch = 0;
  for (const row of rows) {
    if (typeof row.quantityId !== "string" || row.quantityId === "") {
      noQuantityId += 1;
      continue;
    }
    if (typeof row.value !== "number" || !Number.isFinite(row.value)) {
      notNumeric += 1;
      continue;
    }
    const found = computed.get(row.quantityId);
    if (!found) {
      notComputed += 1;
      continue;
    }
    // A unit mismatch is not treated as a disagreement, because a trace may legitimately show a
    // display unit. It is counted instead, so converting one into a comparison stays visible work.
    if (row.unit !== undefined && found.unit !== undefined && row.unit !== found.unit) {
      unitMismatch += 1;
      continue;
    }
    comparable += 1;
    // THE SHARED MODULE (am-f5mo, src/units/tolerance.ts). What stood here divided a difference by a
    // scale, which is withinTolerance written out by hand; the duplicate-comparison detector missed it
    // only because the divisor was a local rather than one of the differenced names, so the rule was
    // being broken in a form the gate could not see. Absolute at a true zero, relative elsewhere: a
    // relative tolerance alone is undefined there, which tolerance.ts reports as relative-only-at-zero.
    const spec =
      found.value === 0 ? { absolute: TRACE_VALUE_TOLERANCE } : { relative: TRACE_VALUE_TOLERANCE };
    const off = !withinTolerance(row.value, found.value, spec).ok;
    if (!off) {
      agree += 1;
      continue;
    }
    // Both numbers in exponential form, because the error this check was built from was a factor of a
    // thousand and "105775400000 against 105891512.36985718" asks the reader to count digits. The raw
    // computed value is given as well, since that is the one to paste into the manifest.
    issues.push({
      code: "trace-row-disagrees-with-example",
      instrumentId,
      message:
        `Instrument ${instrumentId}: trace row "${row.label ?? row.quantityId}" shows ` +
        `${row.value.toExponential()} for ${row.quantityId}, and this instrument's own worked ` +
        `example computes ${found.value.toExponential()} (${found.value}). One of the two numbers a ` +
        `reader sees is wrong.`,
    });
  }
  return {
    issues,
    census: {
      rows: rows.length,
      comparable,
      agree,
      noQuantityId,
      notNumeric,
      notComputed,
      unitMismatch,
    },
  };
}
