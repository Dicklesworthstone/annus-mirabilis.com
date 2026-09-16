/**
 * Kitchen-data hand-off into BM-07. Reuses analyzeKitchen; does not reimplement
 * pairing, noise, or CSV parsing. BM-07's independent-increment interval is not
 * admitted for tracks with localization error, blur, irregular timing, or censoring.
 */
import {
  independentModelAdmission,
  type NumberMeaning,
} from "../../physics/reference/inference.ts";
import { observationDigest } from "./digest.ts";

export { observationDigest } from "./digest.ts";

import { analyzeKitchen, type KitchenAnalysis, type KitchenOptions } from "./kitchen/analyze.ts";
import { KITCHEN_OPTIONS } from "./kitchen/definition.ts";
import type { KitchenDocument } from "./kitchen/schema.ts";

export type KitchenHandoff = Readonly<{
  analysis: KitchenAnalysis;
  increments: Float64Array;
  dt: number;
  d: 1;
  constantSetId: string;
  gasConstantProvenance: string;
  numberMeaning: NumberMeaning | "unavailable";
  radiusProvenance: string;
  documentDigest: string;
  dataDigest: string;
  admission: ReturnType<typeof independentModelAdmission>;
  intervalOwner: "kitchen-noise-aware" | "bm-07-independent-increment" | "none";
}>;

export function handoffKitchenToBm07(
  document: KitchenDocument,
  options: KitchenOptions = KITCHEN_OPTIONS,
  csv = "",
): KitchenHandoff {
  const analysis = analyzeKitchen(document, options);
  const pairs = analysis.outputs.find((o) => o.quantityId === "pairs");
  const pairTimes = analysis.outputs.find((o) => o.quantityId === "pairTimes");
  const noise = analysis.outputs.find((o) => o.quantityId === "noiseVariance");
  const dt = Number(document.metadata.declared_interval_s);
  const increments = new Float64Array(
    pairs?.status === "value" && pairs.value instanceof Float64Array ? pairs.value.length / 2 : 0,
  );
  if (pairs?.status === "value" && pairs.value instanceof Float64Array) {
    const values = pairs.value;
    for (let i = 0; i < increments.length; i++) {
      const start = values[2 * i],
        end = values[2 * i + 1];
      if (start === undefined || end === undefined) continue;
      increments[i] = end - start;
    }
  }
  const irregular = analysis.intervalReasons.some((r) => /[Ii]rregular|[Tt]imestamp/.test(r));
  const censored =
    analysis.counts.lost > 0 || analysis.counts.excluded > 0 || analysis.counts.interpolated > 0;
  const localizationStd =
    noise?.status === "value" && typeof noise.value === "number" ? Math.sqrt(noise.value) : 0;
  const exposureTime = Number(document.metadata.exposure_s) || 0;
  const admission = independentModelAdmission({
    equalSpacing: !irregular && pairTimes?.status === "value",
    nonOverlapping: true,
    localizationStd,
    exposureTime,
    censored,
  });
  const intervalOwner =
    admission.kind === "accepted"
      ? "bm-07-independent-increment"
      : analysis.outputs.some((o) => o.quantityId === "diffusionInterval" && o.status === "value")
        ? "kitchen-noise-aware"
        : "none";
  const documentDigest = csv
    ? observationDigest(new Float64Array(), csv)
    : observationDigest(increments, analysis.selectedTrack);
  return Object.freeze({
    analysis,
    increments,
    dt,
    d: 1,
    constantSetId: analysis.constantSetId,
    gasConstantProvenance: analysis.gasConstantProvenance,
    numberMeaning: analysis.numberMeaning,
    radiusProvenance: document.metadata.radius_provenance,
    documentDigest,
    dataDigest: observationDigest(increments, `${analysis.selectedTrack}:${options.axis}`),
    admission,
    intervalOwner,
  });
}
