"use client";

import { type FormEvent, useEffect, useId, useState } from "react";
import { OCCUPANCY_CHECKS, MAX_OCCUPANCY_POINTS, type OccupancyCheck, type OccupancyLikelihood } from "../../physics/reference/configurationCountermodels.ts";
import {
  analyzeOccupancyRecord, applyOccupancySettings, clearOccupancyRecord,
  CHECK_LABELS, decodeOccupancyLink, encodeOccupancyLink, illustrativeOccupancyRecord,
  OCCUPANCY_TEXT_LIMIT, selectOccupancyChecks,
  type DecodedOccupancyLink, type OccupancyState,
} from "./state.ts";
import "./independence.css";

function numberText(value: number): string {
  return value === 0 ? "0" : Number(value.toPrecision(8)).toString();
}
function likelihoodText(value: OccupancyLikelihood): string {
  return value.status === "possible"
    ? `Possible. Log likelihood: ${numberText(value.logLikelihood)}.`
    : `Impossible in this ideal model: the record contains counts ${value.impossibleCounts.join(", ")}, to which this model assigns probability zero.`;
}

export function IndependenceWorkbench({ example }: { example: OccupancyState }) {
  const id = useId();
  const [state, setState] = useState(example);
  const [nDraft, setNDraft] = useState(String(example.comparison.settings.n));
  const [qDraft, setQDraft] = useState(String(example.comparison.settings.quarters));
  const [histogram, setHistogram] = useState("");
  const [prediction, setPrediction] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sharedHref, setSharedHref] = useState("");
  const [link, setLink] = useState<DecodedOccupancyLink>({ kind: "absent" });
  const { comparison, evidence } = state;
  const { n, quarters } = comparison.settings;
  const dirty = nDraft !== String(n) || qDraft !== String(quarters);

  useEffect(() => {
    setReady(true);
    setLink(decodeOccupancyLink(window.location.search));
  }, []);

  function accept(next: OccupancyState) {
    const changed = next.comparison.settings.n !== n || next.comparison.settings.quarters !== quarters;
    setState(next);
    setNDraft(String(next.comparison.settings.n));
    setQDraft(String(next.comparison.settings.quarters));
    setError("");
    setSharedHref("");
    if (changed) {
      setHistogram("");
      setPrediction("");
      setNotice("New settings calculated. The previous count record and prediction were cleared because they concerned a different experiment.");
    } else setNotice("Settings calculated. The count record still concerns this same experiment.");
  }
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (!/^[1-9][0-9]?$/u.test(nDraft)) throw new TypeError("Enter a whole-number point count.");
      accept(applyOccupancySettings(state, { n: Number(nDraft), quarters: Number(qDraft) }));
    } catch (e) { setError(e instanceof Error ? e.message : "Check the settings."); }
  }
  function toggle(check: OccupancyCheck) {
    const checks = state.checks.includes(check) ? state.checks.filter((item) => item !== check) : [...state.checks, check];
    setState(selectOccupancyChecks(state, checks));
    setSharedHref("");
  }
  function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (dirty) throw new TypeError("Apply or discard the edited model settings before analyzing a record.");
      setState(analyzeOccupancyRecord(state, histogram));
      setError("");
      setNotice("Count record analyzed locally for the displayed point count and volume fraction.");
    } catch (e) { setError(e instanceof Error ? e.message : "Check the frequencies."); }
  }
  function illustrate(kind: "mixed" | "all-or-none") {
    const next = illustrativeOccupancyRecord(kind);
    accept(next);
    setHistogram(next.evidence?.counts.join(", ") ?? "");
    setPrediction("");
    setNotice("Loaded a constructed 16-placement illustration at four points and half volume. These frequencies are not measured data or a random simulation.");
  }
  async function share() {
    const url = new URL("/lab/countermodels/independence/", window.location.origin);
    url.search = encodeOccupancyLink(comparison.settings, state.checks);
    setSharedHref(url.href);
    try {
      await navigator.clipboard.writeText(url.href);
      setNotice("Copied the accepted-settings link. It contains no count record or prediction.");
    } catch { setNotice("Copy the accepted-settings link below. It contains no count record or prediction."); }
  }

  return <section className="laboratory occupancy-workbench" aria-labelledby={`${id}-title`} data-occupancy-workbench data-execution-label="host" data-owner={comparison.owner}>
    <header className="lab-heading"><h2 id={`${id}-title`}>Keep the mean. Change the dependence.</h2><span className="badge">Ideal models · Host calculation</span></header>
    <noscript><p className="notice">JavaScript is off. The full worked comparison below is available at four points and half volume. Editing settings and analyzing a count record require JavaScript.</p></noscript>
    {link.kind === "invalid" && <p className="notice" role="alert">{link.message} The worked example is unchanged. <a href="/lab/countermodels/independence/">Open the clean example</a>.</p>}
    {link.kind === "settings" && <aside className="notice">
      <p>A shared question is ready: {link.settings.n} points, {link.settings.quarters}/4 of the volume, {link.checks.length} selected measurements. The worked example is still displayed.</p>
      <button type="button" onClick={() => { if (link.kind === "settings") { accept(applyOccupancySettings(state, link.settings, link.checks)); setLink({ kind: "absent" }); } }}>Apply shared question</button>{" "}
      <button type="button" onClick={() => setLink({ kind: "absent" })}>Keep the worked example</button>
    </aside>}
    <div className="occupancy-models">
      <div><h3>Independent positions</h3><p>Each labeled point is placed uniformly and independently. Several, all or none may land inside.</p></div>
      <div><h3>Perfectly locked positions</h3><p>All labeled points share one uniformly placed, coincident position. Only all-in or all-out is possible. This is not a finite-size rigid cluster straddling a boundary.</p></div>
    </div>
    <form onSubmit={apply} aria-label="Configuration comparison settings">
      <fieldset disabled={!ready}>
        <legend>Hold these settings fixed for both models</legend>
        <label htmlFor={`${id}-n`}>Number of labeled points</label>
        <input id={`${id}-n`} type="number" min="1" max={MAX_OCCUPANCY_POINTS} step="1" value={nDraft} onChange={(e) => setNDraft(e.target.value)} />
        <label htmlFor={`${id}-q`}>Fraction of the volume</label>
        <select id={`${id}-q`} value={qDraft} onChange={(e) => setQDraft(e.target.value)}>
          <option value="0">0 — empty region</option><option value="1">1/4</option><option value="2">1/2</option><option value="3">3/4</option><option value="4">1 — whole volume</option>
        </select>
        <button type="submit">Apply model settings</button>{" "}
        <button type="button" onClick={() => { setNDraft(String(n)); setQDraft(String(quarters)); setError(""); }}>Discard edited settings</button>
      </fieldset>
    </form>
    {dirty && <p className="notice">The controls contain unapplied edits. Every result below still uses {n} points and {quarters}/4 of the volume. Applying changed settings clears the current record.</p>}
    {error && <p className="notice error" role="alert">{error} The last accepted comparison and record remain unchanged.</p>}
    <p role="status" aria-atomic="true">{notice}</p>

    <fieldset disabled={!ready}>
      <legend>Which measurements would you keep?</legend>
      {OCCUPANCY_CHECKS.map((check) => <label className="occupancy-check" key={check}><input type="checkbox" checked={state.checks.includes(check)} onChange={() => toggle(check)} />{CHECK_LABELS[check]}</label>)}
    </fieldset>
    <p className="notice" aria-live="polite" data-distinction={state.distinction.status}>
      {state.distinction.status === "underdetermined"
        ? "Underdetermined: the selected measurements have identical predictions. These choices cannot distinguish the two candidates."
        : `Different predictions for: ${state.distinction.different.map((check) => CHECK_LABELS[check]).join("; ")}. This identifies a useful measurement, not a winner without data.`}
    </p>
    <div className="occupancy-table-scroll" tabIndex={0} role="region" aria-label="Model prediction table">
      <table><caption>Predictions at n = {n}, f = {quarters}/4. Counts are dimensionless.</caption>
        <thead><tr><th scope="col">Observable</th><th scope="col">Independent</th><th scope="col">Locked</th><th scope="col">Kept?</th></tr></thead>
        <tbody>{OCCUPANCY_CHECKS.map((check) => <tr key={check}><th scope="row">{CHECK_LABELS[check]}</th><td>{numberText(comparison.independent.statistics[check])}</td><td>{numberText(comparison.locked.statistics[check])}</td><td>{state.checks.includes(check) ? "Yes" : "No"}</td></tr>)}</tbody>
      </table>
    </div>
    <details open><summary>Inspect the full count distributions</summary>
      <p>Each bar uses the same probability scale, zero to one. The numbers are model probabilities, not a sampled histogram.</p>
      <div className="occupancy-table-scroll" tabIndex={0} role="region" aria-label="Count probability distributions">
        <table><caption>Probability of exactly K points inside</caption><thead><tr><th scope="col">K</th><th scope="col">Independent</th><th scope="col">Locked</th></tr></thead>
          <tbody>{comparison.independent.probabilities.map((probability, k) => <tr key={k}><th scope="row">{k}</th>
            <td><meter min={0} max={1} value={probability} aria-label={`Independent probability of ${k} inside`} /> {numberText(probability)}</td>
            <td><meter min={0} max={1} value={comparison.locked.probabilities[k] ?? 0} aria-label={`Locked probability of ${k} inside`} /> {numberText(comparison.locked.probabilities[k] ?? 0)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>
    <details><summary>Connect the joint event to the entropy argument</summary>
      <p>The all-inside constraint has probability W = fⁿ for independent points, but W = f for perfectly locked points. Applying Boltzmann’s logarithm gives ΔS/kB = ln W, with the same reference volume and point count.</p>
      <p>Independent: {comparison.independent.entropyChange.kind === "finite" ? numberText(comparison.independent.entropyChange.value) : "zero probability; no finite logarithm"}. Locked: {comparison.locked.entropyChange.kind === "finite" ? numberText(comparison.locked.entropyChange.value) : "zero probability; no finite logarithm"}.</p>
      <p>This is the log weight of a constraint, not the Shannon entropy of the count distribution. Agreeing with a volume law does not uniquely prove independence or establish the light-quantum hypothesis.</p>
    </details>

    <details className="occupancy-record"><summary>Test a count record against both models</summary>
      <p>Record how often K = 0, 1, …, {n} points were inside across independent repeat placements at the displayed settings. Enter one frequency for each K, including zeros. Consecutive frames of one correlated trajectory are not independent trials.</p>
      <p>No file is uploaded and nothing is stored automatically. Analyzing asserts exact counting, known n and f, and identical independently repeated trials. Counting errors, finite cluster geometry and partially correlated models are not included.</p>
      <form onSubmit={analyze}>
        <label htmlFor={`${id}-record`}>Frequencies for K = 0 through {n}, separated by commas or spaces</label>
        <textarea id={`${id}-record`} rows={3} maxLength={OCCUPANCY_TEXT_LIMIT} value={histogram} onChange={(e) => setHistogram(e.target.value)} disabled={!ready} />
        <button type="submit" disabled={!ready}>Analyze count record</button>{" "}
        <button type="button" disabled={!ready} onClick={() => { setState(clearOccupancyRecord(state)); setHistogram(""); setNotice("Count record cleared."); setError(""); }}>Clear count record</button>
      </form>
      <p>Or replace the settings and record with an explicitly constructed example:</p>
      <div className="actions"><button type="button" disabled={!ready} onClick={() => illustrate("mixed")}>Illustration: mixed counts</button><button type="button" disabled={!ready} onClick={() => illustrate("all-or-none")}>Illustration: all-or-none counts</button></div>
      {evidence && <section aria-labelledby={`${id}-evidence`} data-evidence-status={evidence.status}>
        <h3 id={`${id}-evidence`}>{state.evidenceSource === "illustrative" ? "Constructed illustration — not measured data" : "Reader-entered count record — provenance not verified"}</h3>
        <p>Accepted frequencies: <code>{evidence.counts.join(", ")}</code>. {evidence.trials} placements at n = {evidence.settings.n}, f = {evidence.settings.quarters}/4. Edited text is not analyzed until you submit it.</p>
        <p>Empirical mean: {numberText(evidence.empiricalMean)}. Empirical variance (divisor N): {numberText(evidence.empiricalVariance)}. All-inside frequency: {numberText(evidence.empiricalAllInside)}.</p>
        <p><strong>Independent:</strong> {likelihoodText(evidence.independent)}</p><p><strong>Locked:</strong> {likelihoodText(evidence.locked)}</p>
        {evidence.logLikelihoodRatio !== null && <p>ln(L independent / L locked) = {numberText(evidence.logLikelihoodRatio)}. Positive favors independence; negative favors locking; zero gives equal likelihood. Both remain possible. This is not a probability that either model is true, a p-value, or a significance decision.</p>}
        <p>{evidence.status === "neither-possible" ? "Neither ideal candidate can produce this record at these settings. Recheck the measurement, assumptions and model scope; do not declare the remaining model a winner." : evidence.status === "independent-only" ? "A partially occupied placement contradicts perfect locking under the stated ideal assumptions. It does not rule out every correlated model." : "Nonzero likelihood is not proof. More informative measurements or a wider candidate set may still be needed."}</p>
        <details><summary>What the likelihood calculation assumes</summary><p>For bin frequencies hₖ and N total trials, the multinomial likelihood is N! × ∏pₖ^hₖ / ∏hₖ!. It is evaluated in log space. A bin with zero model probability and positive frequency is impossible; an extremely small positive likelihood is not relabeled zero.</p></details>
      </section>}
    </details>
    <label htmlFor={`${id}-prediction`}>Your explanation: why is the mean insufficient? (Optional, this tab only.)</label>
    <textarea id={`${id}-prediction`} rows={3} maxLength={1200} value={prediction} onChange={(e) => setPrediction(e.target.value)} disabled={!ready} />
    <button type="button" disabled={!ready} onClick={share}>Copy accepted-settings link</button>
    {sharedHref && <p><a href={sharedHref}>Open the shared question</a><input aria-label="Accepted-settings link" readOnly value={sharedHref} /></p>}
    <p className="muted">The link shares settings and selected measurements only. Your count record and explanation stay out of it. Copy them separately before leaving this tab.</p>
  </section>;
}
