"use client";

import { type FormEvent, useEffect, useId, useState, useSyncExternalStore } from "react";
import { createBm01BrowserChannel } from "../../experiments/bm01/browser.ts";
import { createBm01Session, type PreparedBm01Example } from "../../experiments/bm01/session.ts";
import { createBm06BrowserChannel } from "../../experiments/bm06/browser.ts";
import { createBm06Session, type PreparedBm06Example } from "../../experiments/bm06/session.ts";
import { createBrownianRadiusGroup } from "../../experiments/groups/brownianRadius.ts";
import type { ExperimentGroupDefinition } from "../../experiments/groups/schema.ts";
import { ExecutionLabel } from "../../experiments/labels/ExecutionLabel.tsx";
import { useLaboratoryVisibility } from "../../experiments/lifecycle/useLaboratoryVisibility.ts";
import { failureCode } from "../../experiments/results/applyFailure.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { DistributionPlot } from "./DistributionPlot.tsx";
import { display, identity, result, scalar } from "./presentation.ts";
import { TracerHistogram } from "./TracerPlots.tsx";
import "./brownianLinkedGroup.css";

const BROWSER_WORKERS = [createBm01BrowserChannel, createBm06BrowserChannel] as const;
const MEMBER_NAMES = ["Tracer ensemble", "Spreading probability"] as const;

function metres(text: string): number {
  return text.trim() ? Number(text) * 1e-6 : Number.NaN;
}

