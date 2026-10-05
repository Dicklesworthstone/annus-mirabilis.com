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

import type { Journey, PendingElement } from "../../content/schemas/journey.ts";
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

function compose(
  paper: string,
  module: SkeletonModule & Record<string, unknown>,
  shelf: readonly { id: string }[],
): Journey {
  return Object.freeze({
    id: paper,
    paper,
    revision: 1,
    // Partial, and the pending list says which two elements and why. The honest value.
    completeness: "partial" as const,
    pendingElements: PENDING,
    shelf: Object.freeze(shelf.map((card) => card.id)),
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
