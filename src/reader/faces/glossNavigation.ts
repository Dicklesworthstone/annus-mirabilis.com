import { parseAnchor } from "../../content/anchors.ts";
import { parseFaceSwitchTransfer } from "../anchors/faceSwitchPlace.ts";
import { canonicalContentId, contentIdVariants } from "../weave/contentIds.ts";

/** A route-local projection, carried in HTML rather than imported into the reading bundle. */
export const GLOSS_ANCHOR_SECTIONS_ATTRIBUTE = "data-gloss-anchor-sections";

function glossRoute(path: string) {
  if (path.includes("#")) return null;
  const query = path.indexOf("?");
  const pathname = query < 0 ? path : path.slice(0, query);
  const match = /^\/papers\/([a-z][a-z0-9-]*)\/(?:(s\d+)\/)?view\/gloss\/?$/.exec(pathname);
  return match
    ? { paper: match[1], section: match[2], search: query < 0 ? "" : path.slice(query) }
    : null;
}

/**
 * Find the page which actually prints an absent gloss address. The declared placement covers
 * equations such as eq-A, part headings, and closing lines; their spelling cannot locate them.
 * Unknown addresses and ambiguous placements stay put. Only this paper's gloss routes can result.
 */
export function glossPageForStrandedAnchor(
  anchor: string,
  currentPath: string,
  serializedSections: string,
): string | null {
  const route = glossRoute(currentPath);
  if (!route || anchor.startsWith("#") || !parseAnchor(anchor).ok) return null;
  let value: unknown;
  try {
    value = JSON.parse(serializedSections);
  } catch {
    return null;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const variants = new Set(contentIdVariants(anchor));
  let destination: string | undefined;
  for (const [section, ids] of Object.entries(value)) {
    if (
      !/^s\d+$/.test(section) ||
      !Array.isArray(ids) ||
      !ids.every((id) => typeof id === "string")
    )
      return null;
    if (!ids.some((id) => variants.has(id))) continue;
    if (destination !== undefined && destination !== section) return null;
    destination = section;
  }
  if (destination === undefined || destination === route.section) return null;
  return `/papers/${route.paper}/${destination}/view/gloss/${route.search}#${encodeURIComponent(anchor)}`;
}

/** Keep an optional viewport fraction through the intermediate whole-paper gloss page. */
export function glossRedirectTransfer(
  value: unknown,
  currentPath: string,
  currentHash: string,
  destination: string,
) {
  const from = glossRoute(currentPath);
  const hashAt = destination.indexOf("#");
  if (hashAt < 0) return null;
  const path = destination.slice(0, hashAt);
  const to = glossRoute(path);
  if (!from || !to || from.paper !== to.paper || from.search !== to.search) return null;
  const snapshot = parseFaceSwitchTransfer(value, currentPath, currentHash, canonicalContentId);
  if (!snapshot) return null;
  const target = parseFaceSwitchTransfer(
    { ...snapshot, path },
    path,
    destination.slice(hashAt),
    canonicalContentId,
  );
  return target ? { ...target, path } : null;
}
