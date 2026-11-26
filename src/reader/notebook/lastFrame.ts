import { scanPageDescription, splitNotebookPosition, splitPassageSummary } from "./splitPlace.ts";
import { portableClarificationFromSearch } from "../stack/portableTargets.ts";
import {
  type LastPlace,
  NOTEBOOK_PAPERS,
  NOTEBOOK_VIEWS,
  type NotebookFrame,
  parseLastPlace,
  parseNotebookFrame,
} from "./schema.ts";
import { sourceNotebookAnchor, sourceNotebookPassage } from "./sourcePassage.ts";

/** Read navigation metadata and authored prose from the existing reader, never from note text. */
export function frameForPassage(
  passage: HTMLElement,
  location: Pick<Location, "pathname" | "search">,
  root: HTMLElement,
): NotebookFrame | null {
  const paper = /^\/papers\/([^/]+)(?:\/|$)/u.exec(location.pathname)?.[1];
  if (!NOTEBOOK_PAPERS.includes(paper as NotebookFrame["paper"])) return null;
  const query = new URLSearchParams(location.search);
  const readerRoot = root.closest<HTMLElement>("[data-reader-root]");
  const view =
    readerRoot?.dataset.view ??
    readerRoot?.dataset.face ??
    /\/view\/([^/]+)(?:\/|$)/u.exec(location.pathname)?.[1] ??
    query.get("view") ??
    "reading";
  const detailValue = document.documentElement.dataset.detail ?? query.get("detail") ?? "1";
  const detail =
    ({ overview: 0, full: 1, steps: 2 } as Record<string, number>)[detailValue] ??
    Number(detailValue);
  const split = view === "split" ? splitNotebookPosition(passage, location.search) : null;
  try {
    return parseNotebookFrame({
      paper,
      ...(split ? { split } : {}),
      anchor: split && passage.matches("[data-facsimile-reader]")
        ? "split-companion-pane"
        : sourceNotebookAnchor(passage) ?? passage.id,
      view: NOTEBOOK_VIEWS.includes(view as NotebookFrame["view"]) ? view : "reading",
      detail,
      lens:
        document.documentElement.dataset.lens === "modern" || query.get("lens") === "modern"
          ? "modern"
          : "paper",
      open: portableClarificationFromSearch(location.search),
    });
  } catch {
    return null;
  }
}

export function authoredLastPlace(passage: HTMLElement, frame: NotebookFrame): LastPlace | null {
  const source = sourceNotebookPassage(passage, frame.paper);
  const page = frame.split ? scanPageDescription(passage) : null;
  const title = page ?? passage.querySelector("h3")?.textContent?.trim() ?? "";
  const recap =
    (frame.split ? splitPassageSummary(passage) : null) ??
    passage.querySelector("[data-face-results] > p")?.textContent?.trim() ??
    "";
  const overview = [...passage.querySelectorAll('[data-reading="0"] > p')]
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");
  try {
    if (source)
      return parseLastPlace({
        frame,
        title: source.title,
        recap: source.excerpt,
        recapKind: "source-excerpt",
      });
    return parseLastPlace({
      frame,
      title,
      recap: recap || overview,
      recapKind: page ? "page-location" : recap ? "authored-recap" : "overview",
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
