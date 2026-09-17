import React from "react";
import { renderToString } from "katex";
import { isModalityClass } from "../../content/schemas/glossConventions.ts";
import type { GlossToken, MultiwordUnit } from "../../content/schemas/source.ts";

export interface GlossPairProps {
  readonly token: GlossToken;
  readonly tokenIndex: number;
  readonly multiwordUnit?: MultiwordUnit | undefined;
  readonly isMultiwordFirst?: boolean | undefined;
  readonly showReasoningWords?: boolean | undefined;
  readonly modalityClasses?: readonly string[] | undefined;
}

const MODALITY_LABELS: Record<string, string> = {
  "konjunktiv-i": "supposition",
  "konjunktiv-ii": "hypothetical",
  hedge: "hedge",
  necessity: "necessity",
  condition: "premise",
  consequence: "consequence",
  restriction: "restriction",
};

/**
 * Renders an interlinear gloss pair: German word on top, English gloss beneath it.
 * Supports multiword units, math tokens, grammar cues, and reasoning-words modality marking.
 */
export function GlossPair({
  token,
  tokenIndex,
  multiwordUnit,
  isMultiwordFirst = true,
  showReasoningWords = false,
  modalityClasses,
}: GlossPairProps) {
  const isMath =
    token.german.startsWith("$") ||
    token.german.startsWith("\\") ||
    token.german.includes("=") ||
    token.noteClass === "formula-phrase";

  const activeNoteClass = token.noteClass || multiwordUnit?.noteClass;
  const activeGrammarNote = token.grammarNote || multiwordUnit?.grammarNote;

  const isReasoningMarked =
    Boolean(showReasoningWords) && isModalityClass(activeNoteClass, modalityClasses);

  const modalityLabel = activeNoteClass
    ? (MODALITY_LABELS[activeNoteClass] ?? activeNoteClass)
    : undefined;

  let renderedMath: string | null = null;
  if (isMath) {
    const rawLatex = token.german.replace(/^\$|\$$/g, "");
    try {
      renderedMath = renderToString(rawLatex, {
        displayMode: false,
        output: "htmlAndMathml",
        throwOnError: false,
        strict: "warn",
        trust: false,
      });
    } catch {
      renderedMath = null;
    }
  }

  // Multiword unit display: first token displays the multiword gloss; subsequent tokens display a continuation marker or empty
  let englishGloss = token.english;
  if (multiwordUnit) {
    if (isMultiwordFirst) {
      englishGloss = multiwordUnit.english;
    } else {
      englishGloss = token.english || "↳";
    }
  }

  return (
    <span
      className={`gloss-pair ${multiwordUnit ? "is-multiword" : ""} ${isReasoningMarked ? "is-reasoning-word" : ""}`}
      data-token-index={tokenIndex}
      data-reasoning-word={isReasoningMarked ? "true" : undefined}
      data-modality-class={isReasoningMarked ? activeNoteClass : undefined}
    >
      <span className="gloss-pair-inner">
        <span
          className={`gloss-german ${isReasoningMarked ? "reasoning-marked-text" : ""}`}
          lang="de"
          dir="ltr"
        >
          {renderedMath ? (
            <span className="inline-math" dangerouslySetInnerHTML={{ __html: renderedMath }} />
          ) : (
            token.german
          )}
        </span>

        <span className="gloss-english" lang="en" dir="ltr">
          {englishGloss || "\u00A0"}
        </span>
      </span>

      {activeGrammarNote && (
        <span
          className={`gloss-grammar-cue ${isReasoningMarked ? "cue-reasoning-marked" : ""}`}
          data-note-class={activeNoteClass}
          title={activeGrammarNote}
          aria-label={
            isReasoningMarked && modalityLabel
              ? `Reasoning word: ${modalityLabel}. ${activeGrammarNote}`
              : `Grammar note: ${activeGrammarNote}`
          }
        >
          {isReasoningMarked && modalityLabel ? (
            <span className="reasoning-cue-label">[{modalityLabel}]</span>
          ) : (
            <span className="cue-dot" aria-hidden="true">
              •
            </span>
          )}
        </span>
      )}
    </span>
  );
}
