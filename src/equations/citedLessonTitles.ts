import { ContentError } from "../content/compiler/json.ts";

/**
 * The title of every lesson a set of equations' notes cite, keyed by foundation id and sorted, so
 * a prerequisite link can name the lesson it opens (SemanticEquation's prerequisiteName). It is
 * written beside a payload's equations rather than into them, so each compiled equation stays
 * exactly what compileEquation returns. A note citing a foundation the compiled content does not
 * hold stops generation: a link to it would be a link to nothing.
 */
export function citedLessonTitles(
  equations: readonly { readonly notes: readonly { readonly foundation: string }[] }[],
  foundations: readonly { readonly id: string; readonly title: string }[],
): Record<string, string> {
  return Object.fromEntries(
    [...new Set(equations.flatMap((equation) => equation.notes.map((note) => note.foundation)))]
      .sort()
      .map((id) => {
        const foundation = foundations.find((f) => f.id === id);
        if (!foundation)
          throw new ContentError(
            "equation-note-foundation-missing",
            id,
            `An equation note cites the foundation ${id}, which the compiled content does not hold.`,
          );
        return [id, foundation.title];
      }),
  );
}
