"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import { typedOrNaN } from "../../../experiments/controls/typedNumber.ts";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
import {
  LQ03_CAPTION,
  LQ03_DEFAULTS,
  LQ03_NOT_MODELED,
  LQ03_OUTPUTS,
  LQ03_QUESTION,
  type Lq03Parameters,
} from "../../../experiments/lq03/definition.ts";
import {
  buildLq03Snapshot,
  createLq03Session,
  evaluateLq03,
  evaluateLq03Spectrum,
  type Lq03Evaluation,
  type PreparedLq03Example,
} from "../../../experiments/lq03/session.ts";
import { LQ03_TAPE } from "../../../experiments/lq03/tape.ts";
import { LabTapeLink, useLabTapeLink } from "../../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import { statusMessage } from "../../../experiments/results/explanations.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { KEPT_RESULT } from "../keptResult.ts";
import { fixed, identity } from "../presentation.ts";
import { Sci, SciFromLn } from "../Sci.tsx";
import { SliderField } from "../SliderField.tsx";
import { withScripts } from "../subscripts.tsx";
import { SpectrumPlot } from "./SpectrumPlot.tsx";

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
    // Number("") is 0: a cleared field was read as 0 and refused with a range, or, for ε, as 0%.
    // A blank or partial field now reaches the validator as NaN and is refused as not a number.
    T: typedOrNaN(d.T),
    nu1: typedOrNaN(d.nu1),
    nu2: typedOrNaN(d.nu2),
    probeNu: typedOrNaN(d.probeNu),
    epsilon: typedOrNaN(d.epsilon) / 100,
    coordinate: d.coordinate,
    axisScale: d.axisScale,
    convention: d.convention,
    showPlanck: d.showPlanck,
    showWien: d.showWien,
    showClassical: d.showClassical,
  };
}

function densityText(result: Lq03Evaluation["planck"]["frequency"], unit: string): ReactNode {
  if (result.status !== "value") {
    return result.status === "outside-domain" ? result.reason : statusMessage(result.status);
  }
  if (result.linearRepresentable)
    return (
      <>
        <Sci value={result.value} digits={6} /> {unit}
      </>
    );
  // Outside double precision the owner reports the natural logarithm. It is drawn as a power of ten
  // like every other value here; it was printed as "below double-precision range; ln(value) =
  // -9.598486147758314e+285 (natural log of …)", which also said "below" for a logarithm of +2644.
  const ln = result.logFrequencyEnergyDensity ?? result.logWavelengthEnergyDensity;
  return ln === undefined ? (
    "below the plotted range"
  ) : (
    <>
      <SciFromLn ln={ln} digits={6} /> {unit}
    </>
  );
}

/** x = hν/(k_B T) spans hundreds of decades as the probe moves. fixed() printed 1.2 × 10⁻⁸ as "0" and
 *  9.6 × 10²⁸⁵ as "9.598486146732442e+285"; mid-range values keep their plain decimals. */
function xText(x: number): ReactNode {
  return x >= 1e-3 && x < 1e4 ? fixed(x, 6) : <Sci value={x} digits={6} />;
}

