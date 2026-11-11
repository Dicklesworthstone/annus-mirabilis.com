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
 * THIS MODULE MAKES THE POPULATION REAL FROM ITS SHARED CONTENT. Each journey's skeleton is
 * already typed data in its own module -- journeyI.ts to journeyIV.ts export NAGGING_FACT, MOVE,
 * SOURCE_JUMPS, DOORS and the forks against the journey schema's own types -- so a `Journey` can be
 * composed from them by reference. Nothing here retypes a sentence: every string below arrives through
 * an import, which is what makes "no reader-facing text lost" true by construction rather than by
 * diffing.
 *
 * scripts/emit-journey-records.ts emits these records to `content/journeys/<paper>.yaml`, and the
 * parity test checks their equality. Mass-energy and Brownian motion share their authored stages
 * with their pages. The other two staged chains remain in their pages and declare that gap.
 *
 * REMAINING ELEMENTS ARE DECLARED PENDING, through the schema's own `pendingElements`:
 *
 *   stages     The two unrecorded staged chains need authored premise references and reasoning.
 *   exercises  Each journey now carries at least two expression exercises, checked numerically.
 *   move       Three journeys still need their move marked in an openable derivation chain.
 *
 * Completeness follows those structural gaps. It does not claim editorial review. A journey that
 * claimed `complete` while elements were missing would be the defect this bead is about.
 */

import type { RevisionLineageEntry } from "../../content/revisions.ts";
import type { AdmittedImport, Journey, PendingElement } from "../../content/schemas/journey.ts";
import * as brownianExercises from "../brownian/journeyExercises.ts";
import * as brownian from "../brownian/journeyII.ts";
import { MOLECULAR_NUMBER_EXERCISE } from "../brownian/molecularNumberExercise.ts";
import { BROWNIAN_STAGES } from "../brownian/stages.ts";
import * as lightQuantaElectron from "../lightQuanta/electronExercise.ts";
import { ENTROPY_COUNT_EXERCISE } from "../lightQuanta/entropyExercise.ts";
import * as lightQuantaExercises from "../lightQuanta/journeyExercises.ts";
import * as lightQuanta from "../lightQuanta/journeyI.ts";
import { LIGHT_QUANTA_STAGES } from "../lightQuanta/stages.ts";
import * as massEnergy from "../massEnergy/journeyIV.ts";
import * as massEnergyExercises from "../massEnergy/massExercise.ts";
import { MASS_ENERGY_STAGES } from "../massEnergy/stages.ts";
import * as relativityClock from "../relativity/clockExercise.ts";
import * as relativityExercises from "../relativity/journeyExercises.ts";
import * as relativity from "../relativity/journeyIII.ts";
import { SPECIAL_RELATIVITY_STAGES } from "../relativity/stages.ts";
import {
  BROWNIAN_SHELF_CARDS,
  LIGHT_QUANTA_SHELF_CARDS,
  MASS_ENERGY_SHELF_CARDS,
  SPECIAL_RELATIVITY_SHELF_CARDS,
} from "./shelves.ts";

/** A stage gap is declared only by a journey whose argument stages are still unrecorded. */
const PENDING: readonly PendingElement[] = Object.freeze([
  Object.freeze({
    element: "stages",
    reason:
      "The staged chain is the discover page's JSX structure rather than data. Composing a stage list here would be authoring content, and a stage carries premise references the shelf audit reads, so invented stages would make that audit pass over prose nobody reviewed.",
    ownerBead: "am-4k0m",
  }),
  // Exercise gaps are derived per paper below, never shared across journeys.
]);

/**
 * Derive the exercise gap from the composed parts. All four journeys now have at least two
 * instrumented exercises; the Brownian inverse problem and Wien coefficient comparison fill
 * the last two gaps. The declaration must not survive that work, because it exempts the journey
 * from the lower exercise-count bound. The gate also rejects declaring an already present part.
 */
