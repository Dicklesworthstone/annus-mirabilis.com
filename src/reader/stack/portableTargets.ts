/**
 * Public clarification addresses, without rendering or registry side effects.
 * Instrument and term ids use the same parsers in the reader and the reading notebook.
 * These identify a place to reopen, never an accepted run, tape, or private answer.
 */
import { parseCatalogueAddress } from "../../experiments/catalogue.ts";

export type InstrumentViewTarget = Readonly<{ raw: string }>;
export type TermTarget = Readonly<{ routeSlug: string | null; termId: string }>;

export function parseInstrumentViewId(raw: string): InstrumentViewTarget | null {
  try {
    parseCatalogueAddress(raw);
  } catch {
    return null;
  }
  return Object.freeze({ raw });
}

const TERM_ID_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
const ROUTE_SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;

export function parseTermId(raw: string): TermTarget | null {
  const parts = raw.split("/");
  if (parts.length === 1) {
    const termId = parts[0] ?? "";
    return TERM_ID_PATTERN.test(termId) ? Object.freeze({ routeSlug: null, termId }) : null;
  }
  if (parts.length === 2) {
    const [routeSlug, termId] = parts as [string, string];
    return ROUTE_SLUG_PATTERN.test(routeSlug) && TERM_ID_PATTERN.test(termId)
      ? Object.freeze({ routeSlug, termId })
      : null;
  }
  return null;
}

/**
 * The notebook's existing 180-character limit is deliberately stricter than the reader's 200.
 * Unknown but well-formed instrument ids remain portable: the dispatcher reports their absence
 * explicitly rather than opening a different model. No executable or instance-specific kind
 * is admitted. Existing foundation-only notebooks keep precisely the same grammar.
 */
export function portableClarification(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 180) return null;
  if (raw === "") return "";
  const separator = raw.indexOf(":");
  if (separator <= 0 || separator === raw.length - 1) return null;
  const kind = raw.slice(0, separator);
  const id = raw.slice(separator + 1);
  if (kind === "foundation") return /^[a-z][a-z0-9-]*$/u.test(id) ? raw : null;
  if (kind === "instrument-view") return parseInstrumentViewId(id) ? raw : null;
  if (kind === "term") return parseTermId(id) ? raw : null;
  return null;
}

/** An absent, ambiguous or unsupported target still permits saving the paper passage itself. */
export function portableClarificationFromSearch(search: string): string {
  const values = new URLSearchParams(search).getAll("open");
  return values.length === 1 ? (portableClarification(values[0]) ?? "") : "";
}
