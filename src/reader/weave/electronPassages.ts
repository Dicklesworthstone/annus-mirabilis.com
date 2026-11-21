import { SR13_MODEL } from "../../experiments/sr13/definition.ts";
import { SR13_LIVE_WEAVE_PREDICATES } from "../../experiments/sr13/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const SR13_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "sr13-force-convention": Object.freeze({
    title: "Different force conventions, the same motion",
    sentenceId: "s10-p8-s1",
    pointerText: SR13_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "sr13-infinite-energy": Object.freeze({
    title: "Finite work below the limiting speed",
    sentenceId: "s10-p11-s1",
    pointerText: SR13_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
});

export const SR13_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "sr-13",
  constantSetId: SR13_MODEL.constantSetId,
  paper: "special-relativity",
  predicates: SR13_LIVE_WEAVE_PREDICATES,
  passages: SR13_WEAVE_PASSAGES,
  contextFields: Object.freeze([
    Object.freeze({ parameterId: "initialSpeed", label: "Initial speed", unit: "c" }),
    Object.freeze({
      parameterId: "forceConvention",
      label: "Force convention",
      values: Object.freeze({ source: "1905 comoving force", laboratory: "Laboratory force" }),
    }),
    Object.freeze({
      parameterId: "particle",
      label: "Particle",
      values: Object.freeze({ electron: "Electron", custom: "Custom material point" }),
    }),
  ]),
});
