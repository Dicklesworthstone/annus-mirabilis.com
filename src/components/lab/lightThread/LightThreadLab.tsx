"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createLightThreadSession } from "../../../experiments/lightThread/session.ts";
import type { AcceptedSnapshot } from "../../../experiments/store/instanceStore.ts";
import {
  decodeLightThreadParameters,
  encodeLightThreadParameters,
  LIGHT_THREAD_BOUNDS,
  LIGHT_THREAD_DEFAULTS,
  LIGHT_THREAD_QUANTITIES,
  type LightThreadParameters,
  type LightThreadQuantityId,
} from "../../../experiments/lightThread/definition.ts";
import { display, identity, result } from "../presentation.ts";
import styles from "./LightThreadLab.module.css";

const fields: Readonly<Record<keyof LightThreadParameters, string>> = Object.freeze({
  frequencyHz: "Source-frame frequency ν (Hz)",
  pulseEnergyJ: "Energy E of one pulse in the source frame (J)",
  beta: "Observer speed β = v/c along +x",
  angleDeg: "Pulse direction relative to +x in the source frame (degrees)",
});

function draftOf(p: LightThreadParameters): Record<keyof LightThreadParameters, string> {
  return { frequencyHz: String(p.frequencyHz), pulseEnergyJ: String(p.pulseEnergyJ), beta: String(p.beta), angleDeg: String(p.angleDeg) };
}

function Reading({ snapshot, id }: { snapshot: AcceptedSnapshot; id: LightThreadQuantityId }) {
  const item = result(snapshot, id);
  if (item.status !== "value" || typeof item.value !== "number") {
    throw new Error(`Light-thread snapshot has no scalar ${id}.`);
  }
  return <span data-quantity-id={id}>{display(item.value)}</span>;
}

