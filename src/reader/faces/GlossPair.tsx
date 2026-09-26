import { renderToString } from "katex";
import { Fragment, type ReactNode } from "react";
import { isModalityClass } from "../../content/schemas/glossConventions.pure.ts";
import type { GlossToken, MultiwordUnit } from "../../content/schemas/source.ts";
import type { GlossAtom } from "./glossStream.ts";
import { type RenderInlinesOptions, renderInlines } from "./inlines.tsx";

export interface GlossPairProps {
  readonly token: GlossToken;
  readonly tokenIndex: number;
  readonly multiwordUnit?: MultiwordUnit | undefined;
  readonly isMultiwordFirst?: boolean | undefined;
  readonly showReasoningWords?: boolean | undefined;
  /** The modality vocabulary the server resolved for this edition. */
  readonly modalityClasses: readonly string[];
  /** Formulas and punctuation printed against the word, before and after it (glossStream.ts). */
  readonly leading?: readonly GlossAtom[] | undefined;
  readonly trailing?: readonly GlossAtom[] | undefined;
  /** The sentence the formulas are printed in, for their colour (inlines.tsx, dispatch 272). */
  readonly terms?: RenderInlinesOptions["terms"];
}

/**
 * Atoms as the paper prints them: a formula typeset by the same renderer as every other face,
 * punctuation as text. They are never glossed.
 */
export function renderGlossAtoms(
  atoms: readonly GlossAtom[],
  keyPrefix: string,
  terms?: RenderInlinesOptions["terms"],
): ReactNode {
  return atoms.map((atom) => (
    <Fragment key={`${keyPrefix}-${atom.start}`}>
      {atom.kind === "math"
        ? renderInlines([atom.node], terms ? { terms } : undefined, `${keyPrefix}-${atom.start}`)
        : atom.text}
    </Fragment>
  ));
}

/**
 * A formula or punctuation standing on its own in the German line, with an empty line beneath
 * where a word would have its gloss.
 */
export function GlossAtoms({
  atoms,
  keyPrefix,
  terms,
}: {
  atoms: readonly GlossAtom[];
  keyPrefix: string;
  terms?: RenderInlinesOptions["terms"];
}) {
  return (
    <span className="gloss-atom" data-gloss-atom={atoms.map((a) => a.kind).join(" ")}>
      <span className="gloss-pair-inner">
        <span className="gloss-german" lang="de" dir="ltr">
          {renderGlossAtoms(atoms, keyPrefix, terms)}
        </span>
        <span className="gloss-english" aria-hidden="true">
          {"\u00A0"}
        </span>
      </span>
    </span>
  );
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
  leading = [],
  trailing = [],
  terms,
}: GlossPairProps) {
  // A formula phrase ("setzen wir", "man erhält") is German words, not a formula: the note class
  // used to be enough to typeset "setzen" through KaTeX as italic mathematics.
  const isMath =
    token.german.startsWith("$") || token.german.startsWith("\\") || token.german.includes("=");

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
          {renderGlossAtoms(leading, `lead-${tokenIndex}`, terms)}
          {renderedMath ? (
            <span
              className="inline-math"
              {...{ dangerouslySetInnerHTML: { __html: renderedMath } }}
            />
          ) : (
            token.german
          )}
          {renderGlossAtoms(trailing, `trail-${tokenIndex}`, terms)}
        </span>

        <span className="gloss-english" lang="en" dir="ltr">
          {englishGloss || "\u00A0"}
        </span>
      </span>

      {isReasoningMarked && activeGrammarNote && (
        <span
          className="gloss-grammar-cue cue-reasoning-fallback"
          role="note"
          title={activeGrammarNote}
          aria-label={`Grammar note: ${activeGrammarNote}`}
        >
          <span className="cue-dot" aria-hidden="true">
            •
          </span>
        </span>
      )}
      {activeGrammarNote && (
        <span
          className={`gloss-grammar-cue ${isReasoningMarked ? "cue-reasoning-marked" : ""}`}
          role="note"
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
