/**
 * RESULT CARDS (am-me-results-cards-c6mf): a paper's numbered results, as the results face shows
 * them, from content/results/<paper>.yaml.
 *
 * A card never retypes Einstein. Its as-printed layer names anchors in the German face (a display,
 * or sentences of a paragraph by their order in it) and the text is read from the face at build
 * time, so a correction to the ledger reaches every card that cites it. The modern layer names
 * equation records; the probe names a registered laboratory and one of the presets its manifest
 * registers; misconceptions and "used later" notes name records in their own registries. Everything
 * a card cites must resolve, and what has no registry yet (the misconception ledger, margin records)
 * resolves nothing: a card that cites one is refused, never trusted.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REGISTERED_IDS } from "../../experiments/catalogue.ts";
import { type GermanSourceFace, loadGermanSourceFace } from "../editions/germanSourceFace.ts";
import type { RouteSlug } from "../ids.ts";
import { parseYaml } from "../provenance/yaml.ts";

/** How a card labels a statement that is not the result itself. */
export const QUALIFICATION_KINDS = [
  "premise",
  "comparison",
  "approximation",
  "inference",
  "conditional",
] as const;
export type QualificationKind = (typeof QUALIFICATION_KINDS)[number];

/** Printed text read from the German face at an anchor: a display, or sentences of a block. */
export type PrintedExcerpt = Readonly<{
  anchor: string;
  kind: "display" | "sentences";
  /** 1-based sentence positions within the block; empty for a display. */
  ordinals: readonly number[];
  /** Ledger markup exactly as the face holds it: LaTeX for a display, marked text for sentences. */
  text: string;
  page: number | undefined;
}>;

export type ResultCardRecord = Readonly<{
  id: string;
  paper: string;
  section: string;
  arguments: readonly string[];
  printed: readonly PrintedExcerpt[];
  equations: readonly string[];
  oneSentence: string;
  decoder: readonly Readonly<{ symbol: string; meaning: string }>[];
  qualifications: readonly Readonly<{ kind: QualificationKind; text: string }>[];
  probes: readonly Readonly<{
    instrumentId: string;
    question: string;
    /** A preset the laboratory's manifest registers, with the label the manifest gives it. */
    preset?: Readonly<{ id: string; label: string }> | undefined;
  }>[];
  misconceptionIds: readonly string[];
  usedLater: readonly string[];
  printedCheck?: string | undefined;
  meanings: Readonly<{
    argumentStatus: string;
    modelStatus: string;
    evidentialRole: string;
    historicalStatus: string;
  }>;
  selectionReason: string;
}>;

/**
 * What a card may cite beyond the paper's own records and the laboratories' manifests. The
 * misconception ledger and the margin records have no registry in this repository yet, so the
 * default is empty: until theirs lands, a card lists none rather than inventing one.
 */
export type ResultRegistries = Readonly<{
  misconceptions: ReadonlySet<string>;
  marginRecords: ReadonlySet<string>;
}>;
export const EMPTY_REGISTRIES: ResultRegistries = Object.freeze({
  misconceptions: new Set<string>(),
  marginRecords: new Set<string>(),
});

/** What the cards of one paper are checked against, read from the repository. */
export type ResultContext = Readonly<{
  paper: string;
  sections: ReadonlySet<string>;
  arguments: ReadonlySet<string>;
  equations: ReadonlySet<string>;
  /** Scenario id to the paper its provenance names. */
  scenarios: ReadonlyMap<string, string>;
  /** Preset id to its laboratory and label, from content/experiments/<id>.yaml. */
  presets: ReadonlyMap<string, Readonly<{ instrumentId: string; label: string }>>;
  face: GermanSourceFace;
  registries: ResultRegistries;
}>;

const ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * An as-printed layer never carries a glyph the paper does not print. The plan's compact forms
 * (β for the explicit radical, "+ …" for the words about neglected orders) are restatements, so
 * finding one in printed text means the edition, or the anchor, is wrong.
 */
