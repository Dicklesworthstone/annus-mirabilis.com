"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  AVOGADRO_CAPTION,
  AVOGADRO_DEFAULTS,
  AVOGADRO_FIELDS,
  type AvogadroKey,
  type AvogadroParameters,
  decodeAvogadroParameters,
  encodeAvogadroParameters,
  parseAvogadroDraft,
} from "../../../experiments/avogadro/definition.ts";
import { createAvogadroSession } from "../../../experiments/avogadro/session.ts";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import { ExperimentRuntimeError } from "../../../experiments/refusal.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import type { AcceptedSnapshot } from "../../../experiments/store/instanceStore.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { display, identity, result, unitText } from "../presentation.ts";
import { withScripts } from "../subscripts.tsx";
import styles from "./AvogadroLab.module.css";

const draftOf = (p: AvogadroParameters) =>
  Object.fromEntries(Object.entries(p).map(([key, value]) => [key, String(value)])) as Record<
    AvogadroKey,
    string
  >;

function Reading({ snapshot, quantity }: { snapshot: AcceptedSnapshot; quantity: string }) {
  const r = result(snapshot, quantity);
  if (r.status === "value" && typeof r.value === "number")
    return (
      <span data-quantity-id={quantity}>
        {display(r.value)} {unitText(r.unit)}
        {r.uncertainty?.kind === "statistical-interval" && (
          <>
            <br />
            <small>
              Conditional {100 * r.uncertainty.coverage}% interval: {display(r.uncertainty.lower)}{" "}
              to {display(r.uncertainty.upper)} {unitText(r.unit)}
            </small>
          </>
        )}
      </span>
    );
  if (r.status === "underdetermined")
    return (
      <span data-quantity-id={quantity}>
        Not determined by this data. {r.compatibleFamily} {r.neededInformation.join(" ")}
      </span>
    );
  if (r.status === "outside-domain")
    return <span data-quantity-id={quantity}>Outside this model. {r.reason}</span>;
  throw new ExperimentRuntimeError(
    "unexpected-result-status",
    `Unexpected comparison result for ${quantity}: ${r.status}`,
    "avogadro",
  );
}