function QuantityTable({ snapshot, ids, caption }: {
  snapshot: AcceptedSnapshot;
  ids: readonly LightThreadQuantityId[];
  caption: string;
}) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <caption>{caption}</caption>
        <thead><tr><th scope="col">Quantity</th><th scope="col">Value</th><th scope="col">Unit</th></tr></thead>
        <tbody>{ids.map((id) => (
          <tr key={id}>
            <th scope="row">{LIGHT_THREAD_QUANTITIES[id].label}</th>
            <td><Reading snapshot={snapshot} id={id} /></td>
            <td>{LIGHT_THREAD_QUANTITIES[id].unit}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function LightThreadLab() {
  const id = useId();
  const [session] = useState(() => createLightThreadSession(`light-thread-${id}`));
  const view = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getServerSnapshot);
  const [draft, setDraft] = useState(() => draftOf(LIGHT_THREAD_DEFAULTS));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const snapshot = view.accepted;
  if (!snapshot) throw new Error("The light thread requires an accepted snapshot.");
  const accepted = snapshot.parameters as LightThreadParameters;

  useEffect(() => {
    function restore() {
      const query = window.location.search;
      const state = query ? decodeLightThreadParameters(query) : { kind: "accepted" as const, parameters: LIGHT_THREAD_DEFAULTS };
      if (state.kind !== "accepted") {
        setError(`${state.reason} The last accepted worked example remains displayed.`);
        return;
      }
      const outcome = session.apply(state.parameters);
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

  function apply(parameters: LightThreadParameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind !== "accepted") {
      setError(outcome.reason);
      return;
    }
    setDraft(draftOf(outcome.parameters));
    setError("");
    setAnnouncement("All three paper comparisons now use the same accepted settings.");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = Object.fromEntries(Object.entries(draft).map(([key, value]) => [
      key, value.trim() === "" ? Number.NaN : Number(value),
    ])) as LightThreadParameters;
    apply(next);
  }

  return (
    <section className="laboratory" data-instrument-id="light-thread" data-execution-label="host" aria-labelledby={`${id}-title`} {...identity(snapshot)}>
      <header className="lab-heading">
        <div><p className="eyebrow">One pulse · Three distinct questions</p><h2 id={`${id}-title`}>Follow the energy without confusing the claims</h2></div>
        <span className="badge">Ideal model, host calculation</span>
      </header>
      <p>This is a modern comparison using the exact modern SI definitions of h and c, not a reconstruction of what was measured in 1905. A programmed consequence is not experimental confirmation.</p>
      <noscript><p className="notice">The default worked example and all its numbers are readable without JavaScript. Changing settings or restoring a bookmark requires JavaScript.</p></noscript>
      <details>
        <summary>Predict before changing the observer</summary>
        <p>Keep the source frequency and pulse energy fixed. Will a receding observer report less energy per quantum, fewer quanta, or both? Compare E/(hν) in the two frames after changing β. No answer is required to continue.</p>
      </details>
      <form className={styles.controls} onSubmit={submit} aria-label="Light-thread settings">
        <fieldset disabled={!ready}>
          <legend>Keep the pulse fixed, or change what was emitted</legend>
          <div className="input-grid">{(Object.keys(fields) as (keyof LightThreadParameters)[]).map((key) => (
            <div className="input-field" key={key}>
              <label htmlFor={`${id}-${key}`}>{fields[key]}</label>
              <input id={`${id}-${key}`} name={key} type="number" step="any" min={LIGHT_THREAD_BOUNDS[key].min} max={LIGHT_THREAD_BOUNDS[key].max} required value={draft[key]} onChange={(event) => setDraft((previous) => ({ ...previous, [key]: event.target.value }))} />
            </div>
          ))}</div>
          <div className="actions">
            <button type="submit" className="button">Apply settings</button>
            <button type="button" className="button" onClick={() => apply({ ...accepted, beta: 0 })}>Same pulse, source observer</button>
            <button type="button" className="button" onClick={() => apply(LIGHT_THREAD_DEFAULTS)}>Reset worked example</button>
          </div>
        </fieldset>
      </form>
      {error && <p className="notice" role="alert">{error}</p>}
      <p role="status" aria-live="polite">{announcement}</p>
      <p>Accepted settings: ν = {display(accepted.frequencyHz)} Hz; E = {display(accepted.pulseEnergyJ)} J per pulse; β = {display(accepted.beta)}; source-frame angle = {display(accepted.angleDeg)}°. Changing only β changes the observer, not the emitted pulse.</p>
      <p><a href={`/lab/light-thread?${encodeLightThreadParameters(accepted)}`}>Bookmark these accepted settings</a></p>

      <section aria-labelledby={`${id}-quantum`}>
        <h3 id={`${id}-quantum`}>1. Light quanta: an energy scale, not a proof of relativity</h3>
        <p>In modern notation the quantum energy is hν. Total pulse energy E and frequency ν are independent settings. E/(hν) is shown without rounding: an energy ratio is not an independently measured integer photon count.</p>
        <QuantityTable snapshot={snapshot} caption="Source pulse and quantum-energy comparison" ids={["frequencyStationary", "energyStationary", "quantumEnergyStationary", "quantumRatioStationary"]} />
        <p><a href="/papers/light-quanta/#s6">Read the light-quanta argument, §6</a> · <a href="/lab/lq-06">Compare the entropy coefficients</a></p>
      </section>
      <section aria-labelledby={`${id}-relativity`}>
        <h3 id={`${id}-relativity`}>2. Relativity: energy and frequency change together</h3>
        <p>For the same pulse, the wave owners evaluate ν′/ν and E′/E. Both follow q = γ(1 − β cos θ), so the modern comparison E′/(hν′) equals E/(hν), apart from numerical rounding. This equality compares two computed consequences; it does not independently establish light quanta.</p>
        <QuantityTable snapshot={snapshot} caption="The same pulse in the moving frame" ids={["frequencyFactor", "energyFactor", "frequencyMoving", "energyMoving", "quantumEnergyMoving", "quantumRatioMoving"]} />
        <p><a href="/papers/special-relativity/#s8">Read relativity, §8</a> · <a href="/lab/sr-10">Explore the finite light complex</a></p>
      </section>
      <section aria-labelledby={`${id}-inertia`}>
        <h3 id={`${id}-inertia`}>3. Mass–energy: first specify the system</h3>
        <p>A unidirectional light pulse has zero invariant mass. Its energy divided by c² is not its rest mass. To connect to the September argument, now add a distinct, equal pulse traveling in the opposite direction. Their total source-frame energy is 2E and their momenta cancel.</p>
        <QuantityTable snapshot={snapshot} caption="A pulse versus an equal, opposite two-pulse system" ids={["pulseEnergyEquivalent", "pulseInvariantMass", "oppositePulseEnergyMoving", "pairEnergyStationary", "pairEnergyMoving", "pairInvariantMass", "bodyMassLoss"]} />
        <p>For a body initially at rest that emits this balanced pair without recoil, the mass decrease is 2E/c². The displayed system invariant mass is a later interpretation. The historical argument instead compares two energy ledgers and uses the low-speed kinetic-energy premise. It does not require quanta, and we have not assigned the unknown initial body energy E₀ = Mc².</p>
        <p><a href="/papers/mass-energy/">Read the September paper</a> · <a href="/lab/me-01">Follow the two ledgers</a> · <a href="/lab/me-02">Inspect the low-speed coefficient</a></p>
      </section>
      <details>
        <summary>Model limits and the code behind the numbers</summary>
        <p>The idealization is a unidirectional, monochromatic vacuum pulse between inertial frames. This does not model finite spectral bandwidth, diffraction, media, gravitational shifts, detector response, or the recoil caused by unbalanced single-pulse emission. The control bounds are numerical admission limits, not claims of physical impossibility.</p>
        <p>The frequency and energy factors come from the existing relativistic wave owners. One accepted, instance-scoped snapshot supplies every displayed quantity. No FrankenSim/WASM execution is claimed.</p>
        <p><a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/physics/reference/waves.ts">Wave owners</a> · <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/physics/reference/lightThread.ts">Cross-paper calculation</a> · <a href="https://github.com/Dicklesworthstone/annus-mirabilis.com/blob/main/src/experiments/lightThread/session.ts">Snapshot publication</a></p>
      </details>
    </section>
  );
}
