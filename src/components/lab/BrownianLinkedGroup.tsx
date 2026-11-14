"use client";

import {
  type FormEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createBm01BrowserChannel } from "../../experiments/bm01/browser.ts";
import type { PreparedBm01Example } from "../../experiments/bm01/session.ts";
import { createBm06BrowserChannel } from "../../experiments/bm06/browser.ts";
import type { PreparedBm06Example } from "../../experiments/bm06/session.ts";
import {
  type BrownianRadiusSession,
  createBrownianRadiusSession,
  restoreBrownianRadiusFromUrl,
  tapeForBrownianRadius,
} from "../../experiments/groups/brownianRadiusTape.ts";
import {
  brownianGroupStateKey,
  incomingBrownianRecording,
  restoreBrownianGroup,
} from "../../experiments/groups/brownianTape.ts";
import type { ExperimentGroupDefinition } from "../../experiments/groups/schema.ts";
import { ExecutionLabel } from "../../experiments/labels/ExecutionLabel.tsx";
import { useLaboratoryVisibility } from "../../experiments/lifecycle/useLaboratoryVisibility.ts";
import { ShareControl } from "../../experiments/permalink/ShareControl.tsx";
import type { TapeGroupV3 } from "../../experiments/permalink/types.ts";
import { failureCode } from "../../experiments/results/applyFailure.ts";
import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { WorkerChannel } from "../../workers/scheduler/hostScheduler.ts";
import { BrownianGroupSharing, type SavedBrownianRecording } from "./BrownianGroupSharing.tsx";
import { DistributionPlot } from "./DistributionPlot.tsx";
import { display, identity, result, scalar } from "./presentation.ts";
import { TracerHistogram } from "./TracerPlots.tsx";
import "./brownianLinkedGroup.css";

const BROWSER_WORKERS = [createBm01BrowserChannel, createBm06BrowserChannel] as const;
const MEMBER_NAMES = ["Tracer ensemble", "Spreading probability"] as const;

