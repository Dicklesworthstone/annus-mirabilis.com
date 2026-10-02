/**
 * THE SPOKEN-FORM SENTENCE ON /accessibility/ IS READ FROM THE RECORDS (am-rc1001-bridge-plan-pcjk.35).
 *
 * From 2026-09-28 to 2026-10-02 the page said that "each equation carries a spoken form written by
 * hand" and that those forms "have been read against screen readers in automated runs". Neither was
 * true. Every displayed equation has an authored form (content/display-terms/<paper>.yaml), but no
 * mathematics inside a sentence does: on the live relativity German face 407 of 505 <math> elements
 * had none. And nothing has ever run a screen reader: the browser lanes run axe-core and record
 * `manualScreenReaderReview: "not performed"`.
 *
 * So the counts come from the records at build time, and the page's test refuses a sentence that
 * claims more than they hold.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadDisplayTerms } from "../../equations/printed/displayTerms.ts";

export const SPOKEN_FORM_PAPERS = [
  "light-quanta",
  "brownian-motion",
  "special-relativity",
  "mass-energy",
] as const;

/** Where a screen-reader session would be recorded (am-eq-math-announcement-at-matrix-0al6). */
export const SCREEN_READER_RUNS_DIR = join("docs", "accessibility", "runs");

export type SpokenFormCounts = Readonly<{
  /** Displayed equations with a display-terms entry, over the four papers. */
  displays: number;
  /** Of those, how many carry an authored spoken form. */
  spoken: number;
  /** Whether any record of a screen-reader session exists. */
  screenReaderRunRecorded: boolean;
}>;

export function spokenFormCounts(root: string = process.cwd()): SpokenFormCounts {
  let displays = 0;
  let spoken = 0;
  for (const paper of SPOKEN_FORM_PAPERS) {
    for (const entry of loadDisplayTerms(root, paper)?.displays ?? []) {
      displays++;
      if (entry.spoken.trim()) spoken++;
    }
  }
  const runs = join(root, SCREEN_READER_RUNS_DIR);
  return Object.freeze({
    displays,
    spoken,
    screenReaderRunRecorded:
      existsSync(runs) && readdirSync(runs).some((name) => !name.startsWith(".")),
  });
}
