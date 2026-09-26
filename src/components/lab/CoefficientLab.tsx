"use client";
import { type FormEvent, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { getKernelListingsForInstrument } from "../../content/kernel/listings.ts";
import { EquationScope } from "../../equations/EquationScope.tsx";
import { SemanticEquation } from "../../equations/SemanticEquation.tsx";
import type { CompiledEquation } from "../../equations/viewTypes.ts";
import { readTypedNumber } from "../../experiments/controls/typedNumber.ts";
import { ExecutionChrome } from "../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../experiments/labels/modelNoteData.ts";
import { labelRootAttributes } from "../../experiments/labels/resultAttributes.ts";
import {
  ME02_CAPTION,
  ME02_NOT_MODELED,
  ME02_OUTPUTS,
  type Me02Parameters,
} from "../../experiments/me02/definition.ts";
import { validateMe02Parameters } from "../../experiments/me02/parameters.ts";
import { decodeMe02Settings } from "../../experiments/me02/permalink.ts";
import { createMe02Session, type PreparedMe02Example } from "../../experiments/me02/session.ts";
import { ME02_TAPE } from "../../experiments/me02/tape.ts";
import { LabTapeLink, useLabTapeLink } from "../../experiments/permalink/LabTapeLink.tsx";
import { deriveHostExecution } from "../../experiments/provenance/executionState.ts";
import { parseResult } from "../../experiments/results/codec.ts";
import { statusMessage } from "../../experiments/results/explanations.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import { instrumentRootAttributes } from "../../experiments/store/identityAttributes.ts";
import type { AcceptedSnapshot, PublishedResult } from "../../experiments/store/instanceStore.ts";
import { ExperimentSettings } from "./ExperimentSettings.tsx";
import { KEPT_RESULT } from "./keptResult.ts";
import { PredictGatePanels, usePredictGate, withPredictions } from "./PredictGate.tsx";
import { ShowTheCode } from "./ShowTheCode.tsx";
import "./coefficientLab.css";
import { refusalSentence } from "../../experiments/results/refusalSentence.ts";
import { PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";
import { display, identity, result } from "./presentation.ts";
import { withScripts } from "./subscripts.tsx";

type Output = ScientificResult | PublishedResult;

/** Reader names for the two constant sets of the printed-factor comparison; the ids stay in data attributes. */
const CONSTANT_SET_NAMES: Readonly<Record<string, string>> = Object.freeze({
  "einstein-1905-mass-energy-printed": "the paper's printed constants",
  "modern-si-2019": "2019 SI",
});
function ConstantSetName({ id }: { id: string }) {
  return (
    <span data-constant-set={id}>{CONSTANT_SET_NAMES[id] ?? "its declared constant set"}</span>
  );
}

function numericOf(item: Output | undefined): number | null {
  if (!item) return null;
  if (item.status === "value" && typeof item.value === "number") return item.value;
  if (item.status === "analytic-limit" && item.representation.kind === "coefficient") {
    return item.representation.value;
  }
  return null;
}

function OutputReading({ item }: { item: Output | undefined }) {
  if (!item) return <span>Not computed at these settings.</span>;
  const quantityId = item.quantityId;
  const value = numericOf(item);
  if (item.status === "analytic-limit" && value !== null) {
    return (
      <span data-quantity-id={quantityId} data-status="analytic-limit">
        {display(value)} (analytic limit)
      </span>
    );
  }
  if (item.status === "value" && value !== null) {
    return <span data-quantity-id={quantityId}>{display(value)}</span>;
  }
  if (item.status === "not-applicable" || item.status === "outside-domain") {
    return <span data-quantity-id={quantityId}>{item.reason}</span>;
  }
  return <span data-quantity-id={quantityId}>{statusMessage(item.status)}</span>;
}

function SnapshotReading({
  snapshot,
  quantityId,
}: {
  snapshot: AcceptedSnapshot;
  quantityId: string;
}) {
  return <OutputReading item={result(snapshot, quantityId)} />;
}

function barLength(value: number | null, peak: number): number {
  if (value === null || peak <= 0) return 0;
  return (Math.abs(value) / peak) * 200;
}

function CoefficientBars({ snapshot, clipId }: { snapshot: AcceptedSnapshot; clipId: string }) {
  const exact = numericOf(result(snapshot, "kineticEnergyDifference"));
  const quadratic = numericOf(result(snapshot, "quadraticKineticDifference"));
  const proxy = numericOf(result(snapshot, "finiteSpeedMassProxy"));
  const limit = numericOf(result(snapshot, "inertialMassDecrease"));
  const energyPeak = Math.max(Math.abs(exact ?? 0), Math.abs(quadratic ?? 0), 1e-18);
  const massPeak = Math.max(Math.abs(proxy ?? 0), Math.abs(limit ?? 0), 1e-18);
  const rows = [
    {
      id: "exact",
      label: "Exact L(γ−1)",
      value: exact,
      width: barLength(exact, energyPeak),
      y: 40,
    },
    {
      id: "quadratic",
      label: "Quadratic",
      value: quadratic,
      width: barLength(quadratic, energyPeak),
      y: 68,
    },
    {
      id: "proxy",
      label: "Finite-speed proxy",
      value: proxy,
      width: barLength(proxy, massPeak),
      y: 126,
    },
    {
      id: "limit",
      label: "Limit L/c²",
      value: limit,
      width: barLength(limit, massPeak),
      y: 154,
    },
  ] as const;
  return (
    <svg
      role="img"
      aria-labelledby={`${clipId}-chart`}
      viewBox="0 0 320 172"
      width="100%"
      height="172"
    >
      <title id={`${clipId}-chart`}>
        Bar comparison of exact versus quadratic energy drop, and of the finite-speed proxy versus
        the limiting coefficient. Length encodes the accepted snapshot values; labels do not rely on
        colour.
      </title>
      {/* Rows sit 28 units apart and each label 4 above its bar: laid out for the 11-unit
          text .me02-bars sets. At the old 24-unit pitch a group title and its first label
          overlapped ("Energy of motion drop" over "Exact L(γ−1)"). */}
      <text x="8" y="16" fontSize="11">
        Energy of motion drop
      </text>
      <text x="8" y="102" fontSize="11">
        Mass coefficient
      </text>
      {rows.map((row) => (
        <g key={row.id} data-bar={row.id} data-width={String(row.width)}>
          <text x="8" y={row.y - 4} fontSize="10">
            {row.label}
            {row.value === null ? "" : ` ${display(row.value)}`}
          </text>
          <rect
            x="8"
            y={row.y}
            width={row.width}
            height="10"
            fill="currentColor"
            // The approximation's bar is the lighter one. At 0.45 it stood at 2.34:1 on the light
            // paper, under the 3:1 a mark needs; at 0.6 it is 3.33:1 there (5.54:1 on the dark
            // paper) and still a shade apart from the exact bar, whose label also names it.
            fillOpacity={row.id === "quadratic" || row.id === "limit" ? 0.6 : 0.85}
          />
        </g>
      ))}
    </svg>
  );
}

// The manifest's prompts (scripts/generate-predict-prompts.mjs), one stable array for the gate. They
// replace ME02_PREDICT_PROMPT, which PredictPanel's and predictReveal's tests still read, and add
// the manifest's second prompt, toward low speed.
const ME02_PROMPTS = PREDICT_PROMPTS["me-02"] ?? [];

/** The typed fields, kept as the reader typed them and read on Apply (dispatch 170). */
type Me02Typed = { beta: string; emittedEnergy: string };
function typedFrom(q: Me02Parameters): Me02Typed {
  return { beta: String(q.beta), emittedEnergy: String(q.emittedEnergy) };
}

export function CoefficientLab({
  example,
  title = "Inertia from the small-speed coefficient",
  equations = [],
  restoreSettings = false,
}: {
  example: PreparedMe02Example;
  title?: string;
  equations?: readonly CompiledEquation[];
  restoreSettings?: boolean;
}) {
  const id = useId();
  const [session] = useState(() => createMe02Session(`me02-${id}`, example));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  // A shared ?tape= link restores through this laboratory's own session (am-inst-permalink-tape-s677).
  const tapeLink = useLabTapeLink(
    ME02_TAPE,
    session,
    session.acceptedParameters(),
    true,
    (restored) => {
      setDraft({ ...restored });
      setTyped(typedFrom(restored));
    },
  );
  const accepted = view.accepted ?? session.getServerSnapshot().accepted;
  if (!accepted) {
    throw new Error("Missing accepted snapshot for CoefficientLab");
  }
  const snapshot = accepted;
  const p = snapshot.parameters as Me02Parameters;
  const [draft, setDraft] = useState(() => ({ ...example.parameters }));
  // A number field hands "" for a cleared field or for "abc"; stored as Number(value) that was 0,
  // applied as v/c = 0 without a word. The text is read on Apply instead.
  const [typed, setTyped] = useState(() => typedFrom(example.parameters));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  // Predict mode (am-inst-predict-mode-ti7m): the result waits for the reader's answer.
  const gate = usePredictGate("me-02", ME02_PROMPTS);
  const linkLoaded = useRef(false);
  useEffect(() => {
    if (linkLoaded.current) return;
    linkLoaded.current = true;
    const linked = restoreSettings ? decodeMe02Settings(window.location.search) : null;
    if (linked?.kind === "invalid")
      setError(`${linked.message} The prepared example is unchanged.`);
    if (linked?.kind === "settings") {
      const outcome = session.apply(linked.parameters);
      if (outcome.kind === "accepted") {
        setDraft(linked.parameters);
        setTyped(typedFrom(linked.parameters));
      } else setError(refusalSentence(outcome.refusal));
    }
    setReady(true);
  }, [session, restoreSettings]);
  function apply(parameters: Me02Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      setError(refusalSentence(outcome.refusal));
      return;
    }
    setDraft(parameters);
    setTyped(typedFrom(parameters));
    setError("");
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const beta = readTypedNumber(typed.beta, "the observer speed v/c");
    if (beta.kind === "refused") return setError(beta.requirement);
    const energy = readTypedNumber(typed.emittedEnergy, "the emitted energy L");
    if (energy.kind === "refused") return setError(energy.requirement);
    const checked = validateMe02Parameters({
      ...draft,
      beta: beta.value,
      emittedEnergy: energy.value,
    });
    if (checked.kind !== "accepted") {
      setError(refusalSentence(checked.refusal));
      return;
    }
    apply(checked.data);
  }
  const at06 = example.results.map(parseResult);
  const at001 = example.comparisonResults.map(parseResult);
  const find = (outputs: ReturnType<typeof parseResult>[], quantityId: string) =>
    outputs.find((item) => item.quantityId === quantityId);
  const printed = example.printedConversion;
  const execution = deriveHostExecution(
    view,
    ME02_OUTPUTS,
    example.sourceDigest,
    snapshot === session.getServerSnapshot().accepted,
  );
  // The label is earned from the derived state: the build-time example reads as a static worked
  // example, an accepted recalculation as a host calculation (am-inst-execution-labels-5ywv).
  const executionKind = executionStateKindFromHostLabel(execution.label);
  const boundEquations = equations.filter(
    (equation) =>
      equation.paper === "mass-energy" &&
      equation.bindings.length > 0 &&
      equation.bindings.every((binding) => binding.experimentId === "me-02"),
  );
  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="me-02"
      data-settings-ready={ready}
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input ?? snapshot.revisions.input}
      data-accepted-input-revision={snapshot.revisions.input}
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "kineticEnergyDifference")}
      data-source-digest={example.sourceDigest}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">An executable model</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
      </header>
      <div className="lab-status-row">
        <ExecutionChrome
          state={executionKind}
          view={view}
          modelNote={modelNoteFromView(view, { notModeled: `${ME02_NOT_MODELED.join("; ")}.` })}
        />
      </div>
      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          The table, named-speed comparison, model assumptions and explanations remain available;
          changing the settings requires JavaScript.
        </p>
      </noscript>
      {/* Absolute, so the embed (which has no #coefficient-argument) opens the laboratory's own
          section rather than a link that goes nowhere (labFragmentLinks.test.tsx). */}
      <PredictGatePanels gate={gate} reasoningHref="/lab/me-02/#coefficient-argument" />
      <div className="lab-columns">
        <div>
          <form
            noValidate
            onSubmit={submit}
            aria-label="Mass-energy coefficient settings"
            aria-describedby={error ? `${id}-error` : undefined}
          >
            <fieldset disabled={!ready}>
              <legend>Set the observer speed and the emitted energy</legend>
              <div className="lab-choice">
                <p className="fine">Compare 0.6c with 0.01c, or type a speed below.</p>
                <div className="actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => apply({ ...p, beta: 0.6 })}
                  >
                    Show 0.6c
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => apply({ ...p, beta: 0.01 })}
                  >
                    Show 0.01c
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => apply({ ...p, beta: 0 })}
                  >
                    Show vanishing speed
                  </button>
                </div>
              </div>
              <div className="input-field">
                <label htmlFor={`${id}-beta`}>Observer speed v/c</label>
                <input
                  id={`${id}-beta`}
                  type="number"
                  name="beta"
                  inputMode="decimal"
                  step="0.01"
                  min="-0.95"
                  max="0.95"
                  value={typed.beta}
                  onChange={(event) => setTyped({ ...typed, beta: event.currentTarget.value })}
                />
              </div>
              <button type="submit">Apply settings</button>
              <ExperimentSettings contents="emitted energy, energy unit, a diagnostic">
                <div className="input-grid">
                  <div className="input-field">
                    <label htmlFor={`${id}-emittedEnergy`}>Emitted energy L</label>
                    <input
                      id={`${id}-emittedEnergy`}
                      type="number"
                      name="emittedEnergy"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={typed.emittedEnergy}
                      onChange={(event) =>
                        setTyped({ ...typed, emittedEnergy: event.currentTarget.value })
                      }
                    />
                  </div>
                  <div className="input-field">
                    <label htmlFor={`${id}-energyUnit`}>Energy unit</label>
                    <select
                      id={`${id}-energyUnit`}
                      name="energyUnit"
                      value={draft.energyUnit}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          energyUnit: event.currentTarget.value as Me02Parameters["energyUnit"],
                        })
                      }
                    >
                      <option value="normalized">normalized (c = 1)</option>
                      <option value="erg">erg</option>
                      <option value="joule">joule</option>
                    </select>
                  </div>
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={draft.showNaive}
                    onChange={(event) =>
                      setDraft({ ...draft, showNaive: event.currentTarget.checked })
                    }
                  />{" "}
                  Show the naive evaluation of γ − 1 (a diagnostic only)
                </label>
                <p className="fine">
                  Changing the input unit reinterprets the entered number and creates a new setup.
                  Physical outputs use joules and kilograms; normalized mode uses c = 1 and
                  normalized energy and mass units.
                </p>
              </ExperimentSettings>
              {error ? (
                <p id={`${id}-error`} className="notice" role="alert">
                  {error} {KEPT_RESULT}
                </p>
              ) : null}
            </fieldset>
          </form>
        </div>
        <div className="lab-results" {...gate.response}>
          <div data-response="">
            <div className="me02-bars">
              <CoefficientBars snapshot={snapshot} clipId={id} />
            </div>
            <h3>Values at these settings</h3>
            <table>
              <caption>
                Outputs from the host calculation. Presentation does not recompute them.
                {p.energyUnit === "normalized"
                  ? " Normalized energy and mass units (c = 1)."
                  : " Energy in joules; mass in kilograms. Erg inputs are converted to SI before calculation."}
              </caption>
              <tbody>
                <tr>
                  <th scope="row">Exact difference L(γ−1)</th>
                  <td>
                    <SnapshotReading snapshot={snapshot} quantityId="kineticEnergyDifference" />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Quadratic estimate</th>
                  <td>
                    <SnapshotReading snapshot={snapshot} quantityId="quadraticKineticDifference" />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Finite-speed proxy</th>
                  <td>
                    <SnapshotReading snapshot={snapshot} quantityId="finiteSpeedMassProxy" />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Limiting coefficient L/c²</th>
                  <td>
                    <SnapshotReading snapshot={snapshot} quantityId="inertialMassDecrease" />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Signed mass change</th>
                  <td>
                    <SnapshotReading snapshot={snapshot} quantityId="massChangeSigned" />
                  </td>
                </tr>
                {p.showNaive ? (
                  <tr>
                    <th scope="row">Naive γ−1 (diagnostic)</th>
                    <td>
                      <SnapshotReading snapshot={snapshot} quantityId="naiveGammaMinusOne" />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <h3>Named-speed comparison (worked example)</h3>
            <p>
              At 0.6c versus 0.01c, with L = 1 in normalized units. These two columns were
              calculated at build time.
            </p>
            <table>
              <thead>
                <tr>
                  <th scope="col">Quantity</th>
                  <th scope="col">0.6c</th>
                  <th scope="col">0.01c</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Exact difference</th>
                  <td>
                    <OutputReading item={find(at06, "kineticEnergyDifference")} />
                  </td>
                  <td>
                    <OutputReading item={find(at001, "kineticEnergyDifference")} />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Quadratic estimate</th>
                  <td>
                    <OutputReading item={find(at06, "quadraticKineticDifference")} />
                  </td>
                  <td>
                    <OutputReading item={find(at001, "quadraticKineticDifference")} />
                  </td>
                </tr>
                <tr>
                  <th scope="row">Finite-speed proxy</th>
                  <td>
                    <OutputReading item={find(at06, "finiteSpeedMassProxy")} />
                  </td>
                  <td>
                    <OutputReading item={find(at001, "finiteSpeedMassProxy")} />
                  </td>
                </tr>
              </tbody>
            </table>
            <p>
              Printed mass change {display(printed.printedGrams)} g (
              <ConstantSetName id={printed.printedConstantSetId} />) for L ={" "}
              {display(printed.emittedEnergyErg)} erg; modern mass change{" "}
              {display(printed.modernGrams)} g (<ConstantSetName id={printed.modernConstantSetId} />
              ): {printed.wording}.
            </p>
          </div>
        </div>
      </div>
      {/* The permalink to these settings, after the instrument it links to (dispatch 263): in the
          status row it made that line 267px tall at 1440. */}
      <LabTapeLink link={withPredictions(tapeLink, gate)} />
      {/* The caption's readings follow the instrument (dispatch 263). Above the predict gate they
          pushed the instrument more than 1000px down at 1440; every sentence is still here. */}
      <p data-detail="0">{withScripts(ME02_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(ME02_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(ME02_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(ME02_CAPTION.r3)}
      </p>

      {boundEquations.length > 0 && (
        <section
          id={restoreSettings ? "coefficient-equations" : `${id}-equations`}
          aria-labelledby={`${id}-equations-title`}
          data-coefficient-equations
        >
          <h3 id={`${id}-equations-title`}>Explore the accepted result, term by term</h3>
          <p>
            Only declared result terms read this laboratory's accepted snapshot. Body energies, the
            unknown offset and unbound inputs stay symbolic. A draft edit does not change these
            values.
          </p>
          {p.energyUnit === "normalized" && (
            <p className="notice" data-equation-unit-notice>
              The current example uses normalized units (c = 1). These SI equations remain symbolic.
              Choose joule or erg and apply settings to attach physical-unit results.
            </p>
          )}
          <EquationScope
            scope={`me02-${id}`}
            slots={[{ slot: "primary", experimentId: "me-02", view, execution }]}
          >
            {boundEquations.map((equation) => (
              <details key={equation.id}>
                <summary>{equation.title}</summary>
                <SemanticEquation equation={equation} />
              </details>
            ))}
          </EquationScope>
          <p>
            <a href="/papers/mass-energy/#arg-me-constant-premise">
              Return to the unchanged-offset premise →
            </a>
          </p>
        </section>
      )}
      {/* The kernel's own source, extracted at build time with its hash pinned (src/content/kernel). */}
      {/* The one kernel computes every bound result, so its Mathematics shows them, linked to the
          explorer above; a lab with no bound equations shows no Mathematics heading at all. */}
      <ShowTheCode
        instrumentId="me-02"
        listings={getKernelListingsForInstrument("me-02")}
        equations={{ evaluateMe02: boundEquations }}
        explorerHref={
          boundEquations.length > 0
            ? `#${restoreSettings ? "coefficient-equations" : `${id}-equations`}`
            : undefined
        }
      />
      <p className="fine">Not modeled: {ME02_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}

export function CoefficientComparison({
  example,
  equations = [],
}: {
  example: PreparedMe02Example;
  equations?: readonly CompiledEquation[];
}) {
  return <CoefficientLab example={example} equations={equations} restoreSettings />;
}
