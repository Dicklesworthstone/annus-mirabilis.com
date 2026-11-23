/**
 * Display-only expression forms from an explicitly authored concordance group.
 *
 * This is the inverse of a group rename, not an algebraic rewrite: the record still binds h or
 * gamma, and its original term owns the entire printed expression. Only a closed arithmetic
 * pattern is admitted. Every leaf names an exact quantity in the same section, with one unscaled
 * printed letter; incomplete patterns, unknown leaves and dimensional changes refuse the form.
 */
import { dimension, sameDimension } from "../content/dimensions/rational.ts";
import { scopeMatches } from "../content/notation/resolve.ts";
import type { ConcordanceEntry } from "../content/schemas/concordance.ts";
import type { Expression } from "./ast.ts";
import { checkDimensions } from "./dimensions.ts";
import type { SymbolExpression } from "./latex/types.ts";
import { recordQuantities } from "./printedGlyphs.ts";
import type { QuantityRegistry } from "./quantities.ts";

/** Unknown keys cannot silently drop a coefficient, exponent or another part of the pattern. */
function fields(input: unknown, names: readonly string[]): Record<string, unknown> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const value = input as Record<string, unknown>;
  return Object.keys(value).length === names.length && names.every((name) => Object.hasOwn(value, name))
    ? value
    : undefined;
}

export function printedGroup(
  entry: ConcordanceEntry,
  table: QuantityRegistry,
  entries: readonly ConcordanceEntry[],
  section: string,
  isLetter: (glyph: string) => boolean,
): SymbolExpression | undefined {
  if (
    entry.operation.kind !== "rename" ||
    entry.operation.target.form !== "group" ||
    !("quantityId" in entry.binding)
  )
    return undefined;
  const target = table[entry.binding.quantityId];
  if (!target) return undefined;
  const glyphs: Record<string, string> = {};
  let nodes = 0;

  const leaf = (quantityId: unknown): Expression | undefined => {
    if (++nodes > 64 || typeof quantityId !== "string") return undefined;
    const quantity = table[quantityId];
    if (!quantity || (quantity.dimension[4] ?? "0") !== "0") return undefined;
    const candidates = entries.filter(
      (candidate) =>
        "quantityId" in candidate.binding &&
        candidate.binding.quantityId === quantityId &&
        candidate.binding.index === undefined &&
        (!candidate.binding.scale ||
          (candidate.binding.scale.num === 1 && candidate.binding.scale.den === 1)) &&
        scopeMatches(candidate.scope, section, section) &&
        isLetter(candidate.glyph.latex),
    );
    if (candidates.length !== 1) return undefined;
    // A leaf reads the PRINTED letter, not its operation. Thus the h -> R beta/N rename can use
    // the printed beta without applying beta's separate, explicitly modern, h/k_B identification.
    glyphs[quantityId] = candidates[0]!.glyph.latex;
    return { kind: "symbol", quantityId, termId: `notation.t.${nodes}` };
  };

  const read = (input: unknown, depth = 0): Expression | undefined => {
    if (++nodes > 64 || depth > 12 || !input || typeof input !== "object") return undefined;
    const kind = (input as { kind?: unknown }).kind;
    if (kind === "term") {
      const value = fields(input, ["kind", "terms"]);
      return value && Array.isArray(value.terms) && value.terms.length === 1
        ? leaf(value.terms[0])
        : undefined;
    }
    if (kind === "number") {
      const value = fields(input, ["kind", "value"]);
      return value && Number.isSafeInteger(value.value)
        ? { kind: "number", value: String(value.value) }
        : undefined;
    }
    if (kind === "multiply") {
      const value = fields(input, ["kind", "terms"]);
      if (!value || !Array.isArray(value.terms) || value.terms.length < 2 || value.terms.length > 8)
        return undefined;
      const args = value.terms.map(leaf);
      return args.every((arg): arg is Expression => arg !== undefined)
        ? { kind: "product", args }
        : undefined;
    }
    if (kind === "divide" || kind === "subtract") {
      const value = fields(input, ["kind", "left", "right"]);
      if (!value) return undefined;
      const left = read(value.left, depth + 1);
      const right = read(value.right, depth + 1);
      if (!left || !right) return undefined;
      return kind === "divide"
        ? { kind: "quotient", numerator: left, denominator: right }
        : { kind: "sum", args: [left, { kind: "negate", argument: right }] };
    }
    if (kind === "power") {
      const value = fields(input, ["kind", "base", "exponent"]);
      if (
        !value ||
        typeof value.exponent !== "number" ||
        !Number.isSafeInteger(value.exponent) ||
        Math.abs(value.exponent) > 12
      )
        return undefined;
      const base = read(value.base, depth + 1);
      return base ? { kind: "power", base, exponent: { num: value.exponent, den: 1 } } : undefined;
    }
    if (kind === "root") {
      const value = fields(input, ["kind", "degree", "radicand"]);
      if (
        !value ||
        typeof value.degree !== "number" ||
        !Number.isSafeInteger(value.degree) ||
        value.degree < 2 ||
        value.degree > 6
      )
        return undefined;
      const radicand = read(value.radicand, depth + 1);
      return radicand ? { kind: "root", degree: value.degree, radicand } : undefined;
    }
    return undefined;
  };

  const tree = read(entry.operation.target.pattern);
  if (!tree) return undefined;
  const registry = recordQuantities(table, glyphs);
  const checked = checkDimensions(tree, registry);
  if (checked.status !== "consistent" || !sameDimension(checked.dimension, dimension(target.dimension)))
    return undefined;
  return { tree, registry };
}
