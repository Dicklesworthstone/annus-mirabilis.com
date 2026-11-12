import { ME02_MODEL } from "../../experiments/me02/definition.ts";
import { ME02_LIVE_WEAVE_PREDICATES } from "../../experiments/me02/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const ME02_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "me02-limiting-coefficient": Object.freeze({
    title: "Mass lost when radiation leaves the body",
    sentenceId: "s0-p12-s1",
    pointerText: ME02_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "me02-coefficient-stabilized": Object.freeze({
    title: "Neglecting fourth and higher orders in speed",
    sentenceId: "s0-p11-s1",
    pointerText: ME02_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
});

export const ME02_WEAVE_CONTEXT: readonly WeaveContextField[] = Object.freeze([
  Object.freeze({ parameterId: "beta", label: "Observer speed", unit: "c" }),
  Object.freeze({ parameterId: "emittedEnergy", label: "Entered emitted energy" }),
  Object.freeze({
    parameterId: "energyUnit",
    label: "Energy units",
    values: Object.freeze({ normalized: "normalized (c = 1)", erg: "erg", joule: "joule" }),
  }),
]);

export const ME02_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "me-02",
  constantSetId: ME02_MODEL.constantSetId,
  paper: "mass-energy",
  predicates: ME02_LIVE_WEAVE_PREDICATES,
  passages: ME02_WEAVE_PASSAGES,
  contextFields: ME02_WEAVE_CONTEXT,
});
