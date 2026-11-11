/** Quoted examples execute the registered owner; rounding never substitutes for numeric comparison. */
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { CORE_NUMERIC_OWNERS } from "../../testing/scenario-registry/coreNumericOwners.ts";
import { validateScenario } from "../schemas/experiment.ts";
import { strictParse } from "../schemas/strictParse.ts";
import { formatQuantityValue } from "../../units/format.ts";
import { compareBitwise, withinTolerance } from "../../units/tolerance.ts";
import { type EssayQuotedValue, essayFailure } from "../schemas/essay.ts";
import type { Scenario } from "../schemas/experiment.ts";

export type CheckedEssayValue = Readonly<{
  id: string;
  text: string;
  value: number;
  scenarioId: string;
  outputId: string;
  constantSetId: string;
}>;

/** Exposed for a negative test: an owner mismatch must fail even when both numbers round alike. */
export function checkScenarioOutput(
  scenario: Scenario,
  outputs: Readonly<Record<string, number>>,
  outputId: string,
  path: string,
): number {
  const expected = scenario.expected.outputs?.find((item) => item.outputId === outputId);
  const actual = outputs[outputId];
  if (!expected || typeof expected.value !== "number" || typeof actual !== "number" ||
      !Number.isFinite(actual))
    return essayFailure(path, scenario.id + "/" + outputId + ": no finite golden output.");
  const passes = expected.comparisonKind === "bitwise"
    ? compareBitwise(actual, expected.value).ok
    : expected.comparisonKind === "tolerance" && expected.tolerance !== undefined
      ? withinTolerance(actual, expected.value, {
          ...(expected.tolerance.absolute === undefined ? {} : { absolute: expected.tolerance.absolute }),
          ...(expected.tolerance.relative === undefined ? {} : { relative: expected.tolerance.relative }),
          ...(expected.tolerance.relativeTo === undefined ? {} : { relativeTo: expected.tolerance.relativeTo }),
        }).ok
      : false;
  if (!passes) return essayFailure(path,
    scenario.id + "/" + outputId + ": owner result disagrees with the golden scenario before formatting.");
  return actual;
}

export function checkEssayValueFormatting(quote: EssayQuotedValue, value: number,
  path: string): string {
  if (!Number.isFinite(value) || !Number.isFinite(value * quote.scale))
    return essayFailure(path, quote.id + ": the quoted value is not finite at its display scale.");
  const text = formatQuantityValue(value * quote.scale, quote.unit, {
    sigFigs: quote.significantFigures, notation: quote.notation,
  });
  if (text !== quote.displayedAs)
    return essayFailure(path,
      quote.id + ": displayedAs differs from the shared formatter (" + text + ").");
  return text;
}

export function resolveEssayValues(root: string, quotes: readonly EssayQuotedValue[],
  path: string): readonly CheckedEssayValue[] {
  const cache = new Map<string, Readonly<{ scenario: Scenario; outputs: Record<string,
    number> }>>();
  function execution(scenarioId: string) {
    const cached = cache.get(scenarioId);
    if (cached) return cached;
    const scenarioPath = join(root, "content/scenarios", scenarioId + ".yaml");
    const scenario = validateScenario(strictParse(readFileSync(scenarioPath, "utf8"), "yaml"),
      scenarioPath);
    if (scenario.id !== scenarioId || scenario.kind !== "modern-golden" ||
        scenario.constantSetId !== "modern-si-2019")
      return essayFailure(path,
        scenarioId + ": essay examples must identify a modern golden scenario using the 2019 SI constants.");
    const owner = CORE_NUMERIC_OWNERS.find((entry) => entry.id === scenario.owner);
    if (!owner) return essayFailure(path,
      scenarioId + ": no content-phase scenario adapter for " + scenario.owner);
    const outputs = owner.fn({
      inputs: Object.fromEntries(Object.entries(scenario.inputs).map(([key, input]) => [key,
        input.value])),
      constantSetId: scenario.constantSetId,
    });
    if ("refused" in outputs)
      return essayFailure(path, scenarioId + ": the registered owner refused the example.");
    // Inputs are quoted only after the same scenario's outputs pass their declared checks.
    for (const expected of scenario.expected.outputs ?? [])
      checkScenarioOutput(scenario, outputs, expected.outputId, path);
    if (!scenario.expected.outputs?.length)
      return essayFailure(path, scenarioId + ": no golden output checks.");
    const result = { scenario, outputs };
    cache.set(scenarioId, result);
    return result;
  }
  return quotes.map((quote) => {
    const { scenario, outputs } = execution(quote.scenarioId);
    let value = quote.source === "input"
      ? scenario.inputs[quote.outputId]?.value
      : checkScenarioOutput(scenario, outputs, quote.outputId, path);
    if (typeof value !== "number" || !Number.isFinite(value))
      return essayFailure(path, quote.id + ": the scenario input does not exist.");
    if (quote.ratioTo) {
      const denominator = execution(quote.ratioTo.scenarioId);
      if (denominator.scenario.constantSetId !== scenario.constantSetId)
        return essayFailure(path, quote.id + ": a ratio cannot mix constant sets.");
      const divisor = checkScenarioOutput(denominator.scenario, denominator.outputs,
        quote.ratioTo.outputId, path);
      if (divisor === 0) return essayFailure(path, quote.id + ": ratio denominator is zero.");
      value /= divisor;
    }
    return {
      id: quote.id, text: checkEssayValueFormatting(quote, value, path), value,
      scenarioId: quote.scenarioId, outputId: quote.outputId, constantSetId: scenario.constantSetId,
    };
  });
}
