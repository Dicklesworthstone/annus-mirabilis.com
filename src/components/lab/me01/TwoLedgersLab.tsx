"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { getKernelListingsForInstrument } from "../../../content/kernel/listings.ts";
import { ExecutionChrome } from "../../../experiments/labels/ExecutionChrome.tsx";
import { executionStateKindFromHostLabel } from "../../../experiments/labels/executionLabelFor.ts";
import { modelNoteFromView } from "../../../experiments/labels/modelNoteData.ts";
import { executionLabelAttributes } from "../../../experiments/labels/resultAttributes.ts";
import { fromMe01Draft, type Me01Draft, toMe01Draft } from "../../../experiments/me01/controls.ts";
import {
  ME01_CAPTION,
  ME01_DEFAULTS,
  ME01_NOT_MODELED,
  ME01_OUTPUTS,
  ME01_PRESETS,
  type Me01Notation,
  type Me01OffsetDisplay,
  type Me01Parameters,
  type Me01Premise,
  type Me01Step,
} from "../../../experiments/me01/definition.ts";
import { decodeMe01Settings, encodeMe01Settings } from "../../../experiments/me01/permalink.ts";
import {
  createMe01Session,
  evaluateMe01,
  type PreparedMe01Example,
} from "../../../experiments/me01/session.ts";
import { deriveHostExecution } from "../../../experiments/provenance/executionState.ts";
import { instrumentRootAttributes } from "../../../experiments/store/identityAttributes.ts";
import { ExperimentSettings } from "../ExperimentSettings.tsx";
import { KEPT_RESULT } from "../keptResult.ts";
import { ShowTheCode } from "../ShowTheCode.tsx";
import { SliderField } from "../SliderField.tsx";
import { withScripts } from "../subscripts.tsx";
import { TwoLedgersPlot } from "./TwoLedgersPlot.tsx";
import "../labControls.css";
import "./me01.css";
import "../showTheCode.css";
import { PREDICT_PROMPTS } from "../../../generated/predict-prompts.ts";
import { AcceptedStatus } from "../AcceptedStatus.tsx";
import { PredictGatePanels, usePredictGate } from "../PredictGate.tsx";
import { sentenceNumber } from "../presentation.ts";

const STEPS: readonly { id: Me01Step; label: string; number: number }[] = [
  { id: "intro", label: "1. The setup", number: 1 },
  { id: "moving-pulses", label: "2. Moving pulses", number: 2 },
  { id: "sum-angle", label: "3. The two pulses summed", number: 3 },
  { id: "two-balances", label: "4. Two balances", number: 4 },
  { id: "subtraction-move", label: "5. The subtraction", number: 5 },
  { id: "premise-kinetic", label: "6. Kinetic drop", number: 6 },
];

// The manifest's prompt (scripts/generate-predict-prompts.mjs), one stable array for the gate. It
// replaces the lab's use of ME01_PROMPTS, a TypeScript copy me01.test.ts still reads.
const ME01_PREDICT_PROMPTS = PREDICT_PROMPTS["me-01"] ?? [];