function instrumentedPending(exercises: Journey["exercises"]): readonly PendingElement[] {
  const instrumented = exercises.filter((e) => e.role === "instrumented").length;
  if (instrumented >= 2) return [];
  return [
    Object.freeze({
      element: "exercises.instrumented",
      reason:
        `This journey has ${instrumented} instrumented exercise(s) and the skeleton asks for two to five. ` +
        "The exercises it has are composed from the parts its page renders; a second one is new physics " +
        "authoring -- a reference expression with declared names, domains, dimensions and a tolerance, " +
        "checked against the owner -- rather than a record migration.",
      ownerBead: "am-4k0m",
    }),
  ];
}

/**
 * THE THIRD PENDING ELEMENT, AND THE ONE THAT IS NOT SHARED BY ALL FOUR.
 *
 * AGENTS.md's discovery skeleton says of the move: "the one non-obvious step, named as such and
 * marked in the derivation chain." A journey's `move` record names it, and every journey has one.
 * What three of the four lack is a chain a reader can OPEN at that step: `content/equations/
 * derivations/` holds one file, bm-variance.yaml, whose `bm-variance-cross` step carries
 * `isMove: true`. So brownian-motion's move is openable and the other three moves are prose.
 *
 * am-4k0m lists this as the fourth of its four drift items and allows either of two resolutions,
 * fixed or "declared with a written reason in the record". It was neither: the census printed
 * "1 of 4" with a floor under it, which reports a gap without declaring one, and a figure in a
 * test log is not a record. Authoring the three missing chains is not a migration -- bm-variance
 * is a full semantic expression tree per step with registry-bound quantity ids, registered
 * identities and a worked case -- so it is declared here and owned where derivation chains are.
 */
const PENDING_MOVE_CHAIN: PendingElement = Object.freeze({
  element: "move.derivationChain",
  reason:
    "The move is named in this record and marked in no derivation chain a reader can open: content/equations/derivations/ holds one chain, for brownian-motion. Authoring one here means a semantic expression tree per step with registry-bound quantity ids, a registered identity per rule and a worked case, which is physics authoring rather than moving this journey's prose into a record.",
  ownerBead: "am-4k0m",
});

/**
 * The papers whose move is not in an openable chain. Hardcoded because this module is composed by
 * reference and must not read the filesystem -- it is reachable from the discover pages, and a
 * node: import there is the defect am-t84m gates against. The list cannot go stale in silence:
 * journeySkeletonCensus.test.ts reads the chain files on disk and refuses any journey that has a
 * chain while declaring one pending, or lacks one while declaring nothing. Author a chain and that
 * census tells you to delete the paper from this set.
 */
const MOVE_CHAIN_MISSING: ReadonlySet<string> = Object.freeze(
  new Set(["light-quanta", "special-relativity", "mass-energy"]),
) as ReadonlySet<string>;

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

/**
 * THE JOURNEY'S EXERCISES, COMPOSED FROM THE PARTS THE PAGES ALREADY RENDER (am-4k0m).
 *
 * `exercises` was declared pending with the reason "The exercise parts are typed, machine-checked
 * objects in each paper's own exercise module, keyed to components rather than to journey-level
 * `ExerciseRef`s. Mapping them is real work and is part of the migration." That was true, and the
 * mapping turns out to be faithful rather than authorial: an `ExerciseRef` is `{ id, role, prompt }`,
 * and a part already carries the id and the prompt. Only the ROLE is derived, and it is derived
 * from the part's TYPE rather than declared a second time -- an expression part is `instrumented`
 * because a kernel checks the reader's answer, an explanation part is `explanation` because the
 * reader judges it against the criteria. No sentence is retyped; every string arrives by import.
 *
 * Twelve of the fourteen parts were already in importable modules. Brownian's two were `const`
 * declarations inside its page, unexported, which is why this could not be composed before; they
 * moved to `../brownian/journeyExercises.ts` character for character, where the other three
 * papers already keep theirs.
 */
