/**
 * THE FOUR DISCOVERY JOURNEYS A READER IS SERVED, ASSEMBLED AS `Journey` RECORDS (am-4k0m).
 *
 * am-4k0m measured that `checkJourney` had 38 call sites and every one passed a FIXTURE, that
 * `JOURNEY_MAP` held one entry and it was the fixture, and that no content record carries
 * `kind: journey`. So the epistemic gates AGENTS.md calls build gates -- the post-1904 shelf refusal,
 * the fork contract, the mockery guard, the move-summary guard -- ran over an empty population while
 * the journeys a reader actually reaches were hand-authored JSX. The bead's own words: "The gates
 * would pass on this population. That is the point: nobody knows that, because they never ran on it."
 *
 * THIS MODULE MAKES THE POPULATION REAL WITHOUT MOVING A LINE OF PROSE. Each journey's skeleton is
 * already typed data in its own module -- journeyI.ts to journeyIV.ts export NAGGING_FACT, MOVE,
 * SOURCE_JUMPS, DOORS and the forks against the journey schema's own types -- so a `Journey` can be
 * composed from them by reference. Nothing here retypes a sentence: every string below arrives through
 * an import, which is what makes "no reader-facing text lost" true by construction rather than by
 * diffing.
 *
 * WHY THIS IS NOT YET THE RECORD FILE am-4k0m ASKS FOR. The first acceptance item wants each journey in
 * `content/journeys/<paper>.yaml` with the JSX rendering from it. That is where this is going, and
 * doing it in this order matters: with the gates already running on the real content, the move to YAML
 * becomes a refactor the gates guard, rather than a 1,637-line prose migration with nothing watching.
 *
 * TWO ELEMENTS ARE DECLARED PENDING RATHER THAN INVENTED, through the schema's own `pendingElements`:
 *
 *   stages     The staged chain is the page's JSX structure, not data. Composing a plausible stage
 *              list here would be authoring content, and a journey's stages carry premise references
 *              the shelf audit reads -- inventing them would make that audit pass over my prose.
 *   exercises  The exercise parts are typed, machine-checked objects in each paper's own exercise
 *              module, keyed to components rather than to journey-level `ExerciseRef`s. Mapping them
 *              is real work and is part of the migration, not of making the gates run.
 *
 * So every journey here is `completeness: "partial"`, which is the honest value, and says why in the
 * record rather than in a comment. A journey that claimed `complete` while two elements were missing
 * would be the exact shape of defect this bead is about.
 */

import type { RevisionLineageEntry } from "../../content/revisions.ts";
import type { AdmittedImport, Journey, PendingElement } from "../../content/schemas/journey.ts";
import * as brownian from "../brownian/journeyII.ts";
import * as lightQuanta from "../lightQuanta/journeyI.ts";
import * as massEnergy from "../massEnergy/journeyIV.ts";
import * as relativity from "../relativity/journeyIII.ts";
import {
  BROWNIAN_SHELF_CARDS,
  LIGHT_QUANTA_SHELF_CARDS,
  MASS_ENERGY_SHELF_CARDS,
  SPECIAL_RELATIVITY_SHELF_CARDS,
} from "./shelves.ts";

/** The two elements no journey records yet, declared the way the schema provides for. */
const PENDING: readonly PendingElement[] = Object.freeze([
  Object.freeze({
    element: "stages",
    reason:
      "The staged chain is the discover page's JSX structure rather than data. Composing a stage list here would be authoring content, and a stage carries premise references the shelf audit reads, so invented stages would make that audit pass over prose nobody reviewed.",
    ownerBead: "am-4k0m",
  }),
  Object.freeze({
    // The gate's own name for this element, not a paraphrase of it. Declared as "exercises" first,
    // which the gate does not recognise, so the declaration did not count and three journeys reported
    // an undeclared missing element. A declaration spelled differently from the thing it declares is
    // no declaration.
    element: "exercises.instrumented",
    reason:
      "The exercise parts are typed, machine-checked objects in each paper's own exercise module, keyed to the components that render them rather than to journey-level ExerciseRefs. Mapping them is part of the record migration.",
    ownerBead: "am-4k0m",
  }),
]);

/** Only the card fields this module reads; the cards themselves stay in their own files. */
type ShelfCard = Readonly<{
  id: string;
  admittedImport?:
    | boolean
    | Readonly<{
        declaringJourney: string;
        anchor?: string | undefined;
        provenance?: string | undefined;
      }>
    | undefined;
}>;

type SkeletonModule = Readonly<{
  NAGGING_FACT: string;
  FIRST_HONEST_QUESTION: string;
  MOVE: Journey["move"];
  SOURCE_JUMPS: Journey["sourceJumps"];
  WORLD_CHECK: Journey["worldChecks"][number];
  PPE_TASK: Journey["ppeTask"];
  DOORS: Journey["doors"];
}>;

/** The forks a module exports, by their own names, so adding a third needs no change here. */
function forksOf(module: Record<string, unknown>): Journey["forks"] {
  return Object.freeze(
    Object.entries(module)
      .filter(([name]) => name.startsWith("FORK_"))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, fork]) => fork as Journey["forks"][number]),
  );
}

