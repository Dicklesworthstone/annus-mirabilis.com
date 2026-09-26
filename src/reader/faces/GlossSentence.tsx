import { isModalityClass } from "../../content/schemas/glossConventions.pure.ts";
import type { Inline } from "../../content/schemas/inlines.ts";
import type { GlossUnit } from "../../content/schemas/source.ts";
import { GlossAtoms, GlossPair } from "./GlossPair.tsx";
import { type GlossAtom, glossStream, type SentenceAtom } from "./glossStream.ts";
import { renderInlines } from "./inlines.tsx";
import { speakMath } from "./mathSpeech.ts";

export interface GlossSentenceProps {
  readonly sentenceId: string;
  readonly germanText: string;
  readonly glossUnit?: GlossUnit | undefined;
  readonly englishTranslation?: string | undefined;
  readonly paperSlug?: string | undefined;
  readonly showReasoningWords?: boolean | undefined;
  /** The modality vocabulary the server resolved for this edition. */
  readonly modalityClasses: readonly string[];
  /** The sentence's formulas and footnote marks, in offsets of germanText (glossStream.ts). */
  readonly atoms?: readonly SentenceAtom[] | undefined;
  /**
   * The sentence's own inlines (sentenceInlines.ts), printed when it has no gloss unit, so its
   * formulas are KaTeX. germanText is plain text, where a formula is its TeX source.
   */
  readonly germanInlines?: readonly Inline[] | undefined;
  /**
   * The section element's id. By default the sentence id, which is the fragment a link names. A
   * heading's gloss passes null: it is printed under the heading element, which already carries the
   * block id (GlossFace.tsx), and a second element with that id would be a duplicate.
   */
  readonly elementId?: string | null | undefined;
}

/**
 * Where an unglossed sentence sends the reader: the same sentence on the parallel face's own
 * route. This was `/papers/<paper>/?view=parallel#<id>`, the paper's landing page, which renders
 * no face and has no sentence ids. The shape is faceLinkHref's (paperRoutes.ts), written out here
 * because that module reads the file system and this subtree does not (GlossFace.tsx, am-bwnf);
 * glossUnglossedSentence.test.tsx holds the two equal.
 */
export function parallelSentenceHref(paperSlug: string, sentenceId: string): string {
  return `/papers/${paperSlug}/view/parallel/#${sentenceId}`;
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
  modalityClasses: readonly string[],
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
  atoms,
  germanInlines,
  elementId,
}: GlossSentenceProps) {
  const domId = elementId === null ? undefined : (elementId ?? sentenceId);
  // No gloss unit yet: the German as printed, and one quiet line linking the same sentence on the
  // parallel face. What the gloss does not cover is named once, at the top of the face (GlossFace.tsx
  // unglossedSections); a boxed notice under every such sentence said it 87 times on Brownian motion.
  if (!glossUnit) {
    return (
      <section
        className="gloss-sentence gloss-sentence-missing"
        id={domId}
        data-sentence-id={sentenceId}
        data-source-sentence="true"
        // A fragment target, not a scroll region: nothing in the CSS gives a gloss
        // sentence overflow or a height, so tabIndex={0} put every sentence in the tab
        // order for nothing. -1 keeps it focusable for the #sentenceId deep link, which
        // is what the return-to-the-exact-sentence route needs.
        tabIndex={-1}
        aria-labelledby={`sentence-german-${sentenceId}`}
      >
        <div className="sentence-german-unadorned" id={`sentence-german-${sentenceId}`} lang="de">
          {germanInlines
            ? renderInlines(
                germanInlines,
                { terms: { paper: paperSlug, holder: sentenceId } },
                `gloss-de-${sentenceId}`,
              )
            : germanText}
        </div>
        <p className="gloss-parallel-line">
          <a
            href={parallelSentenceHref(paperSlug, sentenceId)}
            className="parallel-fallback-link"
            data-parallel-fallback="true"
          >
            Read this sentence in the parallel face
          </a>
        </p>
      </section>
    );
  }

  const reasoningWords = showReasoningWords
    ? extractReasoningWords(glossUnit, modalityClasses)
    : [];

  // The German line as printed: words with their glosses, and the formulas and punctuation
  // between them. It is used only when its words are exactly the unit's tokens; otherwise the
  // unit and the German disagree, and the line falls back to the unit's words, marked
  // data-gloss-stream="word-only" so a test can see it.
  const stream = glossStream(germanText, atoms);
  const printed =
    stream.words.length === glossUnit.tokens.length &&
    stream.words.every((w, i) => w === glossUnit.tokens[i]?.german);
  const fullGerman = printed
    ? stream.clusters
        .map((c) => {
          const said = (a: GlossAtom) => (a.kind === "math" ? speakMath(a.node.latex) : a.text);
          return c.kind === "word"
            ? `${c.leading.map(said).join("")}${glossUnit.tokens[c.tokenIndex]?.german ?? ""}${c.trailing.map(said).join("")}`
            : c.atoms.map(said).join("");
        })
        .join(" ")
    : glossUnit.tokens.map((t) => t.german).join(" ");
  const fullGlosses = glossUnit.tokens.map((t) => t.english || t.german).join(" ");

  return (
    <section
      className="gloss-sentence"
      id={domId}
      data-sentence-id={sentenceId}
      data-source-sentence="true"
      // As above: a fragment target, not a scroll region. This sentence already carries
      // real tab stops in its actions nav, so tabIndex={0} added a redundant stop in
      // front of each one of them, the whole length of the reading face.
      tabIndex={-1}
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
            <li data-reasoning-action>
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
      <div
        className="gloss-pairs-container"
        data-pairs-container="true"
        data-gloss-stream={printed ? "printed" : "word-only"}
      >
        {printed
          ? stream.clusters.map((cluster) => {
              if (cluster.kind === "atoms") {
                return (
                  <GlossAtoms
                    key={`${sentenceId}-atoms-${cluster.start}`}
                    atoms={cluster.atoms}
                    keyPrefix={`${sentenceId}-a${cluster.start}`}
                    terms={{ paper: paperSlug, holder: sentenceId }}
                  />
                );
              }
              const idx = cluster.tokenIndex;
              const token = glossUnit.tokens[idx];
              if (!token) return null;
              const multiword = glossUnit.multiwordUnits?.find((mw) =>
                mw.tokenIndices.includes(idx),
              );
              return (
                <GlossPair
                  key={`${sentenceId}-tok-${idx}-${token.german}`}
                  token={token}
                  tokenIndex={idx}
                  multiwordUnit={multiword}
                  isMultiwordFirst={multiword ? multiword.tokenIndices[0] === idx : true}
                  showReasoningWords={showReasoningWords}
                  modalityClasses={modalityClasses}
                  leading={cluster.leading}
                  trailing={cluster.trailing}
                  terms={{ paper: paperSlug, holder: sentenceId }}
                />
              );
            })
          : Array.from(glossUnit.tokens.entries()).map(([idx, token]) => {
              const multiword = glossUnit.multiwordUnits?.find((mw) =>
                mw.tokenIndices.includes(idx),
              );
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
                {" · "}
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
