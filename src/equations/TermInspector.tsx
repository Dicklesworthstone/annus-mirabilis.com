import type { CSSProperties, ReactNode } from "react";
import type { TermFacts } from "./termFacts.ts";

/**
 * THE TERM INSPECTOR (dispatch 144 unit c): one pinned quantity, set out as a short list. Its
 * symbol and name, what it does in this formula, its unit and dimension, and its value, or one line
 * saying why there is none. The caller supplies the value line, because only the explorer can read
 * a laboratory's accepted snapshot.
 *
 * It holds no state and announces nothing: it is shown for a pinned quantity only, never for the
 * one under the pointer, and each caller keeps its own live region, which changes on a pin.
 */
export function TermInspector({
  name,
  glyphHtml,
  printedGlyphHtml,
  facts,
  value,
  style,
  glyphQuantityId,
  className,
  nodeId,
  children,
  inline = false,
}: {
  name: string;
  glyphHtml?: string | undefined;
  /** The glyph in Einstein's letters, shown instead under html[data-notation]. */
  printedGlyphHtml?: string | undefined;
  facts: TermFacts;
  value: ReactNode;
  style?: CSSProperties | undefined;
  /** Colours the glyph from the paper's sheet where no style carries the colour (the explorer). */
  glyphQuantityId?: string | undefined;
  /** Added to term-inspector: the explorer keeps its equation-inspector panel. */
  className?: string | undefined;
  /** The explorer's selected node, as data-inspector-node. */
  nodeId?: string | undefined;
  /** Links and actions below the facts: a lesson, or the laboratory input. */
  children?: ReactNode;
  /**
   * Phrasing content only, for a formula set inside a paragraph (a printed display on a reading
   * face, dispatch 224): the same facts in spans, as a labelled group, where a <p> may hold no
   * section, p or dl.
   */
  inline?: boolean | undefined;
}) {
  const glyph = (html: string, form: "modern" | "printed" | undefined) => (
    <span
      className="term-inspector-glyph katex"
      aria-hidden="true"
      data-quantity-id={glyphQuantityId}
      data-notation-form={form}
      {...{ dangerouslySetInnerHTML: { __html: html } }}
    />
  );
  const classes = className ? `term-inspector ${className}` : "term-inspector";
  if (inline)
    return (
      // biome-ignore lint/a11y/useSemanticElements: inline, a <fieldset> would end the paragraph the formula is printed in, and it groups form controls, not facts.
      <span
        className={classes}
        role="group"
        aria-label={`About ${name}`}
        data-inspector-node={nodeId}
        data-inline=""
        style={style}
      >
        <span className="term-inspector-name">
          {glyphHtml ? glyph(glyphHtml, printedGlyphHtml ? "modern" : undefined) : null}
          {printedGlyphHtml ? glyph(printedGlyphHtml, "printed") : null}
          <strong>{name}</strong>
        </span>
        <span className="term-inspector-facts">
          {facts.roles.length > 0 ? (
            <span className="term-inspector-fact">
              <span className="term-inspector-fact-name">In this formula</span>{" "}
              <span className="term-inspector-fact-value">
                {facts.roles.map((role, i) => (
                  <span key={`${role.title}\u0000${role.explanation}`}>
                    {i > 0 ? " " : null}
                    {role.title.toLowerCase() !== name.toLowerCase() ? (
                      <strong>{role.title}. </strong>
                    ) : null}
                    {role.explanation}
                  </span>
                ))}
              </span>
            </span>
          ) : null}
          <span className="term-inspector-fact">
            <span className="term-inspector-fact-name">Unit</span>{" "}
            <span className="term-inspector-fact-value">{facts.unit}</span>
          </span>
          <span className="term-inspector-fact">
            <span className="term-inspector-fact-name">Dimension</span>{" "}
            <span className="term-inspector-fact-value">{facts.dimension}</span>
          </span>
          <span className="term-inspector-fact">
            <span className="term-inspector-fact-name">Value</span>{" "}
            <span className="term-inspector-fact-value">{value}</span>
          </span>
        </span>
        {children}
      </span>
    );
  return (
    <section
      className={classes}
      aria-label={`About ${name}`}
      data-inspector-node={nodeId}
      style={style}
    >
      <p className="term-inspector-name">
        {glyphHtml ? glyph(glyphHtml, printedGlyphHtml ? "modern" : undefined) : null}
        {printedGlyphHtml ? glyph(printedGlyphHtml, "printed") : null}
        <strong>{name}</strong>
      </p>
      <dl className="term-inspector-facts">
        {facts.roles.length > 0 ? (
          <div>
            <dt>In this formula</dt>
            {/* One row however many records name the quantity: a note titled with the
                quantity's own name would only repeat it, so only a different title is shown. */}
            <dd>
              {facts.roles.map((role, i) => (
                <span key={`${role.title}\u0000${role.explanation}`}>
                  {i > 0 ? " " : null}
                  {role.title.toLowerCase() !== name.toLowerCase() ? (
                    <strong>{role.title}. </strong>
                  ) : null}
                  {role.explanation}
                </span>
              ))}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Unit</dt>
          <dd>{facts.unit}</dd>
        </div>
        <div>
          <dt>Dimension</dt>
          <dd>{facts.dimension}</dd>
        </div>
        <div>
          <dt>Value</dt>
          <dd>{value}</dd>
        </div>
      </dl>
      {children}
    </section>
  );
}

/** Upper-case lab ids as the site prints them: bm-01 is BM-01. */
export function labLabel(labId: string): string {
  return labId.toUpperCase();
}

/**
 * The value line where no laboratory drives this formula: said once, and where a named record binds
 * the quantity to a laboratory, a link to the laboratory that does compute it.
 */
export function SymbolicValue({ lab }: { lab?: string | undefined }) {
  if (!lab) return <>Symbolic here. No laboratory computes it on this page.</>;
  return (
    <>
      Symbolic here. <a href={`/lab/${lab}/`}>{labLabel(lab)}</a> computes it from the settings you
      give it.
    </>
  );
}
