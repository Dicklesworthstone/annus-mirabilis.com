import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadGermanSourceFace, printedUnits } from "./editions/germanSourceFace.ts";
import {
  ledgerPageCoverage,
  ledgerRelativePath,
  PAPER_BIB_KEYS,
} from "./editions/ledgerPresence.ts";
import type { RouteSlug } from "./ids.ts";
import { parseYaml } from "./provenance/yaml.ts";
import { nameInSentence } from "./translationState.ts";

/*
 * WHERE EACH PAPER'S GERMAN TEXT STANDS, from the same loader the German face renders from
 * (dispatch 153). The home page, its first-pages caption and /papers/ each typed this as a fixed
 * sentence ("set for three of the four", "German text set"); relativity's ledger was being drafted
 * page by page while those sentences stood still. Now they read it.
 *
 *   reviewed          the German face renders a whole text a named reviewer has checked;
 *   draft             the German face renders a whole text, a machine draft with hand correction;
 *   in-transcription  a ledger or some blocks exist, but the German face does not yet have them all;
 *   not-started       nothing exists.
 *
 * It asks what the German face renders, by PaperPage's own rule: the ledger draft face, unless
 * every source block is reviewed; otherwise the edition's source blocks (GermanFace). Relativity
 * has no ledger draft face and renders its blocks, and this said "still being transcribed" of all
 * 31 pages because it asked only the ledger loader.
 */
export type GermanTextState = "reviewed" | "draft" | "in-transcription" | "not-started";

type BlockRecord = Readonly<{
  section?: string;
  status?: Readonly<{ transcription?: string; review?: string }>;
}>;

/** The paper's source-block records (content/source-blocks/<slug>/*.yaml), the manifest aside. */
function sourceBlocks(root: string, slug: RouteSlug): readonly BlockRecord[] {
  const dir = join(root, "content", "source-blocks", slug);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".yaml") && file !== "manifest.yaml")
    .map((file) => (parseYaml(readFileSync(join(dir, file), "utf8")) ?? {}) as BlockRecord);
}

/** faceAvailability.ts sourceBlockIsReviewed, restated so content does not import the reader. */
const blockReviewed = (b: BlockRecord) =>
  b.status?.transcription === "reviewed" &&
  (b.status.review === "reviewed" || b.status.review === "accepted");

export function germanTextState(slug: RouteSlug, root: string = process.cwd()): GermanTextState {
  const blocks = sourceBlocks(root, slug);
  const allReviewed = blocks.length > 0 && blocks.every(blockReviewed);
  const face = loadGermanSourceFace(slug, root);
  if (face && !allReviewed) return face.notice.state === "reviewed" ? "reviewed" : "draft";
  if (blocks.length > 0) {
    // Set only when the blocks reach every printed section and the ledger no printed page is
    // missing from, as the German face's own notices would otherwise say.
    const present = new Set(blocks.map((b) => b.section));
    const sections = [
      ...new Set(printedUnits(root, slug).flatMap((u) => (u.section ? [u.section] : []))),
    ].filter((s) => /^s\d+$/.test(s));
    const ledger = join(root, ledgerRelativePath(slug, root));
    const untranscribed = existsSync(ledger)
      ? ledgerPageCoverage(readFileSync(ledger, "utf8")).filter(
          // As ledgerGaps counts them for the German face's notice: numbered pages only.
          (p) => !p.covered && p.printedPage !== undefined,
        ).length
      : 0;
    if (sections.every((s) => present.has(s)) && untranscribed === 0)
      return allReviewed ? "reviewed" : "draft";
    return "in-transcription";
  }
  const key = PAPER_BIB_KEYS[slug];
  const dir = join(root, "public", "papers", "transcripts");
  return existsSync(join(dir, `${key}-machine-draft.txt`)) ||
    existsSync(join(dir, `${key}-reviewed.txt`))
    ? "in-transcription"
    : "not-started";
}

export type PaperGermanState = Readonly<{ title: string; state: GermanTextState }>;

const NUMBER_WORDS = ["no", "one", "two", "three", "four"];

/** "a", "a and b", "a, b and c". */
function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The home page's sentences on the German text: which papers have it, and which do not yet. They say
 * what the site contains and nothing of review (D-2026-09-25-no-review-status-banners), so a reviewed
 * text and a draft are both "set".
 */
export function germanTextSentences(papers: readonly PaperGermanState[]): string {
  const named = (...states: GermanTextState[]) =>
    papers.filter((p) => states.includes(p.state)).map((p) => nameInSentence(p.title));
  const sentences: string[] = [];
  const set = named("reviewed", "draft");
  if (set.length > 0)
    sentences.push(
      `The German text is set for the ${listOf(set)} ${set.length === 1 ? "paper" : "papers"}.`,
    );
  for (const name of named("in-transcription"))
    sentences.push(
      `The ${name} paper is still being transcribed from the printed plates, a page at a time, and its German face says so.`,
    );
  for (const name of named("not-started"))
    sentences.push(`The German text of the ${name} paper has not been started.`);
  return sentences.join(" ");
}

/** The first-pages caption's clause: how many of the four have their German text set, no more. */
export function germanTextCount(papers: readonly PaperGermanState[]): string {
  const set = papers.filter((p) => p.state === "draft" || p.state === "reviewed");
  const count = `${NUMBER_WORDS[set.length] ?? set.length} of the ${NUMBER_WORDS[papers.length] ?? papers.length}`;
  if (set.length === 0)
    return `The German text is set for none of the ${NUMBER_WORDS[papers.length] ?? papers.length} papers yet.`;
  return `The German text is set for ${count}.`;
}
