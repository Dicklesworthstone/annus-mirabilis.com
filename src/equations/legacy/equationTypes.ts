/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: src/types/equation.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Marked as legacy; retained for donor UI seam extraction and migration isolation.
 * - Decoupled patent references to generic entity identifiers.
 */

export type ColorVariant =
  | "crimson"
  | "sapphire"
  | "emerald"
  | "amber"
  | "amethyst"
  | "cyan"
  | "coral"
  | "rose"
  | "teal";

export interface EquationValueFormat {
  readonly style: "fixed";
  readonly fractionDigits: number;
  readonly scale?: number;
  readonly prefix?: string;
  readonly suffix?: string;
}

export interface EquationVariable {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly color: ColorVariant;
  readonly role: string;
  readonly unit: string;
  readonly dimension?: string;
  readonly explanation: string;
  readonly telemetryKey?: string;
  readonly telemetryMetricLabel?: string;
  readonly valueFormat?: EquationValueFormat;
}

export interface SentenceFragment {
  readonly text: string;
  readonly variableId?: string;
}

export interface ColorizedEquation {
  readonly id: string;
  readonly entityId: string;
  readonly title: string;
  readonly category: string;
  readonly rawLatex: string;
  readonly colorizedLatex: string;
  readonly plainEnglishSentence: readonly SentenceFragment[];
  readonly variables: readonly EquationVariable[];
  readonly pedagogicalNote: string;
  readonly referenceIndex?: number;
  readonly historicalSignificance?: string;
}
