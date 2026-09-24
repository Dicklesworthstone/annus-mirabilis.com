import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadGermanSourceFace } from "./editions/germanSourceFace.ts";
import { PAPER_BIB_KEYS } from "./editions/ledgerPresence.ts";
import type { RouteSlug } from "./ids.ts";
import { nameInSentence } from "./translationState.ts";

/*
 * WHERE EACH PAPER'S GERMAN TEXT STANDS, from the same loader the German face renders from
 * (dispatch 153). The home page, its first-pages caption and /papers/ each typed this as a fixed
 * sentence ("set for three of the four", "German text set"); relativity's ledger was being drafted
 * page by page while those sentences stood still. Now they read it.
 *
 *   reviewed          the German face renders a ledger a named reviewer has checked;
 *   draft             the German face renders a machine draft with hand correction;
 *   in-transcription  a ledger file exists, but the receipt keeps it off the German face;
 *   not-started       no ledger file exists.
 */
export type GermanTextState = "reviewed" | "draft" | "in-transcription" | "not-started";

export function germanTextState(slug: RouteSlug, root: string = process.cwd()): GermanTextState {
  const face = loadGermanSourceFace(slug, root);
  if (face) return face.notice.state === "reviewed" ? "reviewed" : "draft";
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

/** The home page's sentences on the German text, one clause per state that has papers in it. */
export function germanTextSentences(papers: readonly PaperGermanState[]): string {
  const named = (state: GermanTextState) =>
    papers.filter((p) => p.state === state).map((p) => nameInSentence(p.title));
  const sentences: string[] = [];
  const reviewed = named("reviewed");
  const drafted = named("draft");
  if (reviewed.length > 0)
    sentences.push(
      `The German text of the ${listOf(reviewed)} ${reviewed.length === 1 ? "paper" : "papers"} is set and reviewed.`,
    );
  if (drafted.length > 0)
    sentences.push(
      `The German text is set, as ${drafted.length === 1 ? "an unreviewed draft" : "unreviewed drafts"}, for the ${listOf(drafted)} ${drafted.length === 1 ? "paper" : "papers"}.`,
    );
  for (const name of named("in-transcription"))
    sentences.push(
      `The ${name} paper is still being transcribed from the printed plates, a page at a time, and its German face says so.`,
    );
  for (const name of named("not-started"))
    sentences.push(`The German text of the ${name} paper has not been started.`);
  return sentences.join(" ");
}

/** The first-pages caption's clause: how many of the four have their German text set. */
export function germanTextCount(papers: readonly PaperGermanState[]): string {
  const set = papers.filter((p) => p.state === "draft" || p.state === "reviewed");
  const reviewed = papers.filter((p) => p.state === "reviewed").length;
  const count = `${NUMBER_WORDS[set.length] ?? set.length} of the ${NUMBER_WORDS[papers.length] ?? papers.length}`;
  if (set.length === 0)
    return `The German text is set for none of the ${NUMBER_WORDS[papers.length] ?? papers.length} papers yet.`;
  return reviewed === 0
    ? `The German text is set for ${count}, as ${set.length === 1 ? "an unreviewed draft" : "unreviewed drafts"}.`
    : `The German text is set for ${count}, ${reviewed} of them reviewed.`;
}
