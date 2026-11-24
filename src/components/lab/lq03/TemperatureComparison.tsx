"use client";

import { type FormEvent, useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import type { ComparisonSnapshot } from "../../../experiments/compare/Baseline.ts";
import { ComparisonPanel } from "../../../experiments/compare/ComparisonPanel.tsx";
import {
  ComparisonRecovery,
  comparisonCurrency,
} from "../../../experiments/compare/ComparisonRecovery.tsx";
import type { Lq03Coordinate, Lq03Parameters } from "../../../experiments/lq03/definition.ts";
import type { createLq03Session } from "../../../experiments/lq03/session.ts";
import {
  createTemperatureComparison,
  LQ03_TEMPERATURE_COMPARISON,
  temperatureComparisonParameters,
  temperatureComparisonSpectra,
} from "../../../experiments/lq03/temperatureComparison.ts";
import { Sci } from "../Sci.tsx";
import { SpectrumPlot } from "./SpectrumPlot.tsx";
import "../../../experiments/compare/comparison.css";

type Controller = ReturnType<typeof createTemperatureComparison>;

function regime(snapshot: ComparisonSnapshot): string {
  const admitted = (id: string) =>
    snapshot.outputs.some(
      (output) => output.quantityId === id && output.status === "value" && output.value === 1,
    );
  const wien = admitted("wienRegimeAdmitted");
  const classical = admitted("classicalRegimeAdmitted");
  if (wien && classical) return "Both Wien and classical laws meet the selected tolerance.";
  if (wien) return "Wien's law meets the tolerance; the classical law does not.";
  if (classical) return "The classical law meets the tolerance; Wien's law does not.";
  return "Neither approximation meets the selected tolerance.";
}

function Comparison({ controller, onClose }: { controller: Controller; onClose(): void }) {
  const uid = useId();
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState(() => String(state.variant.parameters.T));
  const [error, setError] = useState("");
  const [coordinate, setCoordinate] = useState<Lq03Coordinate>("frequency");
  const [axisScale, setAxisScale] = useState<Lq03Parameters["axisScale"]>("logarithmic");
  const baseline = useMemo(
    () => temperatureComparisonParameters(state.baseline.parameters),
    [state.baseline.parameters],
  );
  const variant = useMemo(
    () => temperatureComparisonParameters(state.variant.parameters),
    [state.variant.parameters],
  );
  const spectra = useMemo(
    () => temperatureComparisonSpectra(baseline, variant, coordinate, axisScale),
    [baseline, variant, coordinate, axisScale],
  );
  const enabled = ready && state.phase === "live" && !state.pending;
  const changed = state.result.kind === "accepted" && state.result.variation.changedInput === "T";

  useEffect(() => {
    controller.connect();
    controller.start();
    setReady(true);
    return () => controller.disconnect();
  }, [controller]);

  useEffect(() => {
    setDraft(String(state.variant.parameters.T));
  }, [state.variant]);

  function applyTemperature(T: number) {
    if (!enabled) return;
    setError("");
    controller.apply({ ...state.baseline.parameters, T });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled) return;
    const T = Number(draft.trim());
    if (draft.trim() === "" || !Number.isFinite(T)) {
      setError("Enter a finite temperature from 500 to 10 000 K.");
      return;
    }
    applyTemperature(T);
  }

  return (
    <section
      className="controlled-comparison"
      aria-labelledby={uid + "-title"}
      data-temperature-comparison
      data-currency-state={comparisonCurrency(state, error)}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">One temperature changes · One fixed spectral band</p>
          <h3 id={uid + "-title"}>Compare two temperatures</h3>
        </div>
        <p className="badge">Ideal model, host calculation</p>
      </header>
      <p>
        The baseline keeps the accepted spectrum you pinned. Change only the variant temperature;
        the band, probe frequency, error tolerance and spectral calibration stay fixed. Changes in
        the main apparatus do not replace this pair.
      </p>
      <p className="fine">
        Fixed band: <Sci value={baseline.nu1} digits={4} /> to{" "}
        <Sci value={baseline.nu2} digits={4} /> Hz. Probe:{" "}
        <Sci value={baseline.probeNu} digits={4} /> Hz. Approximation tolerance:{" "}
        {baseline.epsilon * 100}%.{" "}
        {baseline.constantSetId === "modern-si-2019"
          ? "Both spectra use the modern SI constants."
          : "Both spectra use the light paper's historical calibration with the corrected exponent of α, as declared above; no modern h or Boltzmann constant is substituted."}
      </p>
      <p role="status" aria-live="polite" aria-atomic="true">
        {state.error || state.pending
          ? state.message
          : changed
            ? "Completed comparison: only temperature changed. Both curves and the table use the accepted pair."
            : "No temperature has changed. Both curves and columns show the pinned spectrum."}
      </p>
      <ComparisonRecovery
        id={uid + "-error"}
        state={state}
        contract={LQ03_TEMPERATURE_COMPARISON}
        localError={error}
        ready={ready}
        onRepair={(choice) => {
          setError("");
          controller.repair(choice);
        }}
        onRetry={() => {
          setError("");
          controller.retry(state.failure);
        }}
        onRebuild={() => {
          setError("");
          controller.start();
        }}
      />
      <form onSubmit={submit} aria-label="Temperature comparison settings" noValidate>
        <fieldset disabled={!enabled}>
          <legend>Change the variant temperature</legend>
          <label htmlFor={uid + "-temperature"}>Variant temperature (K)</label>
          <input
            id={uid + "-temperature"}
            name="comparison-temperature"
            type="text"
            inputMode="decimal"
            value={draft}
            aria-invalid={Boolean(error || state.error)}
            aria-describedby={error || state.error ? uid + "-error" : undefined}
            onChange={(event) => setDraft(event.target.value)}
          />
          <p className="fine">The laboratory admits temperatures from 500 to 10 000 K.</p>
          <div className="actions">
            <button type="submit">Compare temperatures</button>
            <button
              type="button"
              disabled={baseline.T * 2 > 10000}
              onClick={() => applyTemperature(baseline.T * 2)}
            >
              Double baseline temperature
            </button>
            <button
              type="button"
              disabled={baseline.T / 2 < 500}
              onClick={() => applyTemperature(baseline.T / 2)}
            >
              Halve baseline temperature
            </button>
            <button type="button" disabled={!changed} onClick={() => applyTemperature(baseline.T)}>
              Return to baseline temperature
            </button>
            <button
              type="button"
              disabled={!changed}
              onClick={() => {
                setError("");
                controller.pinCurrent();
              }}
            >
              Pin variant as new baseline
            </button>
          </div>
        </fieldset>
      </form>

      <fieldset disabled={!ready}>
        <legend>View the same accepted pair</legend>
        <label htmlFor={uid + "-coordinate"}>Density representation</label>
        <select
          id={uid + "-coordinate"}
          name="comparison-coordinate"
          value={coordinate}
          onChange={(event) =>
            setCoordinate(event.target.value === "wavelength" ? "wavelength" : "frequency")
          }
        >
          <option value="frequency">Per unit frequency, against frequency</option>
          <option value="wavelength">Per unit wavelength, against wavelength</option>
        </select>
        <label htmlFor={uid + "-scale"}>Axis scale</label>
        <select
          id={uid + "-scale"}
          name="comparison-axis-scale"
          value={axisScale}
          onChange={(event) =>
            setAxisScale(event.target.value === "linear" ? "linear" : "logarithmic")
          }
        >
          <option value="logarithmic">Logarithmic</option>
          <option value="linear">Linear</option>
        </select>
      </fieldset>
      <SpectrumPlot
        spectrum={spectra.variant}
        reference={spectra.baseline}
        shown={{ planck: true, wien: false, classical: false }}
        titleId={uid + "-spectrum"}
      />
      <p className="fine">
        Both Planck curves share the same axes. Changing representation applies the wavelength
        Jacobian to each curve and preserves the fixed band's energy. The peak of uν and the peak of
        uλ are different observables: c divided by the wavelength-density peak is not the
        frequency-density peak.
      </p>
      <p>
        A higher temperature raises the Planck density at every fixed frequency. It moves the
        frequency-density peak upward and the wavelength-density peak downward. The energy ratio in
        this fixed band need not equal the fourth power of the temperature ratio: that fourth-power
        law applies to the integral over all frequencies.
      </p>
      <section aria-label="Approximation regimes at the fixed probe">
        <h4>Which approximation survives the temperature change?</h4>
        <p data-temperature-regime="baseline">
          Baseline at {baseline.T} K: {regime(state.baselineSnapshot)}
        </p>
        <p data-temperature-regime="variant">
          Variant at {variant.T} K: {regime(state.variantSnapshot)}
        </p>
        <p className="fine">
          These are pointwise spectral-density tests at the fixed probe, not a certificate for the
          integrated entropy argument in §4.
        </p>
      </section>
      <ComparisonPanel
        baseline={state.baseline}
        variant={state.variant}
        contract={LQ03_TEMPERATURE_COMPARISON}
        result={state.result}
      />
      <div className="actions">
        <button type="button" className="secondary" onClick={onClose}>
          Close temperature comparison
        </button>
      </div>
      <p className="fine">Download the comparison record before closing if you want to keep it.</p>
    </section>
  );
}

