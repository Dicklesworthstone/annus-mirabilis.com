import {
  type LastPlace,
  NOTEBOOK_PAPERS,
  NOTEBOOK_VIEWS,
  type NotebookFrame,
  parseLastPlace,
  parseNotebookFrame,
} from "./schema.ts";

/** Read navigation metadata and authored prose from the existing reader, never from note text. */
export function frameForPassage(
  passage: HTMLElement,
  location: Pick<Location, "pathname" | "search">,
  root: HTMLElement,
): NotebookFrame | null {
  const paper = /^\/papers\/([^/]+)(?:\/|$)/u.exec(location.pathname)?.[1];
  if (!NOTEBOOK_PAPERS.includes(paper as NotebookFrame["paper"])) return null;
  const query = new URLSearchParams(location.search);
  const view =
    root.closest<HTMLElement>("[data-reader-root]")?.dataset.view ?? query.get("view") ?? "reading";
  const detailValue = document.documentElement.dataset.detail ?? query.get("detail") ?? "1";
  const detail =
    ({ overview: 0, full: 1, steps: 2 } as Record<string, number>)[detailValue] ??
    Number(detailValue);
  try {
    return parseNotebookFrame({
      paper,
      anchor: passage.id,
      view: NOTEBOOK_VIEWS.includes(view as NotebookFrame["view"]) ? view : "reading",
      detail,
      lens:
        document.documentElement.dataset.lens === "modern" || query.get("lens") === "modern"
          ? "modern"
          : "paper",
      open: "",
    });
  } catch {
    return null;
  }
}

export function authoredLastPlace(passage: HTMLElement, frame: NotebookFrame): LastPlace | null {
  const title = passage.querySelector("h3")?.textContent?.trim() ?? "";
  const recap = passage.querySelector("[data-face-results] > p")?.textContent?.trim() ?? "";
  const overview = [...passage.querySelectorAll('[data-reading="0"] > p')]
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");
  try {
    return parseLastPlace({
      frame,
      title,
      recap: recap || overview,
      recapKind: recap ? "authored-recap" : "overview",
    });
  } catch {
    return null;
  }
}

/** Explicit arrivals must never be redirected or covered by a full recap. */
export function shouldUseCompactRecap(last: LastPlace, pathname: string, hash: string): boolean {
  if (!hash || hash === "#") return false;
  let anchor: string;
  try {
    anchor = decodeURIComponent(hash.slice(1));
  } catch {
    return true;
  }
  return !pathname.startsWith(`/papers/${last.frame.paper}/`) || anchor !== last.frame.anchor;
}