type ExercisePartLike = Readonly<{ id: string; prompt: string }>;

function exercisesOf(
  instrumented: readonly ExercisePartLike[],
  explanation: readonly ExercisePartLike[],
): Journey["exercises"] {
  return Object.freeze([
    ...instrumented.map((part) => ({
      id: part.id,
      role: "instrumented" as const,
      prompt: part.prompt,
    })),
    ...explanation.map((part) => ({
      id: part.id,
      role: "explanation" as const,
      prompt: part.prompt,
    })),
  ]);
}

/**
 * Each paper's parts, by the names their own modules export. Listed rather than discovered,
 * because a module's exports include references and helpers as well as parts, and a name-shaped
 * filter would quietly pick up or drop one as those modules change.
 */
const EXERCISES: Readonly<Record<string, Journey["exercises"]>> = Object.freeze({
  "light-quanta": exercisesOf(
    [ENTROPY_COUNT_EXERCISE, lightQuantaElectron.GREATEST_ENERGY_EXERCISE],
    [
      lightQuantaExercises.INTENSITY_EXPLANATION,
      lightQuantaExercises.LOCKED_POSITIONS_EXPLANATION,
      lightQuantaExercises.PPE_EXPLANATION,
    ],
  ),
  "brownian-motion": exercisesOf(
    [MOLECULAR_NUMBER_EXERCISE, brownianExercises.DISPLACEMENT_SCALE_EXERCISE],
    [brownianExercises.SQUARE_ROOT_IN_WORDS],
  ),
  "special-relativity": exercisesOf(
    [
      relativityExercises.COMPOSITION_EXERCISE,
      relativityExercises.CLOCK_SPEED_EXERCISE,
      relativityClock.MOVING_CLOCK_EXERCISE,
    ],
    [relativityExercises.SIMULTANEITY_EXPLANATION, relativityExercises.PPE_EXPLANATION],
  ),
  "mass-energy": exercisesOf(
    [massEnergyExercises.MASS_GIVEN_UP_EXERCISE, massEnergyExercises.PULSE_SUM_EXERCISE],
    [massEnergyExercises.EQUAL_AND_OPPOSITE_EXPLANATION],
  ),
});

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
 * The lineage records authored stages, new exercises and pending-element changes separately for
 * the papers whose records changed.
 */
const REVISIONS: Readonly<Record<string, number>> = Object.freeze({
  "light-quanta": 4,
  "brownian-motion": 3,
  "special-relativity": 3,
  "mass-energy": 4,
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
      Object.freeze({
        revision: 2,
        reason:
          "Gained the move.derivationChain pending declaration: this journey's move is named in the record and marked in no derivation chain a reader can open, and am-4k0m's fourth drift item allows a written declaration where the fix is physics authoring. The gap had been reported only as a count in a test log, which is a measurement and not a record (am-4k0m).",
        date: "2026-10-09",
      }),
      Object.freeze({
        revision: 3,
        reason:
          "Authored the five argument stages with the page's existing narrative, explicit shelf premises, worked comparisons and qualifications. The page and emitted record now share these stages, so stages is no longer pending; the separate move.derivationChain declaration remains.",
        date: "2026-11-06",
      }),
    ]),
    "light-quanta": Object.freeze([
      Object.freeze({
        revision: 1,
        reason:
          "Gained the move.derivationChain pending declaration: this journey's move is named in the record and marked in no derivation chain a reader can open, and am-4k0m's fourth drift item allows a written declaration where the fix is physics authoring. The gap had been reported only as a count in a test log, which is a measurement and not a record (am-4k0m).",
        date: "2026-10-09",
      }),
      Object.freeze({
        revision: 2,
        reason:
          "Added the source-notation entropy-coefficient exercise shared with the discovery page. Its dimensional and numerical checks preserve the Wien-regime and heuristic qualifications; the exercise-count gap is no longer declared.",
        date: "2026-11-10",
      }),
      Object.freeze({
        revision: 3,
        reason:
          "Recorded the seven existing discovery stages with explicit shelf premises, reasoning tools, worked comparisons and transfer cases. The compiler and local search can now inspect the Light Quanta argument chain; stages is no longer a pending element.",
        date: "2026-11-11",
      }),
    ]),
    "brownian-motion": Object.freeze([
      Object.freeze({
        revision: 1,
        reason:
          "Added the inverse molecular-number exercise shared with the discovery page, with independent-radius, calibration and finite-sample qualifications. The exercise-count gap is no longer declared; the staged-record gap remains.",
        date: "2026-11-10",
      }),
      Object.freeze({
        revision: 2,
        reason:
          "Authored the six argument stages with explicit shelf premises, worked examples, partial comparisons and transfer cases. The discovery page and compiler record now share the original narrative and its guidance; no stage element remains pending.",
        date: "2026-11-10",
      }),
    ]),
    "special-relativity": Object.freeze([
      Object.freeze({
        revision: 1,
        reason:
          "Gained the move.derivationChain pending declaration: this journey's move is named in the record and marked in no derivation chain a reader can open, and am-4k0m's fourth drift item allows a written declaration where the fix is physics authoring. The gap had been reported only as a count in a test log, which is a measurement and not a record (am-4k0m).",
        date: "2026-10-09",
      }),
      Object.freeze({
        revision: 2,
        reason:
          "Recorded the seven existing discovery argument stages with explicit 1904 shelf premises, reasoning tools, worked comparisons, predictions and transfer cases. Compiler checks and local search can now inspect the Special Relativity argument chain; stages is no longer pending.",
        date: "2026-11-11",
      }),
    ]),
  });

