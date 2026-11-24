"use client";

import { type FormEvent, useCallback, useEffect, useId, useMemo, useRef } from "react";
import { KEPT_RESULT } from "../components/lab/keptResult.ts";
import { display, scalar } from "../components/lab/presentation.ts";
import { EquationScope } from "../equations/EquationScope.tsx";
import { SemanticEquation } from "../equations/SemanticEquation.tsx";
import type { CompiledEquation } from "../equations/viewTypes.ts";
import type { Bm01Parameters } from "../experiments/bm01/definition.ts";
import { ExecutionChrome } from "../experiments/labels/ExecutionChrome.tsx";
import { labelRootAttributes } from "../experiments/labels/resultAttributes.ts";
import { useLaboratoryVisibility } from "../experiments/lifecycle/useLaboratoryVisibility.ts";
import { failureCode } from "../experiments/results/applyFailure.ts";
import { instrumentRootAttributes } from "../experiments/store/identityAttributes.ts";
import { useInstrumentView } from "../experiments/store/useExperimentSnapshot.ts";
import equationPayload from "../generated/bm01-equations.json";
import { type BrownianLabContextValue, useBrownianLab } from "./BrownianLabContext.tsx";
import type { SharedBrownianLab } from "./brownianLabSession.ts";

const rmsEquation = (equationPayload.equations as readonly CompiledEquation[]).find(
  (equation) => equation.id === "eq-model-bm-rms",
);

