/**
 * A record's printed letters (orchestrator ruling of 2026-09-23, dispatch 100).
 *
 * An equation record may print a quantity with a different letter from its table's, as the papers'
 * notation concordance does: the lessons on partial derivatives and exponentials print the
 * density as f, where the table prints it p. Only the letter changes. The quantity id, its
 * dimension, its colour and its legend name stay canonical, and binding never reads a glyph
 * (betaCollision.test.ts), so an override can relabel a term but never rebind it.
 *
 * The override lives on the record, never on a symbol node, so one formula cannot print one
 * quantity two ways, and the AST stays free of glyphs.
 */
import { type Expression, quantityBindings } from "./ast.ts";
import type { QuantityRegistry } from "./quantities.ts";

export type PrintedGlyphs = Readonly<Record<string, string>>;

/**
 * A printed letter is one Latin letter or one Greek letter, with at most a short subscript and
 * primes: f, c, \rho, n_0, x'. A command outside the Greek alphabet is refused, so an override can
 * never carry sizing, colour, links or HTML into a formula.
 */
const GREEK =
  "alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega";
const PRINTED_GLYPH = new RegExp(
  `^(?:[A-Za-z]|\\\\(?:${GREEK}))(?:_(?:[A-Za-z0-9]|\\{[A-Za-z0-9]{1,4}\\}))?'{0,2}$`,
);

/**
 * Why a record's printed letters are refused, or undefined when they are admitted. A letter is
 * refused when it is not a letter, when it names a quantity the formula does not bind, when it
 * repeats the table's own letter, or when another quantity in the same formula already prints it:
 * two quantities drawn with one letter is the confusion the override exists to remove.
 */
export function printedGlyphsProblem(
  value: unknown,
  tree: Expression,
  quantities: QuantityRegistry,
): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return "printedGlyphs must map a quantity id to the letter this record prints for it.";
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0 || entries.length > 16)
    return "printedGlyphs must name between one and sixteen quantities.";
  const bound = new Set(quantityBindings(tree).map((b) => b.quantityId));
  const printed = new Map([...bound].map((id) => [id, quantities[id]?.glyph ?? ""] as const));
  for (const [quantityId, glyph] of entries) {
    if (!bound.has(quantityId))
      return `printedGlyphs names ${quantityId}, which this formula does not bind.`;
    if (typeof glyph !== "string" || !PRINTED_GLYPH.test(glyph))
      return `printedGlyphs gives ${quantityId} "${String(glyph)}", which is not one letter with at most a subscript.`;
    if (glyph === quantities[quantityId]?.glyph)
      return `printedGlyphs gives ${quantityId} the letter its table already prints; omit it.`;
    printed.set(quantityId, glyph);
  }
  for (const [quantityId, glyph] of entries) {
    const clash = [...printed].find(([other, g]) => other !== quantityId && g === glyph);
    if (clash)
      return `printedGlyphs prints ${quantityId} as "${String(glyph)}", which ${clash[0]} already prints in this formula.`;
  }
  return undefined;
}

/**
 * The table a record is rendered with: its paper's, with the record's printed letters in place.
 * Every other field of each quantity (id, name, dimension, unit) is the table's own.
 */
export function recordQuantities(
  quantities: QuantityRegistry,
  printed: PrintedGlyphs | undefined,
): QuantityRegistry {
  if (!printed) return quantities;
  const out: Record<string, QuantityRegistry[string]> = { ...quantities };
  for (const [quantityId, glyph] of Object.entries(printed)) {
    const quantity = quantities[quantityId];
    if (quantity) out[quantityId] = { ...quantity, glyph };
  }
  return out;
}
