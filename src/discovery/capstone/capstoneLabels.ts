/**
 * A capstone's taxonomy in a reader's words (am-disc-capstones-infra-3352).
 *
 * The logical roles are labelled by `roleLabel` in src/reader/passageKind.ts, where the argument
 * passages' labels already live, so a role reads the same wherever it appears. Assumption kinds
 * have no such home, and this is it: one map, next to the record it describes, rather than a phrase
 * repeated in the page and again in the worksheet.
 */
import type { AssumptionKind } from "./capstoneSchema.ts";

const KIND: Readonly<Record<AssumptionKind, string>> = {
  premise: "Premise",
  idealization: "Idealization",
  convention: "Convention",
  approximation: "Approximation",
  stipulation: "Stipulation",
  "boundary-choice": "Choice of boundary",
  setup: "Setup",
};

export function assumptionKindLabel(kind: AssumptionKind): string {
  return KIND[kind];
}
