"use client";

import { type FormEvent, type ReactNode, useId, useState } from "react";
import { BM02_CAPTION } from "../../experiments/bm02/definition.ts";
import {
  type Bm02Inputs,
  computeBm02Snapshot,
  DEFAULT_BM02_INPUTS,
  type OsmoticModel,
  PHI_MAX,
  SUGAR_0P01M_INPUTS,
} from "../../experiments/bm02/session";
import { executionLabelFor } from "../../experiments/labels/executionLabelFor.ts";
import { executionLabelAttributes } from "../../experiments/labels/resultAttributes.ts";
import { AcceptedStatus } from "./AcceptedStatus.tsx";
import { ExperimentSettings } from "./ExperimentSettings.tsx";
import { sentenceNumber } from "./presentation.ts";
import { Sci } from "./Sci.tsx";
import { withScripts } from "./subscripts.tsx";

const NOT_MODELED = [
  "Particle interactions and excluded volume above the dilute domain.",
  "Non-ideal activity coefficients.",
  "Imperfect partitions (any real leak of particles across it).",
  "Gravity and sedimentation.",
  "Electrostatic effects.",
  "Adsorption at the partition.",
  "The kinetics and time needed to reach osmotic equilibrium.",
  "Molecular collisions with the wall: the drawn glyphs are illustrative, not a collision simulation.",
] as const;

type Draft = Readonly<{
  Np: string;
  V_um3: string;
  T: string;
  a_um: string;
  A_um2: string;
}>;

function toDraft(inputs: Bm02Inputs): Draft {
  return {
    Np: String(inputs.Np),
    V_um3: String(inputs.V_um3),
    T: String(inputs.T),
    a_um: String(inputs.a_um),
    A_um2: String(inputs.A_um2),
  };
}

function fromDraft(draft: Draft, model: OsmoticModel): Bm02Inputs {
  return {
    Np: Number(draft.Np),
    V_um3: Number(draft.V_um3),
    T: Number(draft.T),
    a_um: Number(draft.a_um),
    A_um2: Number(draft.A_um2),
    model,
    constantSetId: "modern-si-2019",
  };
}

function formatResult(result: { status: string; value?: unknown }, unit: string): ReactNode {
  if (result.status === "value" && typeof result.value === "number") {
    return (
      <>
        <Sci value={result.value} digits={6} />
        {unit ? ` ${unit}` : ""}
      </>
    );
  }
  if (result.status === "outside-domain" && "reason" in result) {
    return `Not modeled here: ${String((result as { reason: unknown }).reason)}`;
  }
  return result.status;
}

/**
 * Fixed, seeded illustration of the chamber: particle glyphs at
 * deterministic positions (golden-angle spacing), never Math.random,
 * capped so the SVG stays legible regardless of the actual particle
 * count. This drawing is never the owner of the pressure; it is
 * explicitly labeled as an illustration.
 *
 * The particles sit in the LEFT chamber, the one labelled "suspension". Until
 * 2026-09-22 they were centred on the partition itself (cx = 50 + r cos θ), so half
 * of them were drawn in the chamber labelled "pure solvent", the opposite of the
 * situation the instrument describes.
 *
 * Sizes are set here, inline, because the global `svg[role="img"] text` rule sets
 * font-size in USER units of whatever viewBox it lands in. On this 100-unit viewBox
 * that rule drew the two labels 100px tall at 1440px, overprinting each other. The
 * width cap keeps the drawing at illustration size, and non-scaling strokes keep
 * the walls a few pixels thick instead of seven.
 */
function ChamberIllustration({ count, admitted }: { count: number; admitted: boolean }) {
  const shown = Math.max(0, Math.min(count, 40));
  const dots = Array.from({ length: shown }, (_, i) => {
    const angle = i * 137.50776405; // golden angle, degrees; deterministic, not random
    const radius = 3 + (i % 5) * 2.4;
    const cx = 25 + radius * Math.cos((angle * Math.PI) / 180);
    const cy = 40 + radius * Math.sin((angle * Math.PI) / 180) * 0.6;
    return { cx, cy, key: i };
  });
  return (
    <svg
      viewBox="0 0 100 80"
      role="img"
      aria-label={`Illustration only: a chamber divided by a partition, with a representative sample of suspended particles on one side${admitted ? "" : ", drawn even though the current settings are outside the modeled dilute domain"}.`}
      className="osmotic-chamber"
      style={{ maxWidth: "26rem", marginInline: "auto" }}
    >
      <rect
        x="1"
        y="1"
        width="98"
        height="78"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1="50"
        y1="1"
        x2="50"
        y2="79"
        stroke="currentColor"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
      {dots.map((d) => (
        <circle key={d.key} cx={d.cx} cy={d.cy} r="1.4" fill="currentColor" opacity={0.75} />
      ))}
      <text x="25" y="75" textAnchor="middle" style={{ fontSize: 3.4 }}>
        suspension
      </text>
      <text x="75" y="75" textAnchor="middle" style={{ fontSize: 3.4 }}>
        pure solvent
      </text>
    </svg>
  );
}

