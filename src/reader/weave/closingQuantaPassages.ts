import { LQ07_MODEL, type Lq07Regime } from "../../experiments/lq07/definition.ts";
import { LQ09_MODEL, type Lq09AbsorptionMode } from "../../experiments/lq09/definition.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { WeaveCondition, WeavePredicate } from "../../experiments/weave/types.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

type Entry = Readonly<{
  id: string;
  title: string;
  sentenceId: string;
  meaning: WeavePredicate["meaning"];
  conditions: readonly WeaveCondition[];
  pointerText: string;
}>;

/** Read availability from published finite scalars. This does not reconstruct an energy budget. */
const finite = (...quantityIds: string[]): readonly WeaveCondition[] => Object.freeze(
  quantityIds.map((quantityId) => Object.freeze({
    kind: "threshold" as const,
    quantityId,
    direction: "at-least" as const,
    enter: -Number.MAX_VALUE,
    exit: -Number.MAX_VALUE,
  })),
);
const status = (quantityId: string, equals: Extract<WeaveCondition, { kind: "status" }>["equals"]): WeaveCondition =>
  Object.freeze({ kind: "status", quantityId, equals });
const allowed: WeaveCondition = Object.freeze({
  kind: "threshold", quantityId: "singleQuantumAllowed", direction: "at-least", enter: 1, exit: 1,
});
const below: WeaveCondition = Object.freeze({
  kind: "threshold", quantityId: "singleQuantumAllowed", direction: "at-most", enter: 0, exit: 0,
});

function binding(
  instrumentId: "lq-07" | "lq-09",
  constantSetId: string,
  contextFields: readonly WeaveContextField[],
  entries: readonly Entry[],
): ReaderWeaveBinding {
  const predicates = entries.map((entry): WeavePredicate => Object.freeze({
    id: entry.id, instrumentId, meaning: entry.meaning, conditions: entry.conditions,
    targets: Object.freeze([entry.sentenceId]), pointerText: entry.pointerText,
  }));
  const passages: Record<string, WeavePassage> = {};
  for (const entry of entries) passages[entry.id] = Object.freeze({
    title: entry.title, sentenceId: entry.sentenceId, pointerText: entry.pointerText,
  });
  return Object.freeze({
    instrumentId, constantSetId, paper: "light-quanta",
    predicates: Object.freeze(predicates), passages: Object.freeze(passages), contextFields,
  });
}

const fluorescenceContext: readonly WeaveContextField[] = Object.freeze<WeaveContextField[]>([
  { parameterId: "nu1", label: "Exciting frequency", unit: "THz" },
  { parameterId: "nu2", label: "Proposed emitted frequency", unit: "THz" },
  { parameterId: "regime", label: "Accepted energy assumptions", values: {
    "standard-stokes": "one independent absorbed quantum",
    "deviation-multi-quantum": "pooled absorbed quanta",
    "deviation-non-wien": "test the Wien-domain qualification",
    "modern-thermal": "modern thermal allowance",
  } },
  { parameterId: "multiQuantumK", label: "Quanta available in the pooled model" },
  { parameterId: "sourceTemperatureK", label: "Source temperature", unit: "K" },
  { parameterId: "bodyTemperatureK", label: "Body temperature", unit: "K" },
  { parameterId: "absorbedPowerMicrowatts", label: "Absorbed power", unit: "μW" },
  { parameterId: "quantumYield", label: "Yield in the chosen channel" },
]);

