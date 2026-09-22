import { Formula } from "../components/edition/Formula";
import { FoundationConstruction } from "../components/foundations/FoundationConstruction.tsx";
import type { Block, Foundation } from "../content/schemas/reading";
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
}: {
  blocks: readonly Block[];
  foundations: readonly Foundation[];
  embed?: boolean;
  contextLabel?: string | undefined;
}) {
  return (
    <>
      {blocks.map((block) => {
        if (block.kind === "paragraph") return <p key={`p-${block.text}`}>{block.text}</p>;
        if (block.kind === "formula")
          return (
            <div key={`formula-${block.latex}`}>
              <Formula latex={block.latex} />
              <p className="spoken-math">{block.spoken}</p>
            </div>
          );
        if (block.kind === "steps")
          return (
            <ol className="derivation-steps" key={`steps-${block.items.join("|")}`}>
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          );
        const foundation = foundations.find((f) => f.id === block.id);
        if (!foundation) throw new Error(`Unresolved foundation ${block.id}.`);
        return embed ? (
          <aside
            className="foundation-inline"
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
   * Depth of this body's own headings. Defaults to 3, which is right where a paper page has
   * already introduced the foundation under an <h2> (PaperReader, PaperPage). The standalone
   * /foundations/[concept] route has only its <h1> above this, so it passes 2; without that it
   * skipped a level on all 27 pages.
   */
  headingLevel?: 2 | 3;
}) {
  const SectionHeading = headingLevel === 2 ? "h2" : "h3";
  return (
    <>
      <p className="foundation-question">{foundation.question}</p>
      <ReadingBlocks blocks={foundation.explanation} foundations={foundations} />
      <SectionHeading>{foundation.exampleTitle ?? "One worked example"}</SectionHeading>
      <ReadingBlocks blocks={foundation.example} foundations={foundations} />
      <p className="notice">A stopping point: {foundation.stoppingPoint}</p>
      <FoundationConstruction foundationId={foundation.id} />
      {foundation.prerequisites.length > 0 && (
        <nav
          className="prerequisites"
          aria-label={
            contextLabel
              ? `Prerequisites for ${foundation.title} (${contextLabel})`
              : `Prerequisites for ${foundation.title}`
          }
        >
          {foundation.prerequisites.map((p) => {
            const prereqId = typeof p === "string" ? p : p.foundationId.replace(/^foundation:/, "");
            return (
              <FoundationLink
                key={prereqId}
                id={prereqId}
                title={foundations.find((f) => f.id === prereqId)?.title ?? prereqId}
              />
            );
          })}
        </nav>
      )}
    </>
  );
}
