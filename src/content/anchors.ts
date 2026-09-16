/**
 * Anchor derivation, mapping helpers, and fragment resolution.
 *
 * Defined in docs/CONTENT_IDS.md and AGENTS.md ("Stable ids, anchors, and revisions").
 * Epic: am-ep-content-model-9e3
 * Bead: am-cm-id-scheme-8bn
 */

import {
  type EntranceId,
  type EquationRecordId,
  ENTRANCE_PAPER_SLUGS,
  type PaperCode,
  PAPER_CODES,
  PAPER_CODE_TO_ROUTE_SLUG,
  type ParseResult,
  type RouteSlug,
  ROUTE_SLUG_TO_PAPER_CODE,
  parseEquationRecordId,
  parseInstrumentId,
  parsePremiseId,
  validateSlug,
} from "./ids.ts";

export type AnchorKind =
  | "section"
  | "paragraph"
  | "sentence"
  | "footnote"
  | "part"
  | "masthead"
  | "closing"
  | "equation"
  | "result"
  | "argument"
  | "lab"
  | "card"
  | "object"
  | "entry";

export interface ParsedAnchor {
  readonly kind: AnchorKind;
  readonly fragment: string;
  readonly targetId: string;
}

/**
 * Returns the page-local anchor for a global equation record ID.
 * Example: 'eq-bm-s3-d4' -> '#eq-s3-d4'
 */
export function equationAnchorForRecord(recordId: string): string {
  const match = recordId.match(/^eq-(?:lq|bm|sr|me|md)-(.+)$/);
  if (!match || !match[1]) {
    throw new Error(`Cannot derive anchor from invalid equation record ID '${recordId}'`);
  }
  return `#eq-${match[1]}`;
}

/**
 * Returns the global equation record ID for a page-local equation anchor.
 * Example: ('bm', '#eq-s3-d4') -> 'eq-bm-s3-d4'
 */
export function equationRecordForAnchor(
  paper: PaperCode | RouteSlug,
  anchor: string,
): EquationRecordId {
  const cleanAnchor = anchor.startsWith("#") ? anchor.slice(1) : anchor;
  const match = cleanAnchor.match(/^eq-(.+)$/);
  if (!match || !match[1]) {
    throw new Error(`Cannot derive equation record from invalid anchor '${anchor}'`);
  }
  const paperCode: PaperCode = (PAPER_CODES as readonly string[]).includes(paper)
    ? (paper as PaperCode)
    : ROUTE_SLUG_TO_PAPER_CODE[paper as RouteSlug];

  if (!paperCode) {
    throw new Error(`Unknown paper identifier '${paper}'`);
  }

  const recordId = `eq-${paperCode}-${match[1]}` as EquationRecordId;
  const parsed = parseEquationRecordId(recordId);
  if (!parsed.ok) {
    throw new Error(`Derived equation record ID '${recordId}' is invalid: ${parsed.error}`);
  }
  return recordId;
}

/**
 * Returns the entry anchor for a first-encounter record ID.
 * Example: 'entrance-brownian-motion' -> '#entry-brownian-motion'
 */
export function entryAnchorForEntrance(entranceId: string): string {
  const match = entranceId.match(/^entrance-(light-quanta|brownian-motion|special-relativity|mass-energy)$/);
  if (!match || !match[1]) {
    throw new Error(`Cannot derive entry anchor from invalid entrance ID '${entranceId}'`);
  }
  return `#entry-${match[1]}`;
}

/**
 * Returns the first-encounter record ID for an entry anchor.
 * Example: '#entry-brownian-motion' -> 'entrance-brownian-motion'
 */
export function entranceForEntryAnchor(anchor: string): EntranceId {
  const clean = anchor.startsWith("#") ? anchor.slice(1) : anchor;
  if (clean === "entrance" || clean === "entry") {
    throw new Error("Retired bare anchor; use '#entry-<paper-slug>' instead");
  }
  const match = clean.match(/^entry-(light-quanta|brownian-motion|special-relativity|mass-energy)$/);
  if (!match || !match[1]) {
    throw new Error(
      `Cannot derive entrance ID from anchor '${anchor}': must be '#entry-<paper-slug>' for one of the four main papers`,
    );
  }
  return `entrance-${match[1]}` as EntranceId;
}

/**
 * Derives a page anchor fragment for any source block or unit ID.
 * Example: 's3' -> '#s3', 's3-p2-s1' -> '#s3-p2-s1'
 */
export function anchorForSourceId(id: string): string {
  return id.startsWith("#") ? id : `#${id}`;
}

/**
 * Validates and parses any URL anchor fragment across all reader faces.
 */
