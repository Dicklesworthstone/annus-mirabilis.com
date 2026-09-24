/**
 * THE WAY BACK FROM AN EXPLANATION TO THE PRINTED TEXT (am-bind-paragraphs-and-displays-me-u7bu).
 *
 * The German face links each printed paragraph to the passages that explain it; this lists, in a
 * passage, the printed paragraphs it explains, each with its one- or two-sentence overview (r0,
 * content/bindings) and a link to that paragraph on the German face. A closed disclosure, so it
 * opens without JavaScript and does not lengthen the passage until asked.
 */
import type { ParagraphBinding } from "../content/bindings/paragraphBindings.ts";

export function SourceParagraphs({
  paperId,
  bindings,
}: {
  paperId: string;
  bindings: readonly ParagraphBinding[];
}) {
  if (bindings.length === 0) return null;
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
            <a href={`/papers/${paperId}/view/german/#${b.unit}`}>{b.label}</a>: {b.r0}
          </li>
        ))}
      </ul>
    </details>
  );
}