/**
 * The journey-level declarations for the 1905 results its own cards admit, BY REFERENCE.
 *
 * AGENTS.md permits one import past the 1904 cutoff: "an explicitly admitted 1905 result whose
 * provenance is shown (the September mass-energy journey may import the relativity paper's section 8
 * light-energy transformation)". The CARD carries that declaration already -- declaringJourney,
 * anchor and provenance on `einstein-1905-light-complex-transformation` -- and the journey record
 * carried none, so once the shelf-date rule reached the shelf (journeyChecks section 1b) the
 * mass-energy shelf refused with `admitted-import-undeclared`. That refusal was correct: the rule
 * requires the JOURNEY to say which imports it admits, not only the card to say it is one.
 *
 * Derived rather than retyped, for this module's standing reason: the importId is the card's id, the
 * provenance and anchor are the card's own strings, and a second admitted import added to any shelf
 * reaches its journey without anyone remembering this function exists. A card whose block names a
 * different journey is not admitted here, which is what `declaringJourney` is for.
 */
function admittedImportsOf(paper: string, shelf: readonly ShelfCard[]): readonly AdmittedImport[] {
  return Object.freeze(
    shelf.flatMap((card) => {
      const block = card.admittedImport;
      if (!block || typeof block !== "object") return [];
      if (block.declaringJourney !== paper) return [];
      if (!block.provenance || !block.anchor) return [];
      return [
        Object.freeze({
          importId: card.id,
          provenance: block.provenance,
          sourceAnchor: block.anchor,
        }),
      ];
    }),
  );
}

/**
 * Each journey record's own revision, bumped when ITS content changes rather than all four together.
 *
 * mass-energy is at 2 because its record gained the `admittedImports` declaration its own card had
 * carried alone -- a substantive change to what the record claims, which is why `check-revisions`
 * refused the emitted file at revision 1. The other three are untouched and stay at 1: raising them
 * would assert a change that did not happen.
 */
const REVISIONS: Readonly<Record<string, number>> = Object.freeze({
  "light-quanta": 1,
  "brownian-motion": 1,
  "special-relativity": 1,
  "mass-energy": 2,
});

/**
 * The lineage a record past revision 1 owes, which `src/content/revisions.ts` defines and this only
 * supplies: every revision from 1 up, each with a non-empty reason and an ISO date.
 *
 * EXPORTED FOR THE EMITTER RATHER THAN PUT ON THE JOURNEY, and the distinction is the one AGENTS.md
 * draws when it says to keep contentRevision, sourceAssetDigest and the rest separate. A lineage is
 * RECORD metadata: it says how the file came to be at this revision. It is not part of what the
 * journey claims, so it belongs to the emitted record and not to the `Journey` the pages read. The
 * faithfulness test compares the record against the composed journey with this metadata excluded, for
 * the same reason `computeCanonicalRecordHash` excludes revision metadata from its hash.
 */
export const JOURNEY_LINEAGE: Readonly<Record<string, readonly RevisionLineageEntry[]>> =
  Object.freeze({
    "mass-energy": Object.freeze([
      Object.freeze({
        revision: 1,
        reason:
          "The record as first emitted from the journey modules, carrying no journey-level admittedImports. Its shelf listed einstein-1905-light-complex-transformation, whose own card declares the import, and the record declared nothing; the shelf-date rule refused that as admitted-import-undeclared once it reached the shelf (am-4k0m).",
        date: "2026-10-05",
      }),
    ]),
  });

function compose(
  paper: string,
  module: SkeletonModule & Record<string, unknown>,
  shelf: readonly ShelfCard[],
): Journey {
  const admittedImports = admittedImportsOf(paper, shelf);
  return Object.freeze({
    id: paper,
    paper,
    revision: REVISIONS[paper] ?? 1,
    // Partial, and the pending list says which two elements and why. The honest value.
    completeness: "partial" as const,
    pendingElements: PENDING,
    shelf: Object.freeze(shelf.map((card) => card.id)),
    // Empty for three of the four journeys, which is the honest value: only mass-energy imports a
    // 1905 result, and the schema omits an empty array rather than recording one.
    ...(admittedImports.length > 0 ? { admittedImports } : {}),
    naggingFact: module.NAGGING_FACT,
    firstHonestQuestion: module.FIRST_HONEST_QUESTION,
    stages: Object.freeze([]),
    forks: forksOf(module),
    move: module.MOVE,
    worldChecks: Object.freeze([module.WORLD_CHECK]),
    sourceJumps: module.SOURCE_JUMPS,
    exercises: Object.freeze([]),
    ppeTask: module.PPE_TASK,
    doors: module.DOORS,
  });
}

/** The four, in the order the papers were received. */
export const REAL_JOURNEYS: readonly Journey[] = Object.freeze([
  compose("light-quanta", lightQuanta as never, LIGHT_QUANTA_SHELF_CARDS),
  compose("brownian-motion", brownian as never, BROWNIAN_SHELF_CARDS),
  compose("special-relativity", relativity as never, SPECIAL_RELATIVITY_SHELF_CARDS),
  compose("mass-energy", massEnergy as never, MASS_ENERGY_SHELF_CARDS),
]);
