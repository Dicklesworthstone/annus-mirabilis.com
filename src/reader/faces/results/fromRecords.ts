/**
 * A paper's result cards for the results face, projected from content/results/<paper>.yaml
 * (resultCards.ts). Each layer comes from the registry that owns it: the as-printed text from the
 * German face, the limitations from the argument passages (projectLimitation), the printed check
 * from the scenario's owning function (projectPrintedCheck), the probe's preset label from the
 * laboratory's manifest. Nothing here is authored a second time, and a card with a problem fails
 * the page rather than rendering half-resolved.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../../../content/provenance/yaml.ts";
import { loadResultCards, type ResultCardRecord } from "../../../content/results/resultCards.ts";
import { loadPaper } from "../../../content/server.ts";
import {
  MASS_ENERGY_PRINTED_FACTOR_SCENARIO,
  printedMassConversion,
} from "../../../physics/reference/massEnergy.ts";
import { projectLimitation, projectPrintedCheck } from "./resultsProjection.ts";
import type { PrintedCheck, ResultCard } from "./types.ts";

export class ResultCardsError extends Error {
  readonly rule: string;
  constructor(rule: string, message: string) {
    super(message);
    this.name = "ResultCardsError";
    this.rule = rule;
  }
}

/** Eight significant figures, the precision at which the two conversions differ visibly. */
const grams = (g: number) => `${Number(g.toPrecision(8))} g`;

type Scenario = {
  inputs?: { emittedEnergy?: { value?: unknown; unit?: unknown } };
  expected?: { outputs?: { printedValue?: unknown }[] };
  transcription?: { status?: unknown };
};

/**
 * The printed check a card names, from its scenario and the scenario's owner. Only the scenarios a
 * card can name have a reproducer here; any other is refused, never shown without its owner.
 * Exported for fromRecords.test.ts, which reaches each refusal from a fixture root.
 */
export function printedCheckFor(
  root: string,
  scenarioId: string,
): Readonly<{ checks: readonly PrintedCheck[]; comparison: string }> {
  if (scenarioId !== MASS_ENERGY_PRINTED_FACTOR_SCENARIO)
    throw new ResultCardsError(
      "printed-check-unowned",
      `No owner reproduces scenario ${scenarioId} for a result card.`,
    );
  const scenario = parseYaml(
    readFileSync(join(root, "content", "scenarios", `${scenarioId}.yaml`), "utf8"),
  ) as Scenario;
  const energy = scenario.inputs?.emittedEnergy;
  const printedValue = scenario.expected?.outputs?.[0]?.printedValue;
  if (typeof energy?.value !== "number" || energy.unit !== "J" || typeof printedValue !== "string")
    throw new ResultCardsError(
      "printed-check-scenario-shape",
      `Scenario ${scenarioId} does not state an energy in joules and a printed value.`,
    );
  const r = printedMassConversion({ emittedEnergyJoules: energy.value });
  if (r.status !== "value")
    throw new ResultCardsError(
      "printed-check-refused",
      `${scenarioId}: ${r.reason ?? "the owner refused the input"}`,
    );
  const transcriptionPending = scenario.transcription?.status !== "verified";
  const statedInputs = {
    L: `${energy.value.toExponential()} J (${r.emittedEnergyErg.toExponential()} erg)`,
  };
  return {
    checks: [
      projectPrintedCheck({
        printedValue,
        statedInputs,
        constantSetId: r.printed.constantSetId,
        scenarioId,
        reproducedValue: r.printed.value,
        tolerance: 0,
        comparisonKind: "rounds-to",
        label: "as printed: L divided by the paper's 9·10²⁰",
        transcriptionPending,
        reproducedText: grams(r.printed.value),
      }),
      projectPrintedCheck({
        printedValue: "(not printed)",
        statedInputs,
        constantSetId: r.modern.constantSetId,
        scenarioId,
        reproducedValue: r.modern.value,
        tolerance: 0,
        comparisonKind: "modern-comparison",
        label: "modern comparison: L divided by the square of today's defined speed of light",
        transcriptionPending,
        reproducedText: grams(r.modern.value),
      }),
    ],
    comparison: r.comparison.wording,
  };
}

/** One card from its record. Exported for fromRecords.test.ts. */
export function toCard(
  root: string,
  record: ResultCardRecord,
  passages: ReadonlyMap<string, Readonly<{ limitations: readonly string[] }>>,
): ResultCard {
  const printedCheck = record.printedCheck ? printedCheckFor(root, record.printedCheck) : null;
  return {
    resultId: record.id,
    paper: record.paper,
    sectionAnchors: [record.section],
    title: record.title,
    printed: record.printed.map((p) => ({
      anchor: p.anchor,
      kind: p.kind,
      text: p.text,
      page: p.page,
      germanHref: `/papers/${record.paper}/view/german/#${p.anchor}`,
    })),
    qualifications: record.qualifications,
    printedEquationIds: record.equations,
    oneSentence: record.oneSentence,
    decoder: record.decoder,
    printedChecks: printedCheck?.checks ?? [],
    ...(printedCheck ? { printedCheckComparison: printedCheck.comparison } : {}),
    probes: record.probes.map((p) => ({
      kind: "instrument" as const,
      instrumentId: p.instrumentId,
      presetOrModeId: p.preset?.id ?? "",
      question: p.question,
      ...(p.preset ? { presetLabel: p.preset.label } : {}),
    })),
    misconceptionIds: record.misconceptionIds,
    // Margin records are cited by id once their registry exists; resultCards.ts refuses any
    // id until then, so there is nothing to project yet.
    usedBy: [],
    meanings: record.meanings,
    sources: record.printed.map((p) => ({ paper: record.paper, anchor: p.anchor })),
    selectionReason: record.selectionReason,
    limitations: record.arguments.map((id) => {
      const passage = passages.get(id);
      if (!passage)
        throw new ResultCardsError("result-passage-missing", `${record.id} names ${id}.`);
      return projectLimitation(id, passage);
    }),
    reception: [],
  };
}

/** The paper's result cards, or null when it has none. Throws on any unresolved card. */
export async function resultCardsFor(
  paperId: string,
  root: string = process.cwd(),
): Promise<readonly ResultCard[] | null> {
  const loaded = loadResultCards(root, paperId);
  if (!loaded) return null;
  if (loaded.problems.length > 0)
    throw new ResultCardsError(
      "result-cards-unresolved",
      `${paperId}'s result cards do not resolve:\n${loaded.problems.join("\n")}`,
    );
  const payload = await loadPaper(paperId);
  const passages = new Map(payload.arguments.map((a) => [a.id, a]));
  return loaded.cards.map((record) => toCard(root, record, passages));
}
