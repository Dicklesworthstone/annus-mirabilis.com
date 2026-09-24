import type { ExactScale } from "./ast.ts";
import type { NavigationNode } from "./navigation.ts";
import type { NotationNoteTarget } from "./notationNoteTarget.ts";
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
    /**
     * The notation toggle (html[data-notation]). "printed": the same tree drawn in Einstein's
     * letters, with its sentence and legend glyphs. "modern": it keeps today's letters in both
     * states and says so. Absent where the toggle does not apply or his letters are today's.
     */
    notationForm?: Readonly<
      | {
          state: "printed";
          html: string;
          mathml: string;
          plainLatex: string;
          sentence: EquationRecord["sentence"];
          glyphHtml: Readonly<Record<string, string>>;
        }
      | {
          state: "modern";
          /** Where the reader finds Einstein's letters instead (notationNoteTarget.ts). */
          seeAt?: NotationNoteTarget;
        }
    >;
  }>;