function compose(
  paper: string,
  module: SkeletonModule & Record<string, unknown>,
  shelf: readonly ShelfCard[],
  stages: Journey["stages"] = Object.freeze([]),
): Journey {
  const admittedImports = admittedImportsOf(paper, shelf);
  const pendingElements = Object.freeze([
    ...(stages.length === 0 ? PENDING : []),
    ...instrumentedPending(EXERCISES[paper] ?? Object.freeze([])),
    ...(MOVE_CHAIN_MISSING.has(paper) ? [PENDING_MOVE_CHAIN] : []),
  ]);
  return Object.freeze({
    id: paper,
    paper,
    revision: REVISIONS[paper] ?? 1,
    // This describes the authored skeleton, not a historical or scientific review verdict.
    completeness: pendingElements.length === 0 ? "complete" : "partial",
    pendingElements,
    shelf: Object.freeze(shelf.map((card) => card.id)),
    // Empty for three of the four journeys, which is the honest value: only mass-energy imports a
    // 1905 result, and the schema omits an empty array rather than recording one.
    ...(admittedImports.length > 0 ? { admittedImports } : {}),
    naggingFact: module.NAGGING_FACT,
    firstHonestQuestion: module.FIRST_HONEST_QUESTION,
    stages,
    forks: forksOf(module),
    move: module.MOVE,
    worldChecks: Object.freeze([module.WORLD_CHECK]),
    sourceJumps: module.SOURCE_JUMPS,
    exercises: EXERCISES[paper] ?? Object.freeze([]),
    ppeTask: module.PPE_TASK,
    doors: module.DOORS,
  });
}

/** The four, in the order the papers were received. */
export const REAL_JOURNEYS: readonly Journey[] = Object.freeze([
  compose("light-quanta", lightQuanta as never, LIGHT_QUANTA_SHELF_CARDS, LIGHT_QUANTA_STAGES),
  compose("brownian-motion", brownian as never, BROWNIAN_SHELF_CARDS, BROWNIAN_STAGES),
  compose("special-relativity", relativity as never, SPECIAL_RELATIVITY_SHELF_CARDS, SPECIAL_RELATIVITY_STAGES),
  compose("mass-energy", massEnergy as never, MASS_ENERGY_SHELF_CARDS, MASS_ENERGY_STAGES),
]);
