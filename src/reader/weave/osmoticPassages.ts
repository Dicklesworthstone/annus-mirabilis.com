import { BM03_MODEL } from "../../experiments/bm03/definition.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { WeaveCondition, WeavePredicate } from "../../experiments/weave/types.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

const finite = (...quantityIds: string[]): readonly WeaveCondition[] =>
  Object.freeze(
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
const status = (quantityId: string, value: "symbolic" | "outside-domain"): WeaveCondition => ({
  kind: "status",
  quantityId,
  equals: value,
});
const contextFields: readonly WeaveContextField[] = Object.freeze([
  { parameterId: "Np", label: "Particle count" },
  { parameterId: "volumeRatio", label: "Accessible volume V/V₀" },
  { parameterId: "V0", label: "Reference volume", unit: "μm³" },
  { parameterId: "T", label: "Temperature", unit: "K" },
  {
    parameterId: "model",
    label: "Accepted dependence model",
    values: {
      independent: "independent particle positions",
      "locked-cluster": "one freely placed rigid cluster",
    },
  },
]);

function binding(locked: boolean): ReaderWeaveBinding {
  const comparisons: readonly WeavePredicate[] = locked
    ? [
        {
          id: "bm03-s2-locked-counterexample",
          instrumentId: "bm-03",
          meaning: "quantity-compared",
          targets: ["s2-p5-s2"],
          conditions: [
            ...finite("logFactorRatio", "deltaF", "lockedClusterPressure"),
            status("pressure", "outside-domain"),
          ],
          pointerText:
            "The accepted model places all constituents as one rigid cluster. Its single translational placement gives one volume factor and the pressure of one independent unit. The source sentence requires independent particles; this authored comparison removes that premise. The independent-particle pressure is withheld. No cluster formation or breakup is calculated.",
        },
      ]
    : [
        {
          id: "bm03-s2-independent-volume",
          instrumentId: "bm-03",
          meaning: "quantity-compared",
          targets: ["s2-p7-s1"],
          conditions: finite("logFactorRatio", "log10FactorRatio", "deltaF"),
          pointerText:
            "The accepted logarithms and free-energy difference use one volume factor for each independent particle. This passage states that J depends on neither the positions nor the confining volume. Those physical assumptions are admitted, not tested by the readouts. The logarithms retain the scale of the arrangement ratio when an ordinary scalar cannot represent it.",
        },
        {
          id: "bm03-s2-independent-pressure",
          instrumentId: "bm-03",
          meaning: "quantity-compared",
          targets: ["s2-p8-s1"],
          conditions: finite("pressure"),
          pointerText:
            "The accepted pressure follows the fixed-temperature volume derivative with the particle count held fixed. The source concludes that dissolved molecules and suspended bodies of equal number have the same osmotic pressure at great dilution. This is a model calculation; it does not establish independence or dilution for a measured suspension.",
        },
      ];
  const predicates: readonly WeavePredicate[] = Object.freeze([
    ...comparisons,
    {
      id: "bm03-s2-unevaluated-factor",
      instrumentId: "bm-03",
      meaning: "assumption-active",
      targets: ["s2-p7-s1"],
      conditions: [
        status("volumeIndependentFactor", "symbolic"),
        status("freeEnergyOffset", "symbolic"),
      ],
      pointerText: locked
        ? "The accepted cluster comparison leaves its internal statistical factor and absolute free-energy offset symbolic. It assumes that factor is independent of the accessible volume, applying the same cancellation illustrated by this source passage to one cluster. It supplies no value for that factor or for the cluster's binding energy."
        : "The accepted result leaves the statistical factor J and absolute free-energy offset symbolic. The source needs their independence of volume, not their numerical values. A changing J would contribute another pressure term; the present model does not calculate it.",
    },
    {
      id: "bm03-s2-logarithmic-range",
      instrumentId: "bm-03",
      meaning: "outside-selected-domain",
      targets: ["s2-p7-s2"],
      conditions: [
        status("factorRatio", "outside-domain"),
        ...finite("logFactorRatio", "log10FactorRatio"),
      ],
      pointerText:
        "The accepted arrangement ratio is outside the ordinary numerical representation, while its separately labelled logarithms remain finite. This is a limit of the computer's number format, not a physical failure of the source argument. The logarithmic free-energy calculation remains distinct from the unrepresentable ratio.",
    },
  ]);
  const titles: Readonly<Record<string, string>> = {
    "bm03-s2-independent-volume": "One volume factor per independent placement",
    "bm03-s2-independent-pressure": "The pressure of a dilute collection",
    "bm03-s2-locked-counterexample": "What changes when independence is removed",
    "bm03-s2-unevaluated-factor": "The factor that remains unknown",
    "bm03-s2-logarithmic-range": "A logarithm is not the arrangement ratio",
  };
  const passages: Record<string, WeavePassage> = {};
  for (const predicate of predicates)
    passages[predicate.id] = Object.freeze({
      title: titles[predicate.id] ?? "The source comparison",
      sentenceId: predicate.targets[0] ?? "s2-p7-s1",
      pointerText: predicate.pointerText,
    });
  return Object.freeze({
    instrumentId: "bm-03",
    constantSetId: BM03_MODEL.constantSetId,
    paper: "brownian-motion",
    predicates,
    passages: Object.freeze(passages),
    contextFields,
  });
}

export const BM03_INDEPENDENT_READER_WEAVE = binding(false);
export const BM03_LOCKED_READER_WEAVE = binding(true);

/** Select the wording from accepted model identity, never from unapplied form controls. */
export function bm03ReaderWeave(
  accepted: Pick<AcceptedSnapshot, "parameters"> | null,
): ReaderWeaveBinding | null {
  if (accepted?.parameters.model === "independent") return BM03_INDEPENDENT_READER_WEAVE;
  if (accepted?.parameters.model === "locked-cluster") return BM03_LOCKED_READER_WEAVE;
  return null;
}
