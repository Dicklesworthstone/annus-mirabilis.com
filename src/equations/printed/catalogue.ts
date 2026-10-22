/**
 * THE EDITION'S EQUATIONS, AS A CATALOGUE A READER CAN BROWSE.
 *
 * WHY THIS EXISTS. Every explained equation has had a page at `/equations/<paper>/<id>/` since
 * dispatch 292, 279 of them, and nothing listed them. Measured 2026-10-21 over the built site:
 * `/equations/` was the largest dead end in the edition, with 279 routes beneath it and no index,
 * so a reader who trimmed one of those URLs back reached a 404, and a reader who wanted to find the
 * equation that states a particular claim had no way in at all. The class is documented in the tree
 * -- `src/app/lab/page.tsx` exists for exactly it -- and `src/testing/trimmedUrlParents.test.ts`
 * measured the rest.
 *
 * NOTHING HERE IS AUTHORED. Each row's words are the explanation's own `inWords`, the phrase that
 * says what the equation claims in ordinary language, written for the explainer and already shipped
 * on 195 pages. Each row's group is the explanation's own `source.label`, the authored text on its
 * way back: "Read it in the paper", "Read the step it belongs to", "Go back to the route", "Open
 * the laboratory". The four of them partition the 279 exactly, measured 2026-10-22 (200 / 35 / 36 /
 * 8), and a label this module has not met lands in `elsewhere` so that the page shows it rather
 * than dropping it. That is the one thing a catalogue must not do quietly.
 *
 * WHY THE FORMULA IS NOT DRAWN HERE, which is the decision a reader would question first. The
 * drawn KaTeX of one paper's equations is 1,056 kB raw for special relativity's 122 (50 kB
 * gzipped), against 27 kB raw and 5.2 kB gzipped for the same paper's sentences. A catalogue is for
 * finding an equation, the page one click away is where it is drawn with its explanation and its
 * terms, and a megabyte of markup to scan a list is the wrong trade on the modest device AGENTS.md
 * asks this edition to work on. The measurement is recorded so the choice can be reversed with one.
 */
import { ROUTE_SLUGS } from "../../content/ids.ts";
import { everyExplanationRoute, fullExplanation } from "./fullExplanations.ts";
import { printedDisplayOrder } from "./printedDisplays.ts";

export type CatalogueKind = "printed" | "step" | "route" | "instrument" | "elsewhere";

export type CatalogueRow = Readonly<{
  /** The explanation's own id, which is also the last segment of its address. */
  display: string;
  /** Its page. */
  href: string;
  /** The equation in ordinary language, the explanation's own `inWords`. */
  words: string;
  /**
   * The authored spoken form, as a reading face gives a printed display its accessible name. Empty
   * for the 8 of 279 explanations that carry no drawn equation. The catalogue page does not use it;
   * the search index carries it as a term, never as a title (explainedEquationDocuments says why).
   */
  spoken: string;
  kind: CatalogueKind;
  /** The authored label on the explanation's way back, kept so `elsewhere` can name itself. */
  sourceLabel: string;
}>;

/**
 * The authored label on each explanation's own way back, which is what classifies its row. Keyed by
 * the label rather than by the id's shape because the label is a record and the shape is a
 * convention: `eq-model-...`, `journey-...` and `lab-...` all happen to be legible today, and a
 * fifth kind of explanation would arrive with its own label and no new prefix rule.
 */
const KIND_BY_SOURCE_LABEL: Readonly<Record<string, CatalogueKind>> = {
  "Read it in the paper": "printed",
  "Read the step it belongs to": "step",
  "Go back to the route": "route",
  "Open the laboratory": "instrument",
};

function kindOf(sourceLabel: string): CatalogueKind {
  return KIND_BY_SOURCE_LABEL[sourceLabel] ?? "elsewhere";
}

/** The explained equations of one paper, printed ones in printed order. */
export function equationCatalogue(paper: string): readonly CatalogueRow[] {
  const printedOrder = new Map(printedDisplayOrder(paper).map((display, i) => [display, i]));
  const rows: CatalogueRow[] = [];
  for (const route of everyExplanationRoute()) {
    if (route.paper !== paper) continue;
    const explanation = fullExplanation(route.paper, route.display);
    if (!explanation) continue;
    const sourceLabel = explanation.source?.label ?? "";
    rows.push({
      display: route.display,
      href: `/equations/${paper}/${route.display}/`,
      words: explanation.inWords.map((phrase) => phrase.text).join(""),
      spoken: explanation.printed?.spoken ?? "",
      kind: kindOf(sourceLabel),
      sourceLabel,
    });
  }
  /*
   * Grouped in the order the page draws the groups, then printed displays in printed order and
   * everything else by id, which is arbitrary but stable. A derivation step's records carry no
   * order (its way back is an argument anchor, not a position) and neither does a route's or a
   * laboratory's, so a sequence for those would be invented.
   */
  const group = (row: CatalogueRow): number =>
    CATALOGUE_GROUPS.findIndex((g) => g.kind === row.kind);
  return rows.sort((a, b) => {
    if (a.kind !== b.kind) return group(a) - group(b);
    if (a.kind !== "printed") return a.display.localeCompare(b.display);
    const fallback = Number.MAX_SAFE_INTEGER;
    return (printedOrder.get(a.display) ?? fallback) - (printedOrder.get(b.display) ?? fallback);
  });
}

export type CataloguePaper = Readonly<{
  paper: string;
  total: number;
  byKind: Readonly<Record<CatalogueKind, number>>;
}>;

/**
 * Every paper that has explained equations, in the order the journal received the papers
 * (`ROUTE_SLUGS`), with its counts. A paper with none is left out rather than shown empty: the
 * companion dissertation has no explanations, and a row reading "0 equations" would be a claim
 * about the edition that this function cannot support.
 */