export function printedFormProblems(text: string): string[] {
  const problems: string[] = [];
  if (/\\beta\b|β/.test(text)) problems.push("carries β, which the paper does not print");
  if (/\\[lc]?dots\b|…|\.\.\./.test(text)) problems.push("carries an ellipsis");
  return problems;
}

/**
 * A preset id is `<instrumentId>-<slug>`; the mode form `<instrumentId>:<mode>` is not one. A dot
 * appears only between two digits (AGENTS.md naming conventions), as in me-02-0.6c.
 */
export function presetIdProblems(instrumentId: string, presetId: string): string[] {
  const undotted = presetId.replace(/(?<=\d)\.(?=\d)/g, "");
  if (!presetId.startsWith(`${instrumentId}-`) || !ID.test(undotted))
    return [`preset ${presetId} is not of the form ${instrumentId}-<slug>`];
  return [];
}

/** The paper does not print E = mc²; no card shows it as the paper's result. */
const EMC2 = /\bE\s*=\s*m\s*c\s*(?:\^\s*\{?\s*2|²)/;

const str = (x: unknown): string => (typeof x === "string" ? x.trim() : "");
const list = (x: unknown): readonly unknown[] => (Array.isArray(x) ? x : []);
const strings = (x: unknown): string[] => list(x).filter((s): s is string => typeof s === "string");

function blockAt(face: GermanSourceFace, anchor: string) {
  return face.blocks.find((b) => (face.anchors.anchorOf[b.id] ?? b.id) === anchor);
}

function resolvePrinted(
  face: GermanSourceFace,
  raw: unknown,
  where: string,
  problems: string[],
): PrintedExcerpt | null {
  const o = (raw ?? {}) as { anchor?: unknown; sentences?: unknown };
  const anchor = str(o.anchor);
  const block = anchor ? blockAt(face, anchor) : undefined;
  if (!block) {
    problems.push(`${where} names ${anchor || "no anchor"}, which the German face does not have`);
    return null;
  }
  const page = face.printedPages.pages[block.id];
  const ordinals = list(o.sentences).filter((n): n is number => typeof n === "number");
  if (block.kind === "equation") {
    if (ordinals.length > 0) problems.push(`${where}: ${anchor} is a display and has no sentences`);
    return { anchor, kind: "display", ordinals: [], text: block.text, page };
  }
  const sentences = block.sentences ?? [];
  if (ordinals.length === 0) {
    problems.push(`${where}: ${anchor} is a ${block.kind}; name the sentences the card shows`);
    return null;
  }
  const picked = ordinals.map((n) => sentences[n - 1]);
  if (picked.some((s) => s === undefined)) {
    problems.push(
      `${where}: ${anchor} has ${sentences.length} sentences, not ${ordinals.join(", ")}`,
    );
    return null;
  }
  return {
    anchor,
    kind: "sentences",
    ordinals,
    text: picked.map((s) => s?.text ?? "").join(" "),
    page,
  };
}

/** Checks raw card records against a paper's context; the cards that resolve, and every problem. */
export function checkResultCards(
  raw: unknown,
  context: ResultContext,
): Readonly<{ cards: readonly ResultCardRecord[]; problems: readonly string[] }> {
  const problems: string[] = [];
  const cards: ResultCardRecord[] = [];
  const seen = new Set<string>();
  for (const [i, entry] of list((raw as { cards?: unknown } | null)?.cards).entries()) {
    const c = (entry ?? {}) as Record<string, unknown>;
    const id = str(c.id);
    const at = `${context.paper} card ${id || `#${i + 1}`}`;
    const before = problems.length;
    if (!ID.test(id)) problems.push(`${at}: id is not a lowercase slug`);
    if (seen.has(id)) problems.push(`${at}: id is used twice`);
    seen.add(id);

    const section = str(c.section);
    if (!context.sections.has(section))
      problems.push(`${at}: section ${section} is not the paper's`);
    const args = strings(c.arguments);
    if (args.length === 0) problems.push(`${at}: names no argument passage`);
    for (const a of args)
      if (!context.arguments.has(a)) problems.push(`${at}: ${a} is not a ${context.paper} passage`);

    const printed = list(c.printed).flatMap((p, k) => {
      const excerpt = resolvePrinted(context.face, p, `${at} printed[${k}]`, problems);
      if (!excerpt) return [];
      for (const problem of printedFormProblems(excerpt.text))
        problems.push(`${at} printed ${excerpt.anchor} ${problem}`);
      return [excerpt];
    });
    if (list(c.printed).length === 0) problems.push(`${at}: has no as-printed layer`);

    const equations = strings(c.equations);
    for (const e of equations)
      if (!context.equations.has(e))
        problems.push(`${at}: ${e} is not a ${context.paper} equation`);

    const oneSentence = str(c.oneSentence);
    if (!oneSentence) problems.push(`${at}: has no one-sentence reading`);
    const decoder = list(c.decoder).map((d) => {
      const o = (d ?? {}) as { symbol?: unknown; meaning?: unknown };
      return { symbol: str(o.symbol), meaning: str(o.meaning) };
    });
    if (decoder.length === 0) problems.push(`${at}: has no decoder`);
    if (decoder.some((d) => !d.symbol || !d.meaning))
      problems.push(`${at}: a decoder entry lacks its symbol or its meaning`);

    const qualifications = list(c.qualifications).flatMap((q) => {
      const o = (q ?? {}) as { kind?: unknown; text?: unknown };
      const kind = str(o.kind) as QualificationKind;
      if (!QUALIFICATION_KINDS.includes(kind) || !str(o.text)) {
        problems.push(
          `${at}: a qualification needs a kind (${QUALIFICATION_KINDS.join(", ")}) and text`,
        );
        return [];
      }
      return [{ kind, text: str(o.text) }];
    });

    const probes = list(c.probes).flatMap((p) => {
      const o = (p ?? {}) as { instrument?: unknown; question?: unknown; preset?: unknown };
      const instrumentId = str(o.instrument);
      const question = str(o.question);
      const presetId = str(o.preset);
      if (!(REGISTERED_IDS as readonly string[]).includes(instrumentId))
        problems.push(`${at}: probe ${instrumentId || "(none)"} is not a registered laboratory`);
      if (!question) problems.push(`${at}: probe ${instrumentId} asks no question`);
      let preset: { id: string; label: string } | undefined;
      if (presetId) {
        const grammar = presetIdProblems(instrumentId, presetId);
        for (const g of grammar) problems.push(`${at}: ${g}`);
        const registered = context.presets.get(presetId);
        if (grammar.length === 0 && registered?.instrumentId !== instrumentId)
          problems.push(`${at}: preset ${presetId} is not registered by ${instrumentId}`);
        else if (registered) preset = { id: presetId, label: registered.label };
      }
      return [{ instrumentId, question, ...(preset ? { preset } : {}) }];
    });
    if (probes.length === 0) problems.push(`${at}: has no probe`);

    const misconceptionIds = strings(c.misconceptions);
    for (const m of misconceptionIds)
      if (!context.registries.misconceptions.has(m))
        problems.push(`${at}: misconception ${m} is not in the paper's ledger`);
    const usedLater = strings(c.usedLater);
    for (const u of usedLater)
      if (!context.registries.marginRecords.has(u))
        problems.push(`${at}: margin record ${u} does not exist`);

    const printedCheck = str(c.printedCheck) || undefined;
    if (printedCheck && context.scenarios.get(printedCheck) !== context.paper)
      problems.push(`${at}: printed check ${printedCheck} is not a ${context.paper} scenario`);

    const m = (c.meanings ?? {}) as Record<string, unknown>;
    const meanings = {
      argumentStatus: str(m.argumentStatus),
      modelStatus: str(m.modelStatus),
      evidentialRole: str(m.evidentialRole),
      historicalStatus: str(m.historicalStatus),
    };
    if (Object.values(meanings).some((v) => !v))
      problems.push(`${at}: all four kinds of meaning are required`);
    const selectionReason = str(c.selectionReason);
    if (!selectionReason) problems.push(`${at}: says not why it is a result`);

    const authored = [
      oneSentence,
      ...decoder.flatMap((d) => [d.symbol, d.meaning]),
      ...qualifications.map((q) => q.text),
      ...probes.map((p) => p.question),
    ];
    if (authored.some((t) => EMC2.test(t)))
      problems.push(`${at}: shows E = mc², which the paper does not print`);

    if (problems.length > before) continue;
    cards.push({
      id,
      paper: context.paper,
      section,
      arguments: args,
      printed,
      equations,
      oneSentence,
      decoder,
      qualifications,
      probes,
      misconceptionIds,
      usedLater,
      ...(printedCheck ? { printedCheck } : {}),
      meanings,
      selectionReason,
    });
  }
  return { cards, problems };
}

function recordIds(root: string, dir: string, paper: string): ReadonlySet<string> {
  const path = join(root, "content", dir, paper);
  if (!existsSync(path)) return new Set();
  return new Set(
    readdirSync(path)
      .filter((name) => name.endsWith(".json"))
      .flatMap((name) => {
        const record = JSON.parse(readFileSync(join(path, name), "utf8")) as { id?: unknown };
        return typeof record.id === "string" ? [record.id] : [];
      }),
  );
}

function scenarioOwners(root: string): ReadonlyMap<string, string> {
  const dir = join(root, "content", "scenarios");
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".yaml"))) {
    // `owner` names a capability (inference.molecularNumber); the paper is provenance.paper.
    const s = parseYaml(readFileSync(join(dir, name), "utf8")) as {
      id?: unknown;
      provenance?: { paper?: unknown } | null;
    } | null;
    const paper = s?.provenance?.paper;
    if (typeof s?.id === "string" && typeof paper === "string") out.set(s.id, paper);
  }
  return out;
}

