"use client";
import { type FormEvent, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import {
  ME02_CAPTION,
  ME02_MODEL,
  ME02_NOT_MODELED,
  ME02_PREDICT_PROMPT,
  type Me02Parameters,
} from "../../experiments/me02/definition.ts";
import { decodeMe02Settings, encodeMe02Settings } from "../../experiments/me02/permalink.ts";
import { validateMe02Parameters } from "../../experiments/me02/parameters.ts";
import { createMe02Session, type PreparedMe02Example } from "../../experiments/me02/session.ts";
import {
  amendAfterReveal,
  beginPrompt,
  keepToSelf,
  type PredictPromptRecord,
  reveal,
  skipPrediction,
  submitPrediction,
} from "../../experiments/predict/predictState.ts";
import { parseResult } from "../../experiments/results/codec.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import type { AcceptedSnapshot, PublishedResult } from "../../experiments/store/instanceStore.ts";
import { PredictPanel } from "./PredictPanel.tsx";
import { display, identity, result } from "./presentation.ts";

type Output = ScientificResult | PublishedResult;

function numericOf(item: Output | undefined): number | null {
  if (!item) return null;
  if (item.status === "value" && typeof item.value === "number") return item.value;
  if (item.status === "analytic-limit" && item.representation.kind === "coefficient") {
    return item.representation.value;
  }
  return null;
}

function OutputReading({ item }: { item: Output | undefined }) {
  if (!item) return <span>missing</span>;
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
  return <span data-quantity-id={quantityId}>{item.status}</span>;
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
      y: 28,
    },
    {
      id: "quadratic",
      label: "Quadratic",
      value: quadratic,
      width: barLength(quadratic, energyPeak),
      y: 52,
    },
    {
      id: "proxy",
      label: "Finite-speed proxy",
      value: proxy,
      width: barLength(proxy, massPeak),
      y: 92,
    },
    {
      id: "limit",
      label: "Limit L/c²",
      value: limit,
      width: barLength(limit, massPeak),
      y: 116,
    },
  ] as const;
  return (
    <svg
      role="img"
      aria-labelledby={`${clipId}-chart`}
      viewBox="0 0 320 148"
      width="100%"
      height="148"
    >
      <title id={`${clipId}-chart`}>
        Bar comparison of exact versus quadratic energy drop, and of the finite-speed proxy versus
        the limiting coefficient. Length encodes the accepted snapshot values; labels do not rely on
        colour.
      </title>
      <text x="8" y="14" fontSize="11">
        Energy of motion drop
      </text>
      <text x="8" y="78" fontSize="11">
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
            fillOpacity={row.id === "quadratic" || row.id === "limit" ? 0.45 : 0.85}
          />
        </g>
      ))}
    </svg>
  );
}

