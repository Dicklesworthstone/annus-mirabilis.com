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
 * The section labeller that `equationLocator` and `marginNoteLocator` take, with the one-section
 * rule in it rather than beside it.
 *
 * `null` for a paper with one section, because mass-energy prints no numbered sections and its
 * whole argument is `s0`: "§0, display 1" would cite something that does not exist. That rule was
 * written twice -- once in `scripts/build-search-index.ts` and once nowhere, which is why
 * `/equations/<paper>/<display>/` titled itself with a raw content id while the search document
 * pointing AT that page carried "§3, display 7". One function now, so the page and the index cannot
 * disagree about what an equation is called.
 */
export function sectionLabeller(
  sections: readonly Readonly<{ id: string; title: string }>[],
): (section: string) => string | null {
  const labels = new Map(sections.map((s) => [s.id, sectionShortLabel(s.title)]));
  const hasSections = sections.length > 1;
  return (section) => (hasSections ? (labels.get(section) ?? null) : null);
}

/**
 * The paper's name without its editorial subtitle: "Brownian motion: from wandering to a measurable
 * law" gives "Brownian motion".
 *
 * The subtitle is why this is not simply `paper.title`. On `/equations/<paper>/<display>/` the full
 * title plus the equation's locator plus the root layout's " · Annus Mirabilis" runs past a hundred
 * characters, and a search result or a narrow tab truncates from the END -- which is where the
 * locator is, the only part that distinguishes one of 279 pages from the next.
 *
 * All four papers' titles are `<name>: <subtitle>`, which `equationPageTitle.test.ts` asserts rather
 * than assumes. A title with no ": " is returned whole, so the companion dissertation or any later
 * paper cannot be silently truncated to nothing, and a leading colon is not a boundary.
 */
export function shortPaperName(title: string): string {
  const cut = title.indexOf(": ");
  return cut > 0 ? title.slice(0, cut) : title;
}

/**
 * WHAT AN EXPLAINED EQUATION IS CALLED, for a reader: the locator a reader would cite for a printed
 * display ("§3, display 7"), and the name its own id carries for a discovery route or a laboratory
 * ("Light postulate", "SR-03: Minkowski interval").
 *
 * `undefined` for a derivation step, for which neither shape applies, and for a route or laboratory
 * id that neither shape recognises. The caller decides what to do with that: the search index counts
 * it in a census of untitled equations and skips the document rather than inventing a title, and the
 * explanation page falls back to the display id, which is the equation's address and is what the
 * catalogue shows beside every row.
 */
export function explainedEquationLabel(
  paper: string,
  display: string,
  kind: CatalogueKind,
  sectionLabelOf: (section: string) => string | null,
): string | undefined {
  return kind === "printed"
    ? equationLocator(display, sectionLabelOf)
    : explainedEquationTitle(paper, display, kind);
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
 * The camelCase paper markers the route-equation ids carry, longest first within each paper.
 *
 * These are a CLOSED set per paper and the paper is always known at the call site, which is what
 * makes stripping one safe. The margin notes could not do the equivalent -- their ids carry a
 * single letter that is sometimes a sequence marker and sometimes the subject, so
 * `note-bm-g-exner-measured-the-wrong-quantity` wants the g dropped and `note-bm-k-is-viscosity`
 * wants it kept, and no rule can tell. Here there is nothing to guess: `journey-bmMeanSquare` on
 * the Brownian paper begins with that paper's own marker, and a marker from another paper would
 * not match at all.
 */
const ROUTE_ID_PAPER_MARKERS: Readonly<Record<string, readonly string[]>> = {
  "light-quanta": ["lqi", "lq"],
  "brownian-motion": ["bmi", "bm"],
  "special-relativity": ["sri", "sr"],
  "mass-energy": ["mei", "me"],
};

/** A hyphenated or camelCase slug as a sentence: "light-postulate" and "meanSquare" both work. */
function slugAsTitle(slug: string): string {
  const spaced = slug
    .replace(/-+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  return spaced.length === 0 ? "" : spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * WHAT TITLES AN EXPLAINED EQUATION THAT IS NOT A PRINTED DISPLAY: the name its own id carries.
 *
 * The 200 printed displays are titled by `equationLocator`, because the anchor grammar locates
 * them. The other 44 explained equations had no title and were therefore absent from the search
 * index entirely -- 36 on a discovery route and 8 behind a laboratory, each with an authored
 * explanation on a page of its own that no query could reach (am-ahgo item 3).
 *
 * BOTH REASONS RECORDED FOR LEAVING THEM OUT TURN OUT TO BE ANSWERABLE, which is why this exists
 * rather than a content decision:
 *
 *   "a title humanised from the first reads 'Bm mean square'" -- true of the id alone, and the
 *   paper is known at the call site, so the paper's own marker comes off first and it reads
 *   "Mean square".
 *
 *   "two of the eight are sr-03's and would share it" -- true of `labName`, which is the
 *   laboratory's heading, and false of the ids: they are `lab-sr-03-contraction-ratio` and
 *   `lab-sr-03-minkowski-interval`. The slug is the discriminator the laboratory's name lacks.
 *
 * Measured over all 44 before it was written: every one derives, and no two share a title within
 * a paper. The laboratory qualifier is load-bearing rather than decorative -- without it
 * `journey-lqQuantumSize` and `lab-lq-06-quantum-size` would both read "Quantum size".
 *
 * `undefined` for an id neither shape recognises, so the caller omits the document rather than
 * titling it with something invented. That is the opposite choice from `equationLocator`, which
 * falls back to the id itself, and deliberately: a catalogue ROW reading "eq-whatever" is visible
 * and gets fixed, while a search RESULT titled "journey-whatever" is noise a reader cannot act on.
 */
export function explainedEquationTitle(
  paper: string,
  display: string,
  kind: CatalogueKind,
): string | undefined {
  if (kind === "route") {
    const investigate = new RegExp(`^journey-discover-${paper}-investigate-(.+)$`).exec(display);
    if (investigate?.[1]) return slugAsTitle(investigate[1]) || undefined;
    const bare = /^journey-(.+)$/.exec(display);
    if (!bare?.[1]) return undefined;
    let rest = bare[1];
    for (const marker of ROUTE_ID_PAPER_MARKERS[paper] ?? []) {
      if (rest.startsWith(marker) && rest.length > marker.length) {
        rest = rest.slice(marker.length);
        break;
      }
    }
    return slugAsTitle(rest) || undefined;
  }
  if (kind === "instrument") {
    const lab = /^lab-([a-z]{2}-\d{2})-(.+)$/.exec(display);
    if (!lab?.[1] || !lab[2]) return undefined;
    const title = slugAsTitle(lab[2]);
    return title.length === 0 ? undefined : `${lab[1].toUpperCase()}: ${title}`;
  }
  return undefined;
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
