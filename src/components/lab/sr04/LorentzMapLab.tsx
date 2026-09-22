"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  ALL_CONSTRAINTS,
  type ConstraintId,
  joinConstraints,
  SR04_DEFAULTS,
  SR04_NOT_MODELED,
  SR04_QUESTION,
  type Sr04Parameters,
  splitConstraints,
} from "../../../experiments/sr04/definition.ts";
import {
  buildSr04Snapshot,
  createSr04Session,
  evaluateSr04,
  type PreparedSr04Example,
} from "../../../experiments/sr04/session.ts";
import { identity } from "../presentation.ts";
import { Sci } from "../Sci.tsx";

const CONSTRAINT_LABELS: Readonly<Record<ConstraintId, string>> = {
  "right-moving-light": "Right-moving light stays at c",
  "left-moving-light": "Left-moving light stays at c",
  reciprocity: "Reciprocity (inverse map)",
  isotropy: "Isotropy (a(v) = a(-v))",
  "identity-branch": "Identity branch (positive root)",
  "transverse-light": "Transverse light ray",
};

type Draft = Readonly<{
  vOverC: string;
  observerSpeed: string;
  objectSpeed: string;
  candidateA: string;
  candidateB: string;
  candidateD: string;
  candidateTransverseScale: string;
  testCandidate: boolean;
  showLaterAids: boolean;
  enabledConstraints: readonly ConstraintId[];
}>;

function toDraft(p: Sr04Parameters): Draft {
  return {
    vOverC: String(p.vOverC),
    observerSpeed: String(p.observerSpeed),
    objectSpeed: String(p.objectSpeed),
    candidateA: String(p.candidateA),
    candidateB: String(p.candidateB),
    candidateD: String(p.candidateD),
    candidateTransverseScale: String(p.candidateTransverseScale),
    testCandidate: p.testCandidate,
    showLaterAids: p.showLaterAids,
    enabledConstraints: splitConstraints(p.enabledConstraints),
  };
}

function fromDraft(d: Draft): unknown {
  return {
    vOverC: Number(d.vOverC),
    observerSpeed: Number(d.observerSpeed),
    objectSpeed: Number(d.objectSpeed),
    candidateA: Number(d.candidateA),
    candidateB: Number(d.candidateB),
    candidateD: Number(d.candidateD),
    candidateTransverseScale: Number(d.candidateTransverseScale),
    testCandidate: d.testCandidate,
    showLaterAids: d.showLaterAids,
    enabledConstraints: joinConstraints(d.enabledConstraints),
  };
}

function fractionText(
  result: { status: string; value?: number; reason?: string },
  unit: string,
): string {
  if (result.status !== "value" || typeof result.value !== "number") {
    return result.status === "outside-domain" && result.reason
      ? result.reason
      : `(${result.status})`;
  }
  return `${result.value.toFixed(6)}${unit}`;
}

