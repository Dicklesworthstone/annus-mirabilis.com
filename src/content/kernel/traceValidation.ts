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
