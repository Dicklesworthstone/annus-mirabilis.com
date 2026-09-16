/**
 * printPolicy.ts
 *
 * Essential-for-print policy and visibility rules for Annus Mirabilis chapters.
 *
 * Requirements:
 * 1. The reading at the chosen Detail always prints.
 * 2. The source-order derivation route of each printed equation card prints expanded.
 * 3. Side-door routes (discovery, pedagogical-reconstruction) print collapsed to their
 *    title and route label unless essentialForPrint is true.
 * 4. Misconception callouts and foundation drawers are omitted unless essentialForPrint is true.
 * 5. An authored essentialForPrint: true on any of the three carriers (ReadingSet,
 *    Misconception, DerivationChain) overrides the default that would drop it.
 * 6. Tool links inside a printed derivation step emit a reference line naming the
 *    foundation and its URL instead of the expanded foundation.
 * 7. Field ownership rule: essentialForPrint is read from compiled records, never declared here.
 *
 * Spec: AGENTS.md §6.2, §15.4, §15.5 and am-plat-print-3orn
 */

export type DetailLevel = 0 | 1 | 2 | 3;
export type PerspectiveKind = "paper" | "modern";
export type DerivationRouteKind =
  | "source-order"
  | "discovery"
  | "pedagogical-reconstruction"
  | string;

export interface PrintPolicyOptions {
  readonly detail: DetailLevel;
  readonly perspective?: PerspectiveKind | undefined;
  readonly includeHistoriansMargins?: boolean | undefined;
}

export interface DerivationRoutePrintVisibility {
  readonly expanded: boolean;
  readonly showSummary: boolean;
}

/**
 * Normalizes reading level identifiers ("R0".."R3" or 0..3) to numeric 0..3.
 */
export function normalizeReadingDetail(level: string | number): DetailLevel {
  if (typeof level === "number") {
    if (level >= 0 && level <= 3) return level as DetailLevel;
    return 1;
  }
  const match = level.trim().match(/^r?([0-3])$/i);
  if (match?.[1]) {
    return Number.parseInt(match[1], 10) as DetailLevel;
  }
  return 1;
}

/**
 * Decides whether a reading level (R0..R3) prints for the given detail option.
 *
 * Default: The reading matching the reader's chosen Detail prints.
 * Override: If record.essentialForPrint is true, it always prints regardless of detail choice.
 */
export function shouldPrintReading(
  readingLevel: string | number,
  options: PrintPolicyOptions,
  record?: {
    readonly essentialForPrint?: boolean | undefined;
    readonly [key: string]: unknown;
  } | null,
): boolean {
  if (record && record.essentialForPrint === true) {
    return true;
  }
  const levelNum = normalizeReadingDetail(readingLevel);
  return levelNum === options.detail;
}

/**
 * Decides whether a misconception callout prints.
 *
 * Default: Misconceptions are omitted in print.
 * Override: If record.essentialForPrint is true, it prints.
 */
export function shouldPrintMisconception(
  record?: {
    readonly essentialForPrint?: boolean | undefined;
    readonly [key: string]: unknown;
  } | null,
): boolean {
  return Boolean(record && record.essentialForPrint === true);
}

/**
 * Decides how a derivation route prints.
 *
 * Defaults:
 * - "source-order" prints expanded (expanded: true, showSummary: false).
 * - Side-door routes ("discovery", "pedagogical-reconstruction") print collapsed
 *   to title and route label (expanded: false, showSummary: true).
 * Override: If record.essentialForPrint is true, side-doors print expanded.
 */
export function shouldPrintDerivationRoute(
  routeKind: DerivationRouteKind,
  record?: {
    readonly essentialForPrint?: boolean | undefined;
    readonly [key: string]: unknown;
  } | null,
): DerivationRoutePrintVisibility {
  if (record && record.essentialForPrint === true) {
    return { expanded: true, showSummary: false };
  }
  if (routeKind === "source-order") {
    return { expanded: true, showSummary: false };
  }
  return { expanded: false, showSummary: true };
}

/**
 * Decides whether a foundation drawer prints in place.
 *
 * Default: Foundation drawers are omitted in print (replaced by reference lines).
 * Override: If record.essentialForPrint is true, it prints expanded in place.
 */
export function shouldPrintFoundationDrawer(
  record?: {
    readonly essentialForPrint?: boolean | undefined;
    readonly [key: string]: unknown;
  } | null,
): boolean {
  return Boolean(record && record.essentialForPrint === true);
}

/**
 * Formats a reference line for a tool link inside a printed derivation step.
 *
 * Emits a single reference line naming the foundation and its URL instead of
 * expanding the foundation inline.
 */
export function formatToolLinkReference(
  foundationTitle: string,
  foundationSlug: string,
  baseUrl = "https://annus-mirabilis.com",
): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanSlug = foundationSlug.replace(/^\/+/, "");
  return `Foundation: ${foundationTitle} (${cleanBase}/foundations/${cleanSlug})`;
}
