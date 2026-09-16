/**
 * linkPrinting.ts
 *
 * Link formatting utilities for print media (am-plat-print-3orn).
 *
 * Requirements:
 * 1. External links print their destination URL after link text (e.g. "Text (https://...)").
 * 2. Internal cross-references print section and page locators (e.g. "Text (§4, p. 556)")
 *    rather than raw relative URLs.
 * 3. No link prints as bare text with no destination.
 *
 * Spec: AGENTS.md §6.2, §15.4 and am-plat-print-3orn
 */

export interface InternalCrossReferenceTarget {
  readonly section: string | number;
  readonly pageNumber?: number | string | undefined;
}

/**
 * Checks whether a link destination is external (http/https/protocol-relative).
 */
export function isExternalLink(href: string): boolean {
  if (!href) return false;
  return /^https?:\/\//i.test(href) || /^\/\//.test(href);
}

/**
 * Checks whether a link is a bare anchor without destination or content.
 */
export function isBareLink(
  href: string | undefined | null,
  text: string | undefined | null,
): boolean {
  if (!text || text.trim().length === 0) return true;
  if (!href || href.trim().length === 0 || href === "#") return true;
  return false;
}

/**
 * Formats an external link with its destination URL in parentheses.
 */
export function formatExternalLink(text: string, href: string): string {
  if (!href || href === "#") return text;
  return `${text} (${href})`;
}

/**
 * Formats an internal cross-reference locator (e.g., "§4, p. 556" or "§4").
 */
export function formatSectionLocator(
  section: string | number,
  pageNumber?: number | string | undefined,
): string {
  const cleanSec = String(section).replace(/^s/, "");
  if (pageNumber !== undefined && String(pageNumber).trim().length > 0) {
    return `§${cleanSec}, p. ${pageNumber}`;
  }
  return `§${cleanSec}`;
}

/**
 * Formats an internal link with its section and page locator in parentheses.
 */
export function formatInternalLink(
  text: string,
  section: string | number,
  pageNumber?: number | string | undefined,
): string {
  const locator = formatSectionLocator(section, pageNumber);
  return `${text} (${locator})`;
}

/**
 * Formats a printable link based on href and optional target metadata.
 */
export function formatPrintableLink(
  text: string,
  href: string,
  options?: {
    readonly isInternal?: boolean | undefined;
    readonly section?: string | number | undefined;
    readonly pageNumber?: number | string | undefined;
  },
): string {
  if (isBareLink(href, text)) {
    return text;
  }
  if (options?.isInternal || options?.section !== undefined) {
    if (options.section !== undefined) {
      return formatInternalLink(text, options.section, options.pageNumber);
    }
  }
  if (isExternalLink(href)) {
    return formatExternalLink(text, href);
  }
  return text;
}
