/**
 * A paper's result cards for the results face, projected from content/results/<paper>.yaml
 * (resultCards.ts). Each layer comes from the registry that owns it: the as-printed text from the
 * German face, the limitations from the argument passages (projectLimitation), the printed check
 * from the build-time join of scenario and owner (content/results/printedChecks.ts), the probe's
 * preset label from the laboratory's manifest. Nothing here is authored a second time, and a card
 * with a problem fails the page rather than rendering half-resolved.
 */
import { printedCheckFor, ResultCardsError } from "../../../content/results/printedChecks.ts";
import { loadResultCards, type ResultCardRecord } from "../../../content/results/resultCards.ts";
import { loadPaper } from "../../../content/server.ts";
import { loadPaperMargins } from "../../marginRecords.ts";
import { projectLimitation, projectPrintedCheck } from "./resultsProjection.ts";
import type { PrintedCheck, ResultCard } from "./types.ts";

/**
 * The printed check a card names, from the build-time join in src/content/results/printedChecks.ts
 * (the scenario and its owner), shaped for the card by projectPrintedCheck. This module never calls
 * the owner itself: nothing under src/reader/ imports physics.
 */
function projectedCheck(
  root: string,
  scenarioId: string,
): Readonly<{ checks: readonly PrintedCheck[]; comparison: string }> {
  const check = printedCheckFor(root, scenarioId);
  return {
    checks: check.rows.map((row) =>
      projectPrintedCheck({
        ...row,
        statedInputs: check.statedInputs,
        scenarioId: check.scenarioId,
        tolerance: 0,
        transcriptionPending: check.transcriptionPending,
      }),
    ),
    comparison: check.comparison,
  };
}

/** One card from its record. Exported for fromRecords.test.ts. */
export function toCard(
  root: string,
  record: ResultCardRecord,
  passages: ReadonlyMap<string, Readonly<{ limitations: readonly string[] }>>,
  /** Each misconception's first tempting claim, from the paper's ledger (loadPaperMargins). */
  claims?: ReadonlyMap<string, string>,
): ResultCard {
  const printedCheck = record.printedCheck ? projectedCheck(root, record.printedCheck) : null;
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
      ...(p.lastPage !== undefined ? { lastPage: p.lastPage } : {}),
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
    ...(claims
      ? {
          misconceptions: record.misconceptionIds.map((id) => ({
            id,
            claim: claims.get(id) ?? id,
            href: `/papers/${record.paper}/#misconception-${id}`,
          })),
        }
      : {}),
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
  // The ledger's own loader, which checks every record the explanation page will show.
  const claims = new Map(
    loadPaperMargins(paperId, root).misconceptions.map((m) => [m.id, m.temptingClaims[0] ?? m.id]),
  );
  return loaded.cards.map((record) => toCard(root, record, passages, claims));
}