export function CoefficientLab({
  example,
  title = "Inertia from the small-speed coefficient",
}: {
  example: PreparedMe02Example;
  title?: string;
}) {
  const id = useId();
  const [session] = useState(() => createMe02Session(`me02-${id}`, example));
  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  const accepted = view.accepted ?? session.getServerSnapshot().accepted;
  if (!accepted) {
    throw new Error("Missing accepted snapshot for CoefficientLab");
  }
  const snapshot = accepted;
  const p = snapshot.parameters as Me02Parameters;
  const [draft, setDraft] = useState(() => ({ ...example.parameters }));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [predictRecord, setPredictRecord] = useState<PredictPromptRecord>(() =>
    beginPrompt(ME02_PREDICT_PROMPT.promptId),
  );
  const linkLoaded = useRef(false);
  useEffect(() => {
    if (linkLoaded.current) return;
    linkLoaded.current = true;
    const linked = decodeMe02Settings(window.location.search);
    if (linked.kind === "invalid") setError(`${linked.message} The prepared example is unchanged.`);
    if (linked.kind === "settings") {
      const outcome = session.apply(linked.parameters);
      if (outcome.kind === "accepted") setDraft(linked.parameters);
      else setError(outcome.refusal.message);
    }
    setReady(true);
  }, [session]);
  function apply(parameters: Me02Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      setError(outcome.refusal.message);
      return;
    }
    setDraft(parameters);
    setError("");
    setPredictRecord((current) => {
      if (
        current.state === "predicted" ||
        current.state === "predicted-unrecorded" ||
        current.state === "skipped"
      ) {
        return reveal(current);
      }
      return current;
    });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateMe02Parameters(draft);
    if (checked.kind !== "accepted") {
      setError(checked.refusal.message);
      return;
    }
    apply(checked.data);
  }
  const at06 = example.results.map(parseResult);
  const at001 = example.comparisonResults.map(parseResult);
  const find = (outputs: ReturnType<typeof parseResult>[], quantityId: string) =>
    outputs.find((item) => item.quantityId === quantityId);
  const printed = example.printedConversion;
  return (
    <section
      className="laboratory"
      aria-labelledby={`${id}-title`}
      data-instrument-id="me-02"
      data-settings-ready={ready}
      {...identity(snapshot)}
      data-input-revision={view.requested?.revisions.input ?? snapshot.revisions.input}
      data-accepted-input-revision={snapshot.revisions.input}
      data-execution-label="host"
      data-source-digest={example.sourceDigest}
    >
      <header className="lab-heading">
        <div>
          <p className="eyebrow">ME-02 · An executable model</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <span className="badge">{ME02_MODEL.label}</span>
      </header>
      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built.
          The table, named-speed comparison, model assumptions and explanations remain available;
          changing the settings requires JavaScript.
        </p>
      </noscript>
      <p data-detail="0">{ME02_CAPTION.r0}</p>
      <p data-detail="1">{ME02_CAPTION.r1}</p>
      <p data-detail="2" hidden>
        {ME02_CAPTION.r2}
      </p>
      <p data-detail="3" hidden>
        {ME02_CAPTION.r3}
      </p>
      <p>
        Type a speed, choose what to read, and compare 0.6c with 0.01c. The plot and table change
        together after you apply valid settings. No dragging is required.
      </p>
      <div className="lab-columns">
        <form
          onSubmit={submit}
          aria-label="Mass-energy coefficient settings"
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <fieldset disabled={!ready}>
            <legend>Set the observer speed and the emitted energy</legend>
            <div className="input-grid">
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
                  value={draft.beta}
                  onChange={(event) =>
                    setDraft({ ...draft, beta: Number(event.currentTarget.value) })
                  }
                />
              </div>
              <div className="input-field">
                <label htmlFor={`${id}-emittedEnergy`}>Emitted energy L</label>
                <input
                  id={`${id}-emittedEnergy`}
                  type="number"
                  name="emittedEnergy"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={draft.emittedEnergy}
                  onChange={(event) =>
                    setDraft({ ...draft, emittedEnergy: Number(event.currentTarget.value) })
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
            <div className="preset-list">
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
              <button type="button" className="secondary" onClick={() => apply({ ...p, beta: 0 })}>
                Show vanishing speed
              </button>
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={draft.showNaive}
                onChange={(event) => setDraft({ ...draft, showNaive: event.currentTarget.checked })}
              />{" "}
              Show the naive evaluation of gamma minus one (diagnostic only)
            </label>
            <p className="fine">Changing the input unit reinterprets the entered number and creates a new setup. Physical outputs use joules and kilograms; normalized mode uses c = 1 and normalized energy and mass units.</p>
            <button type="submit">Apply settings</button>
            <p><a data-settings-permalink href={encodeMe02Settings(p)}>Permalink to the accepted configuration</a></p>
            {error ? (
              <p id={`${id}-error`} className="notice" role="alert">
                {error}
              </p>
            ) : null}
          </fieldset>
        </form>
        <div className="lab-results">
          <PredictPanel
            prompt={ME02_PREDICT_PROMPT}
            record={predictRecord}
            onRecord={(choice) => setPredictRecord((current) => submitPrediction(current, choice))}
            onSkip={() => setPredictRecord((current) => skipPrediction(current))}
            onKeepToSelf={() => setPredictRecord((current) => keepToSelf(current))}
            onAmend={(choice) => setPredictRecord((current) => amendAfterReveal(current, choice))}
          />
          <div
            data-response=""
            hidden={
              ready &&
              (predictRecord.state === "hidden" ||
                predictRecord.state === "predicted" ||
                predictRecord.state === "predicted-unrecorded")
            }
          >
            <h3>Accepted snapshot</h3>
            <table>
              <caption>
                Outputs from the host calculation. Presentation does not recompute them.
                {p.energyUnit === "normalized" ? " Normalized energy and mass units (c = 1)." : " Energy in joules; mass in kilograms. Erg inputs are converted to SI before calculation."}
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
            <CoefficientBars snapshot={snapshot} clipId={id} />
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
              Printed mass change {display(printed.printedGrams)} g ({printed.printedConstantSetId})
              for L = {display(printed.emittedEnergyErg)} erg. Modern mass change{" "}
              {display(printed.modernGrams)} g ({printed.modernConstantSetId}). {printed.wording}.
            </p>
          </div>
        </div>
      </div>
      <p className="fine">Not modeled: {ME02_NOT_MODELED.join("; ")}.</p>
    </section>
  );
}

export function CoefficientComparison({ example }: { example: PreparedMe02Example }) {
  return <CoefficientLab example={example} />;
}