export function cataloguePapers(): readonly CataloguePaper[] {
  const papers: CataloguePaper[] = [];
  for (const paper of ROUTE_SLUGS) {
    const rows = equationCatalogue(paper);
    if (rows.length === 0) continue;
    const byKind: Record<CatalogueKind, number> = {
      printed: 0,
      step: 0,
      route: 0,
      instrument: 0,
      elsewhere: 0,
    };
    for (const row of rows) byKind[row.kind] += 1;
    papers.push({ paper, total: rows.length, byKind });
  }
  return papers;
}

/** The groups a catalogue page draws, in this order, each with the clause that says what it holds. */
export const CATALOGUE_GROUPS: readonly Readonly<{
  kind: CatalogueKind;
  heading: string;
  clause: string;
}>[] = [
  {
    kind: "printed",
    heading: "As printed in the paper",
    clause:
      "Every display equation the paper sets on its own line, in the order it prints them. The explanation opens beside the equation on the reading face; this is the same explanation on a page of its own.",
  },
  {
    kind: "step",
    heading: "A step in a derivation",
    clause:
      "Equations the explanation writes out to get from one printed line to the next. They are the edition's, not Einstein's, and each says which argument it belongs to.",
  },
  {
    kind: "route",
    heading: "On a discovery route",
    clause:
      "Equations a reader meets while rebuilding the argument, on a route the edition labels as one you could take rather than as Einstein's own path.",
  },
  {
    kind: "instrument",
    heading: "What an instrument computes",
    clause: "The formula behind a laboratory's numbers, explained away from its controls.",
  },
  {
    kind: "elsewhere",
    heading: "Elsewhere in the edition",
    clause:
      "Explained equations whose way back this catalogue has not met. They are listed so that a new kind of explanation is visible here rather than missing.",
  },
];

/**
 * The short label a paper record gives a section: "§1" from "§1 · operational simultaneity",
 * "Introduction" from "Introduction · a heuristic viewpoint". The interpunct separates the
 * citation from the editorial gloss in every one of the 28 section titles, so the half before it
 * is the part a reader would write down.
 */
export function sectionShortLabel(title: string): string {
  const [citation] = title.split("·");
  return (citation ?? title).trim();
}

/**
 * WHERE A PRINTED DISPLAY SITS, as a reader would cite it: "§3, display 7", "§3, equation (1)",
 * "Equation (2)". Derived from the anchor grammar in docs/CONTENT_IDS.md and from the paper's own
 * section titles, never authored here.
 *
 * `sectionLabelOf` returns the section's short label, or null when the paper has no sections to
 * cite: mass-energy prints no numbered sections and its whole argument is `s0`, so "§0, display 1"
 * would be a citation to something that does not exist, and its displays are cited by number
 * alone. The caller owns that decision because the caller holds the paper record.
 *
 * An id the grammar does not recognise falls back to ITSELF rather than to null. A null would have
 * to be dropped or shown blank, and a dropped row is a page a reader cannot find, which is the
 * defect this whole catalogue exists to end; a row reading "eq-whatever" is visible and sorts out
 * the next morning. `catalogue.test.ts` asserts that all 200 printed displays are recognised
 * today, so the fallback is a safety net rather than a resting place.
 */
export function equationLocator(
  display: string,
  sectionLabelOf: (section: string) => string | null,
): string {
  const unnumbered = /^eq-(s\d+)-d(\d+)$/.exec(display);
  if (unnumbered?.[1] && unnumbered[2]) {
    const section = sectionLabelOf(unnumbered[1]);
    return section ? `${section}, display ${unnumbered[2]}` : `Display ${unnumbered[2]}`;
  }
  const numbered = /^eq-(s\d+)-(\d+)$/.exec(display);
  if (numbered?.[1] && numbered[2]) {
    const section = sectionLabelOf(numbered[1]);
    return section ? `${section}, equation (${numbered[2]})` : `Equation (${numbered[2]})`;
  }
  const bare = /^eq-([0-9]+|[A-Z])$/.exec(display);
  if (bare?.[1]) return `Equation (${bare[1]})`;
  return display;
}

/**
 * WHERE A MARGIN NOTE ATTACHES, as a reader would cite it: "§3, paragraph 2", "§1, footnote 1",
 * "The closing acknowledgment". Reads the sentence-id grammar of docs/CONTENT_IDS.md off the
 * note's own `affectedIds[0]`, with the section's short label supplied by the caller exactly as
 * `equationLocator` takes it.
 *
 * `null` for a note that names no affected id, which is one of the 28: the caller titles that one
 * as a note on the paper as a whole rather than guessing a position for it.
 */
export function marginNoteLocator(
  affectedId: string | undefined,
  sectionLabelOf: (section: string) => string | null,
): string | null {
  if (!affectedId) return null;
  if (affectedId === "closing-ack") return "The closing acknowledgment";
  if (affectedId === "closing-dateline") return "The date-line";
  const paragraph = /^(s\d+)-p(\d+)(?:-s\d+[a-z]?)?$/.exec(affectedId);
  if (paragraph?.[1] && paragraph[2]) {
    const section = sectionLabelOf(paragraph[1]);
    return section ? `${section}, paragraph ${paragraph[2]}` : `Paragraph ${paragraph[2]}`;
  }
  const footnote = /^(s\d+)-fn(\d+)$/.exec(affectedId);
  if (footnote?.[1] && footnote[2]) {
    const section = sectionLabelOf(footnote[1]);
    return section ? `${section}, footnote ${footnote[2]}` : `Footnote ${footnote[2]}`;
  }
  const section = /^s(\d+)$/.exec(affectedId) ? sectionLabelOf(affectedId) : null;
  return section;
}