function presetRegistry(
  root: string,
): ReadonlyMap<string, Readonly<{ instrumentId: string; label: string }>> {
  const dir = join(root, "content", "experiments");
  const out = new Map<string, { instrumentId: string; label: string }>();
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".yaml"))) {
    const m = parseYaml(readFileSync(join(dir, name), "utf8")) as {
      id?: unknown;
      presets?: unknown;
    } | null;
    if (typeof m?.id !== "string") continue;
    for (const p of list(m.presets)) {
      const { presetId, label } = (p ?? {}) as { presetId?: unknown; label?: unknown };
      if (typeof presetId === "string" && typeof label === "string")
        out.set(presetId, { instrumentId: m.id, label });
    }
  }
  return out;
}

/** The context a paper's cards are checked against, or null when it has no German face. */
export function resultContext(
  root: string,
  paper: string,
  registries: ResultRegistries = EMPTY_REGISTRIES,
): ResultContext | null {
  const face = loadGermanSourceFace(paper as RouteSlug, root);
  if (!face) return null;
  const record = JSON.parse(
    readFileSync(join(root, "content", "papers", `${paper}.json`), "utf8"),
  ) as { sections?: { id?: unknown }[] };
  return {
    paper,
    sections: new Set(
      (record.sections ?? []).flatMap((s) => (typeof s.id === "string" ? [s.id] : [])),
    ),
    arguments: recordIds(root, "arguments", paper),
    equations: recordIds(root, "equations", paper),
    scenarios: scenarioOwners(root),
    presets: presetRegistry(root),
    face,
    registries,
  };
}

/** A paper's result cards and their problems, or null when it has no content/results file. */
export function loadResultCards(
  root: string,
  paper: string,
  registries: ResultRegistries = EMPTY_REGISTRIES,
): Readonly<{ cards: readonly ResultCardRecord[]; problems: readonly string[] }> | null {
  const file = join(root, "content", "results", `${paper}.yaml`);
  if (!existsSync(file)) return null;
  const context = resultContext(root, paper, registries);
  if (!context) return { cards: [], problems: [`${paper} has result cards but no German face`] };
  return checkResultCards(parseYaml(readFileSync(file, "utf8")), context);
}
