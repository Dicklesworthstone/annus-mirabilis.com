import { parseInstrumentId } from "../content/ids.ts";
import { inlineMathPlain } from "../content/inlineMath.ts";
import type { Inline } from "../content/schemas/inlines.ts";
import { labName } from "../reader/actions/labNames.ts";
import {
  normalizeSearchText,
  type SearchAlias,
  type SearchDocument,
  validateSearchDocument,
} from "./core.ts";

export type SearchProfile = "scaffold" | "preview" | "launch";
export function searchProfile(value: string | undefined): SearchProfile {
  if (value === undefined) return "scaffold";
  if (value === "scaffold" || value === "preview" || value === "launch") return value;
  throw new TypeError("Unknown AM_RELEASE_PROFILE for search.");
}

/** These are the two payload kinds emitted by content/compiler/emitter.ts today. */
export const SEARCH_COVERAGE = Object.freeze({
  paper: "paper, section, argument, equation and argument synopsis",
  foundation: "foundation explanation and worked example",
});
export function assertSearchCoverage(kinds: readonly string[]): void {
  assertClassified(SEARCH_COVERAGE, kinds, "compiled search payload kind");
}
/** The one refusal for both classification tables: a value with no builder and no exclusion. */
function assertClassified(table: object, values: readonly string[], what: string): void {
  const missing = values.find((value) => !Object.hasOwn(table, value));
  if (missing !== undefined) throw new TypeError(`Unclassified ${what}: ${missing}. ${ADD}`);
}

type Block = Readonly<
  | { kind: "paragraph"; text: string }
  | { kind: "formula"; latex: string; spoken: string }
  | { kind: "steps"; items: readonly string[] }
  | { kind: "foundation"; id: string; returnCaption: string }
>;
/** Structural input projections; the content compiler remains the schema owner. */
export type SearchGuidedTour = Readonly<{
  id: string;
  title: string;
  paper: string;
  introduction: string;
  /** Every stop or step by name, so a search for one reaches the path that contains it. */
  stopTitles: readonly string[];
}>;
export type SearchDiscoveryRoute = Readonly<{
  slug: string;
  name: string;
  germanTitle: string;
  blurb: string;
  steps: readonly string[];
}>;
export type SearchWalkthrough = Readonly<{
  id: string;
  title: string;
  description: string;
  /** Built by tapePath, because one id contains a dot and the host drops the trailing slash. */
  route: string;
  paper: string;
  paperTitle: string;
  instrumentId: string;
  sectionTitles: readonly string[];
}>;
export type SearchFoundationProjection = Readonly<{
  id: string;
  title: string;
  question: string;
  summary: string;
  review: string;
  explanation: readonly Block[];
  example: readonly Block[];
  stoppingPoint: string;
}>;
export type SearchPaperProjection = Readonly<{
  schemaVersion: number;
  paper: Readonly<{
    id: string;
    title: string;
    germanTitle: string;
    description: string;
    status: string;
    sections: readonly Readonly<{ id: string; title: string; arguments: readonly string[] }>[];
  }>;
  arguments: readonly Readonly<{
    id: string;
    section: string;
    title: string;
    question: string;
    recap: string;
    review: string;
    premises: readonly string[];
    limitations: readonly string[];
    experiments: readonly string[];
    readings: Readonly<Record<"overview" | "full" | "steps" | "margin", readonly Block[]>>;
  }>[];
  equations: readonly Readonly<{
    id: string;
    title: string;
    argument: string;
    spoken: string;
    explanation: string;
    review: string;
    notation: string;
    tree: unknown;
    assumptions: readonly string[];
    notes: readonly Readonly<{ title: string; explanation: string }>[];
  }>[];
}>;
export type SearchInstrumentProjection = Readonly<{
  id: string;
  status: string;
  title: string;
  question?: string;
}>;

function blocksText(blocks: readonly Block[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "paragraph":
          return inlineMathPlain(block.text);
        case "formula":
          return `${block.spoken} ${block.latex}`;
        case "steps":
          return block.items.map(inlineMathPlain).join(" ");
        case "foundation":
          return block.returnCaption;
        default:
          throw new TypeError("Unclassified compiled block in search.");
      }
    })
    .join(" ");
}
/**
 * The paper an instrument is filed under in search, or null when nothing declares it.
 *
 * This read the two-letter prefix and nothing else, so the moment `light-thread`
 * registered, prepare:content threw "Registered instrument needs a search paper
 * mapping: light-thread" and NOTHING could build - out/ could not be regenerated at
 * all, so every measurement of the built site was measuring a pre-outage artefact.
 *
 * The throw is right and stays: an instrument with no declared paper must fail loudly
 * rather than be filed under a plausible wrong one. What was wrong is that this held a
 * second, poorer copy of a taxonomy src/content/ids.ts already owns. Core ids match
 * CORE_INSTRUMENT_PATTERN and carry their paper in the prefix; `shelf` and `discovery`
 * instruments are declared in NON_CORE_INSTRUMENT_IDS and belong to no single paper, so
 * they file under "cross-paper" - the value this module already emits for foundations
 * that span papers. Joining to the parser means a newly declared instrument cannot take
 * the build down again: `avogadro-lab` was one registration away from the same outage.
 */
/**
 * The paper a registered instrument belongs to, or null when its id does not map.
 *
 * Exported for am-14js. documentsFromCompiled THROWS when this returns null, and on 2026-09-20 a
 * newly registered instrument whose id does not parse - light-thread - took typecheck, the bun test
 * lane and the production build down for an hour with a stack trace. The invariant is cheap to
 * assert directly; it was only expensive because the sole thing asserting it was a generator 5 of
 * 34 deep in the prepare chain.
 */
