import { comparisonDisplay as display } from "../../experiments/compare/comparisonStatement.ts";
import {
  CASE_DISCLAIMER,
  type CountermodelCase,
  type CountermodelTest,
  testUnit,
} from "./caseSchema.ts";
import { type CellResult, cellOutcomeText, classifyCell } from "./classify.ts";
import {
  type CountermodelState,
  createCountermodelSession,
  type PreparedCountermodelCase,
} from "./session.ts";

export function escapeWorkbenchText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
const e = escapeWorkbenchText;
function validUid(uid: string): string {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,100}$/u.test(uid))
    throw new TypeError("Invalid workbench placement id.");
  return uid;
}
function candidateConclusion(
  spec: CountermodelCase,
  state: CountermodelState,
  row: readonly CellResult[],
): string {
  const selected = spec.tests
    .map((test, i) => ({ test, cell: row[i] }))
    .filter(({ test }) => state.active.includes(test.id));
  if (!selected.length) return "No requirements selected; this selection excludes nothing.";
  const failures = selected
    .filter(({ cell }) => cell?.outcome === "violates")
    .map(({ test }) => test.label);
  if (failures.length) return `The selected comparison differs at: ${failures.join("; ")}.`;
  if (selected.some(({ cell }) => !cell || ["unavailable", "indeterminate"].includes(cell.outcome)))
    return "The selected comparisons include an unavailable or numerically indeterminate result.";
  return spec.tests[0]?.kind === "observation"
    ? "The selected observations do not distinguish these candidates. This candidate is not refuted by them."
    : "None of the selected requirements excludes this candidate at the stated tolerance.";
}
function renderCell(
  result: CellResult,
  test: CountermodelTest,
  key: string,
  counted: boolean,
): string {
  const unit = testUnit(test.test);
  const worst = result.samples.reduce<(typeof result.samples)[number] | undefined>(
    (previous, sample) =>
      !previous ||
      Math.abs(sample.residual) / sample.allowed > Math.abs(previous.residual) / previous.allowed
        ? sample
        : previous,
    undefined,
  );
  const summary = worst
    ? `<dl class="countermodel-readouts"><dt>Prediction${result.samples.length > 1 ? ` (${e(worst.label)})` : ""}</dt><dd>${e(display(worst.actual))} ${unit}</dd><dt>Reference</dt><dd>${e(display(worst.reference))} ${unit}</dd><dt>Signed residual</dt><dd data-cell-residual>${e(display(worst.residual))} ${unit}</dd><dt>Allowed magnitude</dt><dd>${e(display(worst.allowed))} ${unit}</dd></dl>`
    : "";
  const samples = result.samples.length
    ? `<div class="countermodel-scroll" role="region" aria-label="${e(test.label)} numerical details" tabindex="0"><table class="countermodel-samples"><caption>Every accepted readout, in ${unit}; full-precision decimal strings</caption><thead><tr><th scope="col">Sample</th><th scope="col">Prediction</th><th scope="col">Reference</th><th scope="col">Signed residual</th><th scope="col">Allowed magnitude</th></tr></thead><tbody>${result.samples.map((sample) => `<tr><th scope="row">${e(sample.label)}</th><td>${e(String(sample.actual))}</td><td>${e(String(sample.reference))}</td><td>${e(String(sample.residual))}</td><td>${e(String(sample.allowed))}</td></tr>`).join("")}</tbody></table></div>`
    : "";
  return `<p class="countermodel-mobile-label">${e(test.label)}</p><p class="countermodel-counted">${counted ? "Included in the selected comparison" : "Not selected; prediction retained"}</p><p class="countermodel-outcome" data-cell-outcome="${result.outcome}">${e(cellOutcomeText(result, test))}</p>${result.reason ? `<p>${e(result.reason)}</p>` : ""}${summary}<details data-cell-detail="${key}"><summary>Open the calculation: ${e(test.label)}</summary><p>${e(test.explanation)}</p><p>Tolerance: the larger of ${e(display(test.tolerance.absolute))} ${unit} and ${e(display(test.tolerance.relative))} times the larger magnitude of prediction and reference. A rounding-sized boundary band is reported as indeterminate.</p><p>${e(test.tolerance.reason)}</p>${samples}</details>`;
}
/** The same escaped markup is server-rendered and updated by the small DOM controller. */
export function renderCountermodelResults(
  spec: CountermodelCase,
  state: CountermodelState,
  uid: string,
): string {
  validUid(uid);
  const snapshot = state.view.accepted;
  if (!snapshot) throw new TypeError("The workbench requires an accepted worked result.");
  const rows = spec.candidates.map((_, i) =>
    spec.tests.map((test, j) => classifyCell(snapshot, i, j, test)),
  );
  return `<table class="countermodel-matrix" role="table"><caption>Candidate predictions at accepted v/c = ${e(display(snapshot.parameters.beta ?? "unavailable"))}. References are ${spec.tests[0]?.kind === "observation" ? "the other candidate’s predictions" : "the stated requirements"}.</caption><thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Candidate and conditions</th>${spec.tests.map((test) => `<th id="${uid}-${test.id}-heading" scope="col" role="columnheader">${e(test.label)}</th>`).join("")}</tr></thead><tbody role="rowgroup">${spec.candidates
    .map((candidate, i) => {
      const row = rows[i];
      if (!row) throw new Error("Missing candidate result row.");
      return `<tr role="row" data-candidate="${candidate.id}"><th id="${uid}-${candidate.id}-heading" scope="row" role="rowheader"><h3>${e(candidate.label)}</h3><p>${e(candidate.circumstances)}</p><p class="countermodel-conclusion" data-candidate-conclusion>${e(candidateConclusion(spec, state, row))}</p><p class="fine">Model: ${e(candidate.modelVersion)}</p></th>${spec.tests
        .map((test, j) => {
          const cell = row[j];
          if (!cell) throw new Error("Missing comparison cell.");
          return `<td role="cell" headers="${uid}-${candidate.id}-heading ${uid}-${test.id}-heading" data-test-cell="${test.id}">${renderCell(cell, test, `${candidate.id}-${test.id}`, state.active.includes(test.id))}</td>`;
        })
        .join("")}</tr>`;
    })
    .join("")}</tbody></table>`;
}
export function renderCountermodelWorkbench(
  example: PreparedCountermodelCase,
  uid: string,
): string {
  validUid(uid);
  const state = createCountermodelSession(uid, example).getServerSnapshot();
  const spec = example.case,
    snapshot = state.view.accepted;
  if (!snapshot) throw new TypeError("Missing worked snapshot.");
  const tests = spec.tests
    .map(
      (test) =>
        `<div class="countermodel-selection"><input id="${uid}-${test.id}-toggle" data-test-toggle="${test.id}" type="checkbox" checked><label for="${uid}-${test.id}-toggle">Include ${e(test.label)}</label></div>`,
    )
    .join("");
  const sources = spec.sources
    .map(
      (source) =>
        `<li><a href="${e(source.url)}" rel="noreferrer">${e(source.label)}</a>${source.parallelWork ? " Parallel work: not on the 1904 shelf." : ""}</li>`,
    )
    .join("");
  const inputs = spec.tests
    .filter((test) => test.inputs.events)
    .map(
      (test) =>
        `<details><summary>Inspect the fixed events for ${e(test.label)}</summary><div class="countermodel-scroll" role="region" aria-label="Fixed event inputs" tabindex="0"><table><caption>Specified event inputs, not observations of nature</caption><thead><tr><th scope="col">Event</th><th scope="col">t (s)</th><th scope="col">x (m)</th><th scope="col">y (m)</th><th scope="col">z (m)</th></tr></thead><tbody>${test.inputs.events?.map((event) => `<tr><th scope="row">${e(event.id)}</th><td>${event.t}</td><td>${event.x}</td><td>${event.y}</td><td>${event.z}</td></tr>`).join("")}</tbody></table></div></details>`,
    )
    .join("");
  return `<section class="countermodel-workbench" data-countermodel-case="${spec.id}" data-instance-id="${e(snapshot.instanceId)}" data-run-id="${e(snapshot.runId)}" data-snapshot-version="${snapshot.snapshotVersion}" data-owner-evaluations="0" aria-labelledby="${uid}-title"><header><h2 id="${uid}-title">${e(spec.title)}</h2><p class="lead">${e(spec.question)}</p></header><p data-execution-label>Static worked example · ideal model, host calculation</p><noscript><p>JavaScript is off. Every worked prediction, residual, tolerance, source reference and explanation remains readable below. Changing the observer or selected requirements needs JavaScript.</p></noscript><div class="lab-columns"><div><form data-countermodel-form aria-label="${e(spec.title)} settings" novalidate><fieldset disabled><legend>Describe the fixed inputs from another inertial frame</legend><label for="${uid}-beta">Observer speed v/c (dimensionless)</label><input id="${uid}-beta" data-observer-input type="text" inputmode="decimal" value="${spec.defaultBeta}" aria-describedby="${uid}-domain"><p id="${uid}-domain" class="fine">Enter -0.95 to 0.95. This is a numerical exploration bound, not a physical speed limit. The low-speed test retains its own specified speeds. Modern SI light speed is used; this is not an inference of a historical constant. In the clock and rod tests this speed relates laboratory and object-rest frames; the rest length and test definition stay fixed, not the selected laboratory endpoints.</p><div class="actions"><button type="submit">Apply observer</button><button type="button" class="secondary" data-default-observer>Restore worked observer</button></div></fieldset></form><p data-workbench-draft hidden>Unapplied request. All numbers still belong to the accepted observer.</p><p role="alert" data-workbench-error hidden></p><fieldset data-test-selection disabled><legend>Select what this comparison must satisfy</legend>${tests}<p class="fine">Selecting requirements changes only which conclusions count. It never recalculates a prediction or changes an accepted snapshot.</p></fieldset><p role="status" aria-live="polite" aria-atomic="true" data-workbench-status>${e(state.message)}</p></div><div class="lab-results"><div data-countermodel-results>${renderCountermodelResults(spec, state, uid)}</div></div></div><p>${e(spec.scope)} This explanation is still a draft.</p><p>${CASE_DISCLAIMER}</p><p>The summary uses five significant digits; every cell offers full-precision values. The low-speed residual is evaluated without subtracting rounded speeds.</p>${inputs}<details><summary>Sources, dates and calculation identities</summary><ul>${sources}</ul><p>These source references support this explanatory model comparison. They do not mark a transcription, historical reconstruction or translation as reviewed.</p><p class="countermodel-digest">Evaluator closure: <code>${e(example.sourceDigest)}</code><br>Case revision: <code>${e(example.caseRevision)}</code></p><p>Both candidates are computed separately. Shared numerical primitives do not preassign agreement or disagreement.</p></details></section>`;
}
