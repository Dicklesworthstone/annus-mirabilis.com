import { loadPaperMargins } from "../reader/marginRecords.ts";
import { parseWhatIsTrue } from "../reader/misconceptions/types.ts";

/**
 * THE WRONG TURNS ONE LABORATORY ANSWERS, FOR ITS OWN PAGE TO NAME (dispatch after 423).
 *
 * The link between a misconception and a laboratory ran one way. A misconception record names its
 * instrument and MisconceptionCallout draws "See it in the instrument"; the laboratory said nothing
 * back. Measured on rendered output on 2026-09-28, before this landed: 14 laboratories are named by
 * 22 misconception records, and all 14 pages, 336,819 characters of rendered text between them,
 * carried no occurrence of "misconception", "wrong turn", "tempting", "often said", "#misc" or
 * "#note-". A reader who arrived at a laboratory from anywhere other than a correction had no way
 * to learn which corrections it was built to settle.
 *
 * THE BINDING IS READ FROM THE RECORDS, NOT RESTATED HERE. `loadPaperMargins` is the same loader
 * the paper margins use, so a record added, retargeted or unbound reaches the laboratory page in
 * the same build, and a laboratory cannot claim a wrong turn no record gives it. Both places a
 * binding can live are read, `instrumentIds` and `intervention.instrumentId`, because PaperMargins
 * reads the union too and a record that used only the second would otherwise be invisible here
 * while being visible there.
 *
 * It computes nothing and ships nothing: records at build time, a server component above it.
 */

/** The four papers whose ledgers are on disk. A record is filed under exactly one of them. */
const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;

export type LabWrongTurn = Readonly<{
  id: string;
  paper: string;
  /** The claim as the record states it, which is what a reader recognises. */
  claim: string;
  /** The record's own one-breath answer, r0, not a summary written here. */
  overview: string;
  /** Where the full entry is, in the shape the results cards already link it by. */
  href: string;
}>;

let cache: Map<string, LabWrongTurn[]> | null = null;

function index(root: string): Map<string, LabWrongTurn[]> {
  if (cache) return cache;
  const byLab = new Map<string, LabWrongTurn[]>();
  for (const paper of PAPERS) {
    for (const record of loadPaperMargins(paper, root).misconceptions) {
      const labs = new Set<string>(record.instrumentIds ?? []);
      if (record.intervention.instrumentId) labs.add(record.intervention.instrumentId);
      if (labs.size === 0) continue;
      const entry: LabWrongTurn = {
        id: record.id,
        paper: record.paper,
        claim: record.temptingClaims[0] ?? "",
        overview: parseWhatIsTrue(record.whatIsTrue, record.id).r0,
        href: `/papers/${record.paper}/#misconception-${record.id}`,
      };
      for (const lab of labs) byLab.set(lab, [...(byLab.get(lab) ?? []), entry]);
    }
  }
  cache = byLab;
  return byLab;
}

/** The wrong turns a laboratory is named by, in ledger order, or an empty list. */
export function wrongTurnsForLab(
  lab: string,
  root: string = process.cwd(),
): readonly LabWrongTurn[] {
  return index(root).get(lab) ?? [];
}

/** Every laboratory a misconception record names, for a test that asks "did I miss one". */
export function labsWithWrongTurns(root: string = process.cwd()): readonly string[] {
  return [...index(root).keys()].sort();
}

/** Tests that write a ledger to a temporary root need the index rebuilt. */
export function resetLabWrongTurnsCacheForTests(): void {
  cache = null;
}
