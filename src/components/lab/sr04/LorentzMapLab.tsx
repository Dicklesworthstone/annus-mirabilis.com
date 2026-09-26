"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { typedOrNaN } from "../../../experiments/controls/typedNumber.ts";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { LabTapeLink, useLabTapeLink } from "../../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import { statusMessage } from "../../../experiments/results/explanations.ts";
import {
  ALL_CONSTRAINTS,
  type ConstraintId,
  joinConstraints,
  SR04_CAPTION,
  SR04_DEFAULTS,
  SR04_NOT_MODELED,
  SR04_OUTPUTS,
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
import { SR04_TAPE } from "../../../experiments/sr04/tape.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { KEPT_RESULT } from "../keptResult.ts";
import { fixed, identity } from "../presentation.ts";
import { Sci } from "../Sci.tsx";
import { withScripts } from "../subscripts.tsx";

const CONSTRAINT_LABELS: Readonly<Record<ConstraintId, string>> = {
  "right-moving-light": "Right-moving light stays at c",
  "left-moving-light": "Left-moving light stays at c",
  reciprocity: "Reciprocity: the map back to K is the same map at −v",
  isotropy: "Isotropy: a(v) = a(−v)",
  "identity-branch": "Identity branch: at v = 0 the map changes nothing",
  "transverse-light": "A light ray across the motion stays at c",
};

/** The two light requirements' residuals are speeds, x′/t′ − c in m/s; the others are pure numbers. */
const LIGHT_RESIDUALS: ReadonlySet<string> = new Set(["right-moving-light", "left-moving-light"]);

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
    // A blank field reaches the validator as NaN and is refused by name, not applied as 0.
    vOverC: typedOrNaN(d.vOverC),
    observerSpeed: typedOrNaN(d.observerSpeed),
    objectSpeed: typedOrNaN(d.objectSpeed),
    candidateA: typedOrNaN(d.candidateA),
    candidateB: typedOrNaN(d.candidateB),
    candidateD: typedOrNaN(d.candidateD),
    candidateTransverseScale: typedOrNaN(d.candidateTransverseScale),
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
      : statusMessage(result.status);
  }
  return `${fixed(result.value, 6)}${unit}`;
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
  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(
    SR04_TAPE,
    session,
    session.acceptedParameters(),
    true,
    (restored) => setDraft(toDraft(restored)),
  );

  const fallback =
    session.getServerSnapshot().accepted ??
    buildSr04Snapshot(`sr04-${id}`, "sr04-init", SR04_DEFAULTS, 0, 0);
  const snapshot = view.accepted ?? fallback;
  const p = snapshot.parameters as Sr04Parameters;
  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation; no example, no earned label.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      SR04_OUTPUTS,
      example?.sourceDigest ?? "",
      snapshot === session.getServerSnapshot().accepted,
    ).label,
  );
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
  const enabled = splitConstraints(p.enabledConstraints);

  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="sr-04"
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input}
      data-accepted-input-revision={snapshot.revisions.input}
      data-pending={String(view.pending)}
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "candidateResiduals")}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">Construct the map</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome
          state={executionKind}
          view={view}
          modelNote={modelNoteFromView(view, { notModeled: `${SR04_NOT_MODELED.join("; ")}.` })}
        />
      </div>

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
            </div>
            <button type="submit">Apply settings</button>
            <ExperimentSettings contents="the slow-case observer and object speeds">
              <div className="input-grid">
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
              <p className="fine">Changes here apply with Apply settings.</p>
            </ExperimentSettings>
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
            {error} {KEPT_RESULT}
          </p>
        )}

        <div className="results" aria-live="polite">
          <h3>Construction result</h3>
          {family.status === "value" && (
            <table>
              <caption>The map the requirements you ticked have fixed.</caption>
              <tbody>
                <tr>
                  <td>a</td>
                  <td>{fixed(family.value.a, 6)}</td>
                </tr>
                <tr>
                  <td>b</td>
                  <td>{fixed(family.value.b, 6)}</td>
                </tr>
                <tr>
                  <td>d (s/m)</td>
                  <td>
                    <Sci value={family.value.d} digits={6} />
                  </td>
                </tr>
                <tr>
                  <td>transverse scale</td>
                  <td>
                    {enabled.includes("transverse-light")
                      ? fixed(family.value.transverseScale, 6)
                      : "not fixed yet: tick the light ray across the motion"}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          {family.status === "underdetermined" && (
            <p>
              Not fixed yet. The requirements you ticked give{" "}
              <strong>{withScripts(family.compatibleFamily)}</strong>. Still to tick:{" "}
              {family.neededInformation
                .map(
                  (need) => (CONSTRAINT_LABELS as Readonly<Record<string, string>>)[need] ?? need,
                )
                .join("; ")}
              .
            </p>
          )}
          {family.status === "residual-report" && (
            <table>
              <caption>{withScripts(family.notes)}</caption>
              <thead>
                <tr>
                  <th scope="col">Requirement</th>
                  <th scope="col">How far it misses (0 means it holds)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(family.residuals).map(([key, value]) => (
                  <tr key={key}>
                    <th scope="row">
                      {(CONSTRAINT_LABELS as Readonly<Record<string, string>>)[key] ?? key}
                    </th>
                    <td>
                      <Sci value={value} digits={3} />
                      {LIGHT_RESIDUALS.has(key) ? " m/s" : ""}
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
              ? `${fixed(evaluation.slowCaseGalilean.value, 6)} m/s`
              : "(unavailable)"}
            {evaluation.slowCaseDeviation.status === "value" && (
              <>
                , and the exact map differs from that by{" "}
                <Sci value={Math.abs(evaluation.slowCaseDeviation.value.difference)} digits={2} />{" "}
                m/s
              </>
            )}
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
                    Eigenvalues on the light lines: {fixed(evaluation.laterAids.eigenvalues[0], 6)}{" "}
                    and {fixed(evaluation.laterAids.eigenvalues[1], 6)}.
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
      {/* The permalink to these settings, after the instrument it links to (dispatch 263). In
          the status row it made that line 267px tall at 1440. */}
      <LabTapeLink link={tapeLink} />

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(SR04_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(SR04_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(SR04_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(SR04_CAPTION.r3)}
      </p>
    </section>
  );
}

export function LorentzMapComparison({ example }: { example?: PreparedSr04Example | undefined }) {
  return <LorentzMapLab example={example} />;
}
