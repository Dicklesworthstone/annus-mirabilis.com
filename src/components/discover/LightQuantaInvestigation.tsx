"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import {
  LIGHT_INVESTIGATION_FIELDS,
  lightInvestigationDraft,
  parseLightInvestigationDraft,
} from "../../discovery/lightQuanta/controls.ts";
import {
  changedInvestigationInputs,
  createLightInvestigationSession,
  type InvestigationPerturbation,
  LIGHT_INVESTIGATION_OUTPUTS,
  type LightInvestigationParameters,
  type PreparedLightInvestigation,
  perturbInvestigation,
} from "../../discovery/lightQuanta/investigation.ts";
import { decodeLightInvestigationSettings } from "../../discovery/lightQuanta/transfer.ts";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import { ExperimentRuntimeError } from "../../experiments/refusal.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { display, identity, result } from "../lab/presentation.ts";
import { InvestigationTransfer } from "./InvestigationTransfer.tsx";

// A pure number carries no unit: the table printed "0.125 1" and "22778000000 1".
const COMPARISON_ROWS = [
  ["radiationEnergy", "Radiation energy held fixed during a volume comparison", 1e9, "nJ"],
  ["radiationEntropy", "Radiation entropy change", 1, "J/K"],
  ["entropyVolumeCoefficient", "Coefficient of the volume logarithm", 1, "J/K"],
  ["effectiveIndependentCount", "Effective count (not rounded to an integer)", 1, ""],
  ["independentProbability", "Probability: independent points", 1, ""],
  ["lockedProbability", "Probability: perfectly locked points", 1, ""],
  ["quantumEnergyEv", "Energy scale suggested by matching", 1, "eV"],
  ["maxKineticEnergy", "Maximum emitted-electron kinetic energy", 1, "J"],
  ["stoppingPotentialMagnitude", "Stopping potential magnitude", 1, "V"],
  ["quantumRate", "Incident quantum rate under the assumed model", 1, "s⁻¹"],
  ["emissionRate", "Emission rate at the declared efficiency", 1, "s⁻¹"],
  ["photocurrent", "Collected current", 1e6, "μA"],
] as const;
const PERTURBATIONS: readonly [InvestigationPerturbation, string][] = [
  ["halve-volume", "Halve the accepted volume fraction"],
  ["double-power", "Double the accepted optical power"],
  ["raise-frequency", "Raise the accepted frequency by 10%"],
  ["raise-exit-cost", "Raise the accepted exit cost by 0.5 eV"],
];

function Output({
  snapshot,
  quantity,
  factor = 1,
  unit = "",
}: {
  snapshot: AcceptedSnapshot;
  quantity: string;
  factor?: number;
  unit?: string;
}) {
  const r = result(snapshot, quantity);
  const number = r.status === "value" && typeof r.value === "number" ? r.value : null;
  const text =
    number !== null
      ? `${display(number, factor)}${unit ? ` ${unit}` : ""}`
      : r.status === "outside-domain"
        ? `Outside this model: ${r.reason}`
        : r.status === "not-applicable"
          ? `Not applicable: ${r.reason}`
          : r.status === "underdetermined"
            ? `Not determined: ${r.neededInformation.join(", ")}`
            : "This output has no scalar value for these settings.";
  return (
    <span
      data-quantity-id={quantity}
      data-result-status={r.status}
      data-value={number ?? undefined}
      data-owner-id={r.ownerId}
    >
      {text}
    </span>
  );
}

/** A single snapshot feeds all three model families. Predictions, interpretation choices,
 * disclosures and baseline pinning are presentation actions, never solver inputs.
 * Formula nodes are rendered by the server, so KaTeX is not added to this client bundle.
 */
