/** Search the public transfer questions and worked explanations, never reader answers. */
import type { ConnectionExercise } from "../discovery/connections/types.ts";
import { type SearchDocument, validateSearchDocument } from "./core.ts";
import { type SearchProfile, searchProfile } from "./documents.ts";

export function connectionExerciseDocuments(
  exercises: readonly ConnectionExercise[],
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  // These authored comparisons share the publication boundary of the connections page's
  // existing search documents. A new exercise does not confer a separate review status.
  if (profile !== "scaffold") return [];
  return exercises
    .map((exercise) =>
      validateSearchDocument({
        id: `connection-exercise:${exercise.id}`,
        type: "connection-thread",
        paper: "cross-paper",
        section: "",
        lang: "en",
        route: "/connections/",
        anchor: exercise.id,
        face: "",
        title: exercise.title,
        text: [
          ...exercise.introduction,
          ...exercise.sections.flatMap((section) => [
            section.title,
            ...section.paragraphs,
            ...section.parts.flatMap(({ kind, part }) => [
              part.prompt,
              part.workedExplanation,
              ...(kind === "explanation" && "criteria" in part ? part.criteria : []),
            ]),
            ...(section.links ?? []).map((link) => link.label),
          ]),
          ...exercise.links.map((link) => link.label),
        ].join(" "),
        // Slugs and checker internals are not search terms. Only the prose a reader sees
        // above contributes; numerical references and private drafts cannot leak into it.
        terms: [],
        scopeLabel:
          exercise.historicalStatus === "later-development"
            ? "Across the papers · transfer exercise · modern lens"
            : "Across the papers · transfer exercise",
      }),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}
