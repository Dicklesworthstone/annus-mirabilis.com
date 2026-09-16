"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  LQ03_DEFAULTS,
  LQ03_NOT_MODELED,
  LQ03_QUESTION,
  type Lq03Parameters,
} from "../../../experiments/lq03/definition.ts";
import {
  buildLq03Snapshot,
  createLq03Session,
  evaluateLq03,
  type Lq03Evaluation,
  type PreparedLq03Example,
} from "../../../experiments/lq03/session.ts";
import { identity } from "../presentation.ts";

type Draft = Readonly<{
  T: string;
  nu1: string;
  nu2: string;
  probeNu: string;
  epsilon: string;
  coordinate: Lq03Parameters["coordinate"];
  axisScale: Lq03Parameters["axisScale"];
  convention: Lq03Parameters["convention"];
  showPlanck: boolean;
  showWien: boolean;
  showClassical: boolean;
}>;

function toDraft(p: Lq03Parameters): Draft {
  return {
    T: String(p.T),
    nu1: String(p.nu1),
    nu2: String(p.nu2),
    probeNu: String(p.probeNu),
    epsilon: String(p.epsilon * 100),
    coordinate: p.coordinate,
    axisScale: p.axisScale,
    convention: p.convention,
    showPlanck: p.showPlanck,
    showWien: p.showWien,
    showClassical: p.showClassical,
  };
}

function fromDraft(d: Draft): unknown {
  return {
    T: Number(d.T),
    nu1: Number(d.nu1),
    nu2: Number(d.nu2),
    probeNu: Number(d.probeNu),
    epsilon: Number(d.epsilon) / 100,
    coordinate: d.coordinate,
    axisScale: d.axisScale,
    convention: d.convention,
    showPlanck: d.showPlanck,
    showWien: d.showWien,
    showClassical: d.showClassical,
  };
}

function densityText(result: Lq03Evaluation["planck"]["frequency"], unit: string): string {
  if (result.status !== "value") {
    return result.status === "outside-domain" ? result.reason : `(${result.status})`;
  }
  if (result.linearRepresentable) return `${result.value.toExponential(6)} ${unit}`;
  const ln = result.logFrequencyEnergyDensity ?? result.logWavelengthEnergyDensity;
  return ln === undefined
    ? "below the plotted range"
    : `below double-precision range; ln(value) = ${ln.toFixed(5)} (natural log of ${unit})`;
}

function scalarText(
  result: { status: string; value?: number; reason?: string },
  unit: string,
): string {
  if (result.status !== "value" || typeof result.value !== "number") {
    return result.status === "outside-domain" && result.reason
      ? result.reason
      : `(${result.status})`;
  }
  return `${result.value.toExponential(6)} ${unit}`;
}

