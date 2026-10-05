/**
 * THE HISTORIAN'S MARGIN IS AN INVENTORY, NOT A COUNT (am-8gbg).
 *
 * r0, r1 and r2 are required of every explanation record, so losing one is already a refusal:
 * `readRecord` returns nothing and the census reports `explanation-missing-level`. r3, the
 * historian's margin, is optional. That is correct as an authoring rule -- 129 of the 200 printed
 * displays have no margin yet and the site ships -- and it meant that a record which HAD one could
 * lose it and nothing in the pipeline would notice. The count would move from 71 to 70 in a log
 * nobody diffs.
 *
 * So the 71 are recorded BY ID, in historianMargin.baseline.json, and two lanes watch two different
 * questions:
 *
 * - The GATE lane (`scripts/check-equation-explanations.ts`, family `fast`, every run, all three
 *   release profiles) asks the coarse question: has a paper's margin count fallen below what was
 *   recorded? It catches a loss and is blind to a swap, which is the price of being a count.
 * - The BUN lane (historianMargin.test.ts) asks the fine question: is every recorded id still
 *   carrying its margin, and does any record carry one that was never written down? It catches the
 *   swap a count cannot see, and it names the record.
 *
 * The split is deliberate and is AGENTS.md's rule about a gate's proof not living only in the lane
 * that gate controls. If the bun lane refuses to start -- which it did for 49 commits once -- the
 * gate lane still prints each paper's number every run and still refuses a drop. If the gate lane is
 * skipped, the bun lane still names the record. Neither half is the other's instrument.
 *
 * The baseline only grows. An authored margin is added to it in the same change, for the same reason
 * the R2 ratchet forbids a slack row: an inventory that silently under-counts is how the gap gets
 * discovered by an audit six months later, which is the sentence this bead was filed about.
 */
import baseline from "./historianMargin.baseline.json" with { type: "json" };

export type MarginBaseline = Readonly<{
  bead: string;
  measuredAt: string;
  measuredBy: string;
  /** Records compiled across every paper when the inventory was taken; its denominator. */
  examined: number;
  /** Records carrying an r3 when the inventory was taken; the sum of the rows below. */
  withMargin: number;
  papers: Readonly<Record<string, readonly string[]>>;
}>;

export const MARGIN_BASELINE = baseline as MarginBaseline;

/** The papers the inventory covers, in its own order. */
export function baselinedPapers(): readonly string[] {
  return Object.keys(MARGIN_BASELINE.papers);
}

/**
 * The recorded ids for one paper, or undefined when the paper has no row.
 *
 * Undefined is a refusal rather than an empty set on purpose: a paper with no row is either new
 * (molecular-dimensions, when its displays land) or a renamed slug, and both are moments to take a
 * measurement rather than to pass on zero. An empty set would make every check below vacuously true.
 */
export function recordedMargins(paper: string): readonly string[] | undefined {
  return MARGIN_BASELINE.papers[paper];
}

/** The count the gate lane holds a paper to: as many margins as were recorded, or more. */
export function marginFloor(paper: string): number | undefined {
  return recordedMargins(paper)?.length;
}

/**
 * The gate lane's verdict for one paper: a sentence when the count fell or the paper has no row,
 * and undefined when it is at or above its floor.
 *
 * A count, deliberately. It says how many and not which, and the message says so, because a reader
 * who sees only this line should not believe it identified the record.
 */
export function marginCountRefusal(paper: string, withMargin: number): string | undefined {
  const floor = marginFloor(paper);
  if (floor === undefined) {
    return (
      `${paper} has no row in ${BASELINE_FILE}, so no floor can be held against it. ` +
      "Record its historian's margins by id before this paper is gated."
    );
  }
  if (withMargin < floor) {
    return (
      `${paper}: ${withMargin} of its records carry a historian's margin, ${floor} were recorded on ` +
      `${MARGIN_BASELINE.measuredAt}. A margin that was authored is not removed. This line counts ` +
      `them and does not name them; historianMargin.test.ts says which record lost one.`
    );
  }
  return undefined;
}

/** Where the inventory lives, for a refusal that has to tell a reader what to edit. */
export const BASELINE_FILE = "src/equations/printed/historianMargin.baseline.json";

export type MarginDrift = Readonly<{
  /** Recorded ids whose record no longer carries an r3; a margin was removed. */
  lost: readonly string[];
  /** Ids carrying an r3 that the inventory does not record; a margin was authored, unrecorded. */
  unrecorded: readonly string[];
  /** Recorded ids with no record at all; the inventory names something that is gone. */
  ghosts: readonly string[];
}>;

/**
 * The bun lane's verdict for one paper, by identity.
 *
 * `withMargin` are the paper's compiled records that carry an r3; `allDisplays` is every compiled
 * record, which is what tells a lost margin (the record is there, the r3 is not) from a ghost row
 * (the record itself is gone, so the id was renamed or the display retired). Conflating those two
 * would send an author looking for an r3 in a file that no longer exists.
 */
export function marginDrift(
  paper: string,
  withMargin: readonly string[],
  allDisplays: readonly string[],
): MarginDrift {
  const recorded = recordedMargins(paper) ?? [];
  const has = new Set(withMargin);
  const exists = new Set(allDisplays);
  const recordedSet = new Set(recorded);
  return {
    lost: recorded.filter((id) => exists.has(id) && !has.has(id)),
    unrecorded: withMargin.filter((id) => !recordedSet.has(id)).sort(),
    ghosts: recorded.filter((id) => !exists.has(id)),
  };
}

/** True when a paper's inventory matches its records exactly. */
export function driftIsClean(drift: MarginDrift): boolean {
  return drift.lost.length === 0 && drift.unrecorded.length === 0 && drift.ghosts.length === 0;
}
