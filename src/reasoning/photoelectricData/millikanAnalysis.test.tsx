import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import MillikanAnalysisPage from "../../app/lab/lq-08/millikan/page.tsx";
import { loadMillikanOverlay, millikanOverlayForRecord } from "../../experiments/lq08/millikanRecord.ts";
import { prepareMillikanAnalysis } from "./millikanAnalysis.ts";
import { exportAnalysisReport, modernPhotoelectricReference, refitSelectedRows } from "./session.ts";

const reference = modernPhotoelectricReference();

test("the five-point inference reproduces the independent figure fit from signed, uncorrected rows", () => {
  const figure = loadMillikanOverlay();
  if (figure.kind !== "plottable" || !figure.evidence) throw new Error("Expected admitted Figure 6");
  const prepared = prepareMillikanAnalysis(figure, reference);
  if (prepared.kind !== "available") throw new Error(prepared.reason);
  const { analysis } = prepared;
  expect(analysis.excludedRows).toEqual([6]);
  expect(analysis.record.rows.map((r) => r.stoppingV)).toEqual(figure.points.map((p) => p.interceptVolts));
  expect(analysis.record.rows[0]!.stoppingV).toBeLessThan(0);
  if (analysis.fit.status !== "value" || analysis.fit.planckEstimate.status !== "value") {
    throw new Error("Expected an identifiable slope and conditional h");
  }
  expect(analysis.fit.fit.slope / (1e12 * figure.fittedSlopeVs)).toBeCloseTo(1, 12);
  expect(analysis.fit.planckEstimate.value / (reference.elementaryCharge * figure.fittedSlopeVs)).toBeCloseTo(1, 12);
  expect(analysis.fit.workFunction.status).toBe("underdetermined");
  expect(analysis.fit.threshold.status).toBe("underdetermined");
  expect(analysis.fit.fit.residuals).toHaveLength(5);
  const sensitivity = refitSelectedRows(analysis, [], reference);
  if (sensitivity.kind !== "accepted") throw new Error(sensitivity.message);
  expect(sensitivity.state.fit).toEqual(analysis.allRowsFit);
  expect(sensitivity.state.fit).not.toEqual(analysis.fit);
  expect(sensitivity.state.record.rows).toHaveLength(6);
  const report = JSON.parse(exportAnalysisReport(sensitivity.state, reference));
  expect(report.analysis.historicalRecord.datasetId).toBe(figure.evidence.dataset.id);
  expect(report.analysis.historicalRecord.digitizationRevision).toBe(figure.evidence.dataset.digitizer.digitizationRevision);
  expect(report.analysis.historicalRecord.excluded[0].row).toBe(6);
  expect(report.analysis.historicalRecord.publishedSelection).toEqual([1, 2, 3, 4, 5]);
  expect(report.analysis.excludedRows).toEqual([]);
  expect(report.analysis.source).toBe("historical-measurement");
});

test("an inadmissible source or older plot without provenance supplies no fit or CSV", () => {
  const figure = loadMillikanOverlay();
  if (figure.kind !== "plottable" || !figure.evidence) throw new Error("Expected admitted Figure 6");
  const prohibited = millikanOverlayForRecord(
    { ...figure.evidence.dataset, allowedInferenceModelIds: [] },
    figure.citation,
  );
  const { evidence: _evidence, ...legacy } = figure;
  for (const input of [prohibited, legacy]) {
    const withheld = prepareMillikanAnalysis(input, reference);
    expect(withheld.kind).toBe("withheld");
    expect(withheld).not.toHaveProperty("analysis");
  }
});

test("the static route presents the source selection, residuals, measurement limits and figure links", () => {
  const html = renderToStaticMarkup(<MillikanAnalysisPage />);
  for (const text of [
    "5 of 6 rows", "Signed intercept (V)", "Empirical slope", "Inferred h", "Underdetermined",
    "Select the rows Millikan used", "Download analysis report", "PDF page 94",
  ]) expect(html).toContain(text);
  expect(html).not.toContain("Reader-supplied record");
  expect(html).not.toContain("Constructed straight trend");
});
