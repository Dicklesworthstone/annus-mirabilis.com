/**
 * Marker grammar and KaTeX trust verification (am-eq-latex-generation-hc3).
 *
 * Implements Criterion 6:
 * - Emits \htmlClass{am-role-${role}} and \htmlData{term=${id}} / \htmlData{op=${id}}
 * - Defines KaTeX trust function permitting only valid role classes and term/op data attributes
 */

export const ALLOWED_ROLE_CLASSES = Object.freeze([
  "am-role-input",
  "am-role-result",
  "am-role-constant",
  "am-role-parameter",
  "am-role-intermediate",
]);

export interface KaTeXTrustContext {
  readonly command: string;
  readonly class?: string | undefined;
  readonly attributes?: Record<string, string> | undefined;
  [key: string]: unknown;
}

/**
 * Trust callback for KaTeX rendering of marked mathematical expressions.
 * Strictly verifies role classes and term/op HTML data attributes.
 */
export function katexMarkerTrust(context: KaTeXTrustContext): boolean {
  if (context.command === "\\htmlClass") {
    const cls = String(context.class ?? "");
    return ALLOWED_ROLE_CLASSES.includes(cls);
  }

  if (context.command === "\\htmlData") {
    const attrs = context.attributes;
    if (!attrs || typeof attrs !== "object") return false;
    const entries = Object.entries(attrs);
    if (entries.length !== 1) return false;
    const firstEntry = entries[0];
    if (!firstEntry) return false;
    const [key, value] = firstEntry;
    if (key !== "data-term" && key !== "data-op" && key !== "term" && key !== "op") {
      return false;
    }
    // Authored node IDs must be alphanumeric with dashes/underscores/dots
    return /^[a-zA-Z0-9_.-]+$/.test(String(value));
  }

  return false;
}

export function wrapHtmlClass(role: string, content: string): string {
  const roleClass = `am-role-${role}`;
  return `\\htmlClass{${roleClass}}{${content}}`;
}

export function wrapHtmlData(kind: "term" | "op", id: string, content: string): string {
  return `\\htmlData{${kind}=${id}}{${content}}`;
}
