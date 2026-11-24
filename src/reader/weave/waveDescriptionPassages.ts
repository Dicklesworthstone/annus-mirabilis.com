import { LQ01_MODEL } from "../../experiments/lq01/definition.ts";
import { LQ01_LIVE_WEAVE_PREDICATES } from "../../experiments/lq01/liveWeave.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { WeaveContextField } from "./context.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const LQ01_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "lq01-s0-wave-success": Object.freeze({
    title: "What the wave description explains",
    sentenceId: "s0-p2-s1",
    pointerText: LQ01_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "lq01-s0-time-averages": Object.freeze({
    title: "An average is different from an instant",
    sentenceId: "s0-p2-s2",
    pointerText: LQ01_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
  "lq01-s0-energy-spreading": Object.freeze({
    title: "The continuous account of spreading energy",
    sentenceId: "s0-p1-s4",
    pointerText: LQ01_LIVE_WEAVE_PREDICATES[2]?.pointerText ?? "",
  }),
});

const MODE_CONTEXT: WeaveContextField = Object.freeze({
  parameterId: "mode",
  label: "Arrangement",
  values: Object.freeze({
    interference: "two coherent sources",
    spreading: "one isotropic source",
  }),
});
const INTERFERENCE_CONTEXT: readonly WeaveContextField[] = Object.freeze([
  MODE_CONTEXT,
  Object.freeze({
    parameterId: "readout",
    label: "Detector readout",
    values: Object.freeze({
      "time-average": "average over many cycles",
      instantaneous: "one instant",
    }),
  }),
  Object.freeze({ parameterId: "A1", label: "Wave 1 amplitude" }),
  Object.freeze({ parameterId: "A2", label: "Wave 2 amplitude" }),
  Object.freeze({ parameterId: "delta", label: "Relative phase", unit: "radians" }),
]);

function binding(
  predicateIds: readonly string[],
  contextFields: readonly WeaveContextField[],
): ReaderWeaveBinding {
  const predicates = Object.freeze(
    LQ01_LIVE_WEAVE_PREDICATES.filter((p) => predicateIds.includes(p.id)),
  );
  return Object.freeze({
    instrumentId: "lq-01",
    constantSetId: LQ01_MODEL.constantSetId,
    paper: "light-quanta",
    predicates,
    passages: Object.freeze(
      Object.fromEntries(predicates.map((p) => [p.id, LQ01_WEAVE_PASSAGES[p.id] as WeavePassage])),
    ),
    contextFields,
  });
}

export const LQ01_AVERAGE_READER_WEAVE = binding(
  ["lq01-s0-wave-success", "lq01-s0-time-averages"],
  INTERFERENCE_CONTEXT,
);
export const LQ01_INSTANT_READER_WEAVE = binding(
  ["lq01-s0-wave-success"],
  Object.freeze([
    ...INTERFERENCE_CONTEXT,
    Object.freeze({ parameterId: "t", label: "Time phase", unit: "radians" }),
  ]),
);
export const LQ01_SPREADING_READER_WEAVE = binding(
  ["lq01-s0-energy-spreading"],
  Object.freeze([
    MODE_CONTEXT,
    Object.freeze({ parameterId: "P", label: "Source power", unit: "W" }),
    Object.freeze({ parameterId: "r", label: "Observation radius", unit: "m" }),
  ]),
);

/** Both models publish outputs on every run. Only the accepted view can authorize its pointers. */
export function lq01ReaderWeave(
  accepted: Pick<AcceptedSnapshot, "parameters"> | null,
): ReaderWeaveBinding | null {
  if (accepted?.parameters.mode === "spreading") return LQ01_SPREADING_READER_WEAVE;
  if (accepted?.parameters.mode !== "interference") return null;
  if (accepted.parameters.readout === "time-average") return LQ01_AVERAGE_READER_WEAVE;
  if (accepted.parameters.readout === "instantaneous") return LQ01_INSTANT_READER_WEAVE;
  return null;
}
