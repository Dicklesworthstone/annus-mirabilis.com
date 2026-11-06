/** Search the five authored objects shown on the 1904 desk, at their actual page anchors. */
import type { DeskObject } from "../discovery/desk/model.ts";
import { type SearchDocument, validateSearchDocument } from "./core.ts";
import { type SearchProfile, searchProfile } from "./documents.ts";

export function deskDocuments(
  objects: readonly DeskObject[],
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  // Match the existing chronology and knowledge-card policy. Moving the same historical
  // material onto a desk does not admit it to a stricter search publication profile.
  if (profile !== "scaffold") return [];
  return objects
    .map((object) =>
      validateSearchDocument({
        id: `desk:${object.id}`,
        type: "discovery",
        paper: object.journey,
        section: "",
        lang: "en",
        route: "/1904/",
        anchor: object.id,
        face: "",
        title: `${object.title} · The 1904 desk`,
        text: [object.question, object.description, object.unresolved, ...object.responses].join(
          " ",
        ),
        // The title already names the object. No extra weighting for a paper slug or a later
        // result; these entries lead to the questions that remain open on the desk itself.
        terms: [],
        scopeLabel: "The 1904 desk · reconstruction for learning",
      }),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}
