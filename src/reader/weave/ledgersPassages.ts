import { ME01_MODEL } from "../../experiments/me01/definition.ts";
import { ME01_LIVE_WEAVE_PREDICATES } from "../../experiments/me01/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const ME01_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "me01-two-energy-balances": Object.freeze({
    title: "Energy conservation in both reference frames",
    sentenceId: "s0-p7-s3",
    pointerText: ME01_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "me01-unchanged-offset-premise": Object.freeze({
    title: "The unchanged additive constant",
    sentenceId: "s0-p7-s9",
    pointerText: ME01_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
  "me01-offset-underdetermined": Object.freeze({
    title: "What is lost when the constant may change",
    sentenceId: "s0-p7-s9",
    pointerText: ME01_LIVE_WEAVE_PREDICATES[2]?.pointerText ?? "",
  }),
});

export const ME01_WEAVE_CONTEXT: readonly WeaveContextField[] = Object.freeze([
  Object.freeze({ parameterId: "frameSpeed", label: "Observer speed", unit: "c" }),
  Object.freeze({ parameterId: "emittedEnergyRestFrame", label: "Emitted energy", unit: "J" }),
  Object.freeze({ parameterId: "emissionAngle", label: "Emission angle", unit: "degrees" }),
  Object.freeze({
    parameterId: "premise",
    label: "Additive constant",
    values: Object.freeze({ unchanged: "unchanged during emission", relaxed: "allowed to change" }),
  }),
]);

export const ME01_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "me-01",
  constantSetId: ME01_MODEL.constantSetId,
  paper: "mass-energy",
  predicates: ME01_LIVE_WEAVE_PREDICATES,
  passages: ME01_WEAVE_PASSAGES,
  contextFields: ME01_WEAVE_CONTEXT,
});