export function SpectrumLab({
  example,
  title = "The radiation spectrum and regime comparison",
}: {
  example?: PreparedLq03Example | undefined;
  title?: string | undefined;
}) {
  const id = useId();
  const [session] = useState(() =>
    createLq03Session(`lq03-${id}`, example?.parameters ?? LQ03_DEFAULTS),
  );
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const fallback =
    session.getServerSnapshot().accepted ??
    buildLq03Snapshot(`lq03-${id}`, "lq03-init", LQ03_DEFAULTS, 0, 0);
  const snapshot = view.accepted ?? fallback;
  const p = snapshot.parameters as Lq03Parameters;
  const [draft, setDraft] = useState(() => toDraft(p));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const evaluation = evaluateLq03(p);

  useEffect(() => {
    setReady(true);
    return () => session.disconnect();
  }, [session]);

  function apply(parameters: unknown) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      setError(
        typeof outcome.refusal.details?.requirements === "string"
          ? outcome.refusal.details.requirements
          : outcome.refusal.message,
      );
      return;
    }
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(fromDraft(draft));
  }

  const regime = evaluation.regime;
  const verdict =
    regime.regime === "wien"
      ? "In the Wien regime at this temperature and frequency."
      : regime.regime === "rayleigh-jeans"
        ? "In the classical (large-wavelength, large-density) regime at this temperature and frequency."
        : "In neither regime at the chosen tolerance: an intermediate frequency.";

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="lq-03"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      data-execution-label="host"
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">LQ-03 &middot; Radiation spectrum and regime comparison</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">Ideal model, host calculation</span>
      </header>

      <p>{LQ03_QUESTION}</p>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built,
          at T = {LQ03_DEFAULTS.T} K with the printed formulas below. Changing settings requires
          JavaScript.
        </p>
      </noscript>

      <div className="lab-columns">
        <form
          onSubmit={submit}
          aria-label="Radiation spectrum settings"
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <fieldset disabled={!ready}>
            <legend>Temperature, band, and probe</legend>
            <div className="input-grid">
              <label htmlFor={`${id}-T`}>
                Temperature T <span>(K, 500-10000)</span>
                <input
                  id={`${id}-T`}
                  name="T"
                  type="text"
                  inputMode="decimal"
                  value={draft.T}
                  onChange={(e) => setDraft({ ...draft, T: e.target.value })}
                />
              </label>
              <label htmlFor={`${id}-nu1`}>
                Band lower edge &nu;<sub>1</sub> <span>(Hz)</span>
                <input
                  id={`${id}-nu1`}
                  name="nu1"
                  type="text"
                  inputMode="decimal"
                  value={draft.nu1}
                  onChange={(e) => setDraft({ ...draft, nu1: e.target.value })}
                />
              </label>
              <label htmlFor={`${id}-nu2`}>
                Band upper edge &nu;<sub>2</sub> <span>(Hz)</span>
                <input
                  id={`${id}-nu2`}
                  name="nu2"
                  type="text"
                  inputMode="decimal"
                  value={draft.nu2}
                  onChange={(e) => setDraft({ ...draft, nu2: e.target.value })}
                />
              </label>
              <label htmlFor={`${id}-probeNu`}>
                Probe frequency <span>(Hz)</span>
                <input
                  id={`${id}-probeNu`}
                  name="probeNu"
                  type="text"
                  inputMode="decimal"
                  value={draft.probeNu}
                  onChange={(e) => setDraft({ ...draft, probeNu: e.target.value })}
                />
              </label>
              <label htmlFor={`${id}-epsilon`}>
                Regime tolerance &epsilon; <span>(%, 0.1-99)</span>
                <input
                  id={`${id}-epsilon`}
                  name="epsilon"
                  type="text"
                  inputMode="decimal"
                  value={draft.epsilon}
                  onChange={(e) => setDraft({ ...draft, epsilon: e.target.value })}
                />
              </label>
              <label htmlFor={`${id}-coordinate`}>
                Horizontal coordinate
                <select
                  id={`${id}-coordinate`}
                  name="coordinate"
                  value={draft.coordinate}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      coordinate: e.target.value as Lq03Parameters["coordinate"],
                    })
                  }
                >
                  <option value="frequency">Frequency</option>
                  <option value="wavelength">Wavelength</option>
                </select>
              </label>
              <label htmlFor={`${id}-axisScale`}>
                Axis scale
                <select
                  id={`${id}-axisScale`}
                  name="axisScale"
                  value={draft.axisScale}
                  onChange={(e) =>
                    setDraft({ ...draft, axisScale: e.target.value as Lq03Parameters["axisScale"] })
                  }
                >
                  <option value="logarithmic">Logarithmic</option>
                  <option value="linear">Linear</option>
                </select>
              </label>
              <label htmlFor={`${id}-convention`}>
                Density convention
                <select
                  id={`${id}-convention`}
                  name="convention"
                  value={draft.convention}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      convention: e.target.value as Lq03Parameters["convention"],
                    })
                  }
                >
                  <option value="per-hz">Per Hz</option>
                  <option value="per-m">Per m</option>
                  <option value="per-log">Per natural-log interval</option>
                  <option value="per-decade">Per decade</option>
                </select>
              </label>
            </div>
            <div className="input-grid">
              <label>
                <input
                  type="checkbox"
                  checked={draft.showPlanck}
                  onChange={(e) => setDraft({ ...draft, showPlanck: e.target.checked })}
                />{" "}
                Planck 1900
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.showWien}
                  onChange={(e) => setDraft({ ...draft, showWien: e.target.checked })}
                />{" "}
                Wien 1896
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.showClassical}
                  onChange={(e) => setDraft({ ...draft, showClassical: e.target.checked })}
                />{" "}
                Classical &sect;1
              </label>
            </div>
            <button type="submit">Apply settings</button>
          </fieldset>
        </form>

        {error && (
          <p id={`${id}-error`} className="notice" role="alert">
            {error}
          </p>
        )}

        <div className="results" aria-live="polite">
          <h3>Spectral densities at the probe frequency</h3>
          <table>
            <caption>
              Values at &nu; = {p.probeNu.toExponential(4)} Hz, T = {p.T} K. Wavelength density is
              the Jacobian-transformed value, never a bare substitution of &lambda; = c/&nu;.
            </caption>
            <thead>
              <tr>
                <th>Law</th>
                <th>
                  u<sub>&nu;</sub> (J&middot;m&#8315;&#179;&middot;Hz&#8315;&#185;)
                </th>
                <th>
                  u<sub>&lambda;</sub> (J&middot;m&#8315;&#8308;)
                </th>
              </tr>
            </thead>
            <tbody>
              {draft.showPlanck && (
                <tr>
                  <td>Planck 1900</td>
                  <td>{densityText(evaluation.planck.frequency, "J/(m^3 Hz)")}</td>
                  <td>{densityText(evaluation.planck.wavelength, "J/(m^3 m)")}</td>
                </tr>
              )}
              {draft.showWien && (
                <tr>
                  <td>Wien 1896</td>
                  <td>{densityText(evaluation.wien.frequency, "J/(m^3 Hz)")}</td>
                  <td>{densityText(evaluation.wien.wavelength, "J/(m^3 m)")}</td>
                </tr>
              )}
              {draft.showClassical && (
                <tr>
                  <td>Classical &sect;1</td>
                  <td>{densityText(evaluation.classical.frequency, "J/(m^3 Hz)")}</td>
                  <td>{densityText(evaluation.classical.wavelength, "J/(m^3 m)")}</td>
                </tr>
              )}
            </tbody>
          </table>

          <h3>Band energy: identical across representations</h3>
          <p>
            From the frequency integral: {scalarText(evaluation.bandEnergyFromFrequency, "J/m^3")}.
            From the wavelength integral over the same physical band:{" "}
            {scalarText(evaluation.bandEnergyFromWavelength, "J/m^3")}. These agree because the
            Jacobian is applied; a relabeled axis without it would not agree (see &ldquo;Show the
            code&rdquo;).
          </p>

          <h3>Peak locations: representation-dependent, and why</h3>
          <table>
            <tbody>
              <tr>
                <td>
                  Frequency-density peak &nu;<sub>peak</sub>
                </td>
                <td>{scalarText(evaluation.peakFrequency, "Hz")}</td>
              </tr>
              <tr>
                <td>
                  Wavelength-density peak &lambda;<sub>peak</sub>
                </td>
                <td>{scalarText(evaluation.peakWavelength, "m")}</td>
              </tr>
              <tr>
                <td>
                  c / &lambda;<sub>peak</sub> (NOT the frequency-density peak)
                </td>
                <td>
                  {evaluation.frequencyFromPeakWavelength === null
                    ? "(unavailable)"
                    : `${evaluation.frequencyFromPeakWavelength.toExponential(6)} Hz`}
                </td>
              </tr>
              <tr>
                <td>
                  Per-natural-log-interval peak (x = {evaluation.peakLogInterval.x.toFixed(7)})
                </td>
                <td>{evaluation.peakLogInterval.peakFrequency.toExponential(6)} Hz</td>
              </tr>
            </tbody>
          </table>
          <p className="fine">
            The frequency-density peak and c divided by the wavelength-density peak are different
            numbers on purpose: u<sub>&lambda;</sub> and u<sub>&nu;</sub> are different functions
            related by a Jacobian, so their maxima do not correspond under &lambda; = c/&nu;.
          </p>

          <h3>Wien and classical regime verdict</h3>
          <p>
            At this temperature and probe frequency, x = h&nu;/(k<sub>B</sub>T) ={" "}
            {regime.x.toFixed(6)}. Wien's law's relative error here is{" "}
            {regime.wienRelativeError.toExponential(4)}; the classical law's relative error is{" "}
            {regime.rayleighJeansRelativeError.toExponential(4)}. {verdict}
          </p>
          <p className="fine">
            This pointwise error is not a certificate for the light paper's integrated entropy
            argument (&sect;4), which holds only within its own stated limits.
          </p>

          <p className="fine">Not modeled: {LQ03_NOT_MODELED.join("; ")}.</p>

          <details>
            <summary>Action contract: the same action without dragging, color, or a canvas</summary>
            <p>
              Every action here is typed text entry and a text result: type the band edges and probe
              frequency in hertz, choose the representation from the select lists above, and read
              the band-energy and peak tables and the regime verdict sentence. No control depends on
              dragging a handle, distinguishing color alone, or reading a canvas.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}

export function SpectrumComparison({ example }: { example?: PreparedLq03Example | undefined }) {
  return <SpectrumLab example={example} />;
}
