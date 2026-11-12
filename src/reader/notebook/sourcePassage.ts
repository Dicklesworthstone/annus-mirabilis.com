import { sourceUnitLabel } from "../facsimile/sourceUnitLabel.ts";
import type { NotebookPaper } from "./schema.ts";

/** Source paragraphs are different DOM owners from the explanatory reader's articles. */
export const SOURCE_NOTEBOOK_PASSAGES = [
  ".source-paragraph[id]",
  "p.translation-paragraph[data-source-paragraph]",
  ".gloss-block-wrapper[id][data-block-id] > section.gloss-sentence[id]",
].join(", ");

export type SourceNotebookPassage = Readonly<{
  anchor: string;
  title: string;
  excerpt: string;
}>;

function sourceFace(passage: HTMLElement): string | null {
  const root = passage.closest<HTMLElement>("[data-reader-root]");
  const face = root?.dataset.view ?? root?.dataset.face;
  return face && ["german", "english", "parallel", "gloss"].includes(face) ? face : null;
}

/** Keep the actual English-column namespace; it addresses a different half of a parallel row. */
export function sourceNotebookAnchor(passage: HTMLElement): string | null {
  if (!sourceFace(passage) || !passage.matches(SOURCE_NOTEBOOK_PASSAGES)) return null;
  return (
    passage.id || passage.querySelector<HTMLElement>("[data-translation-unit-id][id]")?.id || null
  );
}

function textExcerpt(passage: HTMLElement): string {
  const clone = passage.cloneNode(true) as HTMLElement;
  // A saved excerpt contains the passage, not its controls, locators or duplicate math layers.
  for (const item of clone.querySelectorAll(
    "script, style, button, nav, .notebook-passage-actions, .block-locator, .page-turn-mark, .show-aligned-action, .footnote-ref, .footnote-backlink, [role=tooltip], .block-editorial-notes, .unit-editorial-notes",
  ))
    item.remove();
  for (const formula of clone.querySelectorAll('[role="math"], .katex')) {
    if (clone.contains(formula)) formula.replaceWith(" [formula] ");
  }
  return clone.textContent ?? "";
}

function boundedExcerpt(text: string): string {
  const words = text.replace(/\s+/gu, " ").trim();
  if (words.length <= 700) return words;
  const start = words.slice(0, 700);
  const boundary = start.lastIndexOf(" ");
  return `${start.slice(0, boundary > 0 ? boundary : 699)}…`;
}

/** A bounded quotation of rendered source text, explicitly distinguished from an authored recap. */
export function sourceNotebookPassage(
  passage: HTMLElement,
  paper: NotebookPaper,
): SourceNotebookPassage | null {
  const anchor = sourceNotebookAnchor(passage);
  if (!anchor) return null;
  const gloss = passage.matches(".gloss-sentence");
  const english = passage.matches(".translation-paragraph");
  const label = gloss
    ? "German text in the gloss"
    : english
      ? "English translation"
      : "German source";
  // The gloss renderer already supplies its continuous German sentence for the reading action.
  // Reading the interlinear container's text would interleave German, glosses and grammar notes.
  const spokenGerman = passage
    .querySelector('[data-action="read-german"]')
    ?.getAttribute("aria-label");
  const excerpt = boundedExcerpt(
    gloss && spokenGerman?.startsWith("Read the German sentence: ")
      ? spokenGerman.slice("Read the German sentence: ".length)
      : textExcerpt(passage.querySelector<HTMLElement>(".sentence-german-unadorned") ?? passage),
  );
  if (!excerpt) return null;
  const sourceId = passage.dataset.sourceParagraph ?? anchor.replace(/^en-/u, "");
  const location = sourceUnitLabel(
    sourceId,
    gloss ? "sentence" : "paragraph",
    paper !== "mass-energy",
  );
  return Object.freeze({
    anchor,
    title: `${label}: ${location}`,
    excerpt: `${label} excerpt${excerpt.includes("[formula]") ? " ([formula] marks omitted mathematics)" : ""}:\n${excerpt}`,
  });
}
