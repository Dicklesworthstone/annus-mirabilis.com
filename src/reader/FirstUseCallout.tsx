/**
 * The red first-use callout for a letter that is easily misread (firstUse.ts): Einstein's beta is
 * the modern gamma, paper 2's k is the viscosity. Its words are the concordance entry's own notes,
 * the ones /notation shows under "Notes", so the two cannot say different things.
 * Static and server-rendered; it reads the same with JavaScript off and in either notation.
 */
import type { ConcordanceEntry } from "../content/schemas/concordance.ts";

export function FirstUseCallout({ entry }: { entry: ConcordanceEntry }) {
  return (
    <aside className="callout-note first-use-callout" data-first-use={entry.id}>
      <p>
        <strong className="first-use-flag">Easily misread.</strong>{" "}
        {entry.notes ?? `Einstein’s ${entry.glyph.unicode}: ${entry.meaning}.`}{" "}
        <a href={`/notation/#${entry.id}`}>This letter in the notation concordance</a>
      </p>
    </aside>
  );
}