function ConnectedPanel({
  lab,
  laboratory,
  active,
  slot,
}: {
  lab: BrownianLabContextValue;
  laboratory: SharedBrownianLab;
  active: boolean;
  slot?: "column" | "sheet" | undefined;
}) {
  const id = useId();
  const lease = useMemo(
    () => laboratory.view(`companion-${slot ?? "passage"}-${id}`),
    [laboratory, slot, id],
  );
  const visibility = useRef({ paused: true, active });
  visibility.current.active = active;
  const session = useMemo(
    () => ({
      ...lease,
      setSchedulingPaused(paused: boolean) {
        visibility.current.paused = paused;
        lease.setSchedulingPaused(paused || !visibility.current.active);
      },
    }),
    [lease],
  );
  const region = useLaboratoryVisibility(session);
  useEffect(() => {
    lease.setSchedulingPaused(visibility.current.paused || !active);
  }, [lease, active]);
  useEffect(() => () => lease.disconnect(), [lease]);
  const view = useInstrumentView(session);
  const snapshot = view.accepted ?? session.getServerSnapshot().accepted;
  const isStatic = snapshot === session.getServerSnapshot().accepted;
  // These displayed quantities are host-owned model predictions and a host summary. The full
  // path display separately identifies whether FrankenSim produced its tracer positions.
  const executionKind = isStatic
    ? "static-example"
    : view.status === "unavailable"
      ? "unavailable"
      : "host-accepted";
  const execution = useMemo(
    () => ({
      label: isStatic ? ("static" as const) : ("host" as const),
      text: isStatic ? "Static worked example" : "Ideal model, host calculation",
      sourceDigest: laboratory.example.sourceDigest,
      owners: [...new Set(snapshot?.outputs.map((output) => output.ownerId) ?? [])],
    }),
    [isStatic, laboratory.example.sourceDigest, snapshot],
  );
  const slots = useMemo(
    () => [{ slot: "primary", experimentId: "bm-01", view, execution }],
    [view, execution],
  );
  const editQuantity = useCallback(
    (quantityId: string) => {
      if (quantityId === "observationInterval") document.getElementById(`${id}-interval`)?.focus();
    },
    [id],
  );
  if (!snapshot || !lab.draft) return null;
  const parameters = snapshot.parameters as Bm01Parameters;
  const notice = view.pending
    ? "Calculating the requested trial. The last accepted readings remain below."
    : view.status === "refused"
      ? `${view.refusal?.message ?? "The trial was refused."} ${KEPT_RESULT}`
      : view.status === "unavailable"
        ? `${view.outcome?.message ?? "The calculation is unavailable."} ${KEPT_RESULT}`
        : view.status === "paused"
          ? `The calculation stopped. ${KEPT_RESULT}`
          : "The compact controls and the full laboratory show the same accepted trial.";
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    lab.applyDraft();
  }
  return (
    <section
      ref={region}
      className="brownian-companion-lab"
      data-brownian-lab-panel={slot ?? "passage"}
      data-instrument-id="bm-01"
      aria-labelledby={`${id}-title`}
      {...instrumentRootAttributes(view)}
      {...labelRootAttributes(executionKind, view, "rmsDisplacement1d")}
    >
      <h2 id={`${id}-title`}>How far do the tracers spread?</h2>
      <p className="fine">Change particle radius, or re-observe a trial at a different time.</p>
      <form onSubmit={submit} noValidate>
        <div className="input-field">
          <label htmlFor={`${id}-a`}>Particle radius (μm)</label>
          <input
            id={`${id}-a`}
            name="a"
            type="text"
            inputMode="decimal"
            value={lab.draft.a}
            onChange={(event) => lab.editDraft("a", event.target.value)}
          />
        </div>
        <div className="input-field">
          <label htmlFor={`${id}-interval`}>Observe after (s)</label>
          <input
            id={`${id}-interval`}
            name="interval"
            type="text"
            inputMode="decimal"
            value={lab.draft.interval}
            onChange={(event) => lab.editDraft("interval", event.target.value)}
          />
        </div>
        <p className="fine">
          The current recording ends at {display(parameters.H)} s, in steps of{" "}
          {display(parameters.h)} s.
        </p>
        <div className="actions">
          <button type="submit">Apply tracer settings</button>
          <button type="button" className="secondary" onClick={lab.resetDraft}>
            Use accepted tracer settings
          </button>
          {view.pending ? (
            <button type="button" className="secondary" onClick={() => session.stop()}>
              Stop calculation
            </button>
          ) : null}
        </div>
      </form>
      {lab.dirty ? (
        <p className="draft-note">
          These edits are a draft. The readings still describe the accepted trial.
        </p>
      ) : null}
      {lab.failure ? (
        <div
          className="notice error"
          role="alert"
          data-refusal-code={failureCode(lab.failure)}
          data-apply-failure={lab.failure.kind}
        >
          <p>
            {lab.failure.text} {KEPT_RESULT}
          </p>
          <button type="button" className="secondary" onClick={lab.resetDraft}>
            Use accepted tracer settings
          </button>
        </div>
      ) : null}
      <p className="fine" role="status" data-brownian-lab-status>
        {notice}
      </p>
      <ExecutionChrome
        state={executionKind}
        view={view}
        validationRefusal={lab.failure?.kind === "refused" ? lab.failure.refusal : null}
      />
      <dl className="brownian-companion-readings" aria-label="Accepted tracer readings">
        <div>
          <dt>Model diffusion coefficient</dt>
          <dd>
            <output data-output="diffusionCoefficient">
              {display(scalar(snapshot, "diffusionCoefficient"), 1e12)}
            </output>{" "}
            μm²/s
          </dd>
        </div>
        <div>
          <dt>Model coordinate RMS</dt>
          <dd>
            <output data-output="rmsDisplacement1d">
              {display(scalar(snapshot, "rmsDisplacement1d"), 1e6)}
            </output>{" "}
            μm
          </dd>
        </div>
        <div>
          <dt>Synthetic sample coordinate RMS</dt>
          <dd>
            <output data-output="sampleRms">{display(scalar(snapshot, "sampleRms"), 1e6)}</output>{" "}
            μm
          </dd>
        </div>
      </dl>
      <p className="fine" data-brownian-accepted-settings>
        Accepted: radius {display(parameters.a, 1e6)} μm, observation {display(parameters.interval)}{" "}
        s; {parameters.M} synthetic tracers, seed {parameters.seed}.{" "}
        {parameters.constantSetId === "einstein-1905-brownian-printed"
          ? "Einstein’s printed 1905 constants."
          : "Modern SI 2019 constants."}
      </p>
      <p className="fine">
        These are consequences of an ideal diffusion model. The finite sample fluctuates around the
        model RMS; it is not an independent measurement from nature.
      </p>
      {rmsEquation ? (
        <details
          data-brownian-companion-equation
          open={lab.equationOpen}
          onToggle={(event) => lab.setEquationOpen(event.currentTarget.open)}
        >
          <summary>Connect these readings to the displacement formula</summary>
          <EquationScope
            selectionStore={lab.selection}
            slots={slots}
            scope={`reader-companion-${id}`}
            scopeLabel="tracer companion"
            lessonTitles={equationPayload.foundationTitles}
            editQuantity={editQuantity}
          >
            <SemanticEquation
              equation={rmsEquation}
              nodeIdPrefix={`reader-companion-${id}`}
              pinAllowed={false}
            />
          </EquationScope>
        </details>
      ) : null}
      <p className="fine">
        <a href="#lab-bm-01">Open the full tracer controls below</a> for temperature, viscosity,
        constants, recording, graphs and provenance.
      </p>
    </section>
  );
}

export default function BrownianLabPanel({
  active,
  slot,
}: {
  active: boolean;
  slot?: "column" | "sheet" | undefined;
}) {
  const lab = useBrownianLab();
  return lab?.laboratory ? (
    <ConnectedPanel lab={lab} laboratory={lab.laboratory} active={active} slot={slot} />
  ) : null;
}