function AcceptedReadouts({ snapshot }: { snapshot: AcceptedSnapshot }) {
  const tracer = snapshot.experimentId === "bm-01";
  return (
    <table {...identity(snapshot)}>
      <caption>Values in the displayed accepted result</caption>
      <tbody>
        <tr>
          <th scope="row">Particle radius</th>
          <td data-linked-output="radius">{display(snapshot.parameters.a as number, 1e6)} μm</td>
        </tr>
        <tr>
          <th scope="row">Diffusion coefficient</th>
          <td data-linked-output="diffusion">
            {display(scalar(snapshot, "diffusionCoefficient"), 1e12)} μm²/s
          </td>
        </tr>
        <tr>
          <th scope="row">Model RMS displacement</th>
          <td data-linked-output="model-rms">
            {display(scalar(snapshot, "rmsDisplacement1d"), 1e6)} μm
          </td>
        </tr>
        {tracer ? (
          <tr>
            <th scope="row">Sample RMS displacement</th>
            <td>{display(scalar(snapshot, "sampleRms"), 1e6)} μm</td>
          </tr>
        ) : (
          <tr>
            <th scope="row">
              Probability from {display(snapshot.parameters.lower as number, 1e6)} to{" "}
              {display(snapshot.parameters.upper as number, 1e6)} μm
            </th>
            <td>{display(scalar(snapshot, "intervalProbability") * 100)}%</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Two ordinary owner sessions; the group controls publication, never the scientific calculation. */
export function BrownianLinkedGroup({
  definition,
  tracerExample,
  densityExample,
  workerFactories = BROWSER_WORKERS,
}: {
  definition: ExperimentGroupDefinition;
  tracerExample: PreparedBm01Example;
  densityExample: PreparedBm06Example;
  workerFactories?: readonly [() => WorkerChannel, () => WorkerChannel];
}) {
  const id = useId();
  const [sessions] = useState(
    () =>
      [
        createBm01Session(id + "-linked-tracers", tracerExample, workerFactories[0]),
        createBm06Session(id + "-linked-density", densityExample, workerFactories[1]),
      ] as const,
  );
  const [group] = useState(() => createBrownianRadiusGroup(definition, sessions));
  const view = useSyncExternalStore(group.subscribe, group.getSnapshot, group.getServerSnapshot);
  const region = useLaboratoryVisibility(group);
  const [ready, setReady] = useState(false);
  const [sharedRadius, setSharedRadius] = useState(String(tracerExample.parameters.a * 1e6));
  const [radii, setRadii] = useState([
    String(tracerExample.parameters.a * 1e6),
    String(densityExample.parameters.a * 1e6),
  ]);
  useEffect(() => {
    group.connect();
    setReady(true);
    return () => group.disconnect();
  }, [group]);

  function submitShared(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (view.enabled) group.update(metres(sharedRadius));
    else group.link(metres(sharedRadius));
  }

  function unlink() {
    group.unlink();
    setRadii(
      group
        .getSnapshot()
        .members.map((member) => String((member.view.accepted?.parameters.a as number) * 1e6)),
    );
  }

  const announcement = !view.enabled
    ? "The instruments are independent. Changing one radius does not change the other."
    : view.status === "accepted"
      ? "Both instruments now show the shared radius, " +
        display(view.requestedValue ?? 0, 1e6) +
        " micrometres."
      : view.status === "incomplete"
        ? "The shared update is incomplete. The displayed results are unchanged; review each instrument's status."
        : "Updating both instruments. The displayed results stay unchanged until both are ready.";

  return (
    <section
      ref={region}
      className="linked-brownian"
      aria-labelledby={id + "-title"}
      data-linked-group={definition.groupId}
      data-group-enabled={String(view.enabled)}
      data-group-status={view.status}
      data-requested-generation={view.generationId}
    >
      <h2 id={id + "-title"}>One radius, two ways of seeing the spread</h2>
      <p>
        The histogram counts a finite synthetic ensemble. The smooth curve gives the model's
        probability density. Link their particle radius to ask the same question of both at once.
        Each instrument keeps its own calculation.
      </p>
      <p className="fine">
        Held fixed: {display(tracerExample.parameters.T)} K, viscosity{" "}
        {display(tracerExample.parameters.eta, 1e3)} mPa·s, and{" "}
        {display(tracerExample.parameters.interval)} s of observation, with modern SI constants. The
        tracer ensemble uses {tracerExample.parameters.M} tracers and seed{" "}
        {tracerExample.parameters.seed}. These are model results, not historical observations.
      </p>
      <noscript>
        <p className="notice">
          These worked examples, plots and numbers remain readable without JavaScript. Linking the
          radius and running new calculations require JavaScript.
        </p>
      </noscript>
      <div className="linked-radius-control">
        {view.enabled && (
          <p className="linked-radius-chip" data-link-chip="particleRadius">
            <strong>{definition.label}</strong>
            <span>Tracer ensemble + spreading probability</span>
            <button type="button" onClick={unlink}>
              Unlink
            </button>
          </p>
        )}
        <form onSubmit={submitShared} noValidate>
          <fieldset disabled={!ready}>
            <legend>{view.enabled ? "Change the shared radius" : "Choose whether to link"}</legend>
            <div className="linked-radius-form">
              <div className="input-field">
                <label htmlFor={id + "-shared"}>Shared particle radius (μm)</label>
                <input
                  id={id + "-shared"}
                  name="shared-radius"
                  type="number"
                  step="any"
                  min={definition.domain.min * 1e6}
                  max={definition.domain.max * 1e6}
                  value={sharedRadius}
                  onChange={(event) => setSharedRadius(event.target.value)}
                  aria-describedby={id + "-domain"}
                />
              </div>
              <button type="submit">
                {view.enabled ? "Apply to both instruments" : "Link the particle radius"}
              </button>
            </div>
          </fieldset>
        </form>
        <p id={id + "-domain"} className="fine">
          Shared range: {display(definition.domain.min, 1e6)} to{" "}
          {display(definition.domain.max, 1e6)} μm, the overlap of the two instruments' admitted
          radii. Try 0.5 μm, then 1 μm.
        </p>
        <p className="status-line" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
        {view.enabled && view.status !== "accepted" && (
          <p className="notice" data-previous-group-results>
            {view.coherent
              ? "Showing the last complete shared calculation, at " +
                display(view.coherent.value, 1e6) +
                " μm."
              : "Showing the results from before linking while the first shared calculation finishes."}
          </p>
        )}
      </div>
      <div className="linked-brownian-members">
        {view.members.map((member, index) => {
          const snapshot = view.displayed[index];
          const memberDefinition = definition.members[index];
          if (!snapshot || !memberDefinition) return null;
          const tracer = snapshot.experimentId === "bm-01";
          const isStatic = snapshot === sessions[index]?.getServerSnapshot().accepted;
          const engine = isStatic
            ? "static-example"
            : tracer && result(snapshot, "tracerPositions").ownerId === "fs-wasm.brownian_frames"
              ? "frankensim-accepted"
              : "host-accepted";
          const status =
            member.failure?.text ??
            (member.status === "accepted"
              ? view.status === "accepted"
                ? "Accepted for the shared radius."
                : "Ready; waiting for the other instrument."
              : member.status === "pending"
                ? "Calculating the requested radius."
                : member.status === "paused"
                  ? "Calculation stopped. Apply the radius to try again."
                  : view.enabled
                    ? "No result for this shared request."
                    : "Ready for an independent radius change.");
          return (
            <section
              key={member.instanceId}
              className="laboratory"
              aria-labelledby={id + "-member-" + index}
              data-linked-member={member.instrumentId}
              data-member-status={member.status}
              data-displayed-generation={
                view.enabled ? (view.coherent?.generationId ?? 0) : undefined
              }
              data-group-currency={
                view.enabled && view.status !== "accepted" ? "previous" : "current"
              }
              {...identity(snapshot)}
            >
              <h3 id={id + "-member-" + index}>{MEMBER_NAMES[index]}</h3>
              <ExecutionLabel state={engine} />
              {!view.enabled && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    group.applyMember(member.instrumentId, metres(radii[index] ?? ""));
                  }}
                  noValidate
                >
                  <fieldset disabled={!ready}>
                    <legend>Independent radius</legend>
                    <div className="input-field">
                      <label htmlFor={id + "-radius-" + index}>
                        {MEMBER_NAMES[index]} radius (μm)
                      </label>
                      <input
                        id={id + "-radius-" + index}
                        name={member.instrumentId + "-radius"}
                        type="number"
                        step="any"
                        min={memberDefinition.domain.min * 1e6}
                        max={memberDefinition.domain.max * 1e6}
                        value={radii[index] ?? ""}
                        onChange={(event) => {
                          const value = event.target.value;
                          setRadii((current) =>
                            current.map((radius, i) => (i === index ? value : radius)),
                          );
                        }}
                      />
                    </div>
                    <button type="submit">Apply to {tracer ? "tracers" : "probability"}</button>
                  </fieldset>
                </form>
              )}
              <p
                className={member.failure ? "notice error" : "fine"}
                data-member-notice
                data-apply-failure={member.failure?.kind}
                data-refusal-code={member.failure ? failureCode(member.failure) : undefined}
              >
                {status}
              </p>
              {member.failure?.kind === "refused" && (
                <ul className="fine">
                  {member.failure.refusal.rankedRepairs.map((repair) => (
                    <li key={repair.label}>{repair.label}</li>
                  ))}
                </ul>
              )}
              {tracer ? (
                <TracerHistogram snapshot={snapshot} />
              ) : (
                <DistributionPlot snapshot={snapshot} clipId={id + "-density"} />
              )}
              <AcceptedReadouts snapshot={snapshot} />
              <p className="fine">
                {tracer
                  ? "Bars are sample frequencies; the dashed comparison gives model probabilities over the same bins. Sample summaries and the comparison are host calculations."
                  : "The shaded probability belongs to the whole interval. This curve is a host calculation of the unbounded Gaussian model."}
              </p>
            </section>
          );
        })}
      </div>
      <p className="notice">
        Read the numbers as well as the shapes: each plot rescales its horizontal axis. A narrower
        distribution can occupy the same width on screen.
      </p>
      <p className="fine">
        Unlinking keeps each instrument's last accepted result and stops any pending shared update.
        This link applies to these two instruments on this page.
      </p>
    </section>
  );
}
