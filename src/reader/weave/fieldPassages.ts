import { SR07_LIVE_WEAVE_PREDICATES } from "../../experiments/sr07/liveWeave.ts";
import { SR08_MODEL } from "../../experiments/sr08/definition.ts";
import { SR08_LIVE_WEAVE_PREDICATES } from "../../experiments/sr08/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const SR07_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "sr07-form-invariance": Object.freeze({
    title: "Carrying the six equations into the moving frame",
    sentenceId: "s6-p2-s1",
    pointerText: SR07_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "sr07-printed-transforms": Object.freeze({
    title: "The printed electric and magnetic transformations",
    sentenceId: "s6-p5-s2",
    pointerText: SR07_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
});

export const SR08_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "sr08-field-transformation": Object.freeze({
    title: "The same fields in two frames",
    sentenceId: "s6-p5-s2",
    pointerText: SR08_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "sr08-new-manner-expression": Object.freeze({
    title: "The electric force in the charge's rest frame",
    sentenceId: "s6-p10-s1",
    pointerText: SR08_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
});

export const SR07_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "sr-07",
  // This owner computes dimensionless residuals with c = 1 and uses no physical constant set.
  constantSetId: "normalized-c-1",
  paper: "special-relativity",
  predicates: SR07_LIVE_WEAVE_PREDICATES,
  passages: SR07_WEAVE_PASSAGES,
  contextFields: Object.freeze([
    Object.freeze({ parameterId: "boostBeta", label: "Observer speed", unit: "c" }),
    Object.freeze({
      parameterId: "wave",
      label: "Wave direction in K",
      values: Object.freeze({
        "plus-x": "along +x",
        "minus-x": "along −x",
        "plus-y": "along +y",
        oblique: "oblique",
      }),
    }),
    Object.freeze({ parameterId: "polarization", label: "Polarization" }),
    Object.freeze({
      parameterId: "unitLayer",
      label: "Displayed equations",
      values: Object.freeze({
        "printed-gaussian": "printed Gaussian units",
        "modern-si": "modern SI units",
      }),
    }),
  ]),
});

export const SR08_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "sr-08",
  constantSetId: SR08_MODEL.constantSetId,
  paper: "special-relativity",
  predicates: SR08_LIVE_WEAVE_PREDICATES,
  passages: SR08_WEAVE_PASSAGES,
  contextFields: Object.freeze([
    Object.freeze({ parameterId: "boost", label: "Signed observer speed along x", unit: "m/s" }),
    Object.freeze({
      parameterId: "descriptionFrame",
      label: "Displayed frame",
      values: Object.freeze({ stationary: "K", moving: "k" }),
    }),
    Object.freeze({
      parameterId: "unitLayer",
      label: "Field notation",
      values: Object.freeze({ si: "SI labels", gaussian: "printed field names; SI readings" }),
    }),
    Object.freeze({ parameterId: "testCharge", label: "Test charge", unit: "C" }),
  ]),
});
