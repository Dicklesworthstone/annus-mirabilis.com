import type { ReactNode } from "react";
import type { CompiledEssay } from "../../content/essays/load.ts";
import type { EssayInline } from "../../content/essays/markdown.ts";
import { ESSAY_SERIES, essayFailure } from "../../content/schemas/essay.ts";
import { renderInlines } from "../../reader/faces/inlines.tsx";

function valueText(text: string): ReactNode {
  const scientific = /^(.*?) × 10\^(-?\d+)(.*)$/.exec(text);
  return scientific ? <>{scientific[1]} × 10<sup>{scientific[2]}</sup>{scientific[3]}</> : text;
}

function EssayInlines({
  essay,
  inlines,
}: {
  essay: CompiledEssay;
  inlines: readonly EssayInline[];
}) {
  return inlines.map((inline, index) => {
    const key = "inline-" + index;
    if (inline.kind === "text") return <span key={key}>{inline.text}</span>;
    if (inline.kind === "link") {
      const link = essay.links.get(inline.anchorId);
      if (!link) return essayFailure(essay.slug, "Unresolved rendered link " + inline.anchorId);
      return <a key={key} href={link.href}>{inline.text}</a>;
    }
    const value = essay.values.get(inline.id);
    if (!value) return essayFailure(essay.slug, "Unresolved rendered value " + inline.id);
    return (
      <span key={key} className="essay-value" data-essay-value={inline.id}>
        {valueText(value.text)}
      </span>
    );
  });
}

/** All text, sources, transfers and equation markup are present in the server-rendered page. */
export function EssayReading({ essay }: { essay: CompiledEssay }) {
  const headings = essay.blocks.filter((block) => block.kind === "heading");
  return (
    <article className="essay-reading" data-edition-status="explanatory-preview">
      <header className="page-intro">
        <p className="eyebrow">
          <a href="/essays/">Reading the reasoning</a> · Essay {essay.number}
        </p>
        <h1 id="essay-title">{essay.title}</h1>
        <p className="lead">{essay.r0Summary}</p>
        <p className="essay-label">{essay.label}</p>
      </header>
      <nav className="essay-toc" aria-label="In this essay">
        <h2>In this essay</h2>
        <ul>
          {headings.map((heading) => (
            <li key={heading.id}><a href={"#" + heading.id}>{heading.text}</a></li>
          ))}
          <li><a href="#in-the-papers">Where this appears in the papers</a></li>
          <li><a href="#transfers">The same move elsewhere</a></li>
          <li><a href="#limits">What this essay does not claim</a></li>
          <li><a href="#citations">Sources</a></li>
        </ul>
      </nav>
      <div className="essay-body">
        {essay.blocks.map((block) => {
          if (block.kind === "heading") return <h2 key={block.id} id={block.id}>{block.text}</h2>;
          if (block.kind === "paragraph")
            return (
              <p key={block.id} id={block.id}>
                <EssayInlines essay={essay} inlines={block.inlines} />
              </p>
            );
          if (block.kind === "list")
            return (
              <ul key={block.id} id={block.id}>
                {block.items.map((inlines, index) => (
                  <li key={block.id + "-" + index}>
                    <EssayInlines essay={essay} inlines={inlines} />
                  </li>
                ))}
              </ul>
            );
          if (block.kind === "quotation") {
            const link = essay.links.get(block.anchorId);
            if (!link?.source) return essayFailure(essay.slug, "Unresolved source quotation.");
            return (
              <figure className="essay-quotation" id={block.id} key={block.id}>
                <blockquote lang={link.source.lang ?? "de"}>
                  {renderInlines(
                    link.source.inlines,
                    { footnoteTarget: () => undefined, idPrefix: block.id + "-" },
                    block.id,
                  )}
                </blockquote>
                <figcaption>
                  <a href={link.href}>{link.title}</a> · German source text; follow the source
                  link for its edition notice.
                </figcaption>
              </figure>
            );
          }
          const equation = essay.renderedEquations.get(block.equationId);
          if (!equation) return essayFailure(essay.slug, "Unresolved rendered equation.");
          return (
            <figure className="essay-equation" key={block.id} id={block.id}>
              <div className="essay-equation-visual" aria-hidden="true"
                {...{ dangerouslySetInnerHTML: { __html: equation.html } }} />
              <div className="essay-equation-mathml"
                {...{ dangerouslySetInnerHTML: { __html: equation.mathml } }} />
              <figcaption>
                {equation.spoken} <span className="fine">Modern model notation.</span>
              </figcaption>
            </figure>
          );
        })}
      </div>
      <section
        id="in-the-papers"
        className="essay-references"
        aria-labelledby="in-the-papers-title"
      >
        <h2 id="in-the-papers-title">Where this appears in the papers</h2>
        <p>
          Follow a passage or try the associated instrument. The return links below point to
          the paragraph that uses it.
        </p>
        <ul>
          {[...essay.links.values()].map((link) => (
            <li key={link.anchorId}>
              <a href={link.href}>{link.title}</a>
              <p>{link.role}</p>
              {link.usedAt.map((id, index) => <a className="essay-return" key={id} href={"#" + id}>
                Return to essay paragraph{link.usedAt.length > 1 ? " " + (index + 1) : ""}
              </a>)}
            </li>
          ))}
        </ul>
      </section>
      <section id="transfers" className="essay-transfers" aria-labelledby="transfers-title">
        <h2 id="transfers-title">The same move elsewhere</h2>
        <p>
          These contemporary examples transfer one part of the reasoning. Each states where
          the comparison stops.
        </p>
        {essay.transferExamples.map((transfer) => (
          <section
            key={transfer.id}
            id={"transfer-" + transfer.id}
            aria-labelledby={transfer.id + "-title"}
          >
            <h3 id={transfer.id + "-title"}>{transfer.domain}</h3>
            <p>{transfer.example}</p>
            <h4>The shared move</h4>
            <p>{transfer.sharedMove}</p>
            <h4>Where it stops</h4>
            <p>{transfer.whereItStops}</p>
            <a className="essay-permalink" href={"#transfer-" + transfer.id}>
              Link to this example
            </a>
          </section>
        ))}
      </section>
      <section id="limits" className="essay-limits" aria-labelledby="limits-title">
        <h2 id="limits-title">What this essay does not claim</h2>
        <ul>{essay.limits.map((limit) => <li key={limit}>{limit}</li>)}</ul>
      </section>
      <section id="citations" className="essay-citations" aria-labelledby="citations-title">
        <h2 id="citations-title">Sources</h2>
        <p>
          The paper links above identify the passages used. Bibliographic records identify
          the editions; they do not imply that these contemporary interpretations have
          completed independent review.
        </p>
        <ol>
          {essay.bibliography.map((citation) => <li key={citation.id}>
            <a href={citation.url}>{citation.title}</a>. {citation.locator}
          </li>)}
        </ol>
      </section>
      <nav id="related" className="essay-related" aria-label="Continue reading">
        <h2>Continue reading</h2>
        <ul>
          {essay.related.map((slug) => <li key={slug}>
            <a href={"/essays/" + slug + "/"}>
              {ESSAY_SERIES.find((entry) => entry.slug === slug)?.title}
            </a>
          </li>)}
          <li><a href="/tours/full-course/">Place these essays in the full course</a></li>
          <li><a href="/essays/">All available essays</a></li>
        </ul>
      </nav>
    </article>
  );
}
