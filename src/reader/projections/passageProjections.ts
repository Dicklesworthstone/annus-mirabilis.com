/**
 * The other views of an exact passage, joined from the edition and its authored bindings.
 *
 * A section is not a paragraph: a laboratory's section reference alone does not make it a
 * projection of every paragraph in that section. Likewise, discovery routes expose their
 * authored SourceJump anchors, not a guessed correspondence with numbered journey steps.
 * Missing relations remain empty so the static reader can say which views are unavailable.
 * This module is server-side; components that only render its result import the types alone.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadParagraphBindings,
  type ParagraphBinding,
} from "../../content/bindings/paragraphBindings.ts";
import type { PaperPayload } from "../../content/compiler/compile.ts";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { validateExperiment } from "../../content/schemas/experiment.ts";
import type { SourceJump } from "../../content/schemas/journey.ts";
import type { Argument } from "../../content/schemas/reading.ts";
import type { Alignment, SourceBlock, TranslationUnit } from "../../content/schemas/source.ts";
import { loadPaper } from "../../content/server.ts";
import { REGISTERED_IDS } from "../../experiments/catalogue.ts";
import { LAB_NAMES } from "../actions/labNames.ts";
import { type BilingualEdition, loadBilingualEdition } from "../faces/bilingualLoader.ts";

export type PassageProjectionLink = Readonly<{ href: string; label: string }>;

export type PassageProjection = Readonly<{
  german: readonly PassageProjectionLink[];
  english: readonly PassageProjectionLink[];
  explanation: readonly PassageProjectionLink[];
  instrument: readonly PassageProjectionLink[];
  journey: readonly PassageProjectionLink[];
}>;

export type PassageProjectionIndex = Readonly<{
  bySourceBlock: Readonly<Record<string, PassageProjection>>;
  byArgument: Readonly<Record<string, PassageProjection>>;
  /** An English unit may translate more than one German paragraph. */
  byTranslationUnit: Readonly<Record<string, PassageProjection>>;
}>;

type ProjectionBlock = Pick<SourceBlock, "id" | "paper" | "kind" | "section" | "containedIn"> &
  Readonly<{ sentenceSpans: readonly Readonly<{ id: string }>[] }>;
type ProjectionUnit = Pick<TranslationUnit, "id" | "sourceRefs">;
type ProjectionArgument = Pick<Argument, "id" | "paper" | "section" | "title" | "experiments">;
type ProjectionInstrument = Readonly<{
  id: string;
  title: string;
  sourceRefs: readonly Readonly<{ paper: string; id: string }>[];
  argumentIds: readonly string[];
}>;

export type PassageProjectionInput = Readonly<{
  paperId: string;
  blocks: readonly ProjectionBlock[];
  units: readonly ProjectionUnit[];
  alignment?: Alignment | undefined;
  bindings: readonly ParagraphBinding[];
  arguments: readonly ProjectionArgument[];
  instruments: readonly ProjectionInstrument[];
  /** Only jumps actually rendered by this paper's discovery route belong here. */
  journeyJumps: readonly SourceJump[];
}>;

const emptyProjection = (): PassageProjection => ({
  german: [],
  english: [],
  explanation: [],
  instrument: [],
  journey: [],
});

function uniqueLinks(links: readonly PassageProjectionLink[]): readonly PassageProjectionLink[] {
  const seen = new Set<string>();
  return links.filter(({ href }) => {
    if (seen.has(href)) return false;
    seen.add(href);
    return true;
  });
}

/** Preserve reading order when an English paragraph or an argument covers several passages. */
export function mergePassageProjections(
  projections: readonly (PassageProjection | undefined)[],
): PassageProjection {
  const present = projections.filter((p): p is PassageProjection => p !== undefined);
  const links = (key: keyof PassageProjection) => uniqueLinks(present.flatMap((p) => p[key]));
  return {
    german: links("german"),
    english: links("english"),
    explanation: links("explanation"),
    instrument: links("instrument"),
    journey: links("journey"),
  };
}

/**
 * Pure join: every destination must be present and explicitly related to this passage.
 * The first aligned unit in English reading order is the paragraph's English landing place.
 * Every aligned source is retained in the inverse map, including many-to-many translations.
 */