export function LorentzMapLab({
  example,
  title = "Construct the Lorentz map",
}: {
  example?: PreparedSr04Example | undefined;
  title?: string | undefined;
}) {
  const id = useId();
  const [session] = useState(() =>
    createSr04Session(`sr04-${id}`, example?.parameters ?? SR04_DEFAULTS),
  );
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const fallback =
    session.getServerSnapshot().accepted ??
    buildSr04Snapshot(`sr04-${id}`, "sr04-init", SR04_DEFAULTS, 0, 0);
  const snapshot = view.accepted ?? fallback;
  const p = snapshot.parameters as Sr04Parameters;
  const [draft, setDraft] = useState(() => toDraft(p));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const evaluation = evaluateSr04(p);

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

  function toggleConstraint(constraintId: ConstraintId) {
    const next = draft.enabledConstraints.includes(constraintId)
      ? draft.enabledConstraints.filter((c) => c !== constraintId)
      : [...draft.enabledConstraints, constraintId];
    const nextDraft = { ...draft, enabledConstraints: next };
    setDraft(nextDraft);
    apply(fromDraft(nextDraft));
  }

  const family = evaluation.family;

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-04"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      data-execution-label="host"
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">SR-04 &middot; Construct the map</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">Ideal model, host calculation</span>
      </header>

      <p className="lab-question">{SR04_QUESTION}</p>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built,
          at v = {SR04_DEFAULTS.vOverC}c with no construction constraints enabled (the Galilean
          candidate). Changing settings requires JavaScript.
        </p>
      </noscript>

      <div className="lab-columns">
        <form
          onSubmit={submit}
          aria-label="Lorentz map construction settings"
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <fieldset disabled={!ready}>
            <legend>Frame speed and slow case</legend>
            <div className="input-grid">
              <div className="input-field">
                <label htmlFor={`${id}-vOverC`}>
                  Frame speed v <span>(fraction of c, |v/c| &le; 0.95)</span>
                </label>
                <input
                  id={`${id}-vOverC`}
                  name="vOverC"
                  type="text"
                  inputMode="decimal"
                  value={draft.vOverC}
                  onChange={(e) => setDraft({ ...draft, vOverC: e.target.value })}
                />
              </div>
              <div className="input-field">
                <label htmlFor={`${id}-observerSpeed`}>
                  Slow-case observer speed <span>(m/s)</span>
                </label>
                <input
                  id={`${id}-observerSpeed`}
                  name="observerSpeed"
                  type="text"
                  inputMode="decimal"
                  value={draft.observerSpeed}
                  onChange={(e) => setDraft({ ...draft, observerSpeed: e.target.value })}
                />
              </div>
              <div className="input-field">
                <label htmlFor={`${id}-objectSpeed`}>
                  Slow-case object speed <span>(m/s)</span>
                </label>
                <input
                  id={`${id}-objectSpeed`}
                  name="objectSpeed"
                  type="text"
                  inputMode="decimal"
                  value={draft.objectSpeed}
                  onChange={(e) => setDraft({ ...draft, objectSpeed: e.target.value })}
                />
              </div>
            </div>
            <button type="submit">Apply settings</button>
          </fieldset>

          <fieldset disabled={!ready}>
            <legend>Enabled constraints (the engine solves only what you enable)</legend>
            <div className="input-grid">
              {ALL_CONSTRAINTS.map((constraintId) => (
                <label key={constraintId}>
                  <input
                    type="checkbox"
                    checked={draft.enabledConstraints.includes(constraintId)}
                    onChange={() => toggleConstraint(constraintId)}
                  />{" "}
                  {CONSTRAINT_LABELS[constraintId]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset disabled={!ready}>
            <legend>Test a hand-built candidate (never a change to the world)</legend>
            <label>
              <input
                type="checkbox"
                checked={draft.testCandidate}
                onChange={(e) => {
                  const next = { ...draft, testCandidate: e.target.checked };
                  setDraft(next);
                  apply(fromDraft(next));
                }}
              />{" "}
              Test this candidate against the enabled constraints
            </label>
            <div className="input-grid">
              <div className="input-field">
                <label htmlFor={`${id}-candidateA`}>a </label>
                <input
                  id={`${id}-candidateA`}
                  type="text"
                  inputMode="decimal"
                  value={draft.candidateA}
                  onChange={(e) => setDraft({ ...draft, candidateA: e.target.value })}
                />
              </div>
              <div className="input-field">
                <label htmlFor={`${id}-candidateB`}>b </label>
                <input
                  id={`${id}-candidateB`}
                  type="text"
                  inputMode="decimal"
                  value={draft.candidateB}
                  onChange={(e) => setDraft({ ...draft, candidateB: e.target.value })}
                />
              </div>
              <div className="input-field">
                <label htmlFor={`${id}-candidateD`}>d (s/m) </label>
                <input
                  id={`${id}-candidateD`}
                  type="text"
                  inputMode="decimal"
                  value={draft.candidateD}
                  onChange={(e) => setDraft({ ...draft, candidateD: e.target.value })}
                />
              </div>
              <div className="input-field">
                <label htmlFor={`${id}-candidateK`}>transverse scale </label>
                <input
                  id={`${id}-candidateK`}
                  type="text"
                  inputMode="decimal"
                  value={draft.candidateTransverseScale}
                  onChange={(e) => setDraft({ ...draft, candidateTransverseScale: e.target.value })}
                />
              </div>
            </div>
            <button type="submit">Apply candidate</button>
          </fieldset>

          <fieldset disabled={!ready}>
            <legend>Later aids</legend>
            <label>
              <input
                type="checkbox"
                checked={draft.showLaterAids}
                onChange={(e) => {
                  const next = { ...draft, showLaterAids: e.target.checked };
                  setDraft(next);
                  apply(fromDraft(next));
                }}
              />{" "}
              Show the matrix, eigenvalues, and rapidity (later aids; never used to derive the map)
            </label>
          </fieldset>
        </form>

        {error && (
          <p id={`${id}-error`} className="notice" role="alert">
            {error}
          </p>
        )}

        <div className="results" aria-live="polite">
          <h3>Construction result</h3>
          {family.status === "value" && (
            <table>
              <caption>The map every enabled constraint has fixed.</caption>
              <tbody>
                <tr>
                  <td>a</td>
                  <td>{family.value.a.toFixed(6)}</td>
                </tr>
                <tr>
                  <td>b</td>
                  <td>{family.value.b.toFixed(6)}</td>
                </tr>
                <tr>
                  <td>d (s/m)</td>
                  <td>
                    <Sci value={family.value.d} digits={6} />
                  </td>
                </tr>
                <tr>
                  <td>transverse scale</td>
                  <td>{family.value.transverseScale}</td>
                </tr>
              </tbody>
            </table>
          )}
          {family.status === "underdetermined" && (
            <p>
              Not determined by this data: <strong>{family.compatibleFamily}</strong>. Still needed:{" "}
              {family.neededInformation.join(", ")}.
            </p>
          )}
          {family.status === "residual-report" && (
            <table>
              <caption>{family.notes}</caption>
              <tbody>
                {Object.entries(family.residuals).map(([key, value]) => (
                  <tr key={key}>
                    <td>{key}</td>
                    <td>
                      <Sci value={value} digits={3} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {family.status === "outside-domain" && <p className="notice">{family.reason}</p>}

          <h3>The Galilean shelf step</h3>
          <p>
            Slow case (observer {p.observerSpeed} m/s, object {p.objectSpeed} m/s): the ordinary
            change of frame gives{" "}
            {evaluation.slowCaseGalilean.status === "value"
              ? `${evaluation.slowCaseGalilean.value} m/s`
              : "(unavailable)"}
            . Light rays at v = {p.vOverC}c: right-moving{" "}
            {fractionText(evaluation.rightRayFraction, "c")}, left-moving{" "}
            {fractionText(evaluation.leftRayFraction, "c")}.
          </p>
          <p className="fine">
            The slow case needs a slow observer: this is why the observer speed above is entered
            separately from the frame speed v used for the light-ray test.
          </p>

          {draft.showLaterAids && (
            <>
              <h3>Later aids (never a premise of the construction above)</h3>
              <p>
                Lorentz factor: {fractionText(evaluation.laterAids.gammaValue, "")}. Rapidity:{" "}
                {fractionText(evaluation.laterAids.rapidityValue, "")}.
                {evaluation.laterAids.eigenvalues && (
                  <>
                    {" "}
                    Eigenvalues on the light lines: {evaluation.laterAids.eigenvalues[0].toFixed(6)}{" "}
                    and {evaluation.laterAids.eigenvalues[1].toFixed(6)}.
                  </>
                )}
              </p>
            </>
          )}

          <p className="fine">Not modeled: {SR04_NOT_MODELED.join("; ")}.</p>

          <details>
            <summary>The same construction without dragging, color, or a canvas</summary>
            <p>
              Every action here is a checkbox toggle or typed text entry, and every result is a text
              table or sentence. Enable constraints from the checklist, type a hand-built
              candidate's coefficients, and read the residual or the fixed map. No control depends
              on dragging a handle, distinguishing color alone, or reading a canvas.
            </p>
          </details>
        </div>
      </div>
    </section>
  );
}

export function LorentzMapComparison({ example }: { example?: PreparedSr04Example | undefined }) {
  return <LorentzMapLab example={example} />;
}
