import { Formula } from "../components/edition/Formula";
import { foundationConstructionId } from "../components/foundations/constructionIds.ts";
import { LazyFoundationConstruction } from "../components/foundations/LazyFoundationConstruction.tsx";
import "../components/foundations/foundations.css";
import { type HeadingLevel, headingTag } from "../components/foundations/headingLevel.ts";
import type { Block, Foundation } from "../content/schemas/reading";
import type { CompiledEquation } from "../equations/viewTypes.ts";
import foundationPayload from "../generated/foundation-equations.json";
import { ColouredFormula } from "./ColouredFormula.tsx";
import type { ExplanationScope } from "./explanationInlines.ts";
import { InlineMathText } from "./InlineMathText.tsx";
export function FoundationLink({
  id,
  title,
  caption,
  ariaLabel,
}: {
  id: string;
  title: string;
  caption?: string;
  ariaLabel?: string;
}) {
  return (
    <a
      href={`/foundations/${id}/`}
      data-foundation={id}
      data-return-caption={caption}
      aria-label={ariaLabel}
    >
      {title}
    </a>
  );
}
export function ReadingBlocks({
  blocks,
  foundations,
  embed = false,
  contextLabel,
  equations,
  scope,
}: {
  blocks: readonly Block[];
  foundations: readonly Foundation[];
  embed?: boolean;
  contextLabel?: string | undefined;
  /** The paper's compiled equations by id, so a formula that names records shows them coloured. */
  equations?: ReadonlyMap<string, CompiledEquation> | undefined;
  /** An explanation passage's scope, so its inline formulas are coloured (dispatch 273). */
  scope?: ExplanationScope | undefined;
}) {
  return (
    <>
      {blocks.map((block) => {
        if (block.kind === "paragraph")
          return (
            <p key={`p-${block.text}`}>
              <InlineMathText text={block.text} scope={scope} />
            </p>
          );
        if (block.kind === "formula") {
          // Every named record must resolve; otherwise the formula's own text, never a partial one.
          const named = (block.equations ?? []).flatMap((id) => {
            const equation = equations?.get(id);
            return equation ? [equation] : [];
          });
          const coloured = named.length > 0 && named.length === block.equations?.length;
          return (
            <div key={`formula-${block.latex}`}>
              {coloured ? <ColouredFormula equations={named} /> : <Formula latex={block.latex} />}
              <p className="spoken-math">{block.spoken}</p>
            </div>
          );
        }
        if (block.kind === "steps")
          return (
            <ol className="derivation-steps" key={`steps-${block.items.join("|")}`}>
              {block.items.map((item) => (
                <li key={item}>
                  <InlineMathText text={item} scope={scope} />
                </li>
              ))}
            </ol>
          );
        const foundation = foundations.find((f) => f.id === block.id);
        if (!foundation) throw new Error(`Unresolved foundation ${block.id}.`);
        return embed ? (
          <aside
            className="foundation-inline callout-aside"
            key={`foundation-${block.id}`}
            aria-label={
              contextLabel
                ? `Foundation: ${foundation.title} (${contextLabel})`
                : `Foundation: ${foundation.title}`
            }
          >
            <p className="eyebrow">A tool for this step</p>
            <h4>{foundation.title}</h4>
            <FoundationBody
              foundation={foundation}
              foundations={foundations}
              contextLabel={contextLabel}
              headingLevel={5}
            />
          </aside>
        ) : (
          <p className="foundation-link" key={`foundation-link-${block.id}`}>
            <FoundationLink
              id={block.id}
              title={`Open the foundation: ${foundation.title}`}
              caption={block.returnCaption}
            />
          </p>
        );
      })}
    </>
  );
}
/**
 * The lessons' own equation records, so a lesson's formula that names them is shown coloured by
 * quantity, as a paper's are (owner's ruling: per-quantity colour on every explanation face). The
 * same map serves the /foundations/ page and every place a paper shows a lesson in place.
 */
const LESSON_EQUATIONS: ReadonlyMap<string, CompiledEquation> = new Map(
  (foundationPayload.equations as readonly CompiledEquation[]).map((e) => [e.id, e]),
);

export function FoundationBody({
  foundation,
  foundations,
  contextLabel,
  headingLevel = 3,
}: {
  foundation: Foundation;
  foundations: readonly Foundation[];
  contextLabel?: string | undefined;
  /**
   * Depth of the headings that divide the lesson into its parts. 3 under a paper's clarification
   * panel (PaperReader, PaperPage), whose own title is an h2; 2 on the standalone
   * /foundations/[concept] page, under its h1; 5 inline under the "A tool for this step" h4.
   *
   * Every part has a heading. Until 2026-09-22 only the worked example did, so on all 27 lessons
   * the question was a grey fine-print line and the explanation that answers it sat unlabelled
   * between the page title and the example.
   */
  headingLevel?: HeadingLevel;
}) {
  const Part = headingTag(headingLevel);
  return (
    <div className="foundation-lesson">
      <section className="foundation-part">
        <Part className="foundation-question">{foundation.question}</Part>
        <ReadingBlocks
          blocks={foundation.explanation}
          foundations={foundations}
          equations={LESSON_EQUATIONS}
        />
      </section>
      <section className="foundation-part">
        <Part className="foundation-part-title">
          {foundation.exampleTitle ? (
            <>
              <span className="foundation-part-kind">
                Worked example<span className="visually-hidden">: </span>
              </span>
              {foundation.exampleTitle}
            </>
          ) : (
            "One worked example"
          )}
        </Part>
        <ReadingBlocks
          blocks={foundation.example}
          foundations={foundations}
          equations={LESSON_EQUATIONS}
        />
      </section>
      {foundationConstructionId(foundation.id) && (
        <LazyFoundationConstruction foundationId={foundation.id} headingLevel={headingLevel} />
      )}
      <section className="foundation-part foundation-stop callout-limit">
        <Part className="foundation-part-title">Where this lesson stops</Part>
        <p>{foundation.stoppingPoint}</p>
      </section>
      {/* Extension sections are records of their own (content/foundations/extensions/), attached
          by the compiler. They go past the stopping point, so they come after it. */}
      {foundation.extensionSections?.map((section) => (
        <section key={section.id} className="foundation-part" data-extension-section={section.id}>
          <Part className="foundation-part-title">
            <span className="foundation-part-kind">
              Going further<span className="visually-hidden">: </span>
            </span>
            {section.title}
          </Part>
          <ReadingBlocks
            blocks={section.body}
            foundations={foundations}
            equations={LESSON_EQUATIONS}
          />
        </section>
      ))}
      {foundation.prerequisites.length > 0 && (
        <nav
          className="prerequisites"
          aria-label={
            contextLabel
              ? `Prerequisites for ${foundation.title} (${contextLabel})`
              : `Prerequisites for ${foundation.title}`
          }
        >
          <Part className="foundation-part-title">This lesson builds on</Part>
          <ul>
            {foundation.prerequisites.map((p) => {
              const prereqId =
                typeof p === "string" ? p : p.foundationId.replace(/^foundation:/, "");
              return (
                <li key={prereqId}>
                  <FoundationLink
                    id={prereqId}
                    title={foundations.find((f) => f.id === prereqId)?.title ?? prereqId}
                  />
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </div>
  );
}
