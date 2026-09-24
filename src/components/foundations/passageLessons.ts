import type { Argument } from "../../content/schemas/reading.ts";
import { ELIMINATION_STEPS } from "../../equations/derivations/massEnergyElimination.ts";
import type { CompiledMissingStepLesson } from "../../equations/missingStep/compiled.ts";
import missingSteps from "../../generated/missing-steps.json";
import { passageActionsFromArgument } from "../../reader/actions/fromArgument.ts";
import type { ExtraLessons } from "./lessonUses.ts";

/**
 * The lessons a passage links from outside its own argument record, so a lesson's rail can name
 * every passage that sends readers to it. Two sources render inside an argument on the paper page
 * and were missing from the rail:
 *
 * - its obstacle answers (src/reader/actions/fromArgument.ts), each of which may link lessons;
 * - the mass-energy elimination (src/equations/derivations/massEnergyElimination.ts), whose every
 *   step links "the mathematical tool behind this step", mounted by PaperPage in one argument;
 * - the missing-step lessons (src/generated/missing-steps.json), whose steps link the same way and
 *   which PaperPage mounts in the argument each lesson names.
 *
 * A paper's first-encounter record also links lessons, but it is not an argument and has no place
 * in this map; that gap is reported on am-ep-foundations-z1e rather than papered over here.
 */

/** The argument PaperPage mounts the mass-energy derivation in; passageLessons.test.ts checks it. */
export const MASS_ENERGY_DERIVATION_ARGUMENT = "arg-me-constant-premise";

const bare = (id: string) => id.replace(/^foundation:/, "");

export function passageLessons(args: readonly Argument[]): ExtraLessons {
  const extra = new Map<string, Set<string>>();
  const add = (argumentId: string, lessonId: string) => {
    const lessons = extra.get(argumentId) ?? new Set<string>();
    lessons.add(bare(lessonId));
    extra.set(argumentId, lessons);
  };
  for (const argument of args) {
    const responses = passageActionsFromArgument(argument).obstacleResponses ?? {};
    for (const response of Object.values(responses))
      if (response && "foundationLinks" in response)
        for (const link of response.foundationLinks ?? []) add(argument.id, link.foundationId);
  }
  if (args.some((a) => a.id === MASS_ENERGY_DERIVATION_ARGUMENT))
    for (const step of ELIMINATION_STEPS) add(MASS_ENERGY_DERIVATION_ARGUMENT, step.foundation);
  const argumentIds = new Set(args.map((a) => a.id));
  for (const lesson of missingSteps.lessons as readonly CompiledMissingStepLesson[])
    if (argumentIds.has(lesson.argument))
      for (const step of lesson.steps) if (step.tool) add(lesson.argument, step.tool);
  return extra;
}
