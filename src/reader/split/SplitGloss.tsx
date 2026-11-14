import { Fragment } from "react";
import type { GlossUnit, SourceBlock, TranslationUnit } from "../../content/schemas/source.ts";
import type { AlignmentIndex } from "../faces/alignment.ts";
import { glossDisplaysIn } from "../faces/displayClaims.ts";
import { GlossSentence } from "../faces/GlossSentence.tsx";
import { sentenceAtoms } from "../faces/glossStream.ts";
import { renderInlines } from "../faces/inlines.tsx";
import { speakInlines } from "../faces/mathSpeech.ts";
import { sentenceInlines } from "../faces/sentenceInlines.ts";
import { SPLIT_GLOSS_PREFIX } from "./selection.ts";

/** The authored gloss of a source row, with displays kept beside their introducing sentence. */
export function SplitGloss({
  block,
  glosses,
  translations,
  alignment,
  equations,
  modalityClasses,
}: {
  block: SourceBlock;
  glosses: ReadonlyMap<string, GlossUnit>;
  translations: ReadonlyMap<string, TranslationUnit>;
  alignment: AlignmentIndex;
  equations: ReadonlyMap<string, SourceBlock>;
  modalityClasses: readonly string[];
}) {
  const placed = new Set<string>();
  return (
    <div
      className="split-source-language"
      data-split-language="gloss"
      data-split-gloss-block={block.id}
      hidden
    >
      <p className="split-language-label">Interlinear gloss</p>
      {block.sentenceSpans.map((span) => {
        const english = (alignment.sourceToTarget.get(span.id) ?? [])
          .map((id) => translations.get(id))
          .flatMap((unit) => (unit ? [speakInlines(unit.inlines)] : []))
          .join(" ");
        return (
          <Fragment key={span.id}>
            <GlossSentence
              sentenceId={span.id}
              idPrefix={SPLIT_GLOSS_PREFIX}
              germanText={block.diplomaticText.slice(span.span.start, span.span.end)}
              atoms={sentenceAtoms(block.inlines, span.span)}
              germanInlines={sentenceInlines(block.inlines, span.span)}
              glossUnit={glosses.get(span.id)}
              englishTranslation={english || undefined}
              paperSlug={block.paper}
              showReasoningWords
              modalityClasses={modalityClasses}
            />
            {glossDisplaysIn(block, span.span, equations, placed).map((equation) => (
              <div className="split-gloss-display" key={equation.id}>
                {renderInlines(
                  equation.inlines.map((node) =>
                    node.kind === "math"
                      ? { ...node, display: true, equationId: equation.id }
                      : node,
                  ),
                  { displayIdPrefix: SPLIT_GLOSS_PREFIX, misprintNotes: block.paper },
                  `${SPLIT_GLOSS_PREFIX}${equation.id}`,
                )}
              </div>
            ))}
          </Fragment>
        );
      })}
    </div>
  );
}