export function familyPaper(id: string): string | null {
  const parsed = parseInstrumentId(id);
  if (!parsed.ok) return null;
  if (parsed.kind !== "core") return "cross-paper";
  const papers: Readonly<Record<string, string>> = {
    bm: "brownian-motion",
    lq: "light-quanta",
    sr: "special-relativity",
    me: "mass-energy",
  };
  const prefix = id.split("-")[0];
  return prefix ? (papers[prefix] ?? null) : null;
}

/**
 * Reader schema v1 admits only drafts, explicitly labeled as explanatory previews.
 * They are searchable in scaffold builds only. Preview/launch must not silently publish
 * them through search while the reviewed publication projection is still unavailable.
 */
export function documentsFromCompiled(
  papers: readonly SearchPaperProjection[],
  foundations: readonly SearchFoundationProjection[],
  instruments: readonly SearchInstrumentProjection[],
  profile: SearchProfile,
  equationTerms: Readonly<Record<string, string>> = {},
): readonly SearchDocument[] {
  searchProfile(profile);
  for (const payload of papers) {
    if (payload.schemaVersion !== 1 || payload.paper.status !== "explanation-preview")
      throw new TypeError("A changed paper publication schema needs an explicit search adapter.");
  }
  if (profile !== "scaffold") return [];
  const documents: SearchDocument[] = [];
  const add = (document: SearchDocument) => documents.push(validateSearchDocument(document));
  const termsByInstrument = new Map<string, Set<string>>();
  for (const payload of papers) {
    const { paper } = payload;
    const route = `/papers/${paper.id}/`;
    const base = {
      paper: paper.id,
      section: "",
      lang: "en",
      route,
      anchor: "",
      face: "reading",
      scopeLabel: `${paper.title} · explanatory preview`,
    };
    add({
      ...base,
      id: `paper:${paper.id}`,
      type: "paper",
      title: paper.title,
      text: paper.description,
      terms: [paper.germanTitle, paper.id],
    });
    for (const section of paper.sections) {
      add({
        ...base,
        id: `section:${paper.id}:${section.id}`,
        type: "section",
        section: section.id,
        anchor: section.id,
        title: section.title,
        text: section.title,
        terms: [section.id],
      });
    }
    const argumentsById = new Map(payload.arguments.map((argument) => [argument.id, argument]));
    for (const argument of payload.arguments) {
      const section = paper.sections.find(
        (s) => s.id === argument.section && s.arguments.includes(argument.id),
      );
      if (!section) throw new TypeError(`Search argument has no rendered section: ${argument.id}.`);
      const readings = ["overview", "full", "steps"] as const;
      add({
        ...base,
        id: `argument:${argument.id}`,
        type: "argument",
        anchor: argument.id,
        section: section.id,
        title: argument.title,
        terms: [argument.id],
        text: [
          argument.question,
          ...readings.map((r) => blocksText(argument.readings[r])),
          ...argument.premises,
          ...argument.limitations,
        ].join(" "),
      });
      // This is a synopsis, not a source-aligned historical result card.
      add({
        ...base,
        id: `result:${argument.id}`,
        type: "result",
        anchor: argument.id,
        section: section.id,
        face: "results",
        title: argument.title,
        scopeLabel: `${paper.title} · authored argument synopsis, not a printed result`,
        text: argument.recap,
        terms: [],
      });
      for (const experiment of argument.experiments) {
        const terms = termsByInstrument.get(experiment) ?? new Set<string>();
        terms.add(argument.title);
        termsByInstrument.set(experiment, terms);
      }
    }
    for (const equation of payload.equations) {
      const argument = argumentsById.get(equation.argument);
      if (!argument)
        throw new TypeError(`Search equation has no rendered argument: ${equation.id}.`);
      const terms = equationTerms[equation.id];
      add({
        ...base,
        id: `equation:${equation.id}`,
        type: "equation",
        anchor: equation.argument,
        section: argument.section,
        title: equation.title,
        // The existing semantic renderer owns equation anchors; the parent argument is
        // always present even in the no-JavaScript reading shell.
        scopeLabel: `${paper.title} · modern teaching equation, not printed notation`,
        text: [
          equation.spoken,
          equation.explanation,
          ...equation.assumptions,
          ...equation.notes.map((note) => `${note.title} ${note.explanation}`),
        ].join(" "),
        terms: [equation.id, equation.spoken, ...(terms ? [terms] : [])],
      });
    }
  }
  for (const foundation of foundations) {
    add({
      id: `foundation:${foundation.id}`,
      type: "foundation",
      paper: "cross-paper",
      section: "",
      lang: "en",
      route: `/foundations/${foundation.id}/`,
      anchor: "",
      face: "",
      title: foundation.title,
      scopeLabel: "Foundation · authored explanation",
      text: [
        foundation.question,
        foundation.summary,
        blocksText(foundation.explanation),
        blocksText(foundation.example),
        foundation.stoppingPoint,
      ].join(" "),
      terms: [foundation.id],
    });
  }
  // A laboratory's line names its paper the way every other result does, by title, not by the
  // slug with spaces ("light quanta · host-calculation laboratory").
  const paperTitles = new Map(papers.map((payload) => [payload.paper.id, payload.paper.title]));
  for (const instrument of instruments) {
    if (instrument.status !== "registered") continue;
    const paper = familyPaper(instrument.id);
    if (!paper)
      throw new TypeError(`Registered instrument needs a search paper mapping: ${instrument.id}.`);
    add({
      id: `instrument:${instrument.id}`,
      type: "instrument",
      paper,
      section: "",
      lang: "en",
      route: `/lab/${instrument.id}/`,
      anchor: "",
      face: "",
      // The name /instruments/ and every "Open the lab" link use: the question the laboratory
      // answers. The catalogue's own title is a placeholder, "Light quanta instrument lq-06",
      // which the palette and /search/ showed for all 37 laboratories. labName falls back to the
      // id, and then the catalogue title is the better of the two.
      title: labName(instrument.id) === instrument.id ? instrument.title : labName(instrument.id),
      text: instrument.question ?? instrument.title,
      terms: [instrument.id, ...(termsByInstrument.get(instrument.id) ?? [])],
      scopeLabel: `${paperTitles.get(paper) ?? "Across the papers"} · host-calculation laboratory`,
    });
  }
  return documents.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Editorial search aids, not claims that these words occur in a 1905 source. */
export function aliasesForDocuments(documents: readonly SearchDocument[]): readonly SearchAlias[] {
  const ids = new Set(documents.map((document) => document.id));
  const suggestions: SearchAlias[] = [
    { phrase: "how far does it wander", target: "argument:arg-bm-observable", label: "search aid" },
    { phrase: "clocks disagree", target: "instrument:sr-01", label: "search aid" },
    { phrase: "photon", target: "instrument:lq-08", label: "modern term" },
    { phrase: "Lorentz factor", target: "instrument:sr-04", label: "modern term" },
    { phrase: "E = mc²", target: "instrument:me-01", label: "modern term" },
  ];
  return suggestions.filter((alias) => ids.has(alias.target));
}

/** One printed glyph as /notation/ lists it: its meanings, paper by paper, and where it lands. */
export type SearchNotationGlyph = Readonly<{
  key: string;
  display: string;
  href: string;
  name: string;
  meanings: readonly Readonly<{
    paperTitle: string;
    meaning: string;
    modernGlyph: string | null;
  }>[];
}>;

/**
 * A reader who types a symbol (β, "beta", k, V) wants to know what it means where it is printed,
 * and before this nothing in the index said: "β" found three mass-energy arguments and never that
 * Einstein's β in the relativity paper is the modern γ. One document per printed glyph, from the
 * notation page's own glyph groups (notationData.ts, uniqueGlyphs), landing where that page's
 * symbol index lands. The concordance is the only source; nothing here is typed by hand.
 */
/**
 * A RECORDED WALKTHROUGH, AS SOMETHING A READER CAN FIND BY NAME.
 *
 * Measured 2026-09-28 against the published shards: 966 documents covering /papers/ (12,296 route
 * occurrences), /foundations/ (2,772) and /lab/ (1,666), and ZERO for /tapes/. The 22 walkthrough
 * pages went live this week and the index never learned about them, so a reader searching "the boost
 * to 0.6c" or "magnet and conductor" found nothing while the page sat one link away.
 *
 * The type is "walkthrough", added in 447ea63b. The only guided-route type before that was "tour",
 * which the palette renders as the heading "Tours", and the site uses that word for the guided
 * reading paths at /tours/ rather than for an ordered run of one instrument.
 *
 * THE ROUTE COMES FROM tapePath, NOT FROM A TEMPLATE. One tape id contains a dot and the host serves
 * that path without the trailing slash (am-tpzn); a hand-built `/tapes/${id}/` here would send every
 * searcher for "the boost to 0.6c" through a 308.
 */
/**
 * A DISCOVERY ROUTE, AS SOMETHING A READER CAN FIND BY NAME.
 *
 * AGENTS.md calls the discovery journeys the site's signature content. Measured 2026-09-28 against
 * the published shards, /discover/ had ZERO documents, so the four routes were reachable only by
 * browsing to them. A reader who types "magnet and conductor" or "ultraviolet" should meet the route
 * that reconstructs the problem, not only the passages that state its answer.
 *
 * ONE DOCUMENT PER ROUTE, NOT ONE PER STEP. The steps have names but no addresses of their own, so a
 * per-step document would carry a link to somewhere the step is not. The step names go into the
 * document's TEXT instead, which is what makes a search for a step phrase find the route it belongs
 * to, and the link then lands where the reader can actually start.
 */
/**
 * A GUIDED READING PATH, AS SOMETHING A READER CAN FIND BY NAME.
 *
 * The last of the three guided layers to be indexed. Measured 2026-09-28, /tours/ had ZERO search
 * documents while the "tour" type sat in SEARCH_TYPES describing exactly these and holding nothing.
 *
 * TWO SOURCES, and the page renders both: content/tours/*.yaml through tourIds and requireTour, and
 * the GUIDED_TOURS catalogue in code. Indexing only the catalogue would have covered four of the
 * five paths a reader can see, which is the population error this file has now made once already
 * (the kernel catalogue and the manifests) and which the caller therefore passes in already merged.
 *
 * NO TERMS. Terms are the heaviest field in the engine and are for names a reader might type that
 * the title does not already contain. A tour's id restates its paper, and putting that in terms is
 * what floated a discovery route above its own paper for the query "brownain". The title and the
 * stop names carry these.
 */
export function tourDocuments(
  tours: readonly SearchGuidedTour[],
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  return tours
    .map((tour) =>
      validateSearchDocument({
        id: `tour:${tour.id}`,
        type: "tour",
        paper: tour.paper,
        section: "",
        lang: "en",
        route: `/tours/${tour.id}/`,
        anchor: "",
        face: "",
        title: tour.title,
        text: [tour.introduction, ...tour.stopTitles].filter(Boolean).join(" "),
        terms: [],
        scopeLabel: `A guided reading path · ${tour.stopTitles.length} stops`,
      }),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function discoveryDocuments(
  routes: readonly SearchDiscoveryRoute[],
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  return routes
    .map((route) =>
      validateSearchDocument({
        id: `discovery:${route.slug}`,
        type: "discovery",
        paper: route.slug,
        section: "",
        lang: "en",
        route: `/discover/${route.slug}/`,
        anchor: "",
        face: "",
        title: route.name,
        text: [route.blurb, ...route.steps].join(" "),
        // ONLY THE GERMAN TITLE, because terms are the highest-weighted field (12, against 8 for
        // the title and 1 for the text) and are meant for names a reader might actually type that
        // the title does not already contain. Putting the slug here too put "brownian motion" into
        // the heaviest field a second time and floated this route above the PAPER for the query
        // "brownain", which queryQuality.test.ts measures on live as a place a reader wants the
        // paper. The German title is a real alternative name; the slug is a URL fragment.
        terms: [route.germanTitle],
        scopeLabel: `${route.name} · a route you could take, ${route.steps.length} steps`,
      }),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function walkthroughDocuments(
  walkthroughs: readonly SearchWalkthrough[],
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  return walkthroughs
    .map((walkthrough) =>
      validateSearchDocument({
        id: `walkthrough:${walkthrough.id}`,
        type: "walkthrough",
        // Every group of tapes names exactly one paper (measured), but a tape with no resolved
        // passage gets the cross-paper scope rather than being dropped: a dropped document is a
        // page a reader cannot find, and silence is the failure this whole builder exists to end.
        paper: walkthrough.paper === "" ? "cross-paper" : walkthrough.paper,
        section: "",
        lang: "en",
        route: walkthrough.route,
        anchor: "",
        face: "",
        title: walkthrough.title,
        // The description plus the sections it leads back to, so a reader searching for the
        // PASSAGE finds the walkthrough that works it.
        text: [walkthrough.description, ...walkthrough.sectionTitles].filter(Boolean).join(" "),
        terms: [walkthrough.id, walkthrough.instrumentId],
        scopeLabel: `${walkthrough.paperTitle || "Across the papers"} · recorded walkthrough of ${walkthrough.instrumentId}`,
      }),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * AN EXPLAINED EQUATION, FOR THE SEARCH INDEX. Built by the caller from
 * `src/equations/printed/catalogue.ts`, because that module reads the explanations payload and this
 * one is imported by a page (src/app/notation/notationData.ts): a payload imported here would ride
 * into that page's server bundle for nothing.
 */
export type SearchExplainedEquation = Readonly<{
  /** The explanation's own id, which is the last segment of its page's address. */
  display: string;
  paper: string;
  paperTitle: string;
  /** Where the equation sits, as a reader would cite it: "§3, display 7" (equationLocator). */
  locator: string;
  /** The equation in ordinary language: the explanation's own `inWords`. */
  words: string;
  /** The authored spoken form, a search TERM rather than the title; see below. */
  spoken: string;
}>;

/**
 * THE PRINTED DISPLAYS A READER CAN SEARCH FOR BY WHAT THEY SAY.
 *
 * Measured on the index of 2026-10-22, before this existed: 998 documents, 106 of type "equation",
 * and every one of the 106 an `eq-model-*` teaching equation routed at its argument anchor. ZERO
 * documents routed under /equations/. So the 200 printed displays each had an authored sentence
 * saying what the equation claims, written for the explainer and shipped on 195 pages, and a
 * reader searching for those words found nothing: not the equation, and not the page that explains
 * it at four depths.
 *
 * THE TITLE IS THE LOCATOR, NOT THE SPOKEN FORM, and that is a measurement rather than a taste.
 * AGENTS.md makes the authored spoken form an equation's accessible name, which argues for using
 * it here; but the 271 spoken forms run from 13 to 1,672 characters (median 84, p90 230) against
 * existing index titles of median 16 and max 167, and /search/ renders a title with no clamp. A
 * 1,672-character link text would be a defect introduced for the sake of a principle that the
 * `terms` field satisfies anyway: the spoken form is searchable here, it is just not the link.
 *
 * ONE AUTHORED SPOKEN FORM IS 1,672 CHARACTERS, which is longer than a search TERM may be, so the
 * spoken form travels in `text` beside the words rather than in `terms`. Found by the validator
 * refusing the document rather than by reading the limit: a refusal in this builder would have
 * taken one page out of the index while every count stayed plausible.
 *
 * WHAT IS LEFT OUT, with the reason, because 200 of 279 is not all of them:
 *   35 derivation steps  already indexed, as `equation:eq-model-*` at their argument anchor; a
 *                        second document for the same equation would put one thing in the list
 *                        twice under two addresses
 *   36 route equations   no authored short name. Their ids are two shapes, `journey-bmMeanSquare`
 *                        and `journey-discover-mass-energy-investigate-opposite-pulses`, and a
 *                        title humanised from the first reads "Bm mean square"
 *    8 lab formulas      `labName` gives the laboratory's own heading, but two of the eight are
 *                        sr-03's and would share it, so the title would not tell them apart
 * Both of the last two want a `title` on the record rather than a derivation here, which is
 * content work; the 200 need no such decision because the anchor grammar already locates them.
 */
export function explainedEquationDocuments(
  equations: readonly SearchExplainedEquation[],
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  if (profile !== "scaffold") return [];
  return equations
    .map((equation) =>
      validateSearchDocument({
        id: `equation-explained:${equation.paper}:${equation.display}`,
        type: "equation",
        paper: equation.paper,
        section: "",
        lang: "en",
        // The explanation's own page, where the equation is drawn above its four readings. No
        // face and no anchor: the page IS the destination, not a position within another one.
        route: `/equations/${equation.paper}/${equation.display}/`,
        anchor: "",
        face: "",
        title: equation.locator,
        /*
         * The words AND the spoken form, both searchable, because a term may not exceed 1,000
         * characters (SEARCH_LIMITS, enforced by validateSearchDocument) and the longest authored
         * spoken form in the corpus is 1,672: relativity's § 6, which is six equations read out.
         * Putting it in `terms` would refuse that document, and refusing one document is how a
         * page goes missing from search while every count still looks right.
         */
        text: [equation.words, equation.spoken].filter(Boolean).join(" "),
        terms: [equation.display],
        scopeLabel: `${equation.paperTitle} · printed display, with its explanation`,
      }),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** A common wrong turn, for the search index. Rows injected; see explainedEquationDocuments. */
export type SearchWrongTurn = Readonly<{
  id: string;
  paper: string;
  paperTitle: string;
  /** The record's own tempting claim, which is what a reader would type. */
  claim: string;
  /** Why it is tempting, where it is true, and what is true, from the record. */
  text: string;
}>;

/**
 * THE 29 COMMON WRONG TURNS, FOUND BY THE WRONG BELIEF ITSELF.
 *
 * Measured on the index of 2026-10-22: `misconception` was one of EIGHT declared search types with
 * zero documents, beside a heading already written for it in TYPE_LABELS ("Common wrong turns") and
 * a route family already allowed by the validator. Four of the eight have real records behind them
 * and four do not, so this is a builder that was never written rather than content that is absent.
 * A reader who typed "Einstein's paper proved that molecules exist" -- which is a record's own
 * `temptingClaims[0]`, verbatim -- found nothing, and that sentence is the single best query a
 * reader could possibly make of this edition.
 *
 * THE TITLE IS THE CLAIM, WHICH THE EDITION DOES NOT ENDORSE, so the frame has to carry that. Two
 * things do: the palette and /search/ group these under "Common wrong turns" (TYPE_LABELS), and the
 * scope line beside every hit says what the record does with the claim. The claims are 29 to 129
 * characters, median 64, against index titles of median 16 and max 167, so none is clipped.
 */
export function wrongTurnDocuments(
  wrongTurns: readonly SearchWrongTurn[],
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  if (profile !== "scaffold") return [];
  return wrongTurns
    .map((wrongTurn) =>
      validateSearchDocument({
        id: `misconception:${wrongTurn.id}`,
        type: "misconception",
        paper: wrongTurn.paper,
        section: "",
        lang: "en",
        // The callout's own element on the paper page (`id="misconception-<id>"`, measured in the
        // built HTML). PaperMargins renders only on the whole-paper page, never on a section, so
        // there is one address and no face.
        route: `/papers/${wrongTurn.paper}/`,
        anchor: `misconception-${wrongTurn.id}`,
        face: "",
        title: wrongTurn.claim,
        text: wrongTurn.text,
        terms: [wrongTurn.id],
        scopeLabel: `${wrongTurn.paperTitle} · a claim the edition examines rather than endorses: why it tempts, and what is true`,
      }),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** A capstone, for the search index. Rows injected; see explainedEquationDocuments. */
export type SearchCapstone = Readonly<{
  paper: string;
  paperTitle: string;
  /** The record's own title, as the page's h1 renders it. */
  title: string;
  /** Its question and the claims it asks a reader to arrange, from the record. */
  text: string;
}>;

/**
 * THE FOUR CAPSTONES. `capstone` was another of the eight declared types with no documents, with
 * its heading written ("Capstones"), its route family allowed, and four real pages behind it since
 * September. A reader searching "rebuild the September argument", which is a capstone's own title
 * and the h1 of its page, found nothing.
 */
export function capstoneDocuments(
  capstones: readonly SearchCapstone[],
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  if (profile !== "scaffold") return [];
  return capstones
    .map((capstone) =>
      validateSearchDocument({
        id: `capstone:${capstone.paper}`,
        type: "capstone",
        paper: capstone.paper,
        section: "",
        lang: "en",
        route: `/capstones/${capstone.paper}/`,
        anchor: "",
        face: "",
        title: capstone.title,
        text: capstone.text,
        /*
         * NOT THE PAPER SLUG, which is the same defect the connection builder below records and
         * which this builder shipped with. Measured after it landed: a term match outweighs body
         * text, so "brownian motion", "light quanta", "special relativity" and "mass energy" each
         * returned the capstone ABOVE the paper itself. A reader typing a paper's name wants the
         * paper. queryQuality.test.ts now pins all four, which it did not before: its two typo
         * queries happened to fuzzy-match past the capstone and reported nothing.
         */
        terms: [`capstone-${capstone.paper}`],
        scopeLabel: `${capstone.paperTitle} · the paper's argument as claims to arrange, optional and printable`,
      }),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** A historian's-margin note, for the search index. Rows injected; see explainedEquationDocuments. */
export type SearchMarginNote = Readonly<{
  id: string;
  paper: string;
  paperTitle: string;
  /** Where the note attaches, as a reader would cite it: "§3, paragraph 2" (marginNoteLocator). */
  locator: string;
  /** The note's own claim, with its reasoning and evidence where it carries them. */
  text: string;
  /** historian-margin, side-note or dispute, for the scope line. */
  kind: string;
}>;

/**
 * THE 28 HISTORICAL NOTES. The third of the eight declared-but-empty search types to be built, and
 * the one that needed a decision rather than a builder: a note carries `claim`, 313 to 1,253
 * characters with a median of 680, and no short name, against index titles of median 16 and a
 * /search/ view that renders a title with no clamp.
 *
 * SO THE TITLE IS WHERE THE NOTE ATTACHES, derived from its own `affectedIds[0]` in the same style
 * as the printed displays' locators, and the claim is the text. 27 of the 28 carry an affected id
 * (25 of the form `s<n>-p<m>`, one `s1-fn1`, one `closing-ack`); the 28th is about the paper as a
 * whole and says so in its title.
 *
 * THE COST, MEASURED RATHER THAN DISCOVERED LATER: 11 of the 28 share a title with another note,
 * because several notes attach to one paragraph -- four to mass-energy's `s0-p12` alone, which has
 * no section to qualify it. A reader therefore meets four results titled "Paragraph 12",
 * distinguished by their snippets. That is worse than a unique title and much better than no
 * document, which is the whole of the choice: this edition's rule is that a dropped row is a page a
 * reader cannot find.
 *
 * AND THE ID CANNOT SUPPLY THE DIFFERENCE, which is why the obvious repair is not taken here. The
 * ids are descriptive kebab slugs, but a single letter in them is sometimes a sequence marker and
 * sometimes the subject: `note-bm-g-exner-measured-the-wrong-quantity` wants the `g` dropped and
 * `note-bm-k-is-viscosity` wants it kept, because k IS the thing the note is about. Undecidable
 * from the id, so a derived discriminator would silently mangle one of the two. The fix is a short
 * `title` on each of the 28 records, which is content work and is on am-ahgo; this derivation moves
 * nothing when it arrives.
 */
export function marginNoteDocuments(
  notes: readonly SearchMarginNote[],
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  if (profile !== "scaffold") return [];
  return notes
    .map((note) =>
      validateSearchDocument({
        id: `margin:${note.id}`,
        type: "margin",
        paper: note.paper,
        section: "",
        lang: "en",
        // PaperMargins renders the note as `id={`note-${note.id}`}`, and the record ids already
        // begin with `note-`, so the element id is doubled in the built HTML. Spelled the way the
        // page spells it rather than the way it reads; searchAnchorsResolve holds the two together.
        route: `/papers/${note.paper}/`,
        anchor: `note-${note.id}`,
        face: "",
        title: note.locator,
        text: note.text,
        terms: [note.id],
        scopeLabel: `${note.paperTitle} · ${note.kind === "dispute" ? "a recorded disagreement" : note.kind === "side-note" ? "a side note" : "the historian's margin"}, with its sources`,
      }),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** A connection between two papers, for the search index. Rows injected; see above. */
export type SearchConnectionThread = Readonly<{
  id: string;
  /** The record's own sentence saying what the connection is. */
  what: string;
  /** "Uses a result", "Reaches the same number", and so on: the record's own label. */
  label: string;
  /** The paper slugs it joins, in received order. */
  papers: readonly string[];
  /** What a reader is told about the use, where the record carries one. */
  text: string;
}>;

/**
 * THE FIVE CONNECTIONS AMONG THE PAPERS. The last of the four declared-but-empty types with records
 * behind it. /connections/ has existed since dispatch 253 and carries an element id for each of the
 * five (verified in the built HTML), so the destination was settled and only the builder was
 * missing.
 *
 * `paper` is the CROSS-PAPER scope rather than one of the two a connection joins, which is what the
 * field means elsewhere in this index for a document that belongs to no single paper (a walkthrough
 * with no resolved passage takes the same value). Filing it under one of its two papers would hide
 * it from a filter on the other.
 */
export function connectionDocuments(
  connections: readonly SearchConnectionThread[],
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  if (profile !== "scaffold") return [];
  return connections
    .map((connection) =>
      validateSearchDocument({
        id: `connection:${connection.id}`,
        type: "connection-thread",
        paper: "cross-paper",
        section: "",
        lang: "en",
        route: "/connections/",
        anchor: connection.id,
        face: "",
        title: connection.what,
        text: connection.text,
        /*
         * NO TERMS AT ALL, which is a repair and the only builder here that needs it. The first
         * version carried `[connection.id, ...connection.papers]` and queryQuality.test.ts went
         * red on "brownain" and "relativty"; the live cause was worse than the typo tolerance it
         * blamed, because a term match outweighs body text and "relativity" then returned three
         * connection records with no relativity paper in the top three at all.
         *
         * The rule this teaches is narrower than "ids are not terms", which the other builders
         * here disprove: `misc-bm-proves-molecules`, `note-bm-k-is-viscosity` and `eq-s3-d7` are
         * all terms and harm nothing. It is that an id CONTAINING A WORD A READER WOULD TYPE FOR
         * SOMETHING ELSE must not be a term, and these five ids are exactly that:
         * `relativity-premises`, `molecular-number`, `energy-transformation`, `light-thread`,
         * `counting`. Each connection stays findable through its own sentence, which names both
         * papers, and a reader typing a slug is not a query this index owes an answer to.
         */
        terms: [],
        scopeLabel: `Across the papers · ${connection.label.toLowerCase()}, joining ${connection.papers.length} of the four`,
      }),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** One card from a journey's 1904 shelf, or the later evidence beside its check. Rows injected. */
export type SearchKnowledgeCard = Readonly<{
  /** The card's own id, which is also its element id on the page as `card-<id>`. */
  id: string;
  /** The journey slug, which is the paper slug. */
  paper: string;
  paperTitle: string;
  /** The card's one-line statement. This is the heading its own summary renders, verbatim. */
  proposition: string;
  /** `available`, `parallel-work` or `later`: what the 1904 shelf says about it. */
  status: string;
  /** The line the card's own view prints, from `formatEventDateLine`: "Published 1851". */
  dateLine: string;
  /** The card's limits sentence: what it does not establish. */
  limits: string;
  /** On the shelf, or later evidence that may never be a premise. */
  onShelf: boolean;
}>;

/**
 * A NAME AND A YEAR A READER MIGHT TYPE, TAKEN FROM THE CARD'S OWN ID.
 *
 * The ids are authored as `<surname(s)>-<year>-<subject>`, so the leading segments before a
 * four-digit one are a person's name: `michelson-morley-1887-no-drift` gives "michelson morley",
 * `de-sitter-1913-double-stars` gives "de sitter". That is mechanical rather than editorial, which
 * matters because 12 of the 40 shelf cards do NOT name their own author anywhere in their
 * proposition or limits, so without this a reader who knows the result by its author's name finds
 * nothing. Measured over the 46: 45 ids yield a name and a year, and one does not -- the concept
 * card `equipartition-mean-resonator-energy`, which gets no name term and should not.
 *
 * `einstein` is excluded deliberately. `terms` is the heaviest field in the index (12, against 8
 * for the title), and this corpus is four Einstein papers: a term match would float one admitted
 * import above the papers themselves for the commonest query the site has. That is not a guess --
 * `connectionDocuments` above records the same effect measured on live for "relativity", and
 * `queryQuality.test.ts` is what holds it.
 */
export function knowledgeCardTerms(id: string): readonly string[] {
  const segments = id.split("-");
  const yearAt = segments.findIndex((segment) => /^\d{4}$/.test(segment));
  if (yearAt < 1) return [];
  const name = segments.slice(0, yearAt).join(" ");
  const year = segments[yearAt] as string;
  return name === "einstein" ? [year] : [name, year];
}

/**
 * THE 1904 SHELF AS SEARCH DOCUMENTS.
 *
 * `knowledge-card` was one of the declared search types with zero documents, and the reason given
 * for it -- "records exist, no page of their own yet" -- is true of a dedicated route and not of
 * reachability: all 46 cards render on the four `/discover/<paper>/` pages, and all 46 carry
 * `id="card-<id>"` in the built HTML (counted per page: 12, 14, 11, 9). So the destination was
 * settled and only the builder was missing, which is the same shape as the margin notes and the
 * connections above.
 *
 * The TITLE is the proposition, in full and unshortened, because that is exactly what the card's
 * `<summary>` renders as its heading (`KnowledgeCard.tsx`), and its own comment says the id "stays
 * as its anchor, not as text a reader must read". The propositions are long -- median 265
 * characters over the 40 shelf cards -- and shortening one here would make the result read
 * differently from the thing a reader lands on. The `text` is the limits sentence, which every one
 * of the 46 carries, because what a card does NOT establish is the half a reader most needs.
 *
 * Scaffold profile only, for the reason `notationDocuments` gives below: 46 of 46 carry no complete
 * verification record (`bun scripts/check-shelf-publication.ts`), so they are searchable where the
 * explanations are and nowhere stricter.
 */
export function knowledgeCardDocuments(
  cards: readonly SearchKnowledgeCard[],
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  if (profile !== "scaffold") return [];
  return cards
    .map((card) =>
      validateSearchDocument({
        id: `knowledge-card:${card.id}`,
        type: "knowledge-card",
        paper: card.paper,
        section: "",
        lang: "en",
        route: `/discover/${card.paper}/`,
        // KnowledgeCardView puts `card-${card.id}` on its <details>; searchAnchorsResolve holds
        // this spelling to the built page rather than to an agreement between two files.
        anchor: `card-${card.id}`,
        face: "",
        title: card.proposition,
        text: card.limits,
        terms: knowledgeCardTerms(card.id),
        scopeLabel: `${card.paperTitle} · ${
          card.onShelf
            ? `on the 1904 shelf, ${card.dateLine.toLowerCase()}`
            : `later evidence, never a premise, ${card.dateLine.toLowerCase()}`
        }`,
      }),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function notationDocuments(
  glyphs: readonly SearchNotationGlyph[],
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  // The same publication rule as documentsFromCompiled: the concordance is still marked pending
  // verification, so it is searchable where the explanations are, in the scaffold profile only.
  if (profile !== "scaffold") return [];
  return glyphs
    .map((glyph) =>
      validateSearchDocument({
        id: `notation:${glyph.key}`,
        type: "glossary",
        paper: "cross-paper",
        section: "",
        lang: "en",
        route: "/notation/",
        anchor: glyph.href.replace(/^#/u, ""),
        face: "",
        title: glyph.name,
        text: glyph.meanings.map((m) => `${m.paperTitle}: ${m.meaning}.`).join(" "),
        terms: [glyph.display],
        scopeLabel: "Notation · each letter as printed, and what it means in each paper",
      }),
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * The modern symbol for a printed one, as the concordance records it, is a way in: a reader who
 * types "gamma" is looking for the relativity paper's β. Each is a "modern term" alias to the
 * printed glyph's document, never a claim that the modern symbol is printed.
 *
 * A letter that is itself printed keeps its own document first. The concordance renames ν and f to
 * a modern n, and several glyphs to k and v, and as aliases those names outranked the printed N, k
 * and V a reader had typed. So a modern name that some printed glyph already carries is not an
 * alias; the renamed glyph is still found through its meanings.
 */
export function notationAliases(
  glyphs: readonly SearchNotationGlyph[],
  documents: readonly SearchDocument[],
): readonly SearchAlias[] {
  const ids = new Set(documents.map((document) => document.id));
  const printed = new Set(glyphs.map((glyph) => normalizeSearchText(glyph.display)));
  const seen = new Set<string>();
  const aliases: SearchAlias[] = [];
  for (const glyph of glyphs) {
    const target = `notation:${glyph.key}`;
    if (!ids.has(target)) continue;
    for (const { modernGlyph } of glyph.meanings) {
      if (!modernGlyph) continue;
      const phrase = normalizeSearchText(modernGlyph);
      if (!phrase || printed.has(phrase)) continue;
      const key = `${phrase}\0${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      aliases.push({ phrase: modernGlyph, target, label: "modern term" });
    }
  }
  return aliases;
}

/** One block of a paper's German face, as src/content/editions/germanSourceFace.ts assembles it. */
export type SearchGermanBlock = Readonly<{ id: string; kind: string; text: string }>;

/**
 * The source's own markup made plain for matching: Sperrsatz and italic tags come out of the word
 * they wrap, a footnote mark leaves the word it follows whole, display mathematics is dropped (a
 * formula is not a word anyone types), and inline mathematics becomes its plain letters.
 */
export function germanSourcePlain(text: string): string {
  return inlineMathPlain(
    text
      .replace(/\$\$[\s\S]*?\$\$/gu, " ")
      .replace(/\[\[\/?(?:SPERR|EM)\]\]|\[\[FN-MARK [^\]]*\]\]/gu, "")
      .replace(/\[\[[^\]]*\]\]/gu, " "),
  )
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * The German a reader can already open, so a German word finds the passage that prints it:
 * "Lichtquanten", "Relativitätsprinzip" and "Lichtgeschwindigkeit" found nothing, because the
 * index held only the English explanations and the German titles. One document per heading,
 * paragraph and footnote of the paper's German face, landing on that block's id there.
 *
 * The text is the transcription that face shows under its draft label, and each document's scope
 * line carries the same label, so a hit never reads as a reviewed edition. Titles are ours and
 * count as the reader sees the face ("§ 8, paragraph 2"), because block ids keep their gaps after
 * a join and "s8-p4" is not the fourth paragraph a reader counts.
 */
export function germanSourceDocuments(
  paper: Readonly<{ id: string; title: string }>,
  face: Readonly<{ label: string; blocks: readonly SearchGermanBlock[] }>,
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  if (profile !== "scaffold") return [];
  const sectioned = face.blocks.some((block) => block.kind === "heading");
  const ordinals = new Map<string, number>();
  const documents: SearchDocument[] = [];
  for (const block of face.blocks) {
    if (!["heading", "paragraph", "footnote"].includes(block.kind)) continue;
    const section = /^(s\d+)/u.exec(block.id)?.[1] ?? "";
    const number = section.slice(1);
    const where = section === "s0" ? (sectioned ? "Introduction" : "") : `§ ${number}`;
    const text = germanSourcePlain(block.text);
    if (!text) continue;
    let title: string;
    if (block.kind === "heading") title = text;
    else if (block.kind === "footnote") {
      const footnote = /-fn(\d+)$/u.exec(block.id)?.[1] ?? "";
      title = where ? `${where}, footnote ${footnote}` : `Footnote ${footnote}`;
    } else {
      const ordinal = (ordinals.get(section) ?? 0) + 1;
      ordinals.set(section, ordinal);
      title = where ? `${where}, paragraph ${ordinal}` : `Paragraph ${ordinal}`;
    }
    documents.push(
      validateSearchDocument({
        id: `german:${paper.id}:${block.id}`,
        type: "sentence-de",
        paper: paper.id,
        section,
        lang: "de",
        route: `/papers/${paper.id}/view/german/`,
        anchor: block.id,
        face: "",
        title,
        text,
        terms: [],
        scopeLabel: `${paper.title} · German source, ${face.label.toLowerCase()}`,
      }),
    );
  }
  return documents;
}

/**
 * The language faces a reader can search, each indexed from its own face's loader by the builder
 * named here. The build asserts every language face of the registry is classified, so a face added
 * later is either indexed or excluded on purpose, never silently left out: until dispatch 214 the
 * English face was left out, and a search for "principle of relativity" found the explanations and
 * never the translation.
 */
export const SEARCH_LANGUAGE_FACES = Object.freeze({
  german: "each heading, paragraph and footnote of the German face (germanSourceDocuments)",
  english: "each heading, paragraph and footnote of the English face (englishTranslationDocuments)",
});
export function assertSearchFaceCoverage(faces: readonly string[]): void {
  assertClassified(SEARCH_LANGUAGE_FACES, faces, "language face for search");
}
const ADD = "Add its builder or an explicit exclusion.";

/** The shape of a content inline this module reads, without importing the content schemas. */
/**
 * A face's inlines in the markup germanSourcePlain reads: the words a reader sees, including a
 * term's and a reference's own words; inline mathematics as $...$; a display formula as $$...$$
 * (which it drops); emphasis unwrapped; and a footnote mark or citation left out.
 */
export function searchInlineText(inlines: readonly Inline[]): string {
  return inlines
    .map((node) => {
      switch (node.kind) {
        case "text":
        case "term":
        case "reference":
          return node.text;
        case "misprint":
          // A misprint inside a formula is its formula, as printed (dispatch 270).
          return "math" in node ? `$${node.math.latex}$` : node.text;
        case "space":
        case "line-break":
          return " ";
        case "emphasis":
          return searchInlineText(node.inlines);
        case "math":
          return node.display ? ` $$${node.latex}$$ ` : `$${node.latex}$`;
        default:
          return "";
      }
    })
    .join("");
}

/** One heading, paragraph or footnote of a paper's English face, as that face groups its units. */
export type SearchEnglishParagraph = Readonly<{
  /** The source block the English renders, which names the paragraph. */
  key: string;
  kind: "heading" | "paragraph" | "footnote";
  section: string;
  /** The id of the paragraph's first unit, which the English face renders as an element id. */
  anchor: string;
  text: string;
}>;

/**
 * The English a reader can open, so an English phrase finds the translation that says it: the index
 * held the explanations and the German, and "principle of relativity", "light quanta" or "Brownian"
 * never reached the translation itself. One document per heading, paragraph and footnote of the
 * English face, grouped as that face sets them and landing on the first unit it renders there.
 * Titles count as the German documents do ("§ 3, paragraph 2"), and the scope line carries the
 * face's label and its review state, so a hit never reads as a person's review.
 */
export function englishTranslationDocuments(
  paper: Readonly<{ id: string; title: string }>,
  face: Readonly<{ label: string; paragraphs: readonly SearchEnglishParagraph[] }>,
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  if (profile !== "scaffold") return [];
  const sectioned = face.paragraphs.some((p) => p.kind === "heading");
  const ordinals = new Map<string, number>();
  const documents: SearchDocument[] = [];
  for (const paragraph of face.paragraphs) {
    const section = paragraph.section;
    const number = section.slice(1);
    const where = section === "s0" ? (sectioned ? "Introduction" : "") : `§ ${number}`;
    const text = germanSourcePlain(paragraph.text);
    if (!text) continue;
    let title: string;
    if (paragraph.kind === "heading") title = text;
    else if (paragraph.kind === "footnote") {
      const footnote = /-fn(\d+)$/u.exec(paragraph.key)?.[1] ?? "";
      title = where ? `${where}, footnote ${footnote}` : `Footnote ${footnote}`;
    } else {
      const ordinal = (ordinals.get(section) ?? 0) + 1;
      ordinals.set(section, ordinal);
      title = where ? `${where}, paragraph ${ordinal}` : `Paragraph ${ordinal}`;
    }
    documents.push(
      validateSearchDocument({
        id: `english:${paper.id}:${paragraph.key}`,
        type: "sentence-en",
        paper: paper.id,
        section,
        lang: "en",
        route: `/papers/${paper.id}/view/english/`,
        anchor: paragraph.anchor,
        face: "",
        title,
        text,
        terms: [],
        scopeLabel: `${paper.title} · ${face.label}`,
      }),
    );
  }
  return documents;
}