export function AvogadroLab({ sourceDigest = "" }: { sourceDigest?: string } = {}) {
  const id = useId();
  const [session] = useState(() => createAvogadroSession(`avogadro-${id}`));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const [draft, setDraft] = useState(() => draftOf(AVOGADRO_DEFAULTS));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const snapshot = view.accepted;
  if (!snapshot)
    throw new ExperimentRuntimeError(
      "no-accepted-snapshot",
      "The comparison requires an accepted worked example.",
      "avogadro",
    );
  const accepted = snapshot.parameters as AvogadroParameters;

  useEffect(() => {
    function restore() {
      const decoded = decodeAvogadroParameters(window.location.search);
      if (decoded.kind !== "accepted") {
        setError(`${decoded.reason} The last accepted example remains displayed.`);
        return;
      }
      const outcome = session.apply(decoded.parameters);
      if (outcome.kind !== "accepted") {
        setError(outcome.reason);
        return;
      }
      setDraft(draftOf(outcome.parameters));
      setError("");
    }
    restore();
    setReady(true);
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [session]);

  function apply(p: AvogadroParameters) {
    const outcome = session.apply(p);
    if (outcome.kind !== "accepted") {
      setError(`${outcome.reason} The accepted readings have not changed.`);
      return;
    }
    setDraft(draftOf(outcome.parameters));
    setError("");
    setAnnouncement(
      "All three methods now show the same accepted revision. These illustrative calculations are not new measurements.",
    );
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseAvogadroDraft(draft);
    if (parsed.kind !== "accepted") {
      setError(`${parsed.reason} The accepted readings have not changed.`);
      return;
    }
    apply(parsed.parameters);
  }
  function control(key: AvogadroKey) {
    const field = AVOGADRO_FIELDS[key];
    const choices =
      key === "coefficient"
        ? [
            ["1", "Original: 1"],
            ["2.5", "Corrected: 2.5"],
          ]
        : key === "radiusKnown" || key === "independentModel"
          ? [
              ["1", "Yes"],
              ["0", "No"],
            ]
          : null;
    return (
      <div className="input-field" key={key}>
        <label htmlFor={`${id}-${key}`}>{field.label}</label>
        {choices ? (
          <select
            id={`${id}-${key}`}
            name={key}
            value={draft[key]}
            onChange={(e) => setDraft((old) => ({ ...old, [key]: e.target.value }))}
          >
            {choices.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={`${id}-${key}`}
            name={key}
            type="number"
            step={key === "coordinateCount" ? "1" : "any"}
            min={field.min}
            max={field.max}
            required
            value={draft[key]}
            onChange={(e) => setDraft((old) => ({ ...old, [key]: e.target.value }))}
          />
        )}
      </div>
    );
  }

  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation; without the page's source digest no label
  // is earned. The bead's per-panel labels are separate work.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      session.outputContracts,
      sourceDigest,
      snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
  return (
    <section
      className="laboratory"
      data-instrument-id="avogadro-lab"
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "radiationNumber")}
      aria-labelledby={`${id}-title`}
      {...identity(snapshot)}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">Three methods · One comparison</p>
          <h2 id={`${id}-title`}>What information fixes the molecular number?</h2>
        </div>
        <span className="badge">Companion preview</span>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome state={executionKind} view={view} />
      </div>
      <noscript>
        <p className="notice">
          The default worked example and its results are readable without JavaScript. Editing or
          restoring a bookmark requires JavaScript.
        </p>
      </noscript>
      <div className="lab-columns">
        <form onSubmit={submit} noValidate aria-label="Three-method comparison settings">
          <fieldset disabled={!ready} className={styles.controls}>
            <legend className="visually-hidden">Inputs, not fitted answers</legend>
            <details className="lab-predict">
              <summary>Predict first</summary>
              <p>
                Can displacement alone distinguish a large particle from a large molecular number?
                With the same viscosity and diffusion observations, will correcting the viscosity
                coefficient increase or decrease the inferred radius?
              </p>
            </details>
            <fieldset>
              <legend>Shared solvent conditions for the two diffusion routes</legend>
              <div className="input-grid">
                {control("temperature")}
                {control("viscosityMpaS")}
              </div>
            </fieldset>
            <div className="actions">
              <button className="button" type="submit">
                Compare these inputs
              </button>
              <button className="button" type="button" onClick={() => apply(AVOGADRO_DEFAULTS)}>
                Reset worked example
              </button>
            </div>
            <ExperimentSettings contents="each route's own inputs: radiation α, the Brownian displacement record, viscosity and solute diffusion">
              <div className={styles.panels}>
                <fieldset>
                  <legend>1. Radiation: vary α</legend>
                  {control("alphaScale")}
                  <p>
                    One means the existing owner's corrected reference α = 6.1 × 10⁻⁵⁷ in its
                    historical CGS convention. β, R and the speed of light remain fixed.
                    Perturbations are sensitivity tests, not measured historical constants.
                  </p>
                </fieldset>
                <fieldset>
                  <legend>2. Brownian displacement</legend>
                  {(
                    [
                      "meanSquareUm2",
                      "observationSeconds",
                      "coordinateCount",
                      "radiusUm",
                      "radiusKnown",
                      "independentModel",
                    ] as const
                  ).map(control)}
                  <p>
                    The interval requires independent Gaussian coordinate increments, known zero
                    drift, exact timing and calibration, and no localization noise, exposure blur,
                    overlap or censoring. Selecting “No” refuses this model rather than narrowing an
                    unjustified interval.
                  </p>
                </fieldset>
                <fieldset>
                  <legend>3. Viscosity plus solute diffusion</legend>
                  {(
                    [
                      "soluteDiffusionUm2S",
                      "molarConcentration",
                      "specificViscosity",
                      "coefficient",
                    ] as const
                  ).map(control)}
                  <p>
                    The tracer radius in panel 2 is not the solute radius in this panel. Both use
                    the declared solvent conditions. No particle radius or target molecular number
                    is supplied to this joint inversion.
                  </p>
                </fieldset>
              </div>
            </ExperimentSettings>
          </fieldset>
          {error && (
            <p className="notice" role="alert">
              {withScripts(error)}
            </p>
          )}
        </form>
        <div className="lab-results">
          <section
            className={styles.tableWrap}
            aria-label="Molecular-number comparison"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard access to a horizontally scrollable comparison
            tabIndex={0}
          >
            <table>
              <caption>One accepted revision: molecular number per mole</caption>
              <thead>
                <tr>
                  <th scope="col">Method</th>
                  <th scope="col">Result</th>
                  <th scope="col">What this means</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    Radiation constants
                    <small className={styles.route}>Light paper §2 · 1905</small>
                  </th>
                  <td>
                    <Reading snapshot={snapshot} quantity="radiationNumber" />
                  </td>
                  <td>
                    <strong>Independent estimate.</strong> Planck's 1901 constants with the 1905 gas
                    constant, which was measured without counting molecules; α scaled by{" "}
                    {display(accepted.alphaScale)}. No confidence interval is asserted.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    Brownian displacement
                    <small className={styles.route}>
                      Brownian paper §5 · the 1905 prediction, applied to illustrative data
                    </small>
                  </th>
                  <td>
                    <Reading snapshot={snapshot} quantity="brownianNumber" />
                  </td>
                  <td>
                    <strong>Consistency check.</strong> With the 2019 SI the gas constant is N
                    <sub>A</sub>k<sub>B</sub> by definition, so this compares the displacements with
                    the defined value. Conditional on an independent radius and the admitted
                    observation model.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    Viscosity and solute diffusion
                    <small className={styles.route}>
                      Dissertation · 1905, coefficient corrected 1911
                    </small>
                  </th>
                  <td>
                    <Reading snapshot={snapshot} quantity="molecularNumber" />
                  </td>
                  <td>
                    <strong>Consistency check</strong> on illustrative inputs with the 2019 SI gas
                    constant: a dilute-sphere inversion with coefficient {accepted.coefficient}. Not
                    a historical dataset or uncertainty interval.
                  </td>
                </tr>
                <tr>
                  <th scope="row">Modern reference</th>
                  <td>
                    <Reading snapshot={snapshot} quantity="definedNumber" />
                  </td>
                  <td>Defined exactly in the 2019 SI, not measured: 6.02214076 × 10²³ mol⁻¹.</td>
                </tr>
              </tbody>
            </table>
          </section>
          <p role="status" aria-live="polite">
            {announcement}
          </p>
          <p>
            These rows are not combined into one number. Combining them honestly would need two
            things this page does not have: the covariance between the routes, which all depend on
            the gas constant, and the two diffusion routes also on Stokes drag and the dilute-sphere
            model; and an allowance for model discrepancy, how far each idealized model departs from
            the real radiation, suspension or solution. The modern gas constant is defined using N
            <sub>A</sub> and k<sub>B</sub>; agreement in the illustrative diffusion rows is not
            independent evidence for either constant.
          </p>
        </div>
      </div>
      {/* What these rows are sits directly under them; above the instrument it came between a phone's heading and the result. */}
      <p>
        The radiation row reconstructs a historical calculation. The other rows use authored
        illustrative inputs and modern SI constants, so they are consistency checks, not independent
        counts or historical measurements. No Bancelin dataset is claimed here.
      </p>
      <section>
        <h3>What diffusion cannot identify by itself</h3>
        <p>
          Accepted mean-square displacement: {display(accepted.meanSquareUm2)} µm² over{" "}
          {display(accepted.observationSeconds)} s; {accepted.coordinateCount} independent
          coordinate increments. The Brownian owner determines the product aN:{" "}
          <Reading snapshot={snapshot} quantity="brownianRadiusProduct" />.
        </p>
        <p>
          Remove the independent radius above to reveal the family instead of a spurious unique
          answer. Radius, viscosity, temperature and calibration uncertainty are held exact in the
          displayed conditional interval. The detailed inference lab supports additional measurement
          models.
        </p>
        <p>
          <a href="/papers/brownian-motion/#s5">Read Brownian motion §5</a> ·{" "}
          <a href="/lab/bm-07/">Open the full inference laboratory</a>
        </p>
      </section>
      <section>
        <h3>What the viscosity correction changes</h3>
        <p>
          Jointly inferred solute radius: <Reading snapshot={snapshot} quantity="molecularRadius" />
          . Inferred volume fraction:{" "}
          <Reading snapshot={snapshot} quantity="soluteVolumeFraction" />.
        </p>
        <p>
          At fixed observations, switching the coefficient from 1 to 2.5 divides the radius by √2.5
          and multiplies N by √2.5. This is not a reproduction of the entire historical revision,
          which also involves the choice of data. The dilute-sphere model is refused above the
          explicitly chosen 5% volume-fraction ceiling; that ceiling is not an accuracy guarantee.
        </p>
        <p>
          Setting both concentration and viscosity increment to zero removes the extra information:
          the solute diffusion then determines only aN, not a unique radius and number.
        </p>
      </section>
      <p>
        <a href={`/lab/avogadro-lab/?${encodeAvogadroParameters(accepted)}`}>
          Bookmark these accepted settings
        </a>{" "}
        · <a href="/lab/lq-02/">Inspect the historical radiation calculation</a> ·{" "}
        <a href="/papers/light-quanta/#s2">Read light quanta §2</a>
      </p>
      <p className="fine">
        Not modeled: solvation, molecular shape, concentrated-solution interactions, measurement
        error and historical data fitting.
      </p>
      <details>
        <summary>Assumptions, provenance and the code behind the numbers</summary>
        <p>
          These are host reference calculations, not FrankenSim/WASM execution. Hydrodynamic
          spheres, dilute solutions, the Stokes drag law and uniform solvent conditions are
          idealizations. Shared controls do not make the two sets of illustrative observations a
          single experiment.
        </p>
        <p>
          Every number shown comes from the settings this laboratory last accepted, and an invalid
          entry leaves those numbers as they were.
        </p>
        <p>
          <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/physics/reference/radiation/avogadro.ts">
            The molecular number from Planck's radiation constants
          </a>{" "}
          ·{" "}
          <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/physics/reference/inference.ts">
            The molecular number from Brownian displacements
          </a>{" "}
          ·{" "}
          <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/physics/reference/molecularDimensions.ts">
            Molecular size and number from viscosity and diffusion
          </a>{" "}
          ·{" "}
          <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/experiments/avogadro/session.ts">
            How the page gathers these results
          </a>
        </p>
      </details>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(AVOGADRO_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(AVOGADRO_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(AVOGADRO_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(AVOGADRO_CAPTION.r3)}
      </p>
    </section>
  );
}
