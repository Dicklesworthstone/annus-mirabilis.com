import type { EditorialNote, PaperSlug } from "../../content/schemas/source.ts";
import {
  loadPaperMargins,
  type MarginCitation,
  MarginRecordError,
  type PaperMargins,
} from "../../reader/marginRecords.ts";

type ArgumentLimitKind =
  | "approximation"
  | "overreach"
  | "convention"
  | "disputed-argument"
  | "historical-scope";

type ArgumentLimitSelection = Readonly<{
  id: string;
  paper: PaperSlug;
  paperLabel: string;
  heading: string;
  kind: ArgumentLimitKind;
  noteId: string;
}>;

/** A route through existing margin records, not a second copy of their historical claims. */
const SELECTIONS: readonly ArgumentLimitSelection[] = [
  {
    id: "quantum-equation-and-interpretation",
    paper: "light-quanta",
    paperLabel: "Light quanta",
    heading: "An equation’s success does not settle the picture of light",
    kind: "historical-scope",
    noteId: "note-lq-b-millikan-verified-and-rejected",
  },
  {
    id: "independent-brownian-steps",
    paper: "brownian-motion",
    paperLabel: "Brownian motion",
    heading: "Independent steps need a suitable time interval",
    kind: "approximation",
    noteId: "note-bm-d-tau-and-the-ballistic-regime",
  },
  {
    id: "terrestrial-clocks",
    paper: "special-relativity",
    paperLabel: "Special relativity",
    heading: "The Earth-clock remark goes beyond the model",
    kind: "overreach",
    noteId: "note-sr-f-the-equator-clock-remark",
  },
  {
    id: "transverse-mass-conventions",
    paper: "special-relativity",
    paperLabel: "Special relativity",
    heading: "State the force convention before comparing masses",
    kind: "convention",
    noteId: "note-sr-transverse-mass-depends-on-the-force-convention",
  },
  {
    id: "additive-constant",
    paper: "mass-energy",
    paperLabel: "Mass–energy",
    heading: "The subtraction depends on a constant staying constant",
    kind: "disputed-argument",
    noteId: "note-me-b-additive-constant",
  },
  {
    id: "mass-change-and-rest-energy",
    paper: "mass-energy",
    paperLabel: "Mass–energy",
    heading: "The 1905 conclusion is a change in mass",
    kind: "historical-scope",
    noteId: "note-me-a-formula-absent",
  },
];

export const ARGUMENT_LIMIT_LABELS: Readonly<Record<ArgumentLimitKind, string>> = {
  approximation: "Approximation",
  overreach: "Overreach",
  convention: "Convention",
  "disputed-argument": "Disputed argument",
  "historical-scope": "Historical scope",
};

export type ArgumentLimit = ArgumentLimitSelection &
  Readonly<{
    note: EditorialNote;
    sources: readonly Readonly<{ citation: MarginCitation; locator: string | undefined }>[];
  }>;

/** Resolve every selected note and citation before rendering; never silently omit a gap. */
export function selectArgumentLimits(
  marginsByPaper: ReadonlyMap<PaperSlug, PaperMargins>,
): readonly ArgumentLimit[] {
  return SELECTIONS.map((selection) => {
    const margins = marginsByPaper.get(selection.paper);
    const note = margins?.notes.find((candidate) => candidate.id === selection.noteId);
    if (!margins || !note)
      throw new MarginRecordError(
        "argument-limit-note-missing",
        `Connections argument limits: "${selection.noteId}" is missing from ${selection.paper}'s margin notes.`,
      );
    const sources = note.sourceSupport.map((source) => {
      const citation = margins.citations.get(source.citationId);
      if (!citation)
        throw new MarginRecordError(
          "argument-limit-citation-missing",
          `Connections argument limits: "${note.id}" cites missing bibliography record "${source.citationId}".`,
        );
      return { citation, locator: source.locator };
    });
    return { ...selection, note, sources };
  });
}

/** The reader's loader checks the notes, inline mathematics and bibliography at build time. */
export function loadArgumentLimits(root: string = process.cwd()): readonly ArgumentLimit[] {
  const margins = new Map<PaperSlug, PaperMargins>();
  for (const { paper } of SELECTIONS)
    if (!margins.has(paper)) margins.set(paper, loadPaperMargins(paper, root));
  return selectArgumentLimits(margins);
}
