/**
 * The stash inventory check (am-70ig).
 *
 * A git stash survives `git status`, `git log`, the beads tracker and every gate. It is the one
 * place work can hide completely, and five of them sat for three to four days holding 1954
 * insertions before a human looked by hand (am-8wv8).
 *
 * TWO FACTS SHAPE THIS CHECK, and both were measured rather than assumed.
 *
 * 1. `refs/stash` is a LOCAL ref. `git ls-remote origin` returns no stash refs, and a fresh clone
 *    has none, so a CI run can only ever see zero. Registering this as a CI gate would be a check
 *    that cannot fail. It is registered with `requiredInCi: false` instead, so the chain records
 *    it as skipped-not-required rather than passed.
 * 2. Clearing a stash means dropping it, which is the owner's decision (AGENTS.md Rule 1). A gate
 *    that fails on any stash would hold every local run hostage to a decision no agent may make.
 *
 * So this is a ratchet keyed by SHA, in the shape the repository already uses for bare throws and
 * dark-theme contrast: the stashes that have been reviewed are acknowledged by commit id, and only
 * an UNACKNOWLEDGED one fails. The known five do not block anyone; the sixth fails the day it is
 * made. A machine with no stashes passes trivially, which is every machine but this one.
 *
 * Acknowledging a stash is not approving it. It records that somebody determined what is in it.
 */

/** One entry as `git stash list` reports it. Parsing lives here so the tests need no real stash. */
export interface StashEntry {
  readonly sha: string;
  readonly committedAt: string;
  readonly subject: string;
}

/** One reviewed stash. `verdict` is what the review concluded, so the file explains itself. */
export interface AcknowledgedStash {
  readonly sha: string;
  readonly date: string;
  readonly verdict: string;
  readonly reviewedUnder: string;
}

export interface StashReport {
  readonly unacknowledged: readonly StashEntry[];
  /** Acknowledged entries that no longer exist: the owner dropped one and the file can be tidied. */
  readonly stale: readonly AcknowledgedStash[];
  readonly acknowledgedPresent: number;
}

/** `%H|%cI|%gs` from `git stash list`, one entry per line. */
export function parseStashList(raw: string): StashEntry[] {
  const out: StashEntry[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const [sha, committedAt, ...rest] = line.split("|");
    if (!sha || !committedAt) continue;
    out.push({ sha: sha.trim(), committedAt: committedAt.trim(), subject: rest.join("|").trim() });
  }
  return out;
}

export function reviewStashes(
  entries: readonly StashEntry[],
  baseline: readonly AcknowledgedStash[],
): StashReport {
  const known = new Set(baseline.map((b) => b.sha));
  const present = new Set(entries.map((e) => e.sha));
  return {
    unacknowledged: entries.filter((e) => !known.has(e.sha)),
    stale: baseline.filter((b) => !present.has(b.sha)),
    acknowledgedPresent: entries.filter((e) => known.has(e.sha)).length,
  };
}

/** Whole days between a stash's commit time and now, for the report line. */
export function ageInDays(committedAt: string, now: Date): number {
  const then = new Date(committedAt).getTime();
  if (Number.isNaN(then)) return Number.NaN;
  return Math.floor((now.getTime() - then) / 86_400_000);
}
