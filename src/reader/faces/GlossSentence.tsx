import { isModalityClass } from "../../content/schemas/glossConventions.ts";
import type { GlossUnit } from "../../content/schemas/source.ts";
import { GlossPair } from "./GlossPair.tsx";

export interface GlossSentenceProps {
  readonly sentenceId: string;
  readonly germanText: string;
  readonly glossUnit?: GlossUnit | undefined;
  readonly englishTranslation?: string | undefined;
  readonly paperSlug?: string | undefined;
  readonly showReasoningWords?: boolean | undefined;
  readonly modalityClasses?: readonly string[] | undefined;
}

export interface ReasoningWordItem {
  readonly tokenIndex: number;
  readonly german: string;
  readonly english: string;
  readonly noteClass: string;
  readonly grammarNote: string;
}

/**
 * Extracts ordered reasoning words from a GlossUnit when modality matches.
 */
export function extractReasoningWords(
  glossUnit: GlossUnit,
  modalityClasses?: readonly string[],
): readonly ReasoningWordItem[] {
  const items: ReasoningWordItem[] = [];

  // Track multiword units already processed
  const processedMultiwordIndices = new Set<number>();

  for (let i = 0; i < glossUnit.tokens.length; i++) {
    const token = glossUnit.tokens[i];
    if (!token) continue;

    // Check if part of a multiword unit
    const multiword = glossUnit.multiwordUnits?.find((mw) => mw.tokenIndices.includes(i));

    if (multiword) {
      const firstIdx = multiword.tokenIndices[0];
      if (firstIdx !== undefined && isModalityClass(multiword.noteClass, modalityClasses)) {
        if (!processedMultiwordIndices.has(firstIdx)) {
          processedMultiwordIndices.add(firstIdx);
          const combinedGerman = multiword.tokenIndices
            .map((idx) => glossUnit.tokens[idx]?.german || "")
            .join(" ");
          items.push({
            tokenIndex: firstIdx,
            german: combinedGerman,
            english: multiword.english,
            noteClass: multiword.noteClass || "modality",
            grammarNote: multiword.grammarNote || "",
          });
        }
      }
    } else if (isModalityClass(token.noteClass, modalityClasses)) {
      items.push({
        tokenIndex: i,
        german: token.german,
        english: token.english || "",
        noteClass: token.noteClass || "modality",
        grammarNote: token.grammarNote || "",
      });
    }
  }

  // Sort by tokenIndex to ensure token order
  return items.sort((a, b) => a.tokenIndex - b.tokenIndex);
}

/**
 * Renders an aligned gloss sentence with word pairs, screen reader actions, and reasoning-words list.
 */
export function GlossSentence({
  sentenceId,
  germanText,
  glossUnit,
  englishTranslation,
  paperSlug = "mass-energy",
  showReasoningWords = false,
  modalityClasses,
}: GlossSentenceProps) {
  // If no gloss unit is available, render German text with an honest coverage notice and link to parallel face
  if (!glossUnit) {
    return (
      <div
        className="gloss-sentence gloss-sentence-missing"
        id={sentenceId}
        data-sentence-id={sentenceId}
        data-source-sentence="true"
        tabIndex={0}
      >
        <div className="sentence-german-unadorned" lang="de">
          {germanText}
        </div>
        <div className="gloss-coverage-notice" role="note" data-coverage-notice="true">
          <p className="notice-message">Gloss not yet available for this section.</p>
          <a
            href={`/papers/${paperSlug}/?view=parallel#${sentenceId}`}
            className="parallel-fallback-link"
            data-parallel-fallback="true"
          >
            Read in parallel face
          </a>
        </div>
      </div>
    );
  }

  const reasoningWords = showReasoningWords
    ? extractReasoningWords(glossUnit, modalityClasses)
    : [];

  const fullGerman = glossUnit.tokens.map((t) => t.german).join(" ");
  const fullGlosses = glossUnit.tokens.map((t) => t.english || t.german).join(" ");

  return (
    <section
      className="gloss-sentence"
      id={sentenceId}
      data-sentence-id={sentenceId}
      data-source-sentence="true"
      tabIndex={0}
      aria-labelledby={`sentence-header-${sentenceId}`}
    >
      {/* Semantic actions for non-visual and assistive reading */}
      <nav className="sentence-actions" aria-label={`Sentence actions for ${sentenceId}`}>
        <ul className="sentence-actions-list">
          <li>
            <button
              type="button"
              className="sentence-action-btn"
              data-action="read-german"
              aria-label={`Read the German sentence: ${fullGerman}`}
            >
              Read the German sentence
            </button>
          </li>
          <li>
            <button
              type="button"
              className="sentence-action-btn"
              data-action="read-glosses"
              aria-label={`Read the word glosses: ${fullGlosses}`}
            >
              Read the word glosses
            </button>
          </li>
          {englishTranslation && (
            <li>
              <button
                type="button"
                className="sentence-action-btn"
                data-action="read-translation"
                aria-label={`Read the aligned English translation: ${englishTranslation}`}
              >
                Read the aligned English translation
              </button>
            </li>
          )}
          {showReasoningWords && (
            <li>
              <button
                type="button"
                className="sentence-action-btn"
                data-action="read-reasoning"
                aria-label={`Read the reasoning words: ${reasoningWords.map((r) => `${r.german} (${r.english})`).join(", ")}`}
              >
                Read the reasoning words
              </button>
            </li>
          )}
        </ul>
      </nav>

      {/* Interlinear word pairs layout */}
      <div className="gloss-pairs-container" data-pairs-container="true">
        {Array.from(glossUnit.tokens.entries()).map(([idx, token]) => {
          const multiword = glossUnit.multiwordUnits?.find((mw) => mw.tokenIndices.includes(idx));
          const isMultiwordFirst = multiword ? multiword.tokenIndices[0] === idx : true;

          return (
            <GlossPair
              key={`${sentenceId}-tok-${idx}-${token.german}`}
              token={token}
              tokenIndex={idx}
              multiwordUnit={multiword}
              isMultiwordFirst={isMultiwordFirst}
              showReasoningWords={showReasoningWords}
              modalityClasses={modalityClasses}
            />
          );
        })}
      </div>

      {/* In-place ordered list of reasoning words when toggle is on */}
      {showReasoningWords && reasoningWords.length > 0 && (
        <details className="reasoning-words-details" open data-reasoning-details="true">
          <summary className="reasoning-words-summary">
            List the reasoning words in this sentence ({reasoningWords.length})
          </summary>
          <ol className="reasoning-words-ol">
            {reasoningWords.map((item) => (
              <li
                key={`${sentenceId}-rw-${item.tokenIndex}-${item.german}`}
                className="reasoning-word-item"
                data-token-index={item.tokenIndex}
              >
                <strong className="rw-german" lang="de">
                  {item.german}
                </strong>{" "}
                <span className="rw-english" lang="en">
                  ({item.english})
                </span>
                {" — "}
                <span className="rw-class">[{item.noteClass}]</span>
                {item.grammarNote && <span className="rw-note">: {item.grammarNote}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