export function buildPassageProjections(input: PassageProjectionInput): PassageProjectionIndex {
  const { paperId } = input;
  const blocks = input.blocks.filter((b) => b.paper === paperId);
  const units = input.units.filter((u) => u.sourceRefs.some((r) => r.paper === paperId));
  const args = input.arguments.filter((a) => a.paper === paperId);
  const blockById = new Map(blocks.map((b) => [b.id, b]));
  const unitById = new Map(units.map((u) => [u.id, u]));
  const argById = new Map(args.map((a) => [a.id, a]));
  const registered = new Set<string>(REGISTERED_IDS);
  const instruments = input.instruments.filter((i) => registered.has(i.id));
  const bindingByBlock = new Map(input.bindings.map((b) => [b.unit, b]));
  const sourceOwner = new Map<string, string>();
  for (const b of blocks) {
    sourceOwner.set(b.id, b.id);
    for (const s of b.sentenceSpans) sourceOwner.set(s.id, b.id);
  }

  const sourcesByUnit = new Map<string, Set<string>>();
  const connect = (unitId: string, blockId: string) => {
    const sources = sourcesByUnit.get(unitId) ?? new Set<string>();
    sources.add(blockId);
    sourcesByUnit.set(unitId, sources);
  };
  // An authored alignment owns a unit's relations. If it names a missing source or target,
  // do not repair that edge by guessing from the spelling of an id or a section heading.
  const unitsWithAlignment = new Set<string>();
  if (input.alignment?.paper === paperId) {
    for (const edge of input.alignment.edges) {
      const unitId = edge.target.translationUnitId;
      unitsWithAlignment.add(unitId);
      const block = blockById.get(edge.source.blockId);
      if (!block || edge.source.paper !== paperId || !unitById.has(unitId)) continue;
      if (
        edge.source.sentenceId &&
        !block.sentenceSpans.some((s) => s.id === edge.source.sentenceId)
      )
        continue;
      connect(unitId, block.id);
    }
  }
  for (const unit of units) {
    if (unitsWithAlignment.has(unit.id)) continue;
    for (const ref of unit.sourceRefs) {
      if (ref.paper !== paperId) continue;
      const blockId = sourceOwner.get(ref.id);
      if (blockId) connect(unit.id, blockId);
    }
  }

  const unitIdsByBlock = new Map<string, string[]>();
  // The edition's unit order, not alignment-file order, determines the first English sentence.
  for (const unit of units) {
    for (const blockId of sourcesByUnit.get(unit.id) ?? []) {
      const ids = unitIdsByBlock.get(blockId) ?? [];
      ids.push(unit.id);
      unitIdsByBlock.set(blockId, ids);
    }
  }

  const path = `/papers/${encodeURIComponent(paperId)}`;
  const labelOf = (block: ProjectionBlock) =>
    bindingByBlock.get(block.id)?.label ??
    (block.kind === "footnote" ? "Source footnote" : "Source passage");
  const germanLink = (block: ProjectionBlock): PassageProjectionLink => ({
    href: `${path}/view/german/#${encodeURIComponent(block.id)}`,
    label: labelOf(block),
  });
  const englishLinks = (block: ProjectionBlock): readonly PassageProjectionLink[] => {
    const unitId = unitIdsByBlock.get(block.id)?.[0];
    return unitId
      ? [{ href: `${path}/view/english/#${encodeURIComponent(unitId)}`, label: labelOf(block) }]
      : [];
  };
  const explanationLink = (arg: ProjectionArgument): PassageProjectionLink => ({
    href: `${path}/#${encodeURIComponent(arg.id)}`,
    label: arg.title,
  });
  const instrumentLinks = (
    passages: readonly ProjectionArgument[],
    sourceBlocks: readonly ProjectionBlock[],
  ): readonly PassageProjectionLink[] => {
    const argumentIds = new Set(passages.map((a) => a.id));
    const declared = new Set(passages.flatMap((a) => a.experiments));
    const sources = new Set(
      sourceBlocks.flatMap((b) => [b.id, ...b.sentenceSpans.map((s) => s.id)]),
    );
    return uniqueLinks(
      instruments
        .filter(
          (i) =>
            declared.has(i.id) ||
            i.argumentIds.some((id) => argumentIds.has(id)) ||
            i.sourceRefs.some((ref) => ref.paper === paperId && sources.has(ref.id)),
        )
        .map((i) => ({
          href: `/lab/${encodeURIComponent(i.id)}/`,
          label: LAB_NAMES[i.id] ?? i.title,
        })),
    );
  };
  const journeyLinks = (
    passages: readonly ProjectionArgument[],
  ): readonly PassageProjectionLink[] => {
    const byId = new Map(passages.map((a) => [a.id, a]));
    return uniqueLinks(
      input.journeyJumps.flatMap((jump) => {
        const arg = byId.get(jump.targetAnchor);
        if (jump.paperId !== paperId || !arg || (jump.section && jump.section !== arg.section))
          return [];
        return [{ href: `/discover/${paperId}/#${encodeURIComponent(jump.id)}`, label: arg.title }];
      }),
    );
  };
  const argumentsOf = (block: ProjectionBlock): readonly ProjectionArgument[] => {
    const binding = bindingByBlock.get(block.id);
    if (!binding || binding.unexplained) return [];
    return binding.passages.flatMap((id) => {
      const arg = argById.get(id);
      return arg ? [arg] : [];
    });
  };

  const bySourceBlock: Record<string, PassageProjection> = {};
  for (const block of blocks) {
    const passages = argumentsOf(block);
    bySourceBlock[block.id] = {
      german: [germanLink(block)],
      english: englishLinks(block),
      explanation: uniqueLinks(passages.map(explanationLink)),
      instrument: instrumentLinks(passages, [block]),
      journey: journeyLinks(passages),
    };
  }

  const byArgument: Record<string, PassageProjection> = {};
  for (const arg of args) {
    const sources = blocks.filter((b) => argumentsOf(b).some((a) => a.id === arg.id));
    byArgument[arg.id] = {
      german: sources.map(germanLink),
      english: uniqueLinks(sources.flatMap(englishLinks)),
      explanation: [explanationLink(arg)],
      // A shared source paragraph can explain several arguments. Its other arguments' labs
      // and journey jumps do not thereby become projections of this argument.
      instrument: instrumentLinks([arg], sources),
      journey: journeyLinks([arg]),
    };
  }

  const byTranslationUnit: Record<string, PassageProjection> = {};
  for (const unit of units) {
    const sources = sourcesByUnit.get(unit.id) ?? new Set<string>();
    const projections = blocks
      .filter((b) => sources.has(b.id))
      .map((b) => {
        // TranslationParagraphs sets a contained display inside its paragraph. Its menu should
        // still describe that paragraph, not list another "source passage" for each formula.
        // Only explicit containment by an existing same-paper paragraph permits this join.
        const parent = b.containedIn ? blockById.get(b.containedIn) : undefined;
        const owner = b.kind === "equation" && parent?.kind === "paragraph" ? parent : b;
        return bySourceBlock[owner.id];
      });
    const projection =
      projections.length > 0 ? mergePassageProjections(projections) : emptyProjection();
    byTranslationUnit[unit.id] = {
      ...projection,
      english:
        projection.english.length > 0
          ? projection.english
          : [
              {
                href: `${path}/view/english/#${encodeURIComponent(unit.id)}`,
                label: "English passage",
              },
            ],
    };
  }
  return { bySourceBlock, byArgument, byTranslationUnit };
}

