/**
 * THE WAY BACK FROM AN EXPLANATION TO THE PRINTED TEXT (am-bind-paragraphs-and-displays-me-u7bu).
 *
 * The German face links each printed paragraph to the passages that explain it; this lists, in a
 * passage, the printed paragraphs it explains, each with its one- or two-sentence overview (r0,
 * content/bindings) and a link to that paragraph on the German face. A closed disclosure, so it
 * opens without JavaScript and does not lengthen the passage until asked.
 *
 * A paragraph is linked only when the German face publishes its anchor (germanAnchors,
 * paperSourceFaces.ts). Relativity is bound before its German text is on the site
 * (am-bind-paragraphs-and-displays-sr-nlea), so its paragraphs are listed with their overviews and
 * their links wait for the text, rather than naming an id no page has. A caller that passes no
 * anchors vouches that the face has every one (the Brownian page, whose draft covers the paper).
 */
import type { ParagraphBinding } from "../content/bindings/paragraphBindings.ts";

export function SourceParagraphs({
  paperId,
  bindings,
  germanAnchors,
}: {
  paperId: string;
  bindings: readonly ParagraphBinding[];
  germanAnchors?: ReadonlySet<string>;
}) {
  if (bindings.length === 0) return null;
  const linked = (unit: string) => germanAnchors === undefined || germanAnchors.has(unit);
  const waiting = bindings.filter((b) => !linked(b.unit)).length;
  return (
    <details className="passage-source-paragraphs">
      <summary>
        {bindings.length === 1
          ? "The printed paragraph this passage explains"
          : `The ${bindings.length} printed paragraphs this passage explains`}
      </summary>
      <ul>
        {bindings.map((b) => (
          <li key={b.unit} data-source-paragraph={b.unit}>
            {linked(b.unit) ? (
              <a href={`/papers/${paperId}/view/german/#${b.unit}`}>{b.label}</a>
            ) : (
              b.label
            )}
            : {b.r0}
          </li>
        ))}
      </ul>
      {waiting > 0 && (
        <p className="fine" data-source-paragraphs-waiting={waiting}>
          {waiting === bindings.length
            ? bindings.length === 1
              ? "The German text of this paragraph is not on this site yet, so it has no link."
              : "The German text of these paragraphs is not on this site yet, so they have no links."
            : `The German text of ${waiting} of these paragraphs is not on this site yet, so ${waiting === 1 ? "it has no link" : "they have no links"}.`}
        </p>
      )}
    </details>
  );
}
