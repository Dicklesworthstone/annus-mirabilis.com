/**
 * A paper's result cards for the results face, projected from content/results/<paper>.yaml
 * (resultCards.ts). Each layer comes from the registry that owns it: the as-printed text from the
 * German face, the limitations from the argument passages (projectLimitation), the printed check
 * from the build-time join of scenario and owner (content/results/printedChecks.ts), the probe's
 * preset label from the laboratory's manifest. Nothing here is authored a second time, and a card
 * with a problem fails the page rather than rendering half-resolved.
 */
import { type Connection, loadConnections } from "../../../content/connections/connections.ts";
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
  /** The connections among the papers, for the card's later uses (dispatch 253). */
  connections?: readonly Connection[],
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
      // A quotation of one sentence lands on that sentence, which every German face anchors since
      // dispatch 255; a longer one, on its paragraph.
      germanHref: `/papers/${record.paper}/view/german/#${
        p.sentenceIds?.length === 1 ? p.sentenceIds[0] : p.anchor
      }`,
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
    // A later use, from the connection that records it (resultCards.ts has checked that its use
    // starts at this card): its words, and a link to the card in the later paper that uses it.
    // Margin records are cited by id once their registry exists; none can be listed until then.
    // Without the connections record there is no recorded use to project.
    usedBy: (connections ? record.usedLater : []).flatMap((id) => {
      const use = connections?.find((k) => k.id === id)?.uses;
      return use
        ? [
            {
              text: use.text,
              href: `/papers/${use.to.paper}/view/results/#result-${use.to.result}`,
            },
          ]
        : [];
    }),
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
  const connections = loadConnections(root);
  return loaded.cards.map((record) => toCard(root, record, passages, claims, connections));
}
