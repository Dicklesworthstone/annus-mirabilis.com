/**
 * EACH MANIFEST UNIT'S STATUS, DERIVED FROM THE TREE (am-rc1001-bridge-plan-pcjk.13).
 *
 * AGENTS.md: "The source manifest, not a hand-maintained percentage, determines completeness."
 * am-4cpx derived the four LAYERS from the tree (sourceLayers.ts). The UNIT half stayed vacuous: the
 * report read `unit.status` from manifest.yaml, no manifest fills it in, and on 2026-10-01 all 544
 * units printed `unspecified`. So the authority could never say a paper's blocks were covered,
 * however complete the paper was.
 *
 * A unit is judged on the layers that apply to its kind, in reading order, and its status is the
 * first one it lacks:
 *
 * - TRANSCRIBED: a source block in content/source-blocks/<paper>/ carries it, as the block itself or
 *   as one of the block's sentence spans (Brownian's manifest lists sentences as units).
 * - TRANSLATED: an edge in content/alignments/<paper>.yaml from the unit, or from its block when the
 *   unit is a block, reaches a translation unit that exists with `reviewState: "reviewed"`.
 *   Every unit has an English rendering, mastheads and closings included.
 * - EXPLAINED, for paragraphs, footnotes, sentences and printed displays: content/bindings binds it
 *   to a passage or an equation record. A binding that DECLARES a status with a reason (a paragraph
 *   "unexplained", a display "printed-only") is reported as declared, never as missing and never as
 *   explained. Headings, mastheads and closings explain nothing and are not judged on it.
 *
 * GLOSS is reported beside the status and does not gate it: the plan glosses paper 4 whole and the
 * others' introductions and key sections, so a missing gloss is not a gap in a paragraph's coverage.
 *
 * Reviewed is not a unit status here. The layers carry it (sourceLayers.ts), and no unit is reviewed
 * by a person. "covered" means every applicable layer is present, which is what plan §17.7's "the
 * source manifest reports every block covered" asks.
 *
 * Reads content/, so it is for scripts and tests, never for a page.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "../schemas/strictParse.ts";
import { sourceBlockSpans } from "./sourceLayers.ts";
import type { SourceManifest } from "./types.ts";

export type UnitStatus =
  | "not-transcribed"
  | "not-translated"
  | "not-explained"
  | "covered"
  | "covered-declared";

export type UnitCoverage = Readonly<{
  id: string;
  kind: string;
  status: UnitStatus;
  /** For "covered-declared": the binding's own status and reason. */
  declared?: Readonly<{ status: string; reason: string }> | undefined;
  /** Every sentence the unit holds has a gloss unit. Reported, not gating. */
  glossed: boolean;
}>;

const EXPLAINED_KINDS = new Set(["paragraph", "footnote", "sentence", "display-equation"]);

type Edge = {
  source?: { blockId?: string; sentenceId?: string };
  target?: { translationUnitId?: string };
};
type Binding = {
  unit: string;
  passages?: unknown[];
  equations?: unknown[];
  status?: string;
  reason?: string;
};

function readYaml(path: string): unknown {
  return existsSync(path) ? strictParse(readFileSync(path, "utf8"), "yaml") : undefined;
}

/** Every unit of the manifest with its derived status, in manifest order. */
export function deriveUnitCoverage(root: string, manifest: SourceManifest): UnitCoverage[] {
  const paper = manifest.paper;
  const blocks = sourceBlockSpans(root, paper);
  // A unit id resolves to the block that carries it: the block itself, or the block a span is in.
  const blockOf = new Map<string, string>();
  for (const [blockId, { ids }] of blocks) for (const id of ids) blockOf.set(id, blockId);

  // Translation units by their `id:`, since the files carry an ordering prefix (010-masthead-title).
  const reviewedUnits = new Set<string>();
  const unitDir = join(root, "content", "translation-units", paper);
  for (const file of existsSync(unitDir) ? readdirSync(unitDir) : []) {
    if (!file.endsWith(".yaml")) continue;
    const text = readFileSync(join(unitDir, file), "utf8");
    const id = /^id: "([\w.-]+)"/m.exec(text)?.[1];
    if (id && /^reviewState: "reviewed"/m.test(text)) reviewedUnits.add(id);
  }
  const reviewedUnit = (id: string): boolean => reviewedUnits.has(id);
  const alignment = readYaml(join(root, "content", "alignments", `${paper}.yaml`)) as
    | { edges?: Edge[] }
    | undefined;
  // Ids (block or sentence) from which an edge reaches a reviewed translation unit.
  const translated = new Set<string>();
  for (const edge of alignment?.edges ?? []) {
    const target = edge.target?.translationUnitId;
    if (!target || !reviewedUnit(target)) continue;
    if (edge.source?.sentenceId) translated.add(edge.source.sentenceId);
    if (edge.source?.blockId) translated.add(edge.source.blockId);
  }

  const bindingFile = readYaml(join(root, "content", "bindings", `${paper}.yaml`)) as
    | { paragraphs?: Binding[]; displays?: Binding[] }
    | undefined;
  const bindings = new Map<string, Binding>();
  for (const b of [...(bindingFile?.paragraphs ?? []), ...(bindingFile?.displays ?? [])])
    bindings.set(b.unit, b);

  const glossDir = join(root, "content", "gloss-units", paper);
  const glossed = (id: string): boolean => existsSync(join(glossDir, `${id}.yaml`));

  return manifest.units.map((unit) => {
    const block = blockOf.get(unit.id);
    const spans = block === undefined ? [] : [...(blocks.get(block)?.ids ?? [])];
    // A block's own sentences, or the unit alone when it is a sentence or a one-sentence block.
    const sentences = unit.kind === "sentence" ? [unit.id] : spans.filter((s) => s !== block);
    const unitGlossed =
      sentences.length > 0 ? sentences.every(glossed) : block !== undefined && glossed(block);
    const base = { id: unit.id, kind: unit.kind, glossed: unitGlossed };
    if (block === undefined) return { ...base, status: "not-transcribed" as const };
    const isTranslated =
      translated.has(unit.id) || (unit.kind !== "sentence" && translated.has(block));
    if (!isTranslated) return { ...base, status: "not-translated" as const };
    if (!EXPLAINED_KINDS.has(unit.kind)) return { ...base, status: "covered" as const };
    // A sentence is explained through the paragraph that holds it.
    const binding = bindings.get(unit.kind === "sentence" ? block : unit.id);
    if (binding?.passages?.length || binding?.equations?.length)
      return { ...base, status: "covered" as const };
    if (binding?.status && binding.reason)
      return {
        ...base,
        status: "covered-declared" as const,
        declared: { status: binding.status, reason: binding.reason },
      };
    return { ...base, status: "not-explained" as const };
  });
}
