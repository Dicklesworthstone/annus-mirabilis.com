/**
 * THE GERMAN FACE PUBLISHES THE FROZEN MANIFEST'S IDS (am-german-face-anchors-not-frozen-ids-jtv6).
 *
 * The ledger's segmenter names blocks as it meets them: paragraphs s0-p1, s0-p2... by count, and
 * displays s0-eq1... by count. Those are good ids for the pipeline and wrong ones to publish. The
 * frozen manifest never renumbers: a paragraph found later took the next free number, a retired one
 * keeps its number for ever (content/aliases), and displays are eq-s0-d1. So on mass-energy the face
 * published s0-p9 to s0-p13 for the paragraphs the manifest calls s0-p11 to s0-p15, reusing ids the
 * manifest retired, and every display anchor was a name no other face or record uses.
 *
 * The blocks keep their segment ids; this says which manifest id each one is published under.
 * Paragraphs and footnotes pair with the manifest's in print order, and only when the counts agree
 * and every pair starts on the same printed page: pairing by number would be wrong, because the
 * manifest's numbers are not in print order (light quanta's §5 runs p1, p2, p6, p3, p4, p7, p8, p5).
 * Displays pair by the rule the page map already uses (blockPages.ts pairDisplays). Anything left
 * unpaired refuses, typed, rather than publishing a guess.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";
import { pairDisplays } from "./blockPages.ts";
import type { JoinedBlock, ManifestUnit } from "./joinContinuations.ts";

export class ManifestAnchorError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ManifestAnchorError";
  }
}

export type ManifestAnchors = Readonly<{
  /** Face block or display id to the manifest id it is published under. */
  anchorOf: Readonly<Record<string, string>>;
  /** Retired manifest id to the published id that absorbed it (content/aliases/<paper>.yaml). */
  aliases: Readonly<Record<string, string>>;
}>;

/** Blocks the manifest names exactly as the segmenter does. */
const SAME_ID_KINDS = new Set([
  "masthead-title",
  "masthead-author",
  "heading",
  "part-heading",
  "closing-dateline",
  "closing-ack",
  "closing-received",
]);

/**
 * The manifest id each face block and display is published under. `pages` is the printed page
 * each face block starts on (blockStartPages); `aliasPath` is the paper's content/aliases file.
 */
export function manifestAnchors(
  paper: string,
  blocks: readonly JoinedBlock[],
  units: readonly ManifestUnit[],
  pages: Readonly<Record<string, number>>,
  aliasPath?: string,
): ManifestAnchors {
  const problems: string[] = [];
  const anchorOf: Record<string, string> = {};
  const manifestIds = new Set(units.map((u) => u.id));

  for (const block of blocks)
    if (SAME_ID_KINDS.has(block.kind)) {
      if (manifestIds.has(block.id)) anchorOf[block.id] = block.id;
      else problems.push(`${block.kind} ${block.id} is not a manifest id`);
    }

  for (const kind of ["paragraph", "footnote"] as const) {
    const face = blocks.filter((b) => b.kind === kind);
    const manifest = units.filter((u) => u.kind === kind);
    if (face.length !== manifest.length) {
      problems.push(`${face.length} ${kind}s on the face, ${manifest.length} in the manifest`);
      continue;
    }
    face.forEach((block, i) => {
      const unit = manifest[i] as ManifestUnit;
      const page = pages[block.id];
      if (page !== undefined && unit.page !== undefined && page !== unit.page)
        problems.push(`${kind} ${block.id} starts on p. ${page}, ${unit.id} on p. ${unit.page}`);
      else anchorOf[block.id] = unit.id;
    });
  }

  const displays = pairDisplays(blocks, units);
  for (const block of blocks)
    for (const id of block.kind === "equation" ? [block.id] : (block.displayEquationIds ?? [])) {
      const unit = displays[id];
      if (unit) anchorOf[id] = unit.id;
      else problems.push(`display ${id} pairs with no manifest display`);
    }

  const published = new Set<string>();
  for (const id of Object.values(anchorOf)) {
    if (published.has(id)) problems.push(`two face blocks are published as ${id}`);
    published.add(id);
  }
  for (const block of blocks)
    if (anchorOf[block.id] === undefined && !problems.some((p) => p.includes(block.id)))
      problems.push(`${block.kind} ${block.id} has no manifest id`);

  if (problems.length > 0) {
    throw new ManifestAnchorError(
      "manifest-anchors-unpaired",
      `The German face of ${paper} cannot publish the frozen manifest's ids: ${problems
        .slice(0, 5)
        .join("; ")}${problems.length > 5 ? `; and ${problems.length - 5} more` : ""}.`,
    );
  }
  return { anchorOf, aliases: declaredAliases(aliasPath, published) };
}

/**
 * Each retired id whose replacement the face publishes, pointing at it, so a link made before the
 * id retired lands on the text that absorbed it. A retired id is never published for anything else.
 */
function declaredAliases(
  path: string | undefined,
  published: ReadonlySet<string>,
): Record<string, string> {
  if (!path || !existsSync(path)) return {};
  const file = parseYaml(readFileSync(path, "utf8")) as {
    aliases?: readonly { retiredId?: unknown; replacementIds?: unknown }[];
  } | null;
  const out: Record<string, string> = {};
  for (const alias of file?.aliases ?? []) {
    const target = Array.isArray(alias.replacementIds) ? alias.replacementIds[0] : undefined;
    if (typeof alias.retiredId !== "string" || typeof target !== "string") continue;
    if (published.has(alias.retiredId) || !published.has(target)) continue;
    out[alias.retiredId] = target;
  }
  return out;
}

/** The paper's declared aliases file. */
export function aliasPathFor(root: string, paper: string): string {
  return join(root, "content", "aliases", `${paper}.yaml`);
}