function scalarText(
  result: { status: string; value?: number; reason?: string },
  unit: string,
): ReactNode {
  if (result.status !== "value" || typeof result.value !== "number") {
    return result.status === "outside-domain" && result.reason
      ? result.reason
      : statusMessage(result.status);
  }
  return (
    <>
      <Sci value={result.value} digits={6} /> {unit}
    </>
  );
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
  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(
    LQ03_TAPE,
    session,
    session.acceptedParameters(),
    true,
    (restored) => setDraft(toDraft(restored)),
  );

  const fallback =
    session.getServerSnapshot().accepted ??
    buildLq03Snapshot(`lq03-${id}`, "lq03-init", LQ03_DEFAULTS, 0, 0);
  const snapshot = view.accepted ?? fallback;
  const p = snapshot.parameters as Lq03Parameters;
  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation; no example, no earned label.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      LQ03_OUTPUTS,
      example?.sourceDigest ?? "",
      snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
  const [draft, setDraft] = useState(() => toDraft(p));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const evaluation = evaluateLq03(p);
  const spectrum = evaluateLq03Spectrum(p);

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

  /** The slider and the selects apply at once; the typed band, probe and tolerance wait for Apply. */
  function applyDraft(next: Draft) {
    setDraft(next);
    apply(fromDraft(next));
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
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "frequencyEnergyDensity")}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">Radiation spectrum and regime comparison</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome
          state={executionKind}
          view={view}
          modelNote={modelNoteFromView(view, { notModeled: `${LQ03_NOT_MODELED.join("; ")}.` })}
        />
      </div>

      <p className="lab-question">{LQ03_QUESTION}</p>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built,
          at T = {LQ03_DEFAULTS.T} K with the printed formulas below. Changing settings requires
          JavaScript.
        </p>
      </noscript>

      <div className="lab-columns">
        <form
          noValidate
          onSubmit={submit}
          aria-label="Radiation spectrum settings"
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <fieldset disabled={!ready}>
            <legend className="visually-hidden">Spectrum settings</legend>
            <SliderField
              id={`${id}-T`}
              label="Temperature T"
              unit="K, 500-10000"
              min={500}
              max={10000}
              step={50}
              value={draft.T}
              onDraft={(T) => setDraft({ ...draft, T })}
              onCommit={(T) => applyDraft({ ...draft, T })}
            />
            <div className="input-grid">
              <div className="input-field">
                <label htmlFor={`${id}-convention`}>Density per</label>
                <select
                  id={`${id}-convention`}
                  name="convention"
                  value={draft.convention}
                  onChange={(e) =>
                    applyDraft({
                      ...draft,
                      convention: e.target.value as Lq03Parameters["convention"],
                    })
                  }
                >
                  <option value="per-hz">Hertz</option>
                  <option value="per-m">Metre of wavelength</option>
                  <option value="per-log">Natural-log interval</option>
                  <option value="per-decade">Decade</option>
                </select>
              </div>
              <div className="input-field">
                <label htmlFor={`${id}-coordinate`}>Plot against</label>
                <select
                  id={`${id}-coordinate`}
                  name="coordinate"
                  value={draft.coordinate}
                  onChange={(e) =>
                    applyDraft({
                      ...draft,
                      coordinate: e.target.value as Lq03Parameters["coordinate"],
                    })
                  }
                >
                  <option value="frequency">Frequency</option>
                  <option value="wavelength">Wavelength</option>
                </select>
              </div>
            </div>
            <ExperimentSettings contents="axis scale, which laws are drawn, the band, the probe frequency, the regime tolerance">
              <div className="input-grid">
                <div className="input-field">
                  <label htmlFor={`${id}-axisScale`}>Axis scale</label>
                  <select
                    id={`${id}-axisScale`}
                    name="axisScale"
                    value={draft.axisScale}
                    onChange={(e) =>
                      applyDraft({
                        ...draft,
                        axisScale: e.target.value as Lq03Parameters["axisScale"],
                      })
                    }
                  >
                    <option value="logarithmic">Logarithmic</option>
                    <option value="linear">Linear</option>
                  </select>
                </div>
              </div>
              <div className="input-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={draft.showPlanck}
                    onChange={(e) => applyDraft({ ...draft, showPlanck: e.target.checked })}
                  />{" "}
                  Planck 1900
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.showWien}
                    onChange={(e) => applyDraft({ ...draft, showWien: e.target.checked })}
                  />{" "}
                  Wien 1896
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.showClassical}
                    onChange={(e) => applyDraft({ ...draft, showClassical: e.target.checked })}
                  />{" "}
                  Classical &sect;1
                </label>
              </div>
              <div className="input-grid">
                <div className="input-field">
                  <label htmlFor={`${id}-nu1`}>
                    Band lower edge &nu;<sub>1</sub> <span>(Hz)</span>
                  </label>
                  <input
                    id={`${id}-nu1`}
                    name="nu1"
                    type="text"
                    inputMode="decimal"
                    value={draft.nu1}
                    onChange={(e) => setDraft({ ...draft, nu1: e.target.value })}
                  />
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-nu2`}>
                    Band upper edge &nu;<sub>2</sub> <span>(Hz)</span>
                  </label>
                  <input
                    id={`${id}-nu2`}
                    name="nu2"
                    type="text"
                    inputMode="decimal"
                    value={draft.nu2}
                    onChange={(e) => setDraft({ ...draft, nu2: e.target.value })}
                  />
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-probeNu`}>
                    Probe frequency <span>(Hz)</span>
                  </label>
                  <input
                    id={`${id}-probeNu`}
                    name="probeNu"
                    type="text"
                    inputMode="decimal"
                    value={draft.probeNu}
                    onChange={(e) => setDraft({ ...draft, probeNu: e.target.value })}
                  />
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-epsilon`}>
                    Regime tolerance &epsilon; <span>(%, 0.1–10)</span>
                  </label>
                  <input
                    id={`${id}-epsilon`}
                    name="epsilon"
                    type="text"
                    inputMode="decimal"
                    value={draft.epsilon}
                    onChange={(e) => setDraft({ ...draft, epsilon: e.target.value })}
                  />
                </div>
              </div>
              <button type="submit">Apply settings</button>
            </ExperimentSettings>
          </fieldset>
          {error && (
            <p id={`${id}-error`} className="notice" role="alert">
              {withScripts(error)} {KEPT_RESULT}
            </p>
          )}
        </form>

        <div className="results lab-results">
          <SpectrumPlot
            spectrum={spectrum}
            shown={{ planck: p.showPlanck, wien: p.showWien, classical: p.showClassical }}
            titleId={`${id}-spectrum`}
          />
          <div aria-live="polite">
            <h3>Spectral densities at the probe frequency</h3>
            <table>
              <caption>
                Values at &nu; = <Sci value={p.probeNu} digits={4} /> Hz, T = {p.T} K. Wavelength
                density is the Jacobian-transformed value, never a bare substitution of &lambda; =
                c/&nu;.
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
                {p.showPlanck && (
                  <tr>
                    <td>Planck 1900</td>
                    <td>{densityText(evaluation.planck.frequency, "J/(m³ Hz)")}</td>
                    <td>{densityText(evaluation.planck.wavelength, "J/(m³ m)")}</td>
                  </tr>
                )}
                {p.showWien && (
                  <tr>
                    <td>Wien 1896</td>
                    <td>{densityText(evaluation.wien.frequency, "J/(m³ Hz)")}</td>
                    <td>{densityText(evaluation.wien.wavelength, "J/(m³ m)")}</td>
                  </tr>
                )}
                {p.showClassical && (
                  <tr>
                    <td>Classical &sect;1</td>
                    <td>{densityText(evaluation.classical.frequency, "J/(m³ Hz)")}</td>
                    <td>{densityText(evaluation.classical.wavelength, "J/(m³ m)")}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <h3>Band energy: identical across representations</h3>
            <p>
              From the frequency integral: {scalarText(evaluation.bandEnergyFromFrequency, "J/m³")}.
              From the wavelength integral over the same physical band:{" "}
              {scalarText(evaluation.bandEnergyFromWavelength, "J/m³")}. These agree because the
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
                    {evaluation.frequencyFromPeakWavelength === null ? (
                      "(unavailable)"
                    ) : (
                      <>
                        <Sci value={evaluation.frequencyFromPeakWavelength} digits={6} /> Hz
                      </>
                    )}
                  </td>
                </tr>
                <tr>
                  <td>
                    Per-natural-log-interval peak (x = {fixed(evaluation.peakLogInterval.x, 7)})
                  </td>
                  <td>
                    <Sci value={evaluation.peakLogInterval.peakFrequency} digits={6} /> Hz
                  </td>
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
              {xText(regime.x)}. Wien's law's relative error here is{" "}
              <Sci value={regime.wienRelativeError} digits={4} />;{" "}
              {Number.isFinite(regime.rayleighJeansRelativeError) ? (
                <>
                  the classical law's relative error is{" "}
                  <Sci value={regime.rayleighJeansRelativeError} digits={4} />
                  {regime.rayleighJeansRelativeError > 1 && (
                    <>
                      , so it gives <Sci value={1 + regime.rayleighJeansRelativeError} digits={4} />{" "}
                      times Planck's value
                    </>
                  )}
                  .
                </>
              ) : (
                <>
                  the classical law gives more than 10<sup>300</sup> times Planck's value, beyond
                  the largest number this page can write.
                </>
              )}{" "}
              {verdict}
            </p>
            <p className="fine">
              This pointwise error is not a certificate for the light paper's integrated entropy
              argument (&sect;4), which holds only within its own stated limits.
            </p>

            <p className="fine">Not modeled: {LQ03_NOT_MODELED.join("; ")}.</p>

            <details>
              <summary>The same action without dragging, color, or a canvas</summary>
              <p>
                Every action here is typed text entry and a text result: type the temperature, the
                band edges and the probe frequency, choose the representation from the select lists
                above, and read the band-energy and peak tables and the regime verdict sentence. The
                spectrum drawing shows the same densities; its description names the peak, and the
                three laws differ by line pattern, not colour. No control depends on dragging a
                handle, distinguishing color alone, or reading a canvas.
              </p>
            </details>
          </div>
        </div>
      </div>
      {/* The permalink to these settings, after the instrument it links to (dispatch 263). In
          the status row it made that line 267px tall at 1440. */}
      <LabTapeLink link={tapeLink} />

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(LQ03_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(LQ03_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(LQ03_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(LQ03_CAPTION.r3)}
      </p>
    </section>
  );
}

export function SpectrumComparison({ example }: { example?: PreparedLq03Example | undefined }) {
  return <SpectrumLab example={example} />;
}
