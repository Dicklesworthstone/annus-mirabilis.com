import { SR02_MODEL } from "../../experiments/sr02/definition.ts";
import { SR02_LIVE_WEAVE_PREDICATES } from "../../experiments/sr02/liveWeave.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const SR02_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "sr02-introduction-asymmetry": Object.freeze({
    title: "Two descriptions of relative motion",
    sentenceId: "s0-p1-s3",
    pointerText: SR02_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "sr02-section-6-resolution": Object.freeze({
    title: "Describing the force in the charge's rest frame",
    sentenceId: "s6-p10-s1",
    pointerText: SR02_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
});

export const SR02_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "sr-02",
  constantSetId: SR02_MODEL.constantSetId,
  paper: "special-relativity",
  predicates: SR02_LIVE_WEAVE_PREDICATES,
  passages: SR02_WEAVE_PASSAGES,
  contextFields: Object.freeze([
    Object.freeze({ parameterId: "speed", label: "Relative speed", unit: "m/s" }),
    Object.freeze({
      parameterId: "descriptionFrame",
      label: "Description",
      values: Object.freeze({
        "magnet-rest": "magnet at rest",
        "conductor-rest": "conductor at rest",
      }),
    }),
    Object.freeze({
      parameterId: "fieldModel",
      label: "Field model",
      values: Object.freeze({ uniform: "uniform field", dipole: "dipole approximation" }),
    }),
    Object.freeze({
      parameterId: "pathOrientation",
      label: "Integration path",
      values: Object.freeze({
        transverse: "across the motion",
        "along-motion": "along the motion",
      }),
    }),
    Object.freeze({
      parameterId: "sliceDeclared",
      label: "Simultaneity slice",
      values: Object.freeze({ true: "declared", false: "not declared" }),
    }),
  ]),
});

/** Apparatus mode offers ordinary source links: symbolic illustrations are not numerical trials. */
export function sr02ReaderWeave(
  accepted: Pick<AcceptedSnapshot, "parameters"> | null,
): ReaderWeaveBinding | null {
  return accepted?.parameters.mode === "analytic" ? SR02_READER_WEAVE : null;
}
