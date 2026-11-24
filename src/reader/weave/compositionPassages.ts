import { SR06_MODEL } from "../../experiments/sr06/definition.ts";
import { SR06_LIVE_WEAVE_PREDICATES } from "../../experiments/sr06/liveWeave.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const SR06_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "sr06-subluminal-composition": Object.freeze({
    title: "Composing motions below the speed of light",
    sentenceId: "s5-p2-s8",
    pointerText: SR06_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "sr06-null-stays-null": Object.freeze({
    title: "A light ray remains a light ray",
    sentenceId: "s5-p6-s1",
    pointerText: SR06_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
});

const COMMON_CONTEXT: readonly WeaveContextField[] = Object.freeze([
  Object.freeze({
    parameterId: "mode",
    label: "Arrangement",
    values: Object.freeze({
      collinear: "along one line",
      angled: "at an angle",
      "two-boosts": "two boosts in turn",
    }),
  }),
  Object.freeze({ parameterId: "frameBeta", label: "Frame speed", unit: "c" }),
]);

function binding(contextFields: readonly WeaveContextField[]): ReaderWeaveBinding {
  return Object.freeze({
    instrumentId: "sr-06",
    constantSetId: SR06_MODEL.constantSetId,
    paper: "special-relativity",
    predicates: SR06_LIVE_WEAVE_PREDICATES,
    passages: SR06_WEAVE_PASSAGES,
    contextFields: Object.freeze([...COMMON_CONTEXT, ...contextFields]),
  });
}

export const SR06_COLLINEAR_READER_WEAVE = binding([
  Object.freeze({ parameterId: "movingSpeed", label: "Moving-frame speed", unit: "c" }),
]);
export const SR06_ANGLED_READER_WEAVE = binding([
  Object.freeze({ parameterId: "movingSpeed", label: "Moving-frame speed", unit: "c" }),
  Object.freeze({ parameterId: "alphaDeg", label: "Moving-frame direction", unit: "degrees" }),
]);
export const SR06_BOOSTS_READER_WEAVE = binding([
  Object.freeze({ parameterId: "secondBeta", label: "Second boost speed", unit: "c" }),
  Object.freeze({
    parameterId: "secondAngleDeg",
    label: "Second boost direction",
    unit: "degrees",
  }),
]);

/** The context names only controls used by the accepted calculation, never a saved inactive angle. */
export function sr06ReaderWeave(
  accepted: Pick<AcceptedSnapshot, "parameters"> | null,
): ReaderWeaveBinding | null {
  switch (accepted?.parameters.mode) {
    case "collinear":
      return SR06_COLLINEAR_READER_WEAVE;
    case "angled":
      return SR06_ANGLED_READER_WEAVE;
    case "two-boosts":
      return SR06_BOOSTS_READER_WEAVE;
    default:
      return null;
  }
}
