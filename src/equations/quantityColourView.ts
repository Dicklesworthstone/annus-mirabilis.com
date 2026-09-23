/**
 * What a view needs to paint one colour per quantity: the paper's map from build-equations.ts,
 * the two custom properties a coloured element reads, the per-term rules for KaTeX's term spans,
 * and the legend. Shared by the SemanticEquation explorer and the reading's in-place formulas, so
 * the two cannot colour one quantity differently. No "use client": it is plain data.
 */
import type { CSSProperties } from "react";
import quantityColourPayload from "../generated/quantity-colours.json";
import "../generated/quantity-colours.css";
import { QUANTITY_PALETTE } from "./quantityColours.ts";
import type { CompiledEquation } from "./viewTypes.ts";

export type QuantityColour = Readonly<{ slot: number; name: string; glyphHtml: string }>;

const QUANTITY_COLOURS = quantityColourPayload.papers as Readonly<
  Record<string, Readonly<Record<string, QuantityColour>>>
>;

export function paperQuantityColours(paper: string): Readonly<Record<string, QuantityColour>> {
  return QUANTITY_COLOURS[paper] ?? {};
}

/** The two custom properties a coloured element reads: its hue, and its pattern-mode line. */
export function colourStyle(colour: QuantityColour | undefined): CSSProperties | undefined {
  if (!colour) return undefined;
  return {
    "--qc": `var(--q-${colour.slot})`,
    "--qd": QUANTITY_PALETTE[colour.slot]?.pattern,
  } as CSSProperties;
}

/**
 * Each quantity once, in the order its first term appears across the equations given, drawn with
 * the letter its formula prints: a record that prints the density as f shows f beside the density's
 * own name. The name and colour are always the paper's; only the glyph can come from the record.
 * The same quantity printed with two letters in one view is listed under both, so no letter on
 * screen is left without its name.
 */
export function quantityLegend(
  equations: readonly CompiledEquation[],
): readonly Readonly<{ quantityId: string; colour: QuantityColour }>[] {
  const seen = new Set<string>();
  return equations.flatMap((equation) => {
    const colours = paperQuantityColours(equation.paper);
    return equation.terms.flatMap((t) => {
      const paperColour = colours[t.quantityId];
      if (!paperColour) return [];
      const printed = equation.printedGlyphHtml?.[t.quantityId];
      const colour = printed ? { ...paperColour, glyphHtml: printed } : paperColour;
      const key = `${t.quantityId}\u0000${colour.glyphHtml}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ quantityId: t.quantityId, colour }];
    });
  });
}