export function LightQuantaInvestigation({
  example,
  equations,
  anchorPrefix,
}: {
  example: PreparedLightInvestigation;
  anchorPrefix?: string;
  equations: Readonly<Record<"entropy" | "counting" | "match" | "emission", ReactNode>>;
}) {
  const id = useId();
  const anchor = (name: string) => `${anchorPrefix ?? `${id}-stage`}-${name}`;
  const [session] = useState(() =>
    createLightInvestigationSession(`light-investigation-${id}`, example),
  );
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const snapshot = view.accepted;
  if (!snapshot)
    throw new ExperimentRuntimeError(
      "missing-accepted-snapshot",
      "The light investigation needs a worked example.",
    );
  const p = snapshot.parameters as LightInvestigationParameters;
  const [baseline, setBaseline] = useState(snapshot);
  const [draft, setDraft] = useState(() => lightInvestigationDraft(example.parameters));
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [prediction, setPrediction] = useState("");
  const [interpretation, setInterpretation] = useState("uncommitted");
  const execution = deriveHostExecution(
    view,
    LIGHT_INVESTIGATION_OUTPUTS,
    example.sourceDigest,
    snapshot === session.getServerSnapshot().accepted,
  );
  const changes = changedInvestigationInputs(baseline, snapshot);
  const entropy = result(snapshot, "radiationEntropy");

  useEffect(() => {
    setReady(true);
    const linked = decodeLightInvestigationSettings(window.location.search);
    if (linked.kind === "settings") {
      setDraft(lightInvestigationDraft(linked.parameters));
      setDirty(true);
      setAnnouncement(
        linked.sourceDigest === example.sourceDigest
          ? "Shared settings are in the form. Choose Apply investigation settings; the worked example is still displayed."
          : "This link names a different source revision. Its settings are in the form; applying them uses this build, not a claimed replay of the older results.",
      );
    } else if (linked.kind === "invalid") setError(linked.message);
  }, [example.sourceDigest]);

  function apply(parameters: LightInvestigationParameters, compareWith?: AcceptedSnapshot) {
    const outcome = session.apply(parameters);
    if (outcome.kind !== "accepted") {
      setError(outcome.message);
      return;
    }
    if (compareWith) setBaseline(compareWith);
    setDraft(lightInvestigationDraft(parameters));
    setDirty(false);
    setError("");
    setAnnouncement(
      "Accepted a new calculation. All stages and the comparison table now use the same settings.",
    );
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      apply(parseLightInvestigationDraft(draft));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check the entered settings.");
    }
  }
  function perturb(action: InvestigationPerturbation) {
    try {
      apply(perturbInvestigation(p, action), snapshot ?? undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "This change exceeds the supported range.");
    }
  }

  return (
    <section
      className="light-investigation"
      aria-label="Connected light-quanta investigation"
      data-light-investigation=""
      data-ready={String(ready)}
      data-dirty={String(dirty)}
      data-execution-label={execution.label}
      data-source-digest={example.sourceDigest}
      {...identity(snapshot)}
    >
      <p className="notice">
        <strong>{execution.text}.</strong> Modern SI constants are used throughout these numerical
        examples. They are declared model calculations, not measurements available in 1904. None of
        these numbers comes from the FrankenSim engine.
      </p>
      <noscript>
        <p className="notice">
          JavaScript is off. The complete worked calculation, explanations, model limits and
          baseline table remain readable. Changing settings requires JavaScript.
        </p>
      </noscript>

      <section aria-labelledby={`${id}-settings`}>
        <h2 id={`${id}-settings`}>One frequency, three linked questions</h2>
        <p>
          The cavity comparison, toy counting problem and emission bench are different model
          systems. They share a frequency and volume fraction where relevant, not an experimental
          apparatus. Optical power is not the cavity’s stored energy. The efficiency and exit cost
          describe a hypothetical surface, not a measured material.
        </p>
        <form
          onSubmit={submit}
          aria-label="Light investigation settings"
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <fieldset disabled={!ready}>
            <legend>Set up the investigation</legend>
            {(["radiation", "counting", "emission"] as const).map((group) => (
              <div key={group} className="light-input-group">
                <h3>
                  {group === "radiation"
                    ? "Radiation and its constrained volume change"
                    : group === "counting"
                      ? "A separate counting model"
                      : "An explicitly assumed emission model"}
                </h3>
                <div className="light-input-grid">
                  {LIGHT_INVESTIGATION_FIELDS.filter((f) => f.group === group).map((f) => (
                    <div key={f.key} className="light-input-field">
                      {/* am-qt1j: the text input is a SIBLING of its label, paired by
                          htmlFor/id. Nested inside the label the reader's own typed value
                          joins the control's accessible name. */}
                      <label htmlFor={`${id}-${f.key}`}>
                        {f.label}
                        {f.unit === "1" ? "" : ` (${f.unit})`}
                      </label>
                      <input
                        id={`${id}-${f.key}`}
                        name={f.key}
                        type="text"
                        inputMode="decimal"
                        value={draft[f.key]}
                        onChange={(e) => {
                          setDraft({ ...draft, [f.key]: e.target.value });
                          setDirty(true);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="actions">
              <button type="submit" disabled={!dirty}>
                Apply investigation settings
              </button>
              <button type="button" className="secondary" onClick={() => apply(example.parameters)}>
                Restore worked settings
              </button>
              <button
                type="button"
                className="secondary"
                disabled={dirty}
                onClick={() => {
                  setBaseline(snapshot);
                  setAnnouncement(
                    "Pinned the completed result as the baseline without recalculating.",
                  );
                }}
              >
                Pin current result as baseline
              </button>
            </div>
          </fieldset>
        </form>
        {dirty && (
          <p className="notice">
            Unapplied edits are in the form. The numbers below still describe the accepted settings.
          </p>
        )}
        {error && (
          <p id={`${id}-error`} className="form-error" role="alert">
            {error} The accepted result is unchanged.
          </p>
        )}
        <p role="status" aria-live="polite" aria-atomic="true" className="fine">
          {announcement}
        </p>
        <details>
          <summary>Inspect every accepted setting</summary>
          <dl className="light-settings">
            {LIGHT_INVESTIGATION_FIELDS.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>
                  {lightInvestigationDraft(p)[f.key]}
                  {f.unit === "1" ? "" : ` ${f.unit}`}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      <section id={anchor("entropy")} aria-labelledby={`${id}-entropy`}>
        <p className="eyebrow">Step 1 · A thermodynamic calculation</p>
        <h2 id={`${id}-entropy`}>Keep the energy. Change the room.</h2>
        <p>
          Compare two narrow-band radiation states with the same energy, frequency and band width.
          The reference temperature fixes the initial state; it is not held fixed during this volume
          comparison. This is not a simulation of pushing a piston or preparing those states.
        </p>
        {equations.entropy}
        <p className="spoken-math">
          The entropy change equals a coefficient multiplied by the logarithm of the final volume
          divided by the initial volume.
        </p>
        <dl className="light-readouts">
          <div>
            <dt>Fixed radiation energy</dt>
            <dd>
              <Output snapshot={snapshot} quantity="radiationEnergy" factor={1e9} unit="nJ" />
            </dd>
          </div>
          <div>
            <dt>Entropy change</dt>
            <dd>
              <Output snapshot={snapshot} quantity="radiationEntropy" unit="J/K" />
            </dd>
          </div>
          <div>
            <dt>Initial implied temperature</dt>
            <dd>
              <Output snapshot={snapshot} quantity="initialTemperature" unit="K" />
            </dd>
          </div>
          <div>
            <dt>Final implied temperature</dt>
            <dd>
              <Output snapshot={snapshot} quantity="finalTemperature" unit="K" />
            </dd>
          </div>
        </dl>
        {entropy.status === "outside-domain" && (
          <p className="notice" data-inference-blocked>
            The entropy inference is withheld for this requested state. No earlier, valid
            coefficient has been carried forward. Restore the worked settings, or see where the
            calculation holds in <a href="/lab/lq-04/">the spectrum-entropy instrument</a>.
          </p>
        )}
        <details>
          <summary>Why the regime and integration constant are part of the argument</summary>
          <p>
            Invert Wien’s law to express reciprocal temperature in terms of spectral density, then
            integrate the entropy derivative with frequency fixed. An arbitrary integration constant
            would leave an additional volume-dependent term. The zero-radiation entropy boundary
            condition removes that ambiguity; simply forgetting the constant does not.
          </p>
          <p>
            Both endpoint states must be dilute and the band must be narrow. This calculation uses
            the spectrum-entropy instrument’s limits: Wien’s law within one per cent, and a band no
            wider than one per cent of its frequency. Compress far enough and the inference becomes
            unavailable rather than a false number.
          </p>
          <a href="/foundations/entropy-temperature/">Entropy and temperature</a>
          {" · "}
          <a href="/foundations/integration/">Integration and its constant</a>
          {" · "}
          <a href="/lab/lq-04/">Inspect the entropy workbench and its unfixed-constant variant</a>
        </details>
      </section>

      <section id={anchor("counting")} aria-labelledby={`${id}-counting`}>
        <p className="eyebrow">Step 2 · A simpler problem with an explicit premise</p>
        <h2 id={`${id}-counting`}>What does independence change?</h2>
        <p>
          Place {p.pointCount} points independently in the larger volume. Ask for the probability
          that all of them lie in the fraction {display(p.volumeRatio)}. Then remove independence:
          perfectly locked positions move as one uniformly placed unit. These are toy configuration
          models, not pictures of photons.
        </p>
        {equations.counting}
        <p className="spoken-math">
          Independent placements multiply their probabilities. Perfectly locked placements have only
          one placement probability, regardless of how many points move together.
        </p>
        <dl className="light-readouts">
          <div>
            <dt>Independent probability</dt>
            <dd>
              <Output snapshot={snapshot} quantity="independentProbability" />
            </dd>
          </div>
          <div>
            <dt>Perfectly locked probability</dt>
            <dd>
              <Output snapshot={snapshot} quantity="lockedProbability" />
            </dd>
          </div>
          <div>
            <dt>Logarithm of independent probability</dt>
            <dd>
              <Output snapshot={snapshot} quantity="logIndependentProbability" />
            </dd>
          </div>
        </dl>
        <details>
          <summary>Start without algebra, then try sixty points</summary>
          <p>
            In half a space, a single uniformly placed object has one chance in two of being inside.
            With three independent placements, exactly one of the eight equally likely
            inside/outside assignments has all three inside. Lock all three placements together and
            only the two collective assignments remain. This counterexample identifies the
            independence premise.
          </p>
          <p>
            The logarithmic calculation stays finite for sixty points without enumerating an
            enormous list of configurations. Neither the point count nor this toy probability is
            inferred from light measurements.
          </p>
          <a href="/foundations/probability-independence/">Probability and independence</a>
          {" · "}
          <a href="/foundations/logarithms/">Why logarithms turn products into sums</a>
          {" · "}
          <a href="/lab/lq-05/">Count and sample configurations in the gas-analogy instrument</a>
        </details>
      </section>

      <section id={anchor("move")} aria-labelledby={`${id}-move`}>
        <p className="eyebrow">Step 3 · The move is a heuristic inference</p>
        <h2 id={`${id}-move`}>Match the coefficient, not the picture.</h2>
        <p>
          The two entropy laws share a volume logarithm. Match its coefficients, including the
          thermal factor R/N. E/(βν) has units of entropy; the dimensionless effective count is
          NE/(Rβν). It is not the small integer entered for the separate counting example.
        </p>
        {equations.match}
        <p className="spoken-math">
          The radiation coefficient suggests an effective number of independent things and an energy
          per thing proportional to frequency. Matching this form does not prove what light is made
          of.
        </p>
        <dl className="light-readouts">
          <div>
            <dt>Entropy coefficient</dt>
            <dd>
              <Output snapshot={snapshot} quantity="entropyVolumeCoefficient" unit="J/K" />
            </dd>
          </div>
          <div>
            <dt>Effective count, never forced to an integer</dt>
            <dd>
              <Output snapshot={snapshot} quantity="effectiveIndependentCount" />
            </dd>
          </div>
          <div>
            <dt>Suggested energy per thing</dt>
            <dd>
              <Output snapshot={snapshot} quantity="quantumEnergyEv" unit="eV" />
            </dd>
          </div>
        </dl>
        <fieldset disabled={!ready} className="light-fork">
          <legend>
            Which claim are you willing to make? This choice does not change any numbers.
          </legend>
          {[
            [
              "uncommitted",
              "Keep the thermodynamic correspondence without choosing a microscopic account.",
            ],
            [
              "quanta",
              "Investigate independent radiation quanta as a further physical hypothesis.",
            ],
          ].map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name={`${id}-interpretation`}
                value={value}
                checked={interpretation === value}
                onChange={() => setInterpretation(value ?? "uncommitted")}
              />{" "}
              {label}
            </label>
          ))}
        </fieldset>
        <p data-interpretation-feedback>
          {interpretation === "quanta"
            ? "You have adopted an additional interpretation to investigate, not changed an algebraic result or disproved the wave description. The next model adds a transfer assumption."
            : "The shared entropy dependence survives without a unique microscopic interpretation. A simulator programmed with quanta cannot settle that choice by reproducing its own assumptions."}
        </p>
        <details>
          <summary>Why this does not derive a full theory of light</summary>
          <p>
            The correspondence is restricted to the admitted Wien regime. It neither derives
            Planck’s full spectrum nor removes the successes of wave propagation and interference.
            Modern numerical constants construct these illustrative states; they are not independent
            historical measurements from which a new physical constant has been discovered.
          </p>
          <a href="/lab/lq-06/">Set the two entropy laws side by side</a>
          {" · "}
          <a href="/papers/light-quanta/#arg-lq-entropy-correspondence">
            Read the argument and its qualifications
          </a>
        </details>
      </section>

      <section id={anchor("prediction")} aria-labelledby={`${id}-prediction`}>
        <p className="eyebrow">Step 4 · Add a physical hypothesis, then demand consequences</p>
        <h2 id={`${id}-prediction`}>More light: more electrons, or more energy per electron?</h2>
        <p>
          This branch explicitly assumes complete single-quantum transfer to one electron, an exit
          cost, and the declared emission efficiency. It does not follow from coefficient matching
          alone. Its results remain conditional calculations even when the entropy model above is
          outside its domain.
        </p>
        {equations.emission}
        <p className="spoken-math">
          The maximum electron kinetic energy is the quantum energy minus the exit cost. Below
          threshold there is no emitted electron in this model, so its kinetic energy and stopping
          potential are not applicable, rather than negative or zero values.
        </p>
        <label htmlFor={`${id}-prediction-note`}>
          Optional prediction: what will change, and why?
        </label>
        <textarea
          id={`${id}-prediction-note`}
          rows={3}
          maxLength={2000}
          value={prediction}
          disabled={!ready}
          onChange={(e) => setPrediction(e.target.value)}
        />
        <p className="fine">
          Your note stays on this page and does not control any calculation. No answer is required.
        </p>
        <div className="actions">
          {PERTURBATIONS.map(([action, label]) => (
            <button
              key={action}
              type="button"
              disabled={!ready || dirty}
              onClick={() => perturb(action)}
            >
              {label}
            </button>
          ))}
        </div>
        <p>
          Each button pins the currently accepted result, changes only the named input, and
          calculates a new comparison. Raising frequency also creates a new cavity reference state
          at the chosen reference temperature; only a volume change keeps that cavity energy fixed.
          Power means intensity at a fixed illuminated area.
        </p>
        <details>
          <summary>Read the explanations without making a prediction</summary>
          <p>
            Doubling optical power at fixed frequency and surface assumptions doubles the arrival
            and emission rates, not the maximum kinetic energy. Raising frequency at fixed power
            raises the energy per quantum but lowers the incident quantum rate. Raising the exit
            cost lowers the energy left to an escaping electron and may stop emission altogether.
          </p>
          <p>
            A positive predicted current also depends on the declared yield and collection model. At
            a retarding potential between zero and the stopping point, the current cannot be fixed
            without a distribution of electron energies, so the model gives it as a range, from zero
            to the saturation current, and not as one number.
          </p>
          <p>
            Partial transfer would instead leave an upper bound on electron energy. Real surface
            states, contact potentials, space charge, thermionic emission and multiphoton processes
            are not modeled.
          </p>
          <a href="/lab/lq-08/">Open the photoelectric bench and its model limits</a>
        </details>
      </section>

      <InvestigationTransfer
        baseline={baseline}
        current={snapshot}
        sourceDigest={example.sourceDigest}
      />

      <section aria-labelledby={`${id}-comparison`}>
        <h2 id={`${id}-comparison`}>Pinned baseline and current accepted result</h2>
        <p data-changed-settings>
          {changes.length
            ? `Changed settings: ${changes.map((key) => LIGHT_INVESTIGATION_FIELDS.find((f) => f.key === key)?.label ?? key).join(", ")}.`
            : "No settings differ from the pinned baseline."}
        </p>
        {/*
          A SCROLLING REGION MUST BE REACHABLE, so the tabIndex stays and the element changes.
          a11y/useSemanticElements flagged `role="region"` on a div, correctly: a <section> with
          an accessible name already IS a region, so the role was a hand-written copy of what the
          element gives for free. Swapping the element drops the role rather than the reachability.

          The tabIndex is a different question and its FIXABLE fix is wrong here: deleting it
          leaves the off-screen columns of this table unreachable by keyboard, which is WCAG 2.1.1
          and axe scrollable-region-focusable, and the scrollable-regions ratchet (am-bc6s) refuses
          it. Suppressed inline at the site, with the reason, following SplitTabs.tsx and
          TaylorBinomialExtension.tsx rather than as a per-file override that turns the rule off
          for everything below it.
        */}
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls must be focusable or its off-screen columns are unreachable by keyboard (WCAG 2.1.1, am-bc6s). */}
        <section className="light-table-scroll" tabIndex={0} aria-label="Complete comparison table">
          <table className="data-table">
            <caption>
              One completed calculation per column; missing values retain their scientific meaning.
            </caption>
            <thead>
              <tr>
                <th scope="col">Quantity</th>
                <th scope="col">Pinned baseline</th>
                <th scope="col">Current result</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map(([quantity, label, factor, unit]) => (
                <tr key={quantity} data-comparison-quantity={quantity}>
                  <th scope="row">{label}</th>
                  <td>
                    <Output snapshot={baseline} quantity={quantity} factor={factor} unit={unit} />
                  </td>
                  <td>
                    <Output snapshot={snapshot} quantity={quantity} factor={factor} unit={unit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <p className="fine">
          Baseline snapshot {baseline.snapshotVersion}; current snapshot {snapshot.snapshotVersion}.
        </p>
        <details>
          <summary>Inspect calculation ownership and reproducibility</summary>
          <p>
            Model: {example.modelId}. Constant set: {example.constantSetId}.
          </p>
          <p className="light-digest">Source digest: {example.sourceDigest}</p>
          <p>
            The physics comes from the site&rsquo;s reference calculations, listed below; this
            investigation puts their accepted results together. Knowing where a number was computed
            is not evidence that the theory is right.
          </p>
          <ul>
            {execution.owners.map((owner) => (
              <li key={owner}>
                <code>{owner}</code>
              </li>
            ))}
          </ul>
        </details>
      </section>
    </section>
  );
}