export function TwoLedgersLab({
  example,
  title = "Two ledgers and opposite pulses",
}: {
  example?: PreparedMe01Example | undefined;
  title?: string | undefined;
}) {
  const id = useId();
  const [session] = useState(() =>
    createMe01Session(`me01-${id}`, example?.parameters ?? ME01_DEFAULTS),
  );

  const view = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );

  const fallbackParams = example?.parameters ?? ME01_DEFAULTS;
  const accepted = view.accepted;
  // Earned per snapshot (am-inst-execution-labels-5ywv): the build-time example is a static worked
  // example, an accepted recalculation a host calculation; an example without a source digest
  // earns no label at all.
  const executionKind = executionStateKindFromHostLabel(
    deriveHostExecution(
      view,
      ME01_OUTPUTS,
      example?.sourceDigest ?? "",
      accepted !== undefined && accepted === session.getServerSnapshot().accepted,
    ).label,
  );
  const p = (accepted?.parameters ?? fallbackParams) as Me01Parameters;
  const [draft, setDraft] = useState(() => toMe01Draft(p));
  const [error, setError] = useState("");
  const [refusalCode, setRefusalCode] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState("");
  const [linkPending, setLinkPending] = useState(false);
  const [sharedUrl, setSharedUrl] = useState("");
  // Predict mode (am-inst-predict-mode-ti7m): the result waits for the reader's answer.
  const gate = usePredictGate("me-01", ME01_PREDICT_PROMPTS);

  const evaluation = evaluateMe01(p);
  // One sentence for the status line: what the two pulses carry in the moving frame, and what the
  // body's kinetic energy loses there.
  const numberIn = (item: { status: string; value?: unknown }) =>
    item.status === "value" && typeof item.value === "number" ? item.value : null;
  const pulseSum = numberIn(evaluation.pulseSumMoving);
  const kineticLoss = numberIn(evaluation.kineticEnergyDifference);
  const statusSummary =
    pulseSum === null
      ? "the moving frame's pulse energies are not computed at these settings."
      : `a body emits ${sentenceNumber(p.emittedEnergyRestFrame)} L of light in its rest frame; seen from a frame moving at ${sentenceNumber(p.frameSpeed)}c the two pulses carry ${sentenceNumber(pulseSum)} L together${kineticLoss === null ? "" : `, and the body's kinetic energy falls by ${sentenceNumber(kineticLoss)} L`}.`;

  useEffect(() => {
    const shared = decodeMe01Settings(window.location.search);
    if (shared.kind === "settings") {
      setDraft(toMe01Draft(shared.parameters));
      setLinkPending(true);
      setLinkNote(
        "The link's settings are in the fields. The drawing still shows the worked example until you calculate them.",
      );
    } else if (shared.kind === "invalid") {
      setLinkNote(shared.message);
    }
  }, []);

  function apply(parameters: Me01Parameters) {
    const outcome = session.apply(parameters);
    if (outcome.kind === "refused") {
      const details = outcome.refusal.details;
      const req =
        typeof details?.requirements === "string" ? details.requirements : outcome.refusal.message;
      const code = typeof details?.code === "string" ? details.code : null;
      setError(req);
      setRefusalCode(code);
      return;
    }
    setError("");
    setRefusalCode(null);
    setLinkNote("");
    setLinkPending(false);
  }

  /** Validate a whole draft and apply it; the typed fields and the sliders both end here. */
  function commitDraft(next: Me01Draft) {
    setDraft(next);
    const parsed = fromMe01Draft(next);
    if (
      !Number.isFinite(parsed.frameSpeed) ||
      !Number.isFinite(parsed.emittedEnergyRestFrame) ||
      !Number.isFinite(parsed.emissionAngle)
    ) {
      setError("Type a number in each field.");
      setRefusalCode("nonfinite-input");
      return;
    }
    if (Math.abs(parsed.frameSpeed) >= 1) {
      setError("No inertial observer moves at or above the speed of light (|v/c| < 1).");
      setRefusalCode("superluminal-observer");
      return;
    }
    if (parsed.emittedEnergyRestFrame <= 0) {
      setError("Enter an emitted energy L greater than zero.");
      setRefusalCode(null);
      return;
    }
    setLinkPending(false);
    apply(parsed);
  }

  type NumericKey = "frameSpeed" | "emissionAngle" | "emittedEnergyRestFrame";
  function field(key: NumericKey) {
    return {
      id: `${key}-${id}`,
      value: draft[key],
      onDraft: (v: string) => setDraft({ ...draft, [key]: v }),
      onCommit: (v: string) => commitDraft({ ...draft, [key]: v }),
    };
  }

  function loadPreset(presetId: string) {
    const found = ME01_PRESETS.find((pr) => pr.presetId === presetId);
    if (!found) return;
    const nextParams: Me01Parameters = {
      ...p,
      ...found.parameterValues,
    };
    setDraft(toMe01Draft(nextParams));
    apply(nextParams);
  }

  function toggleNotation(notation: Me01Notation) {
    const next = { ...p, notation };
    setDraft(toMe01Draft(next));
    apply(next);
  }

  function togglePremise(premise: Me01Premise) {
    const next = { ...p, premise };
    setDraft(toMe01Draft(next));
    apply(next);
  }

  function toggleOffsetDisplay(offsetDisplay: Me01OffsetDisplay) {
    const next = { ...p, offsetDisplay };
    setDraft(toMe01Draft(next));
    apply(next);
  }

  function setStep(step: Me01Step) {
    const next = { ...p, step };
    setDraft(toMe01Draft(next));
    apply(next);
  }

  function share() {
    const query = encodeMe01Settings(p);
    const url = `${window.location.origin}${window.location.pathname}${query}`;
    setSharedUrl(url);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  return (
    <section
      className="laboratory-shell"
      aria-label={title}
      data-instrument-id="me-01"
      {...instrumentRootAttributes(view)}
      {...executionLabelAttributes(executionKind)}
      data-refusal-code={refusalCode ?? undefined}
    >
      <div className="lab-header">
        <div>
          <p className="eyebrow">An executable model</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="lab-status-row">
        <ExecutionChrome
          state={executionKind}
          view={view}
          modelNote={modelNoteFromView(view, { notModeled: `${ME01_NOT_MODELED.join("; ")}.` })}
        />
      </div>

      <noscript>
        <p className="notice">
          JavaScript is off. This is a complete worked example calculated when the site was built,
          and its values and explanations remain available. The controls need JavaScript to respond.
        </p>
      </noscript>

      <PredictGatePanels gate={gate} />
      <div className="lab-columns">
        <div>
          <SliderField
            {...field("frameSpeed")}
            label="Observer speed v/c"
            unit="signed fraction of c"
            min={-0.95}
            max={0.95}
            step={0.01}
          />
          <SliderField
            {...field("emissionAngle")}
            label="Emission angle φ"
            unit="degrees from the direction of motion"
            min={0}
            max={180}
            step={1}
          />

          <fieldset className="lab-choice">
            <legend>Try</legend>
            <div className="actions">
              {ME01_PRESETS.map((pr) => (
                <button
                  key={pr.presetId}
                  type="button"
                  className="secondary"
                  onClick={() => loadPreset(pr.presetId)}
                >
                  {pr.label}
                </button>
              ))}
            </div>
          </fieldset>

          <ExperimentSettings contents="emitted energy, the premise, how internal energy is written, notation, a link to these settings">
            <SliderField
              {...field("emittedEnergyRestFrame")}
              label="Emitted energy L"
              unit="in the body's rest frame"
              min={0.1}
              max={5}
              step={0.1}
            />
            <div className="control-row">
              <span id={`${id}-premise-label`} className="field-label">
                The additive constant <var>C</var>
              </span>
              <fieldset aria-labelledby={`${id}-premise-label`} className="button-group">
                <button
                  type="button"
                  className={p.premise === "unchanged" ? undefined : "secondary"}
                  onClick={() => togglePremise("unchanged")}
                  aria-pressed={p.premise === "unchanged"}
                >
                  Unchanged, as the paper assumes
                </button>
                <button
                  type="button"
                  className={p.premise === "relaxed" ? undefined : "secondary"}
                  onClick={() => togglePremise("relaxed")}
                  aria-pressed={p.premise === "relaxed"}
                >
                  Allowed to change
                </button>
              </fieldset>
            </div>
            <div className="control-row">
              <span id={`${id}-offsets-label`} className="field-label">
                Internal energies written as
              </span>
              <fieldset aria-labelledby={`${id}-offsets-label`} className="button-group">
                <button
                  type="button"
                  className={p.offsetDisplay === "symbolic" ? undefined : "secondary"}
                  onClick={() => toggleOffsetDisplay("symbolic")}
                  aria-pressed={p.offsetDisplay === "symbolic"}
                >
                  Symbols (E₀, H₀)
                </button>
                <button
                  type="button"
                  className={p.offsetDisplay === "offsets" ? undefined : "secondary"}
                  onClick={() => toggleOffsetDisplay("offsets")}
                  aria-pressed={p.offsetDisplay === "offsets"}
                >
                  Numbers that cancel
                </button>
              </fieldset>
            </div>
            <div className="control-row">
              <span id={`${id}-notation-label`} className="field-label">
                Notation
              </span>
              <fieldset aria-labelledby={`${id}-notation-label`} className="button-group">
                <button
                  type="button"
                  className={p.notation === "printed" ? undefined : "secondary"}
                  onClick={() => toggleNotation("printed")}
                  aria-pressed={p.notation === "printed"}
                >
                  As printed in 1905, with the radical
                </button>
                <button
                  type="button"
                  className={p.notation === "modern" ? undefined : "secondary"}
                  onClick={() => toggleNotation("modern")}
                  aria-pressed={p.notation === "modern"}
                >
                  Modern, with γ
                </button>
              </fieldset>
            </div>
            <button type="button" className="secondary" onClick={share}>
              Copy a link to these settings
            </button>
            {sharedUrl && (
              <p className="fine">
                Link copied: <code>{sharedUrl}</code>
              </p>
            )}
          </ExperimentSettings>

          {error && (
            <p className="notice error" role="alert" data-refusal-code={refusalCode ?? undefined}>
              {error} {KEPT_RESULT}
            </p>
          )}
          <AcceptedStatus
            worked={accepted === undefined || accepted === session.getServerSnapshot().accepted}
            summary={statusSummary}
            response={gate.response}
          />
          {linkNote && (
            <div className="notice">
              <p>{linkNote}</p>
              {linkPending && (
                <button type="button" className="secondary" onClick={() => commitDraft(draft)}>
                  Calculate the linked settings
                </button>
              )}
            </div>
          )}
        </div>

        <div className="lab-results" {...gate.response}>
          <TwoLedgersPlot parameters={p} evaluation={evaluation} clipId={`plot-clip-${id}`} />
          <nav className="step-nav" aria-label="Derivation steps">
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`button-step ${p.step === s.id ? "active" : ""}`}
                onClick={() => setStep(s.id)}
                aria-current={p.step === s.id ? "step" : undefined}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* The kernel's own source, extracted at build time with its hash pinned
          (src/content/kernel). It replaces a block retyped by hand, which was not the kernel's
          code: it computed the subtraction as emittedEnergyRestFrame * (g - 1), where
          evaluateSubtraction uses the cancellation-free gammaMinusOne so that the difference does
          not round to zero at walking speeds, and it did not show evaluateLedgers. */}
      <ShowTheCode instrumentId="me-01" listings={getKernelListingsForInstrument("me-01")} />

      {/* Not Modeled Section - Plain Line List */}
      <footer className="lab-not-modeled">
        <p className="not-modeled-heading">Not modeled in this ideal reference calculation:</p>
        <p className="not-modeled-line">{ME01_NOT_MODELED.join(" · ")}</p>
      </footer>

      {/* The four readings follow the reader's detail setting, as on every other laboratory: direct
          children of the lab root, which labShell.css's detail rules select. */}
      <p data-detail="0">{withScripts(ME01_CAPTION.r0)}</p>
      <p data-detail="1">{withScripts(ME01_CAPTION.r1)}</p>
      <p data-detail="2" hidden>
        {withScripts(ME01_CAPTION.r2)}
      </p>
      <p data-detail="3" hidden>
        {withScripts(ME01_CAPTION.r3)}
      </p>
    </section>
  );
}

export function TwoLedgersComparison({ example }: { example: PreparedMe01Example }) {
  return <TwoLedgersLab example={example} />;
}
