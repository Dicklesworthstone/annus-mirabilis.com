import {
  inferenceText as e,
  inferenceIdentity,
  inferenceInterval,
  inferenceValue,
  renderCameraMoments,
  renderCompatibleLine,
  renderInferenceFamily,
} from "../../components/lab/inferenceView.ts";
import { display, result } from "../../components/lab/presentation.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { InferenceEvidence } from "./evidence.ts";
import { radiusInformationFor } from "./model.ts";
import { createCameraInferenceSession, createRadiusSession } from "./session.ts";

export type InferenceExample = Readonly<{
  ideal: InferenceEvidence;
  camera: InferenceEvidence;
  sourceDigest: string;
}>;
export function renderRadiusResults(snapshot: AcceptedSnapshot): string {
  const p = snapshot.parameters;
  const known = p.radiusKnown === true;
  const accepted = known
    ? `Radius ${display(Number(p.radius), 1e6)} μm; bounds ${display(Number(p.radiusLower), 1e6)} – ${display(Number(p.radiusUpper), 1e6)} μm; declared marginal coverage ${display(Number(p.radiusCoverage), 100)}%. Provenance: ${e(String(p.provenance))}`
    : "No independent radius has been admitted. The form below is an unapplied proposal.";
  const auxiliary = (
    [
      ["temperature", "Temperature", "K", 1],
      ["viscosity", "Solvent viscosity", "mPa·s", 1000],
    ] as const
  )
    .map(([name, label, unit, factor]) =>
      p[`${name}Uncertain`]
        ? `<li>${label}: ${display(Number(p[`${name}Lower`]), factor)} – ${display(Number(p[`${name}Upper`]), factor)} ${unit}; declared marginal coverage ${display(Number(p[`${name}Coverage`]), 100)}%. Provenance: ${e(String(p[`${name}Provenance`]))}</li>`
        : `<li>${label}: held exact at this recording's declared nominal value.</li>`,
    )
    .join("");
  return `<div ${inferenceIdentity(snapshot)}><p data-accepted-radius><strong>Accepted radius information:</strong> ${accepted}</p><div data-accepted-auxiliary><p><strong>Accepted physical-input assumptions:</strong></p><ul>${auxiliary}</ul><p class="fine">The radius–number product and family below are conditional on the nominal temperature and viscosity. The molecular-number interval additionally includes every declared input interval above. Timing, coordinate calibration and the selected gas constant remain exact.</p></div><dl class="infer-readouts"><div><dt>Diffusion estimate (μm²/s)</dt><dd>${inferenceValue(snapshot, "diffusionCoefficientEstimate", 1e12)}</dd></div><div><dt>95% diffusion interval (μm²/s)</dt><dd>${inferenceInterval(snapshot, "diffusionInterval", 1e12)}</dd></div><div><dt>Radius × number product at nominal conditions (m/mol)</dt><dd>${inferenceValue(snapshot, "radiusNumberProduct")}</dd></div><div><dt>Molecular-number estimate (mol⁻¹)</dt><dd>${inferenceValue(snapshot, "avogadroNumberEstimate")}</dd></div><div><dt>Conditional molecular-number interval (mol⁻¹)</dt><dd>${inferenceInterval(snapshot, "molecularInterval")}</dd></div><div><dt>Conservative simultaneous coverage lower bound (%)</dt><dd>${inferenceValue(snapshot, "simultaneousCoverage", 100)}</dd></div></dl>${renderInferenceFamily(snapshot, true)}</div>`;
}
export function renderCameraResults(snapshot: AcceptedSnapshot): string {
  const info = String(snapshot.parameters.information);
  const physical = result(snapshot, "physicalSolution");
  const diagnosis =
    physical.status === "value" && physical.value === 0
      ? '<p class="notice" data-infeasible-moments>The unconstrained moment solution contains a negative diffusion or noise variance. No physical parameter pair exactly matches both admitted sample moments. The signed estimates remain visible; they have not been clipped. Finite-sample fluctuation or a wrong model can cause this.</p>'
      : "";
  return `<div ${inferenceIdentity(snapshot)}><p><strong>Accepted information:</strong> ${info === "variance" ? "one increment variance" : info === "covariance" ? "increment variance and neighboring covariance" : "variances at the original and doubled spacing"}. The recorded positions have not changed.</p>${renderCameraMoments(snapshot, false)}<dl class="infer-readouts"><div><dt>Variance at doubled spacing (μm²)</dt><dd>${inferenceValue(snapshot, "secondVariance", 1e12)}</dd></div><div><dt>Diffusion moment estimate (μm²/s)</dt><dd>${inferenceValue(snapshot, "diffusionEstimate", 1e12)}</dd></div><div><dt>Localization-noise variance estimate (μm²)</dt><dd>${inferenceValue(snapshot, "noiseEstimate", 1e12)}</dd></div><div><dt>Confidence interval</dt><dd>${inferenceValue(snapshot, "diffusionConfidenceInterval")}</dd></div></dl>${diagnosis}${renderCompatibleLine(snapshot)}</div>`;
}
function evidenceDetails(evidence: InferenceEvidence, pinned = false): string {
  return `<details data-observation-evidence><summary>Inspect the fixed observations and their identity</summary><p class="digest">Observation digest: <code>${e(evidence.observationDigest)}</code><br>Generator source: <code>${e(evidence.sourceDigest)}</code></p><p>Motion seed: <code>${e(evidence.seed)}</code>. These ${pinned ? "accepted laboratory" : "built-in"} observations are synthetic, not an uploaded dataset or a historical measurement.</p><div class="table-scroll" role="region" aria-label="Fixed synthetic displacement observations" tabindex="0"><table><caption>Displacements in μm, ordered by frame and coordinate</caption><thead><tr><th scope="col">Frame increment</th><th scope="col">Coordinate</th><th scope="col">Displacement (μm)</th></tr></thead><tbody>${evidence.increments.map((v, i) => `<tr><th scope="row">${Math.floor(i / evidence.d) + 1}</th><td>${i % evidence.d === 0 ? "x" : "y"}</td><td>${display(v, 1e6)}</td></tr>`).join("")}</tbody></table></div></details>`;
}
function validatePlacement(uid: string, sourceDigest: string) {
  if (
    !/^[A-Za-z][A-Za-z0-9_-]{0,100}$/u.test(uid) ||
    !/^source:sha256:[a-f0-9]{64}$/u.test(sourceDigest)
  )
    throw new TypeError("Invalid inference placement or evaluator identity.");
}
function requireAccepted(snapshot: AcceptedSnapshot | null): AcceptedSnapshot {
  if (!snapshot) throw new TypeError("Missing accepted worked result.");
  return snapshot;
}
function renderRadiusCase(evidence: InferenceEvidence, uid: string, pinned = false): string {
  const radius = requireAccepted(
    createRadiusSession(`${uid}-radius`, evidence).getSnapshot().accepted,
  );
  const radiusWorked = requireAccepted(
    createRadiusSession(
      `${uid}-worked-radius`,
      evidence,
      radiusInformationFor(evidence, true),
    ).getSnapshot().accepted,
  );
  const fields = [
    ["radius", "Radius point value", "μm", "0.5"],
    ["radiusLower", "Radius lower bound", "μm", "0.45"],
    ["radiusUpper", "Radius upper bound", "μm", "0.55"],
    ["radiusCoverage", "Declared radius interval coverage", "%", "97.5"],
  ] as const;
  const inputs = fields
    .map(
      ([name, label, unit, value]) =>
        `<div><label for="${uid}-${name}">${label} (${unit})</label><input type="text" inputmode="decimal" id="${uid}-${name}" name="${name}" value="${value}" data-radius-field="${name}"></div>`,
    )
    .join("");
  const auxiliaryInputs = (
    [
      ["temperature", "Temperature", "K", evidence.T],
      ["viscosity", "Solvent viscosity", "mPa·s", evidence.eta * 1000],
    ] as const
  )
    .map(([name, label, unit, nominal]) => {
      const numeric = [
        [`${name}Lower`, `${label} lower bound`, unit, String(nominal)],
        [`${name}Upper`, `${label} upper bound`, unit, String(nominal)],
        [`${name}Coverage`, `Declared ${name} interval coverage`, "%", "99"],
      ]
        .map(
          ([field, title, units, value]) =>
            `<div><label for="${uid}-${field}">${title} (${units})</label><input type="text" inputmode="decimal" id="${uid}-${field}" name="${field}" value="${value}" data-radius-field="${field}"></div>`,
        )
        .join("");
      return `<fieldset><legend>${label} uncertainty</legend><div class="infer-choices"><div><input type="checkbox" id="${uid}-${name}Uncertain" data-radius-uncertain="${name}"><label for="${uid}-${name}Uncertain">Include the declared ${name} interval</label></div></div><div class="infer-fields">${numeric}<div class="infer-wide"><label for="${uid}-${name}Provenance">${label} interval provenance</label><input type="text" id="${uid}-${name}Provenance" name="${name}Provenance" maxlength="512" value="" data-radius-field="${name}Provenance"></div></div><p class="fine">Bounds must contain the fixed nominal value, ${display(nominal)} ${unit}. No measurement is inferred from these draft bounds.</p></fieldset>`;
    })
    .join("");
  return `<section class="laboratory" data-infer-case="radius" data-instrument-id="infer-ideal" ${inferenceIdentity(radius)} data-observation-digest="${e(evidence.observationDigest)}" data-input-revision="${radius.revisions.input}" data-accepted-input-revision="${radius.revisions.input}" data-pending="false" data-execution-label="${pinned ? "host" : "static"}"><header class="lab-heading" data-case-heading><div><p class="eyebrow">One relation · two unknowns</p><h2>Can displacements tell radius and molecular number apart?</h2></div><p class="badge" data-infer-label>${pinned ? "Host calculation · pinned observations" : "Static worked example"}</p></header><p class="fine">Held fixed: ${evidence.increments.length / evidence.d} synthetic increments in ${evidence.d} coordinates, ${display(evidence.dt)} s apart, at ${display(evidence.T)} K and ${display(evidence.eta, 1000)} mPa·s.</p><div class="lab-columns"><div>
<form data-radius-form aria-label="Independent radius information" novalidate><fieldset disabled><legend>Add an independent measurement</legend><div class="infer-fields">${inputs}<div class="infer-wide"><label for="${uid}-provenance">Radius provenance (how was this established independently?)</label><input type="text" id="${uid}-provenance" name="provenance" maxlength="512" data-radius-field="provenance" value=""></div></div><details data-radius-auxiliary><summary>Include uncertainty in temperature or viscosity</summary>${auxiliaryInputs}</details><p class="fine">For at least 95% simultaneous coverage, the Bonferroni procedure divides the error allowance between diffusion and every declared input interval. Radius alone needs at least 97.5% marginal coverage; adding temperature or viscosity requires at least 98⅓% for each interval; adding both requires at least 98.75%. No coverage is increased automatically. A provenance description records your assumption; it does not verify the measurement. Dependence between interval errors does not invalidate this conservative bound. Timing, calibration and R remain exact.</p><div class="actions"><button type="submit">Apply independent radius</button><button type="button" class="secondary" data-radius-worked>Use the synthetic worked radius</button><button type="button" class="secondary" data-radius-remove>Remove radius information</button></div></fieldset></form><p class="notice" data-radius-draft hidden>Unapplied input information. The results still use the accepted information above.</p><p role="alert" data-infer-error hidden></p><p role="status" aria-live="polite" aria-atomic="true" data-infer-status>Only displacement information has been admitted.</p></div>
<div class="lab-results" data-infer-results>${renderRadiusResults(radius)}</div></div>
<p>In this synthetic recovery exercise, the gas constant is a declared scenario input. Neither modern exact k<sub>B</sub> nor modern exact N<sub>A</sub> supplies the unknown. This is not a historical molecular count.</p><details><summary>Why does another radius on the curve work equally well?</summary><p>The diffusion relation fixes the product of radius and molecular number. Doubling the radius and halving the number leaves that product unchanged. More displacements can narrow the product's uncertainty, but cannot separate its factors without another relation.</p><p>An independent radius interval restricts the family. Combining its error probability with the diffusion interval's error probability gives a conservative bound. This is not a posterior probability for a single realized interval, and a radius deduced by assuming the molecular number would only return that assumption.</p></details>
<details data-static-radius><summary>${pinned ? "Worked solution" : "Static worked solution"}: admit the independent radius</summary><p>Suppose a separate synthetic calibration supplies 0.5 μm, with bounds 0.45–0.55 μm and declared 97.5% coverage. No measurement is claimed here. The owner's resulting conditional interval is ${inferenceInterval(radiusWorked, "molecularInterval")} mol⁻¹, with conservative coverage of at least ${inferenceValue(radiusWorked, "simultaneousCoverage", 100)}%.</p></details>${evidenceDetails(evidence, pinned)}<p><a href="/lab/bm-07/">Return to the full inference laboratory</a> · <a href="/papers/brownian-motion/#arg-bm-inference">Return to the inference argument</a></p></section>`;
}
function renderCameraCase(evidence: InferenceEvidence, uid: string, pinned = false): string {
  const camera = requireAccepted(
    createCameraInferenceSession(`${uid}-camera`, evidence).getSnapshot().accepted,
  );
  const covarianceWorked = requireAccepted(
    createCameraInferenceSession(`${uid}-worked-camera`, evidence, {
      information: "covariance",
    }).getSnapshot().accepted,
  );
  const paired =
    evidence.increments.length >= 6 * evidence.d &&
    evidence.increments.length % (2 * evidence.d) === 0;
  const methods = [
    ["variance", "Use one variance only"],
    ["covariance", "Add neighboring covariance"],
    ["second-interval", "Add variance at twice the spacing"],
  ] as const;
  return `<section class="laboratory" data-infer-case="camera" data-instrument-id="infer-camera" ${inferenceIdentity(camera)} data-observation-digest="${e(evidence.observationDigest)}" data-input-revision="${camera.revisions.input}" data-accepted-input-revision="${camera.revisions.input}" data-pending="false" data-execution-label="${pinned ? "host" : "static"}"><header class="lab-heading" data-case-heading><div><p class="eyebrow">One record · different information</p><h2>Motion or localization error?</h2></div><p class="badge" data-infer-label>${pinned ? "Host calculation · pinned observations" : "Static worked example"}</p></header><p>Keep ${evidence.increments.length / evidence.d} camera increments in ${evidence.d} coordinates. Frame spacing ${display(evidence.dt)} s; known uniform exposure ${display(evidence.exposure)} s; known drift ${display(evidence.knownDrift, 1e6)} μm/s. The generator's diffusion coefficient and localization variance are not inference inputs.</p><div class="lab-columns"><div><fieldset disabled data-camera-controls><legend>Which information will you admit?</legend><div class="infer-choices">${methods.map(([value, label]) => `<div><input type="radio" id="${uid}-${value}" name="${uid}-camera-information" value="${value}"${value === "variance" ? " checked" : ""}${value === "second-interval" && !paired ? " disabled" : ""} data-camera-information><label for="${uid}-${value}">${label}</label></div>`).join("")}</div>${paired ? "" : '<p class="fine" data-unpaired-observations>Twice-spacing comparison requires an even count of at least six increments. This record remains complete; no trailing observations have been discarded. Variance and neighboring covariance use every increment.</p>'}</fieldset><p role="alert" data-infer-error hidden></p><p role="status" aria-live="polite" aria-atomic="true" data-infer-status>Variance alone leaves diffusion and noise unresolved.</p></div>
<div class="lab-results" data-infer-results>${renderCameraResults(camera)}</div></div>
<details><summary>What did adding information change?</summary><p>Variance mixes physical spreading, exposure averaging and localization error. Neighboring increments share a localization error with opposite signs, so their covariance contributes a different relation. Alternatively, pair adjacent increments from the same recording to inspect twice the frame spacing, with the exposure duration unchanged.</p><p>The second-spacing observations are derived from the same positions, not statistically independent new trials. The two finite-sample moment solutions can differ. Neither solution here carries a confidence interval. These are later camera models, not Einstein's derivation.</p><p>In the zero-exposure case, ignoring unknown localization error biases a variance-only diffusion estimate upward. Uniform exposure can instead reduce the observed variance. That is why the exposure assumption stays visible and fixed.</p></details><details data-static-camera><summary>${pinned ? "Worked solution" : "Static worked solution"}: admit neighboring covariance</summary><p>For this same fixed recording, the covariance-based point estimates are D = ${inferenceValue(covarianceWorked, "diffusionEstimate", 1e12)} μm²/s and localization variance = ${inferenceValue(covarianceWorked, "noiseEstimate", 1e12)} μm². They are not confidence limits.</p></details>${evidenceDetails(evidence, pinned)}<p><a href="/lab/bm-08/">Return to the full camera laboratory and interval procedures</a></p></section>`;
}

/** The same owner, controls and readable tables for one explicitly pinned accepted record. */
export function renderInferenceCase(
  evidence: InferenceEvidence,
  uid: string,
  sourceDigest: string,
): string {
  validatePlacement(uid, sourceDigest);
  return `<div class="inference-workbench" data-infer-workbench data-ready="false" data-source-digest="${e(sourceDigest)}">${evidence.kind === "ideal" ? renderRadiusCase(evidence, uid, true) : renderCameraCase(evidence, uid, true)}</div>`;
}
export function renderInferenceWorkbench(example: InferenceExample, uid: string): string {
  validatePlacement(uid, example.sourceDigest);
  return `<div class="inference-workbench" data-infer-workbench data-ready="false" data-source-digest="${e(example.sourceDigest)}"><noscript><p class="notice">JavaScript is off. Both fixed-data families, the complete tables, and the optional worked solutions remain readable. Applying a new information choice requires JavaScript.</p></noscript>
${renderRadiusCase(example.ideal, uid)}
${renderCameraCase(example.camera, uid)}
<section class="reading" data-infer-companion><h2>A different kind of second measurement</h2><p>The second measurement, from the viscosity of dilute solutions, is in preparation.</p></section></div>`;
}