export function OsmoticPartitionLab({
  example = DEFAULT_BM02_INPUTS,
  title = "The osmotic partition",
}: {
  example?: Bm02Inputs;
  title?: string;
}) {
  const id = useId();
  const [accepted, setAcceptedInputs] = useState<Bm02Inputs>(example);
  // The harness DOM contract's runtime identity. With no instance store, evaluation is synchronous on
  // an accepted apply: nothing is ever pending, and the requested input is the accepted one. The
  // revision counts accepted applies, the convention ShelfOpticsLab already uses.
  const [revision, setRevision] = useState(0);
  function setAccepted(next: Bm02Inputs) {
    setAcceptedInputs(next);
    setRevision((r) => r + 1);
  }
  // Earned per state (am-inst-execution-labels-5ywv): the build's worked example until a reader's
  // settings are accepted, a host calculation after. There is no instance store here, so the test is
  // identity with the state the lab started from, as in the reasoning workbenches (12a926b9).
  const executionKind = accepted === example ? "static-example" : "host-accepted";
  const [draft, setDraft] = useState<Draft>(() => toDraft(example));
  const [error, setError] = useState("");
  const [predictAnswer, setPredictAnswer] = useState<"harder" | "same" | "less" | null>(null);

  const snapshot = computeBm02Snapshot(accepted);
  // One sentence for the status line: the pressure on the partition, its force and its water column.
  const valueIn = (item: { status: string; value?: unknown }) =>
    item.status === "value" && typeof item.value === "number" ? item.value : null;
  const pressure = valueIn(snapshot.osmoticPressure.result);
  const force = valueIn(snapshot.partitionForce.result);
  const head = valueIn(snapshot.hydrostaticHead.result);
  const density = valueIn(snapshot.numberDensity);
  const modelWords =
    accepted.model === "molecular-kinetic"
      ? "on the molecular-kinetic model"
      : "on the classical expectation for suspended bodies";
  const statusSummary =
    pressure === null || force === null || head === null || density === null
      ? `${modelWords}, the pressure on the partition is not computed at these settings.`
      : `${modelWords}, ${sentenceNumber(density)} particles per cubic metre press on the partition with ${sentenceNumber(pressure)} Pa, a force of ${sentenceNumber(force)} N, as much as a ${sentenceNumber(head)} m column of water.`;
  const admitted = "admitted" in snapshot.domain ? snapshot.domain.admitted : false;

  function apply(next: Bm02Inputs) {
    if (
      !Number.isFinite(next.Np) ||
      !Number.isFinite(next.V_um3) ||
      !Number.isFinite(next.T) ||
      !Number.isFinite(next.a_um) ||
      !Number.isFinite(next.A_um2)
    ) {
      setError("Every field must be a real number. Check for a typo or an empty field.");
      return;
    }
    if (!Number.isInteger(next.Np) || next.Np < 0) {
      setError(
        `Particle count must be a whole number, zero or more. The nearest admissible values are ${Math.max(0, Math.floor(next.Np))} and ${Math.ceil(Math.max(0, next.Np))}.`,
      );
      return;
    }
    setAccepted(next);
    setError("");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    apply(fromDraft(draft, accepted.model));
  }

  function setModel(model: OsmoticModel) {
    const next = { ...accepted, model };
    setAccepted(next);
  }

  function loadSugarComparison() {
    setDraft(toDraft(SUGAR_0P01M_INPUTS));
    apply(SUGAR_0P01M_INPUTS);
  }

  function backToDefault() {
    setDraft(toDraft(DEFAULT_BM02_INPUTS));
    apply(DEFAULT_BM02_INPUTS);
  }

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="bm-02"
      data-instance-id={id}
      data-run-id={`${id}-${revision}`}
      data-snapshot-version={revision}
      data-input-revision={revision}
      data-accepted-input-revision={revision}
      data-pending="false"
      {...executionLabelAttributes(executionKind)}
      data-model={accepted.model}
    >
      <header className="lab-heading">
        <p className="eyebrow">The osmotic partition</p>
        <h2 id={`${id}-title`}>{title}</h2>
        <span className="badge">{executionLabelFor(executionKind).text}</span>
      </header>

      <noscript>
        <p className="notice">
          JavaScript is off. The table below shows the complete worked example for the default
          settings and, for comparison, for a 0.01 mol/L sugar solution: both calculated when the
          site was built. Changing settings requires JavaScript.
        </p>
      </noscript>

      <div className="lab-columns">
        <form
          onSubmit={submit}
          aria-label="Osmotic partition settings"
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <fieldset>
            <legend>Model and settings</legend>
            <div className="model-toggle">
              <strong>Model</strong>
              <div className="actions">
                <button
                  type="button"
                  className={accepted.model === "molecular-kinetic" ? "primary" : "secondary"}
                  aria-pressed={accepted.model === "molecular-kinetic"}
                  onClick={() => setModel("molecular-kinetic")}
                >
                  Molecular-kinetic (Einstein §§1–2)
                </button>
                <button
                  type="button"
                  className={
                    accepted.model === "classical-thermodynamics-suspended-bodies"
                      ? "primary"
                      : "secondary"
                  }
                  aria-pressed={accepted.model === "classical-thermodynamics-suspended-bodies"}
                  onClick={() => setModel("classical-thermodynamics-suspended-bodies")}
                >
                  Classical expectation for suspended bodies
                </button>
              </div>
            </div>
            <div className="actions">
              <button type="button" className="secondary" onClick={loadSugarComparison}>
                Compare: 0.01 mol/L sugar solution
              </button>
              <button type="button" className="secondary" onClick={backToDefault}>
                Back to the default suspension
              </button>
            </div>
            <ExperimentSettings contents="particle count, volume, temperature, radius, partition area">
              <div className="input-grid">
                <div className="input-field">
                  <label htmlFor={`${id}-Np`}>
                    Particle count N<sub>p</sub> <span>(count, whole number)</span>
                  </label>
                  <input
                    id={`${id}-Np`}
                    name="Np"
                    type="text"
                    inputMode="numeric"
                    value={draft.Np}
                    onChange={(e) => setDraft({ ...draft, Np: e.target.value })}
                  />
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-V`}>
                    Accessible volume V <span>(μm³)</span>
                  </label>
                  <input
                    id={`${id}-V`}
                    name="V"
                    type="text"
                    inputMode="decimal"
                    value={draft.V_um3}
                    onChange={(e) => setDraft({ ...draft, V_um3: e.target.value })}
                  />
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-T`}>
                    Temperature T <span>(K)</span>
                  </label>
                  <input
                    id={`${id}-T`}
                    name="T"
                    type="text"
                    inputMode="decimal"
                    value={draft.T}
                    onChange={(e) => setDraft({ ...draft, T: e.target.value })}
                  />
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-a`}>
                    Particle radius a <span>(μm; 0.0005 = 0.5 nm)</span>
                  </label>
                  <input
                    id={`${id}-a`}
                    name="a"
                    type="text"
                    inputMode="decimal"
                    value={draft.a_um}
                    onChange={(e) => setDraft({ ...draft, a_um: e.target.value })}
                  />
                </div>
                <div className="input-field">
                  <label htmlFor={`${id}-A`}>
                    Partition area A <span>(μm²)</span>
                  </label>
                  <input
                    id={`${id}-A`}
                    name="A"
                    type="text"
                    inputMode="decimal"
                    value={draft.A_um2}
                    onChange={(e) => setDraft({ ...draft, A_um2: e.target.value })}
                  />
                </div>
              </div>
              <p className="fine">
                Out-of-domain settings are never silently clamped: the table names the admissible
                boundary instead.
              </p>
              <div className="actions">
                <button type="submit">Apply settings</button>
              </div>
            </ExperimentSettings>
          </fieldset>
          {error && (
            <p id={`${id}-error`} role="alert" className="notice error">
              {error}
            </p>
          )}
        </form>
        <AcceptedStatus worked={executionKind === "static-example"} summary={statusSummary} />

        <div className="lab-results">
          <ChamberIllustration count={accepted.Np} admitted={admitted} />

          <div className="table-scroll">
            <table>
              <caption>One accepted calculation, in explicit units</caption>
              <tbody>
                <tr>
                  <th scope="row">Number density n</th>
                  <td data-output="numberDensity">{formatResult(snapshot.numberDensity, "m⁻³")}</td>
                </tr>
                <tr>
                  <th scope="row">Volume fraction φ</th>
                  <td data-output="volumeFraction">
                    {formatResult(snapshot.volumeFraction, "")} (admitted domain: φ ≤ {PHI_MAX})
                  </td>
                </tr>
                <tr>
                  <th scope="row">Osmotic pressure Π</th>
                  <td data-output="osmoticPressure">
                    {formatResult(snapshot.osmoticPressure.result, "Pa")}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Force on partition F = ΠA</th>
                  <td data-output="partitionForce">
                    {formatResult(snapshot.partitionForce.result, "N")}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Equivalent water column h = Π/(ρg)</th>
                  <td data-output="hydrostaticHead">
                    {formatResult(snapshot.hydrostaticHead.result, "m")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* The three counts share a letter and are easy to confuse, so each is named at every
              reading: the one the reader sets, the one the law uses, and the one it does not. */}
          <section
            className="table-scroll"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls must be focusable or its off-screen columns cannot be reached by keyboard at all (am-bc6s)
            tabIndex={0}
            aria-label="Three symbols that are easy to confuse"
          >
            <table>
              <caption>Three symbols that are easy to confuse</caption>
              <tbody>
                <tr>
                  <th scope="row">
                    N<sub>p</sub>
                  </th>
                  <td>
                    How many suspended particles are in the chamber: the count you set,{" "}
                    {accepted.Np.toLocaleString()} here.
                  </td>
                </tr>
                <tr>
                  <th scope="row">n</th>
                  <td>
                    Their number density, N<sub>p</sub> divided by the accessible volume, in
                    particles per cubic metre. The pressure is Π = nkT.
                  </td>
                </tr>
                <tr>
                  <th scope="row">
                    N<sub>A</sub>
                  </th>
                  <td>
                    Avogadro&apos;s number, the molecules in one mole: 6.022 × 10<sup>23</sup>,
                    exact in the 2019 SI. Einstein writes it N. It enters when the pressure is
                    written with the gas constant, R = N<sub>A</sub>k, and this laboratory does not
                    use it.
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {!admitted && "maxAdmittedCount" in snapshot.domain && (
            <p className="notice">
              Above φ = {PHI_MAX}, particle interactions and excluded volume are not modeled by the
              ideal dilute law. At these settings the admissible boundary is at most{" "}
              {snapshot.domain.maxAdmittedCount.toLocaleString()} particles, or at least{" "}
              <Sci value={snapshot.domain.minAdmittedVolume} digits={4} /> m³ of accessible volume.
            </p>
          )}

          {accepted.model === "classical-thermodynamics-suspended-bodies" && (
            <p className="notice">
              This is the pressure §1 attributes to classical thermodynamics for suspended bodies:
              zero, by that model's own reasoning, not a value this instrument calls refuted. What
              decides between the two models is Einstein's predicted displacements (§5), and later
              Perrin's sedimentation equilibrium (1908–1909, dated later evidence).
            </p>
          )}
        </div>
      </div>
      {/* The prediction sits under the instrument in a closed disclosure, as on every other lab;
          open above it, it came between a phone's heading and the partition. */}
      <details className="lab-predict">
        <summary>Predict before you calculate</summary>
        <p id={`${id}-predict-question`}>
          At the same number of particles per volume, does a 1000-times-larger particle push harder,
          the same, or less on the partition?
        </p>
        <fieldset aria-labelledby={`${id}-predict-question`} className="actions">
          <button
            type="button"
            className={predictAnswer === "harder" ? "primary" : "secondary"}
            aria-pressed={predictAnswer === "harder"}
            onClick={() => setPredictAnswer("harder")}
          >
            Harder
          </button>
          <button
            type="button"
            className={predictAnswer === "same" ? "primary" : "secondary"}
            aria-pressed={predictAnswer === "same"}
            onClick={() => setPredictAnswer("same")}
          >
            The same
          </button>
          <button
            type="button"
            className={predictAnswer === "less" ? "primary" : "secondary"}
            aria-pressed={predictAnswer === "less"}
            onClick={() => setPredictAnswer("less")}
          >
            Less
          </button>
        </fieldset>
        {predictAnswer && (
          <p className="fine">
            The model: the ideal osmotic pressure depends on the number of particles per volume, not
            on their size. The size-independence comparison above shows it, with the same calculated
            pressure at 0.5 nm and at 500 nm for the same count per volume.
          </p>
        )}
      </details>

      <section className="lab-bottom">
        <h3>What this model leaves out</h3>
        {NOT_MODELED.map((note) => (
          <p key={note}>• {note}</p>
        ))}
      </section>

      <details>
        <summary>Show the calculation owner and source identity</summary>
        <p>
          Number density, osmotic pressure, the dilute-domain check, partition force, and
          hydrostatic head are computed by <code>src/physics/reference/diffusion/routeA.ts</code>{" "}
          and <code>src/physics/reference/diffusion/distributions.ts</code>, composed (never
          recomputed) by <code>src/experiments/bm02/session.ts</code>.
        </p>
        <p>
          Live terms bind <code>osmoticPressure</code>, <code>numberDensity</code>, and{" "}
          <code>temperature</code>.
        </p>
      </details>
      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(BM02_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(BM02_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(BM02_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(BM02_CAPTION.r3)}
      </p>
    </section>
  );
}
