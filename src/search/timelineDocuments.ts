/** Search the chronology the page renders, including date kinds, source locators and limits. */
import {
  dateKindLabel,
  formatTimelineDate,
  TIMELINE_PAPER_NAMES,
  TIMELINE_TRACKS,
  type TimelineEntry,
} from "../discovery/timeline/model.ts";
import { type SearchDocument, validateSearchDocument } from "./core.ts";
import { type SearchProfile, searchProfile } from "./documents.ts";

export function timelineDocuments(
  entries: readonly TimelineEntry[],
  profile: SearchProfile,
): readonly SearchDocument[] {
  searchProfile(profile);
  // The chronology reuses the journey cards. It follows their existing search publication
  // policy rather than making an unreviewed source searchable in a stricter profile by moving it.
  if (profile !== "scaffold") return [];
  return entries
    .map((entry) => {
      const date = `${dateKindLabel(entry.date.kind)} ${formatTimelineDate(entry.date)}`;
      return validateSearchDocument({
        id: `timeline:${entry.id}`,
        type: "timeline",
        paper: entry.paper,
        section: "",
        lang: "en",
        route: "/timeline/",
        anchor: `t-${entry.id}`,
        face: "",
        title: `${entry.title} · ${date}`,
        text: [
          entry.summary,
          entry.limits,
          entry.printedDateLine,
          entry.parallelWorkBasis,
          ...entry.sources.map((source) => `${source.title} ${source.locator}`.trim()),
        ]
          .filter(Boolean)
          .join(" "),
        // Sorting bounds are deliberately absent: 1905-05-01 is not a recorded publication day
        // when the source says only May 1905.
        terms: [date, ...entry.sources.map((source) => source.locator)].filter(Boolean),
        scopeLabel: `${TIMELINE_TRACKS[entry.track].title} · ${TIMELINE_PAPER_NAMES[entry.paper] ?? entry.paper} · ${entry.date.precision === "range" ? "recorded range" : `${entry.date.precision} precision`}`,
      });
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
