import type { ExactScale } from "./ast.ts";
import type { NavigationNode } from "./navigation.ts";
import type { Quantity } from "./quantities.ts";
import type { EquationRecord } from "./record.ts";
/** Serialized, pre-rendered route-local payload. Rendering imports are server-only. */
export type CompiledEquation = EquationRecord &
  Readonly<{
    html: string;
    mathml: string;
    plainLatex: string;
    treeDigest: string;
    navigation: readonly NavigationNode[];
    terms: readonly Readonly<{
      termId: string;
      quantityId: string;
      scale: ExactScale;
      quantity: Quantity;
    }>[];
    /** The legend's glyph for each quantity this record prints with its own letter. */
    printedGlyphHtml?: Readonly<Record<string, string>>;
  }>;
