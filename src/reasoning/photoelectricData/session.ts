import {
  analyzePhotoelectricData, type FitOptions, type PhotoelectricDataFit, type PhotoelectricReference,
} from "../../physics/reference/inference/photoelectricData.ts";
import { constantValue, getConstantSet } from "../../physics/reference/constants.ts";

// The workbench and its page read these through this module, so neither imports a physics owner
// itself (the no-physics-in-components boundary).
export type { InferredQuantity, PhotoelectricReference } from "../../physics/reference/inference/photoelectricData.ts";

/** The modern SI reference a fitted slope is compared against. It is read from the constant-set
 * registry and never fitted to a record. */
export function modernPhotoelectricReference(): PhotoelectricReference {
  const constants = getConstantSet("modern-si-2019");
  return {
    constantSetId: constants.id,
    elementaryCharge: constantValue(constants, "elementaryCharge").value,
    planckConstant: constantValue(constants, "planckConstant").value,
    speedOfLight: constantValue(constants, "speedOfLight").value,
  };
}
import { parseVoltageCsv, type VoltageRecord } from "./record.ts";

/** Deliberately constructed rows, not Millikan observations or a random simulation.
 * Their slope is not secretly set to the reference value of h/e.
 */
export const PHOTOELECTRIC_EXAMPLES = Object.freeze([
  Object.freeze({ id: "linear", label: "Constructed straight trend", csv: "frequency_THz,stopping_V,sigma_V\n500,0.52,0.04\n600,0.85,0.04\n700,1.36,0.04\n800,1.66,0.04\n900,2.11,0.04\n" }),
  Object.freeze({ id: "curved", label: "Constructed curved trend", csv: "frequency_THz,stopping_V,sigma_V\n500,0.70,0.03\n600,0.95,0.03\n700,1.30,0.03\n800,1.75,0.03\n900,2.30,0.03\n" }),
  Object.freeze({ id: "unequal", label: "Constructed unequal precision", csv: "frequency_THz,stopping_V,sigma_V\n500,0.51,0.02\n600,0.89,0.02\n700,1.31,0.02\n800,1.68,0.02\n900,3.10,1.00\n" }),
]);
export type AnalysisDraft = Readonly<{
  csv: string;
  label: string;
  weighting: "equal" | "declared-sigma";
  offsetKind: "unknown" | "known";
  offsetVolts: string;
  offsetSigmaV: string;
}>;
export type AcceptedAnalysis = Readonly<{
  revision: number;
  csv: string;
  label: string;
  source: "constructed-example" | "reader-supplied";
  record: VoltageRecord;
  options: FitOptions;
  excludedRows: readonly number[];
  fit: PhotoelectricDataFit;
  allRowsFit: PhotoelectricDataFit;
}>;
export type AnalysisOutcome = Readonly<{ kind: "accepted"; state: AcceptedAnalysis }> | Readonly<{ kind: "refused"; message: string }>;
export function exampleDraft(id = "linear"): AnalysisDraft {
  const example = PHOTOELECTRIC_EXAMPLES.find((e) => e.id === id);
  if (!example) throw new TypeError("Unknown constructed example.");
  return { csv: example.csv, label: example.label, weighting: "declared-sigma", offsetKind: "unknown", offsetVolts: "0", offsetSigmaV: "0" };
}
export function draftFromAnalysis(state: AcceptedAnalysis): AnalysisDraft {
  return { csv: state.csv, label: state.label, weighting: state.options.weighting, offsetKind: state.options.offset.kind,
    offsetVolts: String(state.options.offset.kind === "known" ? state.options.offset.volts : 0),
    offsetSigmaV: String(state.options.offset.kind === "known" ? state.options.offset.sigmaV : 0) };
}
function scalar(text: string): number {
  if (typeof text !== "string" || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/u.test(text.trim())) throw new TypeError("Calibration values must be explicit finite decimal numbers; blanks are not zero.");
  const n = Number(text);
  if (!Number.isFinite(n)) throw new TypeError("Calibration values must be finite.");
  return n;
}
export function acceptAnalysisDraft(draft: AnalysisDraft, reference: PhotoelectricReference, revision = 1): AnalysisOutcome {
  try {
    if (!Number.isSafeInteger(revision) || revision < 1) throw new TypeError("Invalid analysis revision.");
    if (typeof draft.label !== "string" || draft.label.length > 160 || /[\u0000-\u001f]/u.test(draft.label)) throw new TypeError("Use a single-line record label of at most 160 characters.");
    if (draft.offsetKind !== "unknown" && draft.offsetKind !== "known") throw new TypeError("Choose the voltage-offset assumption explicitly.");
    const record = parseVoltageCsv(draft.csv, reference.speedOfLight);
    const options: FitOptions = Object.freeze({ weighting: draft.weighting, offset: draft.offsetKind === "unknown" ? Object.freeze({ kind: "unknown" as const }) : Object.freeze({ kind: "known" as const, volts: scalar(draft.offsetVolts), sigmaV: scalar(draft.offsetSigmaV) }) });
    const fit = analyzePhotoelectricData(record.rows, options, reference);
    const source = PHOTOELECTRIC_EXAMPLES.some((e) => e.csv === draft.csv && e.label === draft.label) ? "constructed-example" : "reader-supplied";
    return { kind: "accepted", state: Object.freeze({ revision, csv: draft.csv, label: draft.label.trim() || "Local record", source, record, options, excludedRows: Object.freeze([]), fit, allRowsFit: fit }) };
  } catch (error) {
    return { kind: "refused", message: error instanceof Error ? error.message : "The record could not be analyzed." };
  }
}
/** Exclusion is an explicit sensitivity calculation. Rows are retained and the full fit stays visible. */
export function refitSelectedRows(state: AcceptedAnalysis, excluded: readonly number[], reference: PhotoelectricReference): AnalysisOutcome {
  try {
    if (new Set(excluded).size !== excluded.length || excluded.some((id) => !state.record.rows.some((r) => r.row === id))) throw new TypeError("Select only unique observations from the accepted record.");
    const fit = analyzePhotoelectricData(state.record.rows.filter((r) => !excluded.includes(r.row)), state.options, reference);
    return { kind: "accepted", state: Object.freeze({ ...state, revision: state.revision + 1, fit, excludedRows: Object.freeze([...excluded].sort((a, b) => a - b)) }) };
  } catch (error) {
    return { kind: "refused", message: error instanceof Error ? error.message : "The selection could not be fitted." };
  }
}
/** Report is a local evidence export, not an executable saved result or a public share URL. */
export function exportAnalysisReport(state: AcceptedAnalysis, reference: PhotoelectricReference): string {
  return `${JSON.stringify({ format: "annus-photoelectric-analysis", version: 1, evaluator: "photoelectric-data-v1", reference, analysis: state,
    assumptions: ["Single surface; detected stopping endpoints only; fitted straight line.", "Frequencies treated as known without error; voltage observations independent.", "Known offset calibration is independent of the fitted record.", "Standard errors are conditional, not complete measurement uncertainties or confidence intervals.", "No automatic exclusions, historical authentication or server upload."],
  }, null, 2)}\n`;
}