export function parseAnchor(raw: string): ParseResult<ParsedAnchor> {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "Anchor must be a non-empty string", rule: "anchor-grammar" };
  }
  const fragment = raw.startsWith("#") ? raw : `#${raw}`;
  const target = fragment.slice(1);

  if (target === "entrance" || target === "entry") {
    return {
      ok: false,
      error: `Retired anchor '${fragment}': use '#entry-<paper-slug>' (e.g. '#entry-brownian-motion')`,
      rule: "retired-entrance-anchor",
    };
  }

  if (target.endsWith("-h") && /^s\d+-h$/.test(target)) {
    const sId = target.slice(0, -2);
    return {
      ok: false,
      error: `Retired heading anchor '${fragment}': use '#${sId}' instead`,
      rule: "retired-heading-anchor",
    };
  }

  if (target.includes("-fn") && target.includes("-s")) {
    return {
      ok: false,
      error: `Retired footnote sentence anchor '${fragment}': footnotes use block anchor without sentence index`,
      rule: "retired-footnote-sentence-anchor",
    };
  }

  // 1. Entry Anchor
  if (target.startsWith("entry-")) {
    const slug = target.slice("entry-".length);
    if ((ENTRANCE_PAPER_SLUGS as readonly string[]).includes(slug)) {
      return {
        ok: true,
        value: { kind: "entry", fragment, targetId: `entrance-${slug}` },
      };
    }
    return {
      ok: false,
      error: `Invalid entry anchor '${fragment}': target slug must be one of ${ENTRANCE_PAPER_SLUGS.join(", ")}`,
      rule: "entry-anchor-grammar",
    };
  }

  // 2. Equation Anchor
  if (target.startsWith("eq-")) {
    return {
      ok: true,
      value: { kind: "equation", fragment, targetId: target },
    };
  }

  // 3. Result Anchor
  if (target.startsWith("result-")) {
    const slug = target.slice("result-".length);
    const slugRes = validateSlug(slug);
    if (!slugRes.ok) {
      return { ok: false, error: `Invalid result anchor '${fragment}': ${slugRes.error}`, rule: "result-anchor-grammar" };
    }
    return {
      ok: true,
      value: { kind: "result", fragment, targetId: target },
    };
  }

  // 4. Argument Anchor
  if (target.startsWith("arg-")) {
    const match = target.match(/^arg-(lq|bm|sr|me|md)-([a-z0-9]+(?:-[a-z0-9]+)*)$/);
    if (match) {
      return {
        ok: true,
        value: { kind: "argument", fragment, targetId: target },
      };
    }
    return {
      ok: false,
      error: `Invalid argument anchor '${fragment}': must match '#arg-<paperCode>-<name>' (e.g. '#arg-sr-03')`,
      rule: "argument-anchor-grammar",
    };
  }

  // 5. Lab Anchor
  if (target.startsWith("lab-")) {
    const inst = target.slice("lab-".length);
    const instRes = parseInstrumentId(inst);
    if (instRes.ok) {
      return {
        ok: true,
        value: { kind: "lab", fragment, targetId: inst },
      };
    }
    return {
      ok: false,
      error: `Invalid lab anchor '${fragment}': instrument '${inst}' is neither core nor declared non-core`,
      rule: "lab-anchor-grammar",
    };
  }

  // 6. Knowledge Card Anchor
  if (target.startsWith("card-")) {
    const premise = target.slice("card-".length);
    const premiseRes = parsePremiseId(premise);
    if (premiseRes.ok) {
      return {
        ok: true,
        value: { kind: "card", fragment, targetId: premise },
      };
    }
    return {
      ok: false,
      error: `Invalid card anchor '${fragment}': ${premiseRes.error}`,
      rule: "card-anchor-grammar",
    };
  }

  // 7. Object Anchor (1904 desk)
  if (target.startsWith("object-")) {
    const obj = target.slice("object-".length);
    const slugRes = validateSlug(obj);
    if (slugRes.ok) {
      return {
        ok: true,
        value: { kind: "object", fragment, targetId: target },
      };
    }
    return {
      ok: false,
      error: `Invalid object anchor '${fragment}': ${slugRes.error}`,
      rule: "object-anchor-grammar",
    };
  }

  // 8. Source structure anchors
  if (/^s\d+$/.test(target)) {
    return { ok: true, value: { kind: "section", fragment, targetId: target } };
  }
  if (/^s\d+-p\d+$/.test(target)) {
    return { ok: true, value: { kind: "paragraph", fragment, targetId: target } };
  }
  if (/^s\d+-p\d+-s\d+$/.test(target)) {
    return { ok: true, value: { kind: "sentence", fragment, targetId: target } };
  }
  if (/^s\d+-fn\d+$/.test(target)) {
    return { ok: true, value: { kind: "footnote", fragment, targetId: target } };
  }
  if (/^part-[12]$/.test(target)) {
    return { ok: true, value: { kind: "part", fragment, targetId: target } };
  }
  if (/^masthead-(title|author)$/.test(target)) {
    return { ok: true, value: { kind: "masthead", fragment, targetId: target } };
  }
  if (/^closing-(dateline|ack|received)$/.test(target)) {
    return { ok: true, value: { kind: "closing", fragment, targetId: target } };
  }

  return {
    ok: false,
    error: `Unknown anchor format '${fragment}'`,
    rule: "anchor-grammar",
  };
}
