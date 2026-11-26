import {
  MILLIKAN_1916_FIT_ID,
  type MillikanOverlayResult,
} from "../../experiments/lq08/millikan.ts";
import {
  type AcceptedAnalysis,
  acceptAnalysisDraft,
  type PhotoelectricReference,
  refitSelectedRows,
} from "./session.ts";

type MillikanAnalysis =
  | Readonly<{ kind: "available"; analysis: AcceptedAnalysis }>
  | Readonly<{ kind: "withheld"; citation: string; reason: string }>;

/** The source inspector has already admitted the record, the signed axes and the named fit.
 * CSV row numbers start at one. Retain their relation to the original dataset rows in exports. */
export function prepareMillikanAnalysis(
  overlay: MillikanOverlayResult,
  reference: PhotoelectricReference,
): MillikanAnalysis {
  if (overlay.kind === "withheld") return overlay;
  const withhold = (reason: string): MillikanAnalysis => ({
    kind: "withheld",
    citation: overlay.citation,
    reason,
  });
  if (!overlay.evidence) return withhold("The figure’s source record is unavailable.");
  const { dataset, sourceLinks } = overlay.evidence;
  const sourceRows: number[] = [];
  const publishedSelection: number[] = [];
  const excluded: { row: number; reason: string }[] = [];
  const lines = ["frequency_Hz,stopping_V"];
  for (const [index, point] of overlay.points.entries()) {
    if (point.rowIndex === undefined) return withhold("A figure point lacks its source row.");
    sourceRows.push(point.rowIndex + 1);
    const row = index + 1;
    if (point.usedForSlope) publishedSelection.push(row);
    else {
      if (!point.slopeExclusionReason) return withhold("A point outside the fit lacks its source explanation.");
      excluded.push({ row, reason: point.slopeExclusionReason });
    }
    lines.push(`${point.frequencyHz},${point.interceptVolts}`);
  }
  // The plotted signed endpoints have no per-row standard deviations or admitted calibration.
  const all = acceptAnalysisDraft({
    label: "Millikan’s sodium measurements, Figure 6 (1916)",
    csv: lines.join("\n") + "\n",
    weighting: "equal",
    offsetKind: "unknown",
    offsetVolts: "",
    offsetSigmaV: "",
  }, reference);
  if (all.kind === "refused") return withhold(all.message);
  const selected = refitSelectedRows(all.state, excluded.map(({ row }) => row), reference);
  if (selected.kind === "refused") return withhold(selected.message);
  return {
    kind: "available",
    analysis: {
      ...selected.state,
      revision: 1,
      source: "historical-measurement",
      historicalRecord: {
        datasetId: dataset.id,
        fitId: MILLIKAN_1916_FIT_ID,
        digitizationRevision: dataset.digitizer.digitizationRevision,
        citation: overlay.citation,
        sourceRows,
        publishedSelection,
        printedSlopes: overlay.printedSlopes,
        excluded,
        sourceLinks,
        uncertainty: dataset.uncertainty.description,
      },
    },
  };
}