/** Load the route's own anchors without importing unrelated journeys and their instruments. */
async function loadJourneyJumps(paperId: string): Promise<readonly SourceJump[]> {
  switch (paperId) {
    case "light-quanta":
      return (await import("../../discovery/lightQuanta/journeyI.ts")).SOURCE_JUMPS;
    case "brownian-motion":
      return (await import("../../discovery/brownian/journeyII.ts")).SOURCE_JUMPS;
    case "special-relativity":
      return (await import("../../discovery/relativity/journeyIII.ts")).SOURCE_JUMPS;
    case "mass-energy":
      return (await import("../../discovery/massEnergy/journeyIV.ts")).SOURCE_JUMPS;
    default:
      return [];
  }
}

function loadInstruments(rootDir: string): readonly ProjectionInstrument[] {
  return REGISTERED_IDS.flatMap((id) => {
    const file = join(rootDir, "content", "experiments", `${id}.yaml`);
    if (!existsSync(file)) return [];
    const instrument = validateExperiment(parseYaml(readFileSync(file, "utf8")), file);
    return instrument.id === id ? [instrument] : [];
  });
}

export type LoadPassageProjectionsOptions = Readonly<{
  edition?: BilingualEdition | null | undefined;
  payload?: PaperPayload | undefined;
  rootDir?: string | undefined;
}>;

/** Reuse an edition or paper already loaded by PaperPage without adding work to the client. */
export async function loadPassageProjections(
  paperId: string,
  options: LoadPassageProjectionsOptions = {},
): Promise<PassageProjectionIndex> {
  const rootDir = options.rootDir ?? process.cwd();
  const [edition, payload, journeyJumps] = await Promise.all([
    options.edition === undefined ? loadBilingualEdition(paperId, rootDir) : options.edition,
    options.payload ?? loadPaper(paperId),
    loadJourneyJumps(paperId),
  ]);
  const source = edition?.paper.slug === paperId ? edition : null;
  const sections = new Set(payload.paper.sections.map((s) => s.id));
  return buildPassageProjections({
    paperId,
    blocks: source?.blocks ?? [],
    units: source?.units ?? [],
    alignment: source?.alignment,
    bindings: loadParagraphBindings(rootDir, paperId) ?? [],
    arguments: payload.arguments.filter((a) => sections.has(a.section)),
    instruments: loadInstruments(rootDir),
    journeyJumps,
  });
}