const stokes: Entry = Object.freeze({
  id: "lq07-s7-energy-conservation",
  title: "The one-quantum frequency bound",
  sentenceId: "s7-p1-s5",
  meaning: "quantity-compared",
  conditions: finite("allowed", "nu2Max", "e1Ev", "e2Ev"),
  pointerText: "The accepted energies and frequency ceiling compare the proposed emission with the one-quantum budget stated here. A proposal may be allowed or disallowed by that budget. The body supplies no extra energy, and all other outgoing channels are nonnegative. This is a conditional model comparison, not an observation of fluorescence.",
});
const weakLight: Entry = Object.freeze({
  id: "lq07-s7-weak-illumination-rate",
  title: "Independent events and a fixed emission yield",
  sentenceId: "s7-p2-s1",
  meaning: "assumption-active",
  conditions: finite("absorbedRate", "emittedRate", "emittedPowerWatts"),
  pointerText: "The accepted rate calculation uses independent absorptions and a fixed yield for the chosen emission channel. This passage predicts proportionality with exciting intensity when other conditions remain the same. The present rates illustrate that assumed model; a single trial does not test proportionality or determine the yield.",
});
const pooled: Entry = Object.freeze({
  id: "lq07-s7-multi-quantum-deviation",
  title: "The printed exception for pooled quanta",
  sentenceId: "s7-p3-s1",
  meaning: "assumption-active",
  conditions: finite("allowed", "nu2Max", "e1Ev", "e2Ev"),
  pointerText: "The accepted model lets several absorbed quanta supply one emitted quantum. The paper names that possibility as an exception to the single-quantum Stokes bound. The laboratory compares the larger conditional energy ceiling; it supplies no multi-quantum rate and does not establish that this process occurs.",
});
const nonWien: Entry = Object.freeze({
  id: "lq07-s7-non-wien-boundary",
  title: "Where the heuristic supplies no frequency bound",
  sentenceId: "s7-p4-s2",
  meaning: "outside-selected-domain",
  conditions: Object.freeze([status("nu2Max", "outside-domain")]),
  pointerText: "The accepted result withholds the frequency ceiling because the chosen source lies outside the laboratory's admitted Wien domain. This passage allows radiation outside that regime to behave differently even when dilute. The refusal gives no prediction of a new bound and is not evidence that fluorescence is impossible.",
});
const thermal: Entry = Object.freeze({
  id: "lq07-s7-body-energy-premise",
  title: "Changing the premise that the body supplies no energy",
  sentenceId: "s7-p1-s5",
  meaning: "assumption-active",
  conditions: finite("allowed", "nu2Max", "e1Ev", "e2Ev"),
  pointerText: "The accepted thermal allowance is a modern extension that lets energy from the body help pay for the emission. It changes the no-additional-energy premise of this source passage. The chosen thermal budget is not a universal ceiling, and it is distinct from the paper's printed non-Wien exception.",
});

export const LQ07_READER_WEAVES: Readonly<Record<Lq07Regime, ReaderWeaveBinding>> = Object.freeze({
  "standard-stokes": binding("lq-07", LQ07_MODEL.constantSetId, fluorescenceContext, [stokes, weakLight]),
  "deviation-multi-quantum": binding("lq-07", LQ07_MODEL.constantSetId, fluorescenceContext, [pooled]),
  "deviation-non-wien": binding("lq-07", LQ07_MODEL.constantSetId, fluorescenceContext, [stokes, weakLight, nonWien]),
  "modern-thermal": binding("lq-07", LQ07_MODEL.constantSetId, fluorescenceContext, [thermal]),
});

const ionizationContext: readonly WeaveContextField[] = Object.freeze<WeaveContextField[]>([
  { parameterId: "frequency", label: "Frequency", unit: "Hz" },
  { parameterId: "ionizationEnergyEv", label: "Work per molecule", unit: "eV" },
  { parameterId: "incidentPower", label: "Incident power", unit: "W" },
  { parameterId: "absorptionEfficiency", label: "Share of incident light absorbed" },
  { parameterId: "duration", label: "Exposure", unit: "s" },
  { parameterId: "absorptionMode", label: "Accepted counting premise", values: {
    "all-absorbed-ionizes": "every absorbed quantum ionizes",
    "declared-fraction": "a declared share ionizes",
    unknown: "the share that ionizes is unknown",
  } },
  { parameterId: "declaredFraction", label: "Declared share (when that mode is selected)" },
]);

