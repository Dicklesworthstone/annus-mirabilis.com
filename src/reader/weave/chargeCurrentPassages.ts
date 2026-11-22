import { SR12_MODEL } from "../../experiments/sr12/definition.ts";
import { SR12_LIVE_WEAVE_PREDICATES } from "../../experiments/sr12/liveWeave.ts";
import type { WeavePassage } from "./brownianPassages.ts";
import type { ReaderWeaveBinding } from "./SessionResultWeave.tsx";

export const SR12_WEAVE_PASSAGES: Readonly<Record<string, WeavePassage>> = Object.freeze({
  "sr12-charge-density-transformation": Object.freeze({
    title: "Charge density and convection current",
    sentenceId: "s9-p2-s1",
    pointerText: SR12_LIVE_WEAVE_PREDICATES[0]?.pointerText ?? "",
  }),
  "sr12-total-charge-invariance": Object.freeze({
    title: "The same body's total charge",
    sentenceId: "s9-p3-s1",
    pointerText: SR12_LIVE_WEAVE_PREDICATES[1]?.pointerText ?? "",
  }),
});

export const SR12_READER_WEAVE: ReaderWeaveBinding = Object.freeze({
  instrumentId: "sr-12",
  constantSetId: SR12_MODEL.constantSetId,
  paper: "special-relativity",
  predicates: SR12_LIVE_WEAVE_PREDICATES,
  passages: SR12_WEAVE_PASSAGES,
  contextFields: Object.freeze([
    Object.freeze({ parameterId: "boost", label: "Signed observer speed along x", unit: "m/s" }),
    Object.freeze({
      parameterId: "mode",
      label: "Selected comparison",
      values: Object.freeze({
        "neutral-conductor": "neutral conductor",
        convection: "convection current",
        "current-loop": "current loop",
        "moving-sphere": "uniform sphere",
        "gaussian-pulse": "Gaussian continuity pulse",
      }),
    }),
    Object.freeze({
      parameterId: "chargeDensity",
      label: "Charge density in K (SI)",
      unit: "C/m³",
    }),
    Object.freeze({
      parameterId: "currentDensityX",
      label: "Entered current density along x in K (SI)",
      unit: "A/m²",
    }),
    Object.freeze({ parameterId: "sphereRadius", label: "Uniform-sphere radius", unit: "m" }),
  ]),
});
