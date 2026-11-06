import { sectionAnchorOf } from "../../content/anchors.ts";
import { contentIdFromDomId } from "../anchors/paneIds.ts";
import { parseSplitPanesFromSearch } from "../viewMode.ts";

export type SplitSource = "parallel" | "german" | "english";
export type SplitCompanion = "reading" | "results";
export type SplitPane = "source" | "companion";
export interface SplitSelection {
  readonly source: SplitSource;
  readonly companion: SplitCompanion;
  readonly reversed: boolean;
}

export const DEFAULT_SELECTION: SplitSelection = {
  source: "parallel",
  companion: "reading",
  reversed: false,
};

export const SOURCE_LABELS: Readonly<Record<SplitSource, string>> = {
  parallel: "German and English",
  german: "German source",
  english: "English translation",
};
export const COMPANION_LABELS: Readonly<Record<SplitCompanion, string>> = {
  reading: "Explanation",
  results: "Results",
};

const isSource = (face: string): face is SplitSource =>
  face === "parallel" || face === "german" || face === "english";
const isCompanion = (face: string): face is SplitCompanion =>
  face === "reading" || face === "results";

/** Reuse the reader's allowlist, then require a pair this renderer can actually show. */
export function splitSelectionFromSearch(search: string): {
  selection: SplitSelection;
  notice: string;
} {
  if (search.length > 4096) {
    return {
      selection: DEFAULT_SELECTION,
      notice: "The split settings could not be read. Showing the bilingual source and explanation.",
    };
  }
  const params = new URLSearchParams(search);
  const raw = params.getAll("panes");
  const [left, right] = parseSplitPanesFromSearch(search);
  if (raw.length > 0 && (raw.length !== 1 || raw[0] !== `${left},${right}`)) {
    return {
      selection: DEFAULT_SELECTION,
      notice: "The split settings could not be read. Showing the bilingual source and explanation.",
    };
  }
  if (isSource(left) && isCompanion(right)) {
    return { selection: { source: left, companion: right, reversed: false }, notice: "" };
  }
  if (isCompanion(left) && isSource(right)) {
    return { selection: { source: right, companion: left, reversed: true }, notice: "" };
  }
  return {
    selection: DEFAULT_SELECTION,
    notice:
      "This split view pairs a German, English, or bilingual source with Explanation or Results. The requested pair is unavailable here. Showing the bilingual source and explanation; other faces remain available above.",
  };
}

/** Change only the split choice; detail, notation, passage and other reader state survive. */
export function withSplitSelection(url: URL, selection: SplitSelection): URL {
  const next = new URL(url);
  const pair = [selection.source, selection.companion];
  if (selection.reversed) pair.reverse();
  next.searchParams.set("panes", pair.join(","));
  return next;
}

export interface SplitLocation {
  readonly paper: string;
  readonly section: string;
  readonly sections: readonly string[];
  readonly argumentSections: Readonly<Record<string, string>>;
  /** Canonical static routes are supplied by the server's existing route owner. */
  readonly sectionHrefs: Readonly<Record<string, string>>;
  readonly faceHrefs: Readonly<Record<SplitSource | SplitCompanion, string>>;
}

/** Whole-paper split opens one section. A deep link to another goes to its static section page. */
export function splitSectionDestination(url: URL, scope: SplitLocation): URL | null {
  let id: string;
  try {
    id = decodeURIComponent(url.hash.slice(1));
  } catch {
    return null;
  }
  if (id.length > 240) return null;
  id = contentIdFromDomId(id).replace(/^en-/, "");
  const section = scope.argumentSections[id] ?? sectionAnchorOf(id);
  if (!section || section === scope.section || !scope.sections.includes(section)) return null;
  const href = scope.sectionHrefs[section];
  if (!href) return null;
  const next = new URL(url);
  next.pathname = href;
  return next;
}
