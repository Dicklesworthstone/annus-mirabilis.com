import { splitSelectionFromSearch } from "../split/selection.ts";
import { isNotebookScanTarget, type NotebookSplit } from "./schema.ts";

export const SPLIT_NOTEBOOK_PASSAGES = [
  "[data-split-explanation] article.split-argument[id]",
  "[data-split-results] article.result-card[id]",
  "[data-split-comparison] [data-facsimile-reader]",
].join(", ");

function selectedPage(root: Element) {
  return root.querySelector<HTMLElement>('[data-facsimile-page-link][aria-current="page"]');
}

/** Read the actual selected page, never the editable page-number input or the React instance id. */
export function scanPageDescription(passage: HTMLElement): string | null {
  if (!passage.matches("[data-facsimile-reader]")) return null;
  const page = selectedPage(passage);
  return page ? `Original journal scan, printed page ${page.textContent?.trim()}` : null;
}

/** Use only the public controls of the split reader. Notes, private query fields and edit drafts stay out. */
export function splitNotebookPosition(passage: HTMLElement, search: string): NotebookSplit | null {
  const root = passage.closest<HTMLElement>("[data-split-comparison]");
  const section = root?.dataset.splitSection;
  const pane = passage.closest<HTMLElement>("[data-split-role]")?.dataset.splitRole;
  if (!root || !section || (pane !== "source" && pane !== "companion")) return null;
  const { selection } = splitSelectionFromSearch(search);
  const panes = selection.reversed
    ? [selection.companion, selection.source]
    : [selection.source, selection.companion];
  let scan = "";
  if (selection.companion === "facsimile") {
    const target = root.dataset.splitScanTarget;
    scan = target && isNotebookScanTarget(target) ? target : selectedPage(root)?.dataset.facsimileTarget ?? "";
  }
  return { section, panes: panes.join(","), pane, scan };
}

export function splitPassageSummary(passage: HTMLElement): string | null {
  const page = scanPageDescription(passage);
  if (page) return page;
  if (passage.matches(".result-card")) {
    const sentence = passage.querySelector('[data-result-layer="one-sentence"]') ?? passage.querySelector("h3");
    return sentence?.textContent?.trim() ?? null;
  }
  return passage.dataset.notebookRecap ?? null;
}
