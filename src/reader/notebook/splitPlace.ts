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
    const viewer = root.querySelector<HTMLElement>("[data-facsimile-reader]");
    if (!viewer) {
      // The verified map is fetched on demand. Keep the reader's public target while it loads.
      if (target && isNotebookScanTarget(target)) scan = target;
    } else {
      // If the map could not resolve that passage, remember the page the viewer actually shows.
      scan = target && target === viewer.dataset.facsimileResolvedTarget && isNotebookScanTarget(target)
        ? target
        : selectedPage(viewer)?.dataset.facsimileTarget ?? "";
    }
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
