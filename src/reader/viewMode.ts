/**
 * Face (`?view=`) parsing and URL computation, ported and generalized from
 * the donor's `viewModeFromSearch`/`applyPatentViewToUrl` (AGENTS.md,
 * "Relationship to the Donor Projects"). Every function here is pure: no DOM
 * access, no history mutation. Callers push or replace history themselves,
 * exactly once per face change, using the string this module returns.
 */
import {
  DEFAULT_FACE,
  DEFAULT_SPLIT_PANES,
  type FaceId,
  isFaceId,
  isSplittableFaceId,
  type SplittableFaceId,
} from "./faces/registry";

export const VIEW_PARAM = "view";
export const PANES_PARAM = "panes";

export type SplitPanes = readonly [SplittableFaceId, SplittableFaceId];

/**
 * The requested face. Unknown, missing, or repeated `view` values fall back
 * to `reading` — the caller never writes that fallback back into the URL.
 */
export function parseViewFromSearch(search: string): FaceId {
  const params = new URLSearchParams(search);
  const values = params.getAll(VIEW_PARAM);
  if (values.length !== 1) return DEFAULT_FACE;
  const value = values[0];
  return isFaceId(value) ? value : DEFAULT_FACE;
}

/**
 * The requested split pane pair. An invalid, incomplete, degenerate (both
 * panes equal), or missing `panes` value falls back to the default pair.
 */
export function parseSplitPanesFromSearch(search: string): SplitPanes {
  const params = new URLSearchParams(search);
  const values = params.getAll(PANES_PARAM);
  const raw = values.length === 1 ? values[0] : undefined;
  if (raw === undefined) return DEFAULT_SPLIT_PANES;
  const parts = raw.split(",");
  if (parts.length !== 2) return DEFAULT_SPLIT_PANES;
  const [left, right] = parts;
  if (!isSplittableFaceId(left) || !isSplittableFaceId(right) || left === right) {
    return DEFAULT_SPLIT_PANES;
  }
  return [left, right];
}

export type ParsedViewMode = Readonly<{
  view: FaceId;
  panes: SplitPanes;
}>;

/** Convenience wrapper combining the two parses for a single `location.search`. */
export function viewModeFromSearch(search: string): ParsedViewMode {
  return Object.freeze({
    view: parseViewFromSearch(search),
    panes: parseSplitPanesFromSearch(search),
  });
}

/**
 * The next `pathname?search#hash` for a face change, preserving every other
 * query key and the hash exactly, and never emitting the fallback face or
 * pane pair back into the URL unless the caller explicitly asks for them
 * (an explicit `view=reading` is a legitimate deep link, not noise; the
 * fallback-not-written-back rule applies to invalid input, not to reading
 * being the default).
 */
export function applyViewToUrl(
  currentHref: string,
  next: { view: FaceId; panes?: SplitPanes },
): string {
  const url = new URL(currentHref, "https://reader.invalid");
  if (next.view === DEFAULT_FACE) url.searchParams.delete(VIEW_PARAM);
  else url.searchParams.set(VIEW_PARAM, next.view);
  if (next.view === "split" && next.panes) {
    url.searchParams.set(PANES_PARAM, `${next.panes[0]},${next.panes[1]}`);
  } else {
    url.searchParams.delete(PANES_PARAM);
  }
  return url.pathname + (url.search ? url.search : "") + url.hash;
}

/**
 * The canonical href for a route: strips `view`, `panes`, and every other
 * state parameter (`detail`, `lens`, `notation`, `units`, `open`, `tape`),
 * per this bead's canonical-URL policy. Document URLs never multiply into
 * an index of slider positions.
 */
const CANONICAL_STRIPPED_PARAMS = [
  VIEW_PARAM,
  PANES_PARAM,
  "detail",
  "lens",
  "notation",
  "units",
  "open",
  "tape",
] as const;

export function canonicalHref(currentHref: string): string {
  const url = new URL(currentHref, "https://reader.invalid");
  for (const param of CANONICAL_STRIPPED_PARAMS) url.searchParams.delete(param);
  return url.pathname + (url.search ? url.search : "") + url.hash;
}
