/** Search projects the same compiled prose and stable transfer IDs that the essay pages render. */
import type { CompiledEssay } from "../content/essays/load.ts";
import { type SearchDocument, validateSearchDocument } from "./core.ts";
import { type SearchProfile, searchProfile } from "./documents.ts";

export function essayDocuments(essays: readonly CompiledEssay[],
  profile: SearchProfile): readonly SearchDocument[] {
  searchProfile(profile);
  // Empty review records do not become reviewed content by being indexed.
  if (profile !== "scaffold") return [];
  return essays.flatMap((essay) => {
    const common = {
      type: "essay", paper: "cross-paper", section: "", lang: "en", face: "",
      route: "/essays/" + essay.slug + "/", scopeLabel: "Contemporary methodological reading",
    };
    return [
      validateSearchDocument({
        ...common, id: "essay:" + essay.slug, title: essay.title, anchor: "essay-title",
        text: essay.searchText,
        terms: [essay.slug.replaceAll("-", " "),
          ...essay.transferExamples.map((example) => example.domain)],
      }),
      ...essay.transferExamples.map((example) => validateSearchDocument({
        ...common, id: "essay-transfer:" + example.id, title: example.domain + " · " + essay.title,
        anchor: "transfer-" + example.id,
        text: [example.example, example.sharedMove, example.whereItStops].join(" "),
        terms: [example.domain, essay.title],
      })),
    ];
  }).sort((a, b) => a.id.localeCompare(b.id));
}
