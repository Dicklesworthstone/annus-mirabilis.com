import { Formula } from "../components/edition/Formula";
import type { Block, Foundation } from "../content/schemas/reading";
export function FoundationLink({
  id,
  title,
  caption,
}: {
  id: string;
  title: string;
  caption?: string;
}) {
  return (
    <a href={`/foundations/${id}/`} data-foundation={id} data-return-caption={caption}>
      {title}
    </a>
  );
}
export function ReadingBlocks({
  blocks,
  foundations,
  embed = false,
}: {
  blocks: readonly Block[];
  foundations: readonly Foundation[];
  embed?: boolean;
}) {
  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === "paragraph") return <p key={i}>{block.text}</p>;
        if (block.kind === "formula")
          return (
            <div key={i}>
              <Formula latex={block.latex} />
              <p className="spoken-math">{block.spoken}</p>
            </div>
          );
        if (block.kind === "steps")
          return (
            <ol className="derivation-steps" key={i}>
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ol>
          );
        const foundation = foundations.find((f) => f.id === block.id);
        if (!foundation) throw new Error(`Unresolved foundation ${block.id}.`);
        return embed ? (
          <aside
            className="foundation-inline"
            key={i}
            aria-label={`Foundation: ${foundation.title}`}
          >
            <p className="eyebrow">A tool for this step</p>
            <h4>{foundation.title}</h4>
            <FoundationBody foundation={foundation} foundations={foundations} />
          </aside>
        ) : (
          <p className="foundation-link" key={i}>
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
}: {
  foundation: Foundation;
  foundations: readonly Foundation[];
}) {
  return (
    <>
      <p className="foundation-question">{foundation.question}</p>
      <ReadingBlocks blocks={foundation.explanation} foundations={foundations} />
      <h3>One worked example</h3>
      <ReadingBlocks blocks={foundation.example} foundations={foundations} />
      <p className="notice">A stopping point: {foundation.stoppingPoint}</p>
      {foundation.prerequisites.length > 0 && (
        <nav className="prerequisites" aria-label={`Prerequisites for ${foundation.title}`}>
          {foundation.prerequisites.map((id) => (
            <FoundationLink
              key={id}
              id={id}
              title={foundations.find((f) => f.id === id)?.title ?? id}
            />
          ))}
        </nav>
      )}
    </>
  );
}
