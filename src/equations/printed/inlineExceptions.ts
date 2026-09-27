/**
 * The inline-term exceptions, and the papers whose inline formulas are enforced.
 *
 * THIS FILE EXISTS SO A PAGE CAN IMPORT IT. It was part of paperInlines.ts until 2026-09-27, and a
 * page that wanted only `loadInlineExceptions` pulled in that module's registry import with it:
 * content/quantities/registry.ts reads its own directory through import.meta.url, which webpack
 * cannot bundle, so `next build` failed with "Can't resolve '../../../content/quantities/'" through
 * ExplanationInlineTerms.tsx and again through the equation explainer. The same defect broke the
 * build through a lab page (0bd55e6b) and through a validator before that, so the rule is worth
 * stating: a module a route imports must not import the registry, directly or through one hop.
 * Nothing here imports it. Everything here is node:fs, node:path and the schemas.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { strictParse } from "../../content/schemas/strictParse.ts";
import { glyphSignature } from "../latex/printedAtoms.ts";
import type { InlineException } from "./inlineTerms.ts";

export const INLINE_EXCEPTIONS_PATH = join("content", "inline-terms", "exceptions.yaml");

/**
 * Papers whose every inline formula is coloured or declared: a refusal stops the build, and only
 * these are drawn in colour (scripts/build-equations.ts), so a paper turns over whole. A paper joins
 * when its concordance reads every glyph its formulas print.
 */
export const ENFORCED_INLINE_PAPERS: readonly string[] = [
  "mass-energy",
  "light-quanta",
  "brownian-motion",
  // Dispatch 277: every glyph read from the plates of pp. 893 to 921, its points and axes listed.
  "special-relativity",
];

export type InlineExceptionsCode =
  | "inline-exceptions-not-a-list"
  | "inline-exceptions-no-paper"
  | "inline-exceptions-glyph-not-one-atom"
  | "inline-exceptions-no-scope"
  | "inline-exceptions-no-reason"
  | "inline-exceptions-no-note";

export class InlineExceptionsError extends Error {
  readonly code: InlineExceptionsCode;
  constructor(code: InlineExceptionsCode, message: string) {
    super(`${code}: ${message}`);
    this.name = "InlineExceptionsError";
    this.code = code;
  }
}

/** The listed exceptions, each checked: a known paper, one atom, a scope, and a reason. */
export function parseInlineExceptions(raw: unknown, where: string): readonly InlineException[] {
  const list = (raw as { exceptions?: unknown } | null)?.exceptions;
  if (!Array.isArray(list))
    throw new InlineExceptionsError(
      "inline-exceptions-not-a-list",
      `${where}: exceptions must be a list.`,
    );
  return list.map((item, i) => {
    const at = `${where} exceptions[${i}]`;
    const e = (item ?? {}) as Record<string, unknown>;
    if (typeof e.paper !== "string" || !e.paper)
      throw new InlineExceptionsError("inline-exceptions-no-paper", `${at}: paper is required.`);
    const glyph = typeof e.glyph === "string" ? e.glyph : "";
    let oneAtom = true;
    try {
      glyphSignature(glyph);
    } catch {
      oneAtom = false;
    }
    if (!oneAtom)
      throw new InlineExceptionsError(
        "inline-exceptions-glyph-not-one-atom",
        `${at}: "${glyph}" is not one printed name.`,
      );
    if (
      !Array.isArray(e.scope) ||
      e.scope.length === 0 ||
      e.scope.some((s) => typeof s !== "string" || !s)
    )
      throw new InlineExceptionsError(
        "inline-exceptions-no-scope",
        `${at}: scope must list sections, anchors or "all".`,
      );
    if (typeof e.reason !== "string" || e.reason.trim().length < 20)
      throw new InlineExceptionsError(
        "inline-exceptions-no-reason",
        `${at}: a reason of a sentence is required.`,
      );
    // What the sign names, for the reader who points at it on a reading face (dispatch 280).
    if (typeof e.note !== "string" || e.note.trim().length < 8)
      throw new InlineExceptionsError(
        "inline-exceptions-no-note",
        `${at}: a note saying what the sign names, in the reader's words, is required.`,
      );
    return {
      paper: e.paper,
      glyph,
      scope: e.scope as string[],
      reason: e.reason.trim(),
      note: e.note.trim(),
    };
  });
}

export function loadInlineExceptions(root: string): readonly InlineException[] {
  const path = join(root, INLINE_EXCEPTIONS_PATH);
  if (!existsSync(path)) return [];
  return parseInlineExceptions(
    strictParse(readFileSync(path, "utf8"), "yaml", INLINE_EXCEPTIONS_PATH),
    INLINE_EXCEPTIONS_PATH,
  );
}
