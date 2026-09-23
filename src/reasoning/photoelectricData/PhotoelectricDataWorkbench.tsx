"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import type { InferredQuantity, PhotoelectricReference } from "../../physics/reference/inference/photoelectricData.ts";
import { createVoltageFileReader } from "./record.ts";
import {
  acceptAnalysisDraft, draftFromAnalysis, exampleDraft, exportAnalysisReport, PHOTOELECTRIC_EXAMPLES,
  refitSelectedRows, type AcceptedAnalysis, type AnalysisDraft,
} from "./session.ts";
import { PhotoelectricPlots } from "./PhotoelectricPlots.tsx";
import "./photoelectricData.css";

function display(value: number): string { return Number(value.toPrecision(6)).toString(); }
function Quantity({ title, result }: { title: string; result: InferredQuantity }) {
  return <div className="photo-data-quantity"><h3>{title}</h3>{result.status === "value" ? <p>{display(result.value)} ± {display(result.standardError)} {result.unit}<br /><small>One standard error, conditional on the assumptions below.</small></p> : <p><strong>{result.status === "underdetermined" ? "Underdetermined" : "Outside this model"}.</strong> {result.reason}</p>}</div>;
}
function download(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function PhotoelectricDataWorkbench({ example, reference }: { example: AcceptedAnalysis; reference: PhotoelectricReference }) {
  const id = useId();
  const [accepted, setAccepted] = useState(example);
  const [draft, setDraft] = useState<AnalysisDraft>(() => draftFromAnalysis(example));
  const [dirty, setDirty] = useState(false);
  const [excluded, setExcluded] = useState<readonly number[]>(example.excludedRows);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reading, setReading] = useState(false);
  const [reader] = useState(createVoltageFileReader);
  useEffect(() => () => reader.cancel(), [reader]);
  function edit(next: Partial<AnalysisDraft>) {
    reader.cancel(); setReading(false); setDraft((old) => ({ ...old, ...next })); setDirty(true); setNotice(""); setError("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); reader.cancel(); setReading(false);
    const outcome = acceptAnalysisDraft(draft, reference, accepted.revision + 1);
    if (outcome.kind === "refused") { setError(outcome.message); return; }
    setAccepted(outcome.state); setExcluded([]); setDirty(false); setError("");
    setNotice("Record and assumptions accepted. All rows are included in this new analysis.");
  }
  async function openFile(file: File) {
    setReading(true); setError("");
    const outcome = await reader.read(file);
    if (outcome.kind === "stale") return;
    setReading(false);
    if (outcome.kind === "invalid") { setError(outcome.message); return; }
    setDraft((old) => ({ ...old, csv: outcome.text, label: "Local file record" })); setDirty(true);
    setNotice("File read locally into the draft. Choose Analyze record to replace the accepted result.");
  }
  function selectExample(exampleId: string) {
    reader.cancel(); setReading(false); setDraft(exampleDraft(exampleId)); setDirty(true); setError("");
    setNotice("Constructed example staged. It is not a historical dataset; choose Analyze record to use it.");
  }
  function refit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dirty || reading) { setError("Analyze or discard the edited record before changing its row selection."); return; }
    const outcome = refitSelectedRows(accepted, excluded, reference);
    if (outcome.kind === "refused") { setError(outcome.message); return; }
    setAccepted(outcome.state); setError(""); setNotice("Selection accepted. Excluded rows and the all-row comparison remain visible.");
  }
  function save(kind: "csv" | "report") {
    try {
      download(kind === "csv" ? accepted.csv : exportAnalysisReport(accepted, reference), kind === "csv" ? "photoelectric-record.csv" : "photoelectric-analysis.json", kind === "csv" ? "text/csv;charset=utf-8" : "application/json");
      setNotice(kind === "csv" ? "Downloaded the accepted CSV, including all rows. Exclusions are recorded in the JSON report." : "Downloaded the accepted analysis, raw CSV, exclusions, assumptions and calibration. Draft edits are not exported.");
    } catch { setError("This browser could not create the download. The accepted analysis is unchanged."); }
  }
  const result = accepted.fit;
  const baseline = accepted.allRowsFit;
  const residualByRow = new Map(result.status === "value" ? result.usedRows.map((row, i) => [row, result.fit.residuals[i]!]) : []);
  const selectedCount = accepted.record.rows.length - accepted.excludedRows.length;
  return <section className="photoelectric-data-workbench" aria-labelledby={`${id}-title`} data-photoelectric-data data-analysis-revision={accepted.revision} data-execution-label="host">
    <h2 id={`${id}-title`}>Analyze a stopping-potential record</h2>
    <p className="notice">The initial rows are a constructed teaching example, not measurements. Your CSV stays in this tab unless you download it. There is no server upload, automatic storage or public data link.</p>
    <noscript><p>The complete constructed worked example and its table remain readable. File reading, refitting and downloads need JavaScript.</p></noscript>
    <form onSubmit={submit} aria-label="Photoelectric data and calibration">
      <fieldset><legend>1. Choose the record</legend>
        <div className="actions">{PHOTOELECTRIC_EXAMPLES.map((e) => <button type="button" key={e.id} onClick={() => selectExample(e.id)}>{e.label}</button>)}</div>
        <label htmlFor={`${id}-file`}>Read a local CSV (at most 128 KiB)</label>
        <input id={`${id}-file`} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void openFile(file); }} />
        {reading && <p role="status">Reading the file into the draft…</p>}
        <label htmlFor={`${id}-csv`}>Frequency and stopping-potential rows</label>
        <textarea id={`${id}-csv`} rows={9} value={draft.csv} maxLength={131072} spellCheck={false} onChange={(e) => edit({ csv: e.target.value, label: "Edited local record" })} aria-describedby={`${id}-format`} />
        <p id={`${id}-format`}>Header: <code>frequency_THz,stopping_V</code>, optionally followed by <code>sigma_V</code>. <code>frequency_Hz</code> or <code>wavelength_nm</code> may replace the frequency column. Commas or tabs, decimal/scientific notation, 3–1000 rows. Every row must be a detected stopping endpoint; a non-detection is not a zero-voltage observation.</p>
        <label htmlFor={`${id}-label`}>Record label (included in your download)</label>
        <input id={`${id}-label`} value={draft.label} maxLength={160} onChange={(e) => edit({ label: e.target.value })} />
      </fieldset>
      <fieldset><legend>2. State the error and calibration assumptions</legend>
        <label htmlFor={`${id}-weight`}>Fit weighting</label>
        <select id={`${id}-weight`} value={draft.weighting} onChange={(e) => edit({ weighting: e.target.value as AnalysisDraft["weighting"] })}>
          <option value="equal">Equal weights; estimate scatter from residuals</option>
          <option value="declared-sigma">Inverse variance from every row’s sigma_V</option>
        </select>
        <p>Weighted fitting treats sigma_V as a declared independent standard uncertainty in volts. It is not a relative quality score. Frequency error, correlated errors and mixed surfaces are not modeled.</p>
        <label htmlFor={`${id}-offset-kind`}>Common voltage offset</label>
        <select id={`${id}-offset-kind`} value={draft.offsetKind} onChange={(e) => edit({ offsetKind: e.target.value as AnalysisDraft["offsetKind"] })}>
          <option value="unknown">Unknown: do not identify escape work from the intercept</option>
          <option value="known">Independently calibrated, including a stated zero</option>
        </select>
        {draft.offsetKind === "known" && <div className="photo-data-calibration">
          <label htmlFor={`${id}-offset`}>Offset added to the physical stopping potential (V)</label>
          <input id={`${id}-offset`} inputMode="decimal" value={draft.offsetVolts} onChange={(e) => edit({ offsetVolts: e.target.value })} />
          <label htmlFor={`${id}-offset-sigma`}>Independent standard uncertainty of that offset (V)</label>
          <input id={`${id}-offset-sigma`} inputMode="decimal" value={draft.offsetSigmaV} onChange={(e) => edit({ offsetSigmaV: e.target.value })} />
          <p>A zero uncertainty is an explicit idealized assumption, not an experimental calibration supplied by this site.</p>
        </div>}
      </fieldset>
      <div className="actions"><button type="submit" disabled={reading}>Analyze record</button>
        <button type="button" onClick={() => { reader.cancel(); setReading(false); setDraft(draftFromAnalysis(accepted)); setDirty(false); setError(""); setNotice("Draft discarded; the accepted record and selection are unchanged."); }}>Discard draft edits</button></div>
    </form>
    {error && <p className="notice error" role="alert">{error} The accepted result below has not been replaced.</p>}
    <p role="status" aria-live="polite">{notice}</p>
    {(dirty || reading) && <p className="notice">Draft changes are not yet applied. Plots, table, selection and downloads still describe the accepted record.</p>}
    <section aria-labelledby={`${id}-result`} data-accepted-analysis>
      <h2 id={`${id}-result`}>Accepted analysis: {accepted.label}</h2>
      <p><strong>{accepted.source === "constructed-example" ? "Constructed example — not historical observations" : "Reader-supplied record — provenance not verified"}</strong>. Revision {accepted.revision}. {selectedCount} of {accepted.record.rows.length} rows used; {accepted.excludedRows.length} explicitly excluded.</p>
      <p>Accepted assumptions: {accepted.options.weighting === "equal" ? "equal weights and estimated common scatter" : "declared independent voltage uncertainties"}; {accepted.options.offset.kind === "unknown" ? "unknown common voltage offset" : `offset ${accepted.options.offset.volts} ± ${accepted.options.offset.sigmaV} V`}.</p>
      {result.status === "underdetermined" ? <p className="notice"><strong>Underdetermined.</strong> {result.reason}</p> : <>
        <div className="photo-data-results">
          <div className="photo-data-quantity"><h3>Empirical slope</h3><p>{display(result.fit.slope)} ± {display(Math.sqrt(result.fit.slopeVariance))} V/THz</p></div>
          <div className="photo-data-quantity"><h3>Empirical intercept</h3><p>{display(result.fit.intercept)} ± {display(Math.sqrt(result.fit.interceptVariance))} V</p></div>
          <Quantity title="Inferred h, conditional on the photoelectric model" result={result.planckEstimate} />
          <Quantity title="Surface escape work" result={result.workFunction} />
          <Quantity title="Physical threshold frequency" result={result.threshold} />
        </div>
        <p>Reference slope from {reference.constantSetId}: {display(result.referenceSlopeVPerTHz)} V/THz. Relative fitted-slope difference: {display(100 * result.relativeSlopeDifference)}%. This reference does not determine the fitted line.</p>
        <p>Residual standard deviation: {display(result.fit.residualStandardDeviation)} V; {result.fit.degreesOfFreedom} residual degrees of freedom.{result.fit.reducedChiSquare !== null && ` Reduced chi-square: ${display(result.fit.reducedChiSquare)}.`}</p>
        {result.warnings.map((warning) => <p className="notice" key={warning}>{warning}</p>)}
        <p>These are conditional one-standard-error estimates, not confidence intervals, proof of the model, or a complete uncertainty budget. A fit against modern SI is a consistency check, not a redetermination of its defined constants.</p>
      </>}
      {accepted.excludedRows.length > 0 && <p className="notice">All-row comparison: {baseline.status === "value" ? `slope ${display(baseline.fit.slope)} V/THz, residual standard deviation ${display(baseline.fit.residualStandardDeviation)} V.` : baseline.reason} Exclusion is a sensitivity calculation, not an automatic outlier test.</p>}
      <PhotoelectricPlots state={accepted} />
      <form onSubmit={refit} aria-label="Observation selection">
        <fieldset disabled={dirty || reading}><legend>Inspect observations and test a stated exclusion</legend>
          <p>All observations remain in this table and in the CSV. No point is removed automatically. Keep at least three selected rows; excluded points are crosses on the voltage plot.</p>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: the wide data table is a named keyboard-scrollable region */}
          <div className="photo-data-table" role="region" aria-label="Accepted observations, residuals and row selection" tabIndex={0}>
            <table><caption>Accepted CSV converted to THz and V. Residuals correspond to the last accepted selection, not unapplied checkboxes.</caption>
              <thead><tr><th scope="col">Include</th><th scope="col">Row</th><th scope="col">Frequency (THz)</th><th scope="col">Stopping (V)</th><th scope="col">σ (V)</th><th scope="col">Residual (V)</th><th scope="col">Accepted use</th></tr></thead>
              <tbody>{accepted.record.rows.map((r) => <tr key={r.row}>
                <td><input type="checkbox" aria-label={`Include observation ${r.row}`} checked={!excluded.includes(r.row)} onChange={(e) => setExcluded((ids) => e.target.checked ? ids.filter((n) => n !== r.row) : [...ids, r.row])} /></td>
                <th scope="row">{r.row}</th><td>{display(r.frequencyTHz)}</td><td>{display(r.stoppingV)}</td><td>{r.sigmaV === undefined ? "Not supplied" : display(r.sigmaV)}</td><td>{residualByRow.has(r.row) ? display(residualByRow.get(r.row)!) : "Not fitted"}</td><td>{accepted.excludedRows.includes(r.row) ? "Excluded" : "Included"}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="actions"><button type="submit">Refit selected rows</button><button type="button" onClick={() => setExcluded([])}>Select all rows</button></div>
        </fieldset>
      </form>
      <div className="actions"><button type="button" onClick={() => save("csv")}>Download accepted CSV</button><button type="button" onClick={() => save("report")}>Download analysis report</button></div>
      <p>The JSON report includes the raw CSV, row exclusions, calibration values and assumptions. It is a private file export, not an authenticated experiment or a public sharing link.</p>
    </section>
  </section>;
}
