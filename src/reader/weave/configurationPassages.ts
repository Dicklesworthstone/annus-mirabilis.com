import { LQ05_MODEL } from "../../experiments/lq05/definition.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { WeaveCondition, WeavePredicate } from "../../experiments/weave/types.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

function finiteReadings(...quantityIds: string[]): readonly WeaveCondition[] {
  return Object.freeze(
    quantityIds.map((quantityId) =>
      Object.freeze({
        kind: "threshold" as const,
        quantityId,
        direction: "at-least" as const,
        enter: -Number.MAX_VALUE,
        exit: -Number.MAX_VALUE,
      }),
    ),
  );
}

const CONTEXT: readonly WeaveContextField[] = Object.freeze([
  Object.freeze({ parameterId: "n", label: "Number of points" }),
  Object.freeze({ parameterId: "f", label: "Volume fraction V/V₀" }),
  Object.freeze({
    parameterId: "locked",
    label: "Dependence model",
    values: Object.freeze({ false: "independent positions", true: "one shared, locked position" }),
  }),
  Object.freeze({ parameterId: "trials", label: "Sampled placements" }),
  Object.freeze({ parameterId: "seed", label: "Seed" }),
]);

function bindingForModel(locked: boolean): ReaderWeaveBinding {
  const probabilityId = locked
    ? "lq05-s5-locked-counterexample"
    : "lq05-s5-independent-probability";
  const probabilitySentence = locked ? "s5-p7-s2" : "s5-p8-s1";
  const predicates: readonly WeavePredicate[] = Object.freeze([
    Object.freeze({
      id: probabilityId,
      instrumentId: "lq-05",
      meaning: "quantity-compared" as const,
      targets: Object.freeze([probabilitySentence]),
      conditions: finiteReadings("configurationProbability", "lnW", "log10W"),
      pointerText: locked
        ? "The accepted model puts every point at one shared position, so its concentration probability is W = f regardless of how many labels there are. The source question specifies independent positions. This authored counterexample removes that premise; it is not evidence against the source's W = fⁿ. The logarithms describe the same accepted probability."
        : "The accepted probability W = fⁿ counts independent, uniformly distributed positions in the chosen volume fraction. Its natural and base-ten logarithms retain the scale of rare events even when a finite sample finds none. This is a calculation under the source's assumptions, not evidence that radiation consists of points.",
    }),
    Object.freeze({
      id: "lq05-s5-entropy-volume-relation",
      instrumentId: "lq-05",
      meaning: "quantity-compared" as const,
      targets: Object.freeze(["s5-p6-s3"]),
      conditions: finiteReadings("lnW", "deltaSOverKb"),
      pointerText: locked
        ? "The accepted entropy reading applies ΔS/kB = ln W to one shared placement coordinate, giving ln f. The paper writes kB as R/N and its natural logarithm as lg. The locked model does not supply the n independent factors used in the paper's gas comparison. This entropy difference compares constrained states; it is not a measured heat or a compression trajectory."
        : "The accepted entropy reading applies the paper's Boltzmann relation to W = fⁿ, giving ΔS/kB = n ln f. The paper writes kB as R/N and its natural logarithm as lg. A smaller accessible volume gives a negative entropy difference, and f = 1 gives zero. This compares constrained states; the spontaneous concentration probability is a different observable, not a compression trajectory.",
    }),
    Object.freeze({
      id: "lq05-s5-motion-assumption-independence",
      instrumentId: "lq-05",
      meaning: "quantity-compared" as const,
      targets: Object.freeze(["s5-p3-s4"]),
      conditions: finiteReadings("sampleFraction", "successCount", "drawCountAfter"),
      pointerText: locked
        ? "The accepted seeded sample redraws one uniform position for the whole group on each trial. These are synthetic placements, not a time evolution. As the source explains, a specific law of motion is not needed for the volume counting; the locked dependence is this site's additional countermodel. A zero success count alone does not make an event impossible."
        : "The accepted seeded sample redraws each point uniformly and independently on each trial. These are synthetic placements, not a time evolution. The source leaves the law of motion unspecified while requiring that no region or direction be preferred. The sample fraction is kept separate from the model probability; a zero success count alone does not make an event impossible.",
    }),
  ]);
  const titles = [
    locked ? "What changes when independence is removed" : "Independence supplies the exponent",
    "From probability to a constrained entropy difference",
    "Counting positions without a law of motion",
  ];
  const passages: Record<string, WeavePassage> = {};
  for (const [index, predicate] of predicates.entries()) {
    passages[predicate.id] = Object.freeze({
      title: titles[index] ?? "The source comparison",
      sentenceId: predicate.targets[0] ?? "s5-p7-s2",
      pointerText: predicate.pointerText,
    });
  }
  return Object.freeze({
    instrumentId: "lq-05",
    constantSetId: LQ05_MODEL.constantSetId,
    paper: "light-quanta",
    predicates,
    passages: Object.freeze(passages),
    contextFields: CONTEXT,
  });
}

export const LQ05_INDEPENDENT_READER_WEAVE = bindingForModel(false);
export const LQ05_LOCKED_READER_WEAVE = bindingForModel(true);

/** A draft checkbox cannot change the interpretation of an already accepted sample. */
export function lq05ReaderWeave(
  accepted: Pick<AcceptedSnapshot, "parameters"> | null,
): ReaderWeaveBinding | null {
  if (accepted?.parameters.locked === false) return LQ05_INDEPENDENT_READER_WEAVE;
  if (accepted?.parameters.locked === true) return LQ05_LOCKED_READER_WEAVE;
  return null;
}
