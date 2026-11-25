import { SR04_MODEL } from "../../experiments/sr04/definition.ts";
import { SR04_LIVE_WEAVE_PREDICATES } from "../../experiments/sr04/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const SR04_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "sr04-s3-unfixed-scale": Object.freeze({
    title: "What the requirements still leave undetermined",
    sentenceId: "s3-p21-s1",
    pointerText: SR04_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "sr04-s3-longitudinal-map": Object.freeze({
    title: "The longitudinal position and time transformation",
    sentenceId: "s3-p22-s10",
    pointerText: SR04_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
  "sr04-s3-candidate-comparison": Object.freeze({
    title: "Checking a proposed map against the light requirements",
    sentenceId: "s3-p15-s1",
    pointerText: SR04_LIVE_WEAVE_PREDICATES[2]?.pointerText ?? "",
  }),
});

export const SR04_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "sr-04",
  constantSetId: SR04_MODEL.constantSetId,
  paper: "special-relativity",
  predicates: SR04_LIVE_WEAVE_PREDICATES,
  passages: SR04_WEAVE_PASSAGES,
  contextFields: Object.freeze([
    Object.freeze({ parameterId: "vOverC", label: "Frame speed", unit: "c" }),
    Object.freeze({
      parameterId: "testCandidate",
      label: "Hand-built candidate",
      values: Object.freeze({ true: "being tested", false: "not selected" }),
    }),
    Object.freeze({
      parameterId: "showLaterAids",
      label: "Later aids",
      values: Object.freeze({ true: "shown separately", false: "hidden" }),
    }),
  ]),
});