const threshold: Entry = Object.freeze({
  id: "lq09-s9-energy-threshold",
  title: "A necessary energy condition for one ionization",
  sentenceId: "s9-p1-s2",
  meaning: "quantity-compared",
  conditions: finite("quantumEnergyEv", "ionizationEnergyPerMolecule", "thresholdFrequency", "singleQuantumAllowed"),
  pointerText: "The accepted quantum energy is compared with the work needed per molecule. This passage requires an effective absorbed quantum to carry at least that work. Meeting the energy threshold does not guarantee absorption, a nonzero yield or a measurable ionization rate. The source's J is per gram-equivalent; this laboratory's work is per molecule.",
});
const belowThreshold: Entry = Object.freeze({
  id: "lq09-s9-below-threshold",
  title: "The single-quantum count does not apply below threshold",
  sentenceId: "s9-p1-s2",
  meaning: "outside-selected-domain",
  conditions: Object.freeze([below, status("ionizationCount", "not-applicable")]),
  pointerText: "The accepted owner reports the count as not applicable because one quantum cannot pay the ionization work. More intensity cannot repair an individual quantum's shortfall under this hypothesis. This is a restriction of the selected single-quantum model, not a measured zero or a claim about multi-quantum mechanisms.",
});
const fullYield: Entry = Object.freeze({
  id: "lq09-s9-full-yield-count",
  title: "The additional premise behind the printed count equality",
  sentenceId: "s9-p3-s5",
  meaning: "assumption-active",
  conditions: Object.freeze([allowed, ...finite("absorbedLightEnergy", "absorbedQuantumRate", "ionizationCount", "ionizedGramMolecules")]),
  pointerText: "The accepted counting premise says every absorbed quantum produces one primary ionization. Under that premise the displayed count translates to the paper's j = L/(Rβν) gram-molecules. L is absorbed energy over the exposure. The threshold alone does not justify this equality, which the paper proposes as an experimental test.",
});
const declaredYield: Entry = Object.freeze({
  id: "lq09-s9-declared-yield",
  title: "A specified share replaces the full-yield premise",
  sentenceId: "s9-p3-s6",
  meaning: "assumption-active",
  conditions: Object.freeze([allowed, ...finite("absorbedLightEnergy", "absorbedQuantumRate", "ionizationCount", "ionizedGramMolecules")]),
  pointerText: "The accepted model uses the declared fraction of absorbed quanta that ionize. The resulting count follows from that extra input. This source sentence qualifies the full-yield equality by excluding appreciable absorption without ionization. A declared fraction is not inferred from the threshold or measured by this simulation.",
});
const unknownYield: Entry = Object.freeze({
  id: "lq09-s9-unknown-yield",
  title: "Without the yield, the count remains underdetermined",
  sentenceId: "s9-p3-s6",
  meaning: "outside-selected-domain",
  conditions: Object.freeze([allowed, status("ionizationCount", "underdetermined"), ...finite("absorbedLightEnergy", "absorbedQuantumRate")]),
  pointerText: "The accepted owner leaves the ion count underdetermined because the share of absorptions that ionize is unknown. The absorbed quantum count supplies an upper bound under the one-primary-ionization-per-quantum restriction. The source's full-yield equality requires excluding the non-ionizing absorption discussed here.",
});

export const LQ09_READER_WEAVES: Readonly<Record<Lq09AbsorptionMode, ReaderWeaveBinding>> = Object.freeze({
  "all-absorbed-ionizes": binding("lq-09", LQ09_MODEL.constantSetId, ionizationContext, [threshold, belowThreshold, fullYield]),
  "declared-fraction": binding("lq-09", LQ09_MODEL.constantSetId, ionizationContext, [threshold, belowThreshold, declaredYield]),
  unknown: binding("lq-09", LQ09_MODEL.constantSetId, ionizationContext, [threshold, belowThreshold, unknownYield]),
});

/** Select wording from accepted metadata only; missing or unknown regimes never acquire a default. */
export function closingQuantaReaderWeave(
  instrumentId: "lq-07" | "lq-09",
  accepted: Pick<AcceptedSnapshot, "parameters"> | null,
): ReaderWeaveBinding | null {
  if (!accepted) return null;
  if (instrumentId === "lq-07") {
    const regime = accepted.parameters.regime;
    if (regime === "standard-stokes" || regime === "deviation-multi-quantum" ||
        regime === "deviation-non-wien" || regime === "modern-thermal") return LQ07_READER_WEAVES[regime];
    return null;
  }
  const mode = accepted.parameters.absorptionMode;
  if (mode === "all-absorbed-ionizes" || mode === "declared-fraction" || mode === "unknown") return LQ09_READER_WEAVES[mode];
  return null;
}
