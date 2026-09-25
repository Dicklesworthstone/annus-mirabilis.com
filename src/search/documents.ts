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
