/**
 * THE CENSUS'S JUDGMENTS, as pure functions (am-rc1001-bridge-plan-pcjk.9).
 *
 * Separated from the CLI so every finding code can be observed without running a gate. A meta-gate
 * whose own detections have never been seen to fire is the same shape as the gates it judges: it
 * would report "0 findings" over a corpus it never examined and that would read as the cleanest
 * possible result.
 *
 * The CLI supplies the gate's real output and the routes; everything here is a decision about that
 * text. Nothing reads a count from a census record: the examined count and the minimum come from the
 * line the gate printed, because a census that copied a gate's own claim would inherit its silence.
 */

import type { GateStep } from "../quality-gates/registry.ts";
import { isVacuous, parsePopulationLines } from "./population.ts";
import type { CensusRecord } from "./records.ts";

export type Finding = Readonly<{ gate: string; code: string; message: string }>;

export type GateObservation = Readonly<{
  /** The combined stdout and stderr of the gate's run. */
  output: string;
  /** Its exit code. */
  exitCode: number;
  /** Which runners reach it, as reach.ts computed. Empty means nothing does. */
  routes: readonly string[];
}>;

/**
 * Judge one step. `record` is undefined when the step has no census record, which is itself a finding
 * rather than a reason to skip it.
 */
export function judgeGate(
  step: GateStep,
  record: CensusRecord | undefined,
  observed: GateObservation,
): Finding[] {
  const findings: Finding[] = [];
  const gate = step.id;
  if (observed.routes.length === 0) {
    findings.push({
      gate,
      code: "reached-by-nothing",
      message: `no runner reaches this step, so its verdict is never asked for. Owner ${step.owner}.`,
    });
  }
  if (record === undefined) {
    findings.push({
      gate,
      code: "no-census-record",
      message: `[${step.family}/${step.cadence}] has no census record, so nothing knows what population it examines. Owner ${step.owner}.`,
    });
    return findings;
  }
  const parsed = parsePopulationLines(observed.output);
  for (const bad of parsed.malformed) {
    findings.push({
      gate,
      code: "malformed-population-line",
      message: `printed ${JSON.stringify(bad.line)}, which ${bad.reason}.`,
    });
  }
  const line = parsed.reports.find((r) => r.gate === gate);
  if (line === undefined) {
    findings.push({
      gate,
      code: "no-population-printed",
      message: `exited ${observed.exitCode} without printing a census line for itself, so what it examined is unknown.`,
    });
    return findings;
  }
  if (line.noun !== record.noun) {
    findings.push({
      gate,
      code: "population-noun-changed",
      message: `prints ${JSON.stringify(line.noun)} where its record declares ${JSON.stringify(record.noun)}. A gate that changed which population it reads has changed what its verdict means.`,
    });
  }
  if (isVacuous(line)) {
    findings.push({
      gate,
      code: "population-below-minimum",
      message: `examined ${line.examined} ${line.noun} against its own declared minimum of ${line.minimum}.`,
    });
  }
  return findings;
}

/** Judge a plant's run. Separated for the same reason as judgeGate. */
export function judgePlant(input: {
  gate: string;
  plantId: string;
  file: string;
  /** Occurrences of the plant's anchor in the file before planting. */
  anchorOccurrences: number;
  digestBefore: string;
  digestAfterPlanting: string;
  digestAfterReverting: string;
  output: string;
  exitCode: number;
  expectFailureNaming: string;
}): Finding[] {
  const findings: Finding[] = [];
  const { gate, plantId } = input;
  if (input.anchorOccurrences !== 1) {
    findings.push({
      gate,
      code: "plant-anchor-missing",
      message: `plant ${plantId}: its anchor appears ${input.anchorOccurrences} time(s) in ${input.file}, so the plant cannot be applied exactly once. An anchor that moved makes a green run meaningless.`,
    });
    return findings;
  }
  if (input.digestAfterPlanting === input.digestBefore) {
    findings.push({
      gate,
      code: "plant-not-applied",
      message: `plant ${plantId}: the file's digest did not change, so nothing was planted and any verdict below is about the unplanted file.`,
    });
  }
  if (input.digestAfterReverting !== input.digestBefore) {
    findings.push({
      gate,
      code: "plant-not-reverted",
      message: `plant ${plantId}: ${input.file} is ${input.digestAfterReverting} after putting the copy back, not ${input.digestBefore}.`,
    });
  }
  if (input.exitCode === 0) {
    findings.push({
      gate,
      code: "plant-stayed-green",
      message: `plant ${plantId}: the gate exited 0 with the violation present, so it does not detect what it is registered to detect.`,
    });
    return findings;
  }
  if (!input.output.includes(input.expectFailureNaming)) {
    findings.push({
      gate,
      code: "plant-red-for-the-wrong-reason",
      message: `plant ${plantId}: the gate failed (exit ${input.exitCode}) but its output does not contain ${JSON.stringify(input.expectFailureNaming)}, so the red may belong to something other than the plant.`,
    });
  }
  return findings;
}

/** Every code this module can emit. The census's own test asserts each one has been seen to fire. */
export const FINDING_CODES = [
  "reached-by-nothing",
  "no-census-record",
  "malformed-population-line",
  "no-population-printed",
  "population-noun-changed",
  "population-below-minimum",
  "plant-anchor-missing",
  "plant-not-applied",
  "plant-not-reverted",
  "plant-stayed-green",
  "plant-red-for-the-wrong-reason",
] as const;
