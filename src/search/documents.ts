import { type SearchAlias, type SearchDocument, validateSearchDocument } from "./core.ts";

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
  for (const kind of kinds) {
    if (!Object.hasOwn(SEARCH_COVERAGE, kind))
      throw new TypeError(
        `Unclassified compiled search payload kind: ${kind}. Add its builder or an explicit exclusion.`,
      );
  }
}

type Block = Readonly<
  | { kind: "paragraph"; text: string }
  | { kind: "formula"; latex: string; spoken: string }
  | { kind: "steps"; items: readonly string[] }
  | { kind: "foundation"; id: string; returnCaption: string }
>;
/** Structural input projections; the content compiler remains the schema owner. */
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
          return block.text;
        case "formula":
          return `${block.spoken} ${block.latex}`;
        case "steps":
          return block.items.join(" ");
        case "foundation":
          return block.returnCaption;
        default:
          throw new TypeError("Unclassified compiled block in search.");
      }
    })
    .join(" ");
}
function familyPaper(id: string): string | null {
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
      scopeLabel: `${paper.title} · explanatory preview; source review pending`,
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
      scopeLabel: "Foundation · authored explanation; review pending",
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
      title: instrument.title,
      text: instrument.question ?? instrument.title,
      terms: [instrument.id, ...(termsByInstrument.get(instrument.id) ?? [])],
      scopeLabel: `${paper.replaceAll("-", " ")} · host-calculation laboratory`,
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
