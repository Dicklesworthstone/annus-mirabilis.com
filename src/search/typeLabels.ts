import type { SearchType } from "./core.ts";

/**
 * ONE HEADING PER SEARCH TYPE, FOR EVERY SURFACE THAT GROUPS RESULTS.
 *
 * There were two of these maps, one in CommandPalette.ts and one inside src/app/search/page.tsx, and
 * nothing compared them. The page's was typed Record<string, string>, listed ten of the then
 * seventeen types, and its order list decided what the page rendered at all, so 31 indexed documents
 * appeared in the palette and nowhere on /search/. They also disagreed about "misconception".
 *
 * Record<SearchType, string> means a new type does not compile until it has a heading, and there is
 * one place to add it.
 */
export const TYPE_LABELS: Readonly<Record<SearchType, string>> = {
  paper: "Papers",
  section: "Sections",
  argument: "Arguments",
  equation: "Equations",
  instrument: "Laboratories",
  foundation: "Foundations",
  result: "Argument synopses",
  "sentence-de": "German passages",
  "sentence-en": "English passages",
  glossary: "Notation and terms",
  // "Common wrong turns" is the heading PaperMargins renders for these on a paper page; the
  // palette said "Misconceptions", which is the entity name in AGENTS.md rather than a word a
  // reader has seen. One map now, so the two cannot drift again.
  misconception: "Common wrong turns",
  margin: "Historical notes",
  timeline: "Timeline",
  "knowledge-card": "Knowledge cards",
  person: "People",
  essay: "Essays",
  "connection-thread": "Connections",
  walkthrough: "Recorded walkthroughs",
  discovery: "Routes you could take",
  tour: "Tours",
  capstone: "Capstones",
};