/** Captures the accepted result only after an explicit reader action; drafts never enter it. */
export function TemperatureComparison({
  session,
  sourceDigest,
  enabled,
}: {
  session: ReturnType<typeof createLq03Session>;
  sourceDigest: string;
  enabled: boolean;
}) {
  const uid = useId();
  const [ready, setReady] = useState(false);
  const [controller, setController] = useState<Controller | null>(null);
  const [error, setError] = useState("");
  useEffect(() => setReady(true), []);

  function pin() {
    if (!ready || !enabled) return;
    const view = session.getSnapshot();
    if (view.pending || !view.accepted?.final) return;
    try {
      setController(
        createTemperatureComparison("lq03-temperature-" + uid, view.accepted, sourceDigest),
      );
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The comparison could not be opened.");
    }
  }

  if (controller) return <Comparison controller={controller} onClose={() => setController(null)} />;
  return (
    <section aria-labelledby={uid + "-offer"} data-temperature-comparison-offer>
      <h3 id={uid + "-offer"}>What changes when the body gets hotter?</h3>
      <p>
        Keep this spectrum as a baseline and compare another temperature on the same axes. See how
        the peak, energy in the fixed band and validity of the two approximations change.
      </p>
      <p className="fine">
        This uses the last accepted settings. Unapplied or refused form edits are not included.
      </p>
      <button type="button" disabled={!ready || !enabled} onClick={pin}>
        Pin spectrum for temperature comparison
      </button>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
