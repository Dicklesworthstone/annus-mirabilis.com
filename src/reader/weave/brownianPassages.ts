import type { WeavePredicate } from "../../experiments/weave/types.ts";

export type WeavePassage = Readonly<{
  title: string;
  sentenceId: string;
  pointerText: string;
}>;

/**
 * Explicit editorial links from BM-01's legacy predicate names to the current source inventory.
 * s4-p6-s9 is the cancellation of the odd terms; s4-p10-s7 introduces the Gaussian solution;
 * s5-p2-s1 introduces the historical numerical example. These are content ids, not list positions.
 * The conditions remain the instrument's. No new calculation or statistical threshold lives here.
 */
export const BM01_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "bm01-s4-cancellation": Object.freeze({
    title: "Symmetry and the diffusion equation",
    sentenceId: "s4-p6-s9",
    pointerText:
      "The signed mean and mean square are inside the comparison bands published by this trial's numerical owner.",
  }),
  "bm01-s5-distribution-agreement": Object.freeze({
    title: "The Gaussian distribution of displacements",
    sentenceId: "s4-p10-s7",
    pointerText:
      "The distribution-distance output is within the stated sampling bound for this accepted trial.",
  }),
  "bm01-s5-printed-numbers": Object.freeze({
    title: "Einstein's numerical example",
    sentenceId: "s5-p2-s1",
    pointerText: "The historical constant set and the recorded numerical conditions are active.",
  }),
});

/** Replace obsolete target names and fixed-seed prose, never an instrument's conditions. */
export function withWeavePassages(
  predicates: readonly WeavePredicate[],
  passages: Readonly<Record<string, WeavePassage>>,
): readonly WeavePredicate[] {
  return Object.freeze(
    predicates.map((predicate) => {
      const passage = passages[predicate.id];
      return passage
        ? Object.freeze({
            ...predicate,
            targets: Object.freeze([passage.sentenceId]),
            pointerText: passage.pointerText,
          })
        : predicate;
    }),
  );
}

/** The standalone source faces both expose canonical sentence anchors without a prefix. */
export function weavePassageHref(
  paper: string,
  sentenceId: string,
  face: "german" | "english",
): string {
  return `/papers/${encodeURIComponent(paper)}/view/${face}/#${encodeURIComponent(sentenceId)}`;
}