/** React checks this synchronous selection again before commit, including an interrupted render. */
function createSessionSelection(initial: BrownianRadiusSession) {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => current,
    getServerSnapshot: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    select(next: BrownianRadiusSession) {
      if (next === current) return;
      current = next;
      for (const listener of [...listeners]) listener();
    },
  };
}


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
  const examples = useMemo(
    () => ({ tracer: tracerExample, density: densityExample }),
    [tracerExample, densityExample],
  );
  const [selection] = useState(() => createSessionSelection(
    createBrownianRadiusSession(id + "-linked", definition, examples, workerFactories),
  ));
  const proposedSession = useSyncExternalStore(
    selection.subscribe, selection.getSnapshot, selection.getServerSnapshot,
  );
  const committedSession = useRef(proposedSession);
  const proposalSignals = useRef(new WeakMap<BrownianRadiusSession, AbortSignal>());
  const session = proposalSignals.current.get(proposedSession)?.aborted
    ? committedSession.current
    : proposedSession;
  const scientificInputs = useMemo(
    () => ({ definition, tracerExample, densityExample, workerFactories }),
    [definition, tracerExample, densityExample, workerFactories],
  );
  const { sessions, group } = session;
  const view = useSyncExternalStore(group.subscribe, group.getSnapshot, group.getServerSnapshot);
  const region = useLaboratoryVisibility(group);
  const [ready, setReady] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState("");
  const [incomingRecording, setIncomingRecording] = useState<TapeGroupV3 | null>(null);
  const [recorded, setRecorded] = useState<SavedBrownianRecording | null>(null);
  const navigation = useRef<AbortController | null>(null);
  const scientificRestore = useRef<AbortController | null>(null);
  const restoring = useRef(true);
  const restoreSequence = useRef(0);
  const activeSession = useRef<BrownianRadiusSession | null>(session);
  const candidates = useRef(
    new Map<BrownianRadiusSession, Readonly<{ signal: AbortSignal; notice: string; recording?: TapeGroupV3 }>>(),
  );
  const [sharedRadius, setSharedRadius] = useState(String(tracerExample.parameters.a * 1e6));
  const [radii, setRadii] = useState([
    String(tracerExample.parameters.a * 1e6),
    String(densityExample.parameters.a * 1e6),
  ]);
  useLayoutEffect(() => {
    const signal = proposalSignals.current.get(session);
    if (selection.getSnapshot() !== session || (signal?.aborted && session !== committedSession.current)) {
      if (session !== committedSession.current) session.group.disconnect();
      selection.select(committedSession.current);
      return;
    }
    const previous = activeSession.current;
    group.connect();
    activeSession.current = session;
    committedSession.current = session;
    // A proposed render never owns the previous group's cleanup. Only an admitted replacement
    // can retire it, after layout-phase bookkeeping has made cancellation observe the new owner.
    if (previous && previous !== session) previous.group.disconnect();
    const restored = candidates.current.get(session);
    if (restored) {
      candidates.current.delete(session);
      setRadii(sessions.map((owner) => String((owner.acceptedParameters().a as number) * 1e6)));
      setSharedRadius(String((sessions[0].acceptedParameters().a as number) * 1e6));
      setRestoreNotice(restored.notice);
      const key = brownianGroupStateKey(group.getSnapshot());
      setRecorded(restored.recording && key
        ? { bundle: session, key, tape: restored.recording }
        : null);
      restoring.current = false;
      setReady(true);
    }
  }, [group, session, sessions, selection]);

  useLayoutEffect(() => () => {
    activeSession.current?.group.disconnect();
    activeSession.current = null;
  }, []);

  useEffect(() => {
    let controller: AbortController | null = null;
    let previousLocation: string | null = null;
    function retireCandidates() {
      for (const candidate of candidates.current.keys()) {
        if (candidate !== activeSession.current) candidate.group.disconnect();
      }
      candidates.current.clear();
    }
    function restoreLocation() {
      const address = new URL(window.location.href);
      const locationKey = JSON.stringify([address.pathname, address.searchParams.getAll("tape")]);
      if (locationKey === previousLocation) return;
      previousLocation = locationKey;
      controller?.abort();
      scientificRestore.current?.abort();
      scientificRestore.current = null;
      selection.select(committedSession.current);
      setIncomingRecording(null);
      retireCandidates();
      const request = new AbortController();
      controller = request;
      navigation.current = request;
      restoreSequence.current += 1;
      restoring.current = true;
      setReady(false);
      setRestoreNotice(
        address.searchParams.has("tape")
          ? "Checking the shared settings and calculating both instruments…"
          : "",
      );
      const failed = () => {
        if (request.signal.aborted || controller !== request) return;
        setRestoreNotice(
          "The shared comparison could not be restored. Your current comparison is kept.",
        );
        restoring.current = false;
        setReady(true);
      };
      void incomingBrownianRecording(scientificInputs, address.href, request.signal).then(
        (recording) => {
          if (request.signal.aborted || controller !== request) return;
          if (recording !== null) {
            if (recording.kind === "prepared") {
              setIncomingRecording(recording.tape);
              setRestoreNotice(
                "A scientific comparison is ready. Restore it to verify both complete checkpoints; no calculation has started.",
              );
            } else setRestoreNotice(recording.notice);
            restoring.current = false;
            setReady(true);
            return;
          }
          void restoreBrownianRadiusFromUrl(
            id + "-shared-" + restoreSequence.current,
            definition,
            examples,
            workerFactories,
            address.href,
            request.signal,
          ).then(
            (restored) => {
              if (request.signal.aborted || controller !== request) {
                if (restored.kind === "restored") restored.session.group.disconnect();
                return;
              }
              if (restored.kind === "restored") {
                const next = restored.session;
                candidates.current.set(next, { signal: request.signal, notice: restored.notice });
                proposalSignals.current.set(next, request.signal);
                // Cancel/navigation synchronously rolls this pointer back before retiring next.
                selection.select(next);
              } else {
                setRestoreNotice(restored.kind === "not-restored" ? restored.notice : "");
                restoring.current = false;
                setReady(true);
              }
            },
            () => {
              if (request.signal.aborted || controller !== request) return;
              setRestoreNotice(
                "The shared comparison could not be restored. Your current comparison is kept.",
              );
              restoring.current = false;
              setReady(true);
            },
          );
        },
        failed,
      );
    }
    window.addEventListener("popstate", restoreLocation);
    window.addEventListener("pageshow", restoreLocation);
    restoreLocation();
    return () => {
      controller?.abort();
      scientificRestore.current?.abort();
      scientificRestore.current = null;
      retireCandidates();
      window.removeEventListener("popstate", restoreLocation);
      window.removeEventListener("pageshow", restoreLocation);
    };
  }, [id, definition, examples, workerFactories, scientificInputs, selection]);

  const shareTape = useMemo(() => tapeForBrownianRadius(session, view), [session, view]);

  function restoreRecording() {
    const location = navigation.current;
    if (!ready || restoring.current || !incomingRecording || !location || location.signal.aborted)
      return;
    scientificRestore.current?.abort();
    const request = new AbortController();
    scientificRestore.current = request;
    restoreSequence.current += 1;
    restoring.current = true;
    setReady(false);
    setRestoreNotice("Verifying both scientific checkpoints. Your displayed comparison is kept.");
    void restoreBrownianGroup(
      id + "-recording-" + restoreSequence.current,
      scientificInputs,
      session,
      incomingRecording,
      { signal: request.signal },
    ).then(
      (restored) => {
        if (
          request.signal.aborted || location.signal.aborted ||
          navigation.current !== location || scientificRestore.current !== request
        ) {
          if (restored.kind === "restored") restored.bundle.group.disconnect();
          return;
        }
        if (restored.kind === "restored") {
          const next = restored.bundle;
          candidates.current.set(next, {
            signal: request.signal,
            recording: restored.tape,
            notice: restored.tape.group.enabled
              ? "Both scientific checkpoints were verified and restored as one linked comparison."
              : "Both scientific checkpoints were verified; the two radii remain independent.",
          });
          proposalSignals.current.set(next, request.signal);
          selection.select(next);
        } else {
          setRestoreNotice(restored.notice);
          restoring.current = false;
          setReady(true);
        }
      },
      () => {
        if (request.signal.aborted || location.signal.aborted || navigation.current !== location)
          return;
        setRestoreNotice("The scientific comparison could not be restored. Your accepted results are kept.");
        restoring.current = false;
        setReady(true);
      },
    );
  }

  function cancelRecordingRestore() {
    scientificRestore.current?.abort();
    scientificRestore.current = null;
    selection.select(committedSession.current);
    for (const candidate of candidates.current.keys()) {
      if (candidate !== activeSession.current) {
        candidate.group.disconnect();
        candidates.current.delete(candidate);
      }
    }
    restoring.current = false;
    setReady(true);
    setRestoreNotice("Scientific restoration canceled. Your displayed comparison is kept.");
  }


  function submitShared(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || restoring.current) return;
    setRestoreNotice("");
    if (view.enabled) group.update(metres(sharedRadius));
    else group.link(metres(sharedRadius));
  }

  function unlink() {
    if (!ready || restoring.current) return;
    setRestoreNotice("");
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
      data-group-restoring={String(!ready)}
      data-requested-generation={view.generationId}
    >
      <h2 id={id + "-title"}>One radius, two ways of seeing the spread</h2>
      <p>
        The histogram counts a finite synthetic ensemble. The smooth curve gives the model's
        probability density. Link their particle radius to ask the same question of both at once.
        Each instrument keeps its own calculation.
      </p>
      <p className="fine">
        Held fixed: {display(view.displayed[0]?.parameters.T as number)} K, viscosity{" "}
        {display(view.displayed[0]?.parameters.eta as number, 1e3)} mPa·s, and{" "}
        {display(view.displayed[0]?.parameters.interval as number)} s of observation, with modern SI constants. The
        tracer ensemble uses {view.displayed[0]?.parameters.M} tracers and seed{" "}
        {view.displayed[0]?.parameters.seed}. These are model results, not historical observations.
      </p>
      <noscript>
        <p className="notice">
          These worked examples, plots and numbers remain readable without JavaScript. Linking the
          radius and running new calculations require JavaScript.
        </p>
      </noscript>
      {incomingRecording && (
        <div className="notice" data-incoming-scientific-comparison>
          <p>Restoring replaces the displayed pair only after both owners reproduce their recorded scientific results.</p>
          {ready ? (
            <button type="button" onClick={restoreRecording}>Restore the scientific comparison</button>
          ) : (
            <button type="button" onClick={cancelRecordingRestore}>Cancel scientific restore</button>
          )}
        </div>
      )}
      <div className="linked-radius-control">
        {view.enabled && (
          <p className="linked-radius-chip" data-link-chip="particleRadius">
            <strong>{definition.label}</strong>
            <span>Tracer ensemble + spreading probability</span>
            <button
              type="button"
              onClick={unlink}
              disabled={!ready}
              aria-label="Unlink the particle radius for both instruments"
            >
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
          {restoreNotice && <span data-group-restore>{restoreNotice} </span>}
          {(ready || !restoreNotice) && announcement}
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
                    if (!ready || restoring.current) return;
                    setRestoreNotice("");
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
      {ready && shareTape && (
        <div>
          <h3>Share the displayed settings</h3>
          <p className="fine">
            The link records both instruments' accepted settings, the tracer seed and whether their
            radii are linked. Opening it calculates a new comparison from those settings. Particle
            paths are not stored in the link.
          </p>
          <ShareControl tape={shareTape} />
        </div>
      )}
      <BrownianGroupSharing
        inputs={scientificInputs}
        bundle={session}
        view={view}
        ready={ready}
        recorded={recorded}
        settingsAvailable={shareTape !== null}
      />
    </section>
  );
}
