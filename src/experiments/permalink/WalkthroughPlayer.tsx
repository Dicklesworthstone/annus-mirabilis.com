"use client";

import { useEffect, useId, useRef, useState } from "react";
import { tapePath } from "../../reader/sitePaths.ts";
import type { CheckpointReadoutOwner } from "./checkpointReadings.ts";
import { CheckpointReadingsPanel } from "./CheckpointReadingsPanel.tsx";
import {
  applyWalkthroughCheckpointAsync,
  calculateWalkthroughCheckpointAsync,
  type WalkthroughAction,
  type WalkthroughPlayerTarget,
} from "./walkthroughActions.ts";
import { checkpointAt, type WalkthroughCatalogue } from "./walkthroughCheckpoints.ts";
import {
  observeWalkthroughLocation,
  resolveWalkthroughLocation,
  type WalkthroughLocation,
} from "./walkthroughLocation.ts";

type PlayerOutcome = WalkthroughAction | Readonly<{ kind: "cancelled"; notice: string }>;

async function loadCatalogue(): Promise<WalkthroughCatalogue> {
  const { WALKTHROUGH_CATALOGUE } = await import("./walkthroughCatalogue.ts");
  return WALKTHROUGH_CATALOGUE;
}

/**
 * One checkpoint player for all shared-link laboratories (am-rt-control-tapes-0gc).
 * The catalogue loads only on request, including an explicit public walkthrough link.
 * Selection and seeking inspect instructions only. Every state-changing action still goes through
 * the supplied laboratory adapter; a new calculation is never disguised as historical replay.
 */
export function WalkthroughPlayer({
  target,
  owner,
  load = loadCatalogue,
}: Readonly<{
  target: WalkthroughPlayerTarget;
  owner?: CheckpointReadoutOwner | undefined;
  load?: (() => Promise<WalkthroughCatalogue>) | undefined;
}>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [catalogue, setCatalogue] = useState<WalkthroughCatalogue | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [tapeId, setTapeId] = useState("");
  const [manualIndex, setIndex] = useState(0);
  const [result, setResult] = useState<PlayerOutcome | null>(null);
  const [working, setWorking] = useState(false);
  const pendingAction = useRef<AbortController | null>(null);
  const actionTrigger = useRef<HTMLButtonElement | null>(null);
  const [location, setLocation] = useState<WalkthroughLocation>({ kind: "absent" });
  const experimentId = target.experimentId;

  useEffect(
    () => () => {
      const controller = pendingAction.current;
      pendingAction.current = null;
      controller?.abort();
    },
    [],
  );

  // The cancellation control disappears after use. Return keyboard focus only after React has
  // re-enabled the original action, rather than leaving it on the document body.
  useEffect(() => {
    if (result?.kind === "cancelled") actionTrigger.current?.focus();
  }, [result]);

  async function run(
    action: (signal: AbortSignal) => Promise<WalkthroughAction>,
    trigger: HTMLButtonElement,
  ) {
    if (pendingAction.current) return;
    const controller = new AbortController();
    pendingAction.current = controller;
    actionTrigger.current = trigger;
    setWorking(true);
    setResult(null);
    try {
      const outcome = await action(controller.signal);
      if (pendingAction.current === controller && !controller.signal.aborted) setResult(outcome);
    } finally {
      // An old adapter may finish after cancellation and a fresh action. It owns neither the
      // new feedback nor the new action's busy state.
      if (pendingAction.current === controller) {
        pendingAction.current = null;
        if (!controller.signal.aborted) setWorking(false);
      }
    }
  }

  function cancel() {
    const controller = pendingAction.current;
    if (!controller) return;
    pendingAction.current = null;
    controller.abort();
    setWorking(false);
    setResult({
      kind: "cancelled",
      notice:
        "Calculation cancelled. The laboratory keeps its last accepted result. You can retry this stop or choose another.",
    });
  }

  useEffect(
    () =>
      observeWalkthroughLocation(window, (next) => {
        pendingAction.current?.abort();
        pendingAction.current = null;
        setWorking(false);
        setLocation(next);
        setResult(null);
        if (next.kind !== "absent") setOpen(true);
      }),
    [],
  );

  // A biome-ignore reason must fit ONE line: it applies only directly before the diagnostic.
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry deliberately re-runs a failed catalogue request.
  useEffect(() => {
    if (!open || catalogue) return;
    let active = true;
    setLoading(true);
    setLoadError("");
    void load()
      .then((next) => {
        if (!active) return;
        setCatalogue(next);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(
          "The recorded walkthroughs could not be loaded. Retry or read them on the walkthrough page.",
        );
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // Without retry in the dependency list the retry button is rendered but inert.
  }, [open, catalogue, load, retry]);

  const walkthroughs =
    catalogue?.walkthroughs.filter((entry) => entry.experimentId === experimentId) ?? [];
  const requested =
    location.kind === "selected" && catalogue
      ? resolveWalkthroughLocation(location.selection, experimentId, catalogue)
      : null;
  const linkError =
    location.kind === "invalid"
      ? location.notice
      : requested?.kind === "invalid"
        ? requested.notice
        : "";
  // A bad incoming id must not display the first walkthrough as though it were the requested one.
  const walkthrough =
    requested?.kind === "selected"
      ? requested.walkthrough
      : location.kind === "absent"
        ? (walkthroughs.find((entry) => entry.tapeId === tapeId) ?? walkthroughs[0])
        : undefined;
  const index = requested?.kind === "selected" ? requested.index : manualIndex;
  const checkpoint = walkthrough ? checkpointAt(walkthrough, index) : null;
  const formOnly = target.kind === "form";

  const inspect = (nextIndex: number) => {
    if (!walkthrough || !checkpointAt(walkthrough, nextIndex)) return;
    setLocation({ kind: "absent" });
    setTapeId(walkthrough.tapeId);
    setIndex(nextIndex);
    setResult(null);
  };

  return (
    <details
      className="notice"
      data-walkthrough-player={experimentId}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Explore recorded walkthroughs</summary>
      <p>
        {formOnly
          ? "Load a recorded stop into the form, then Apply to make a new calculation. Loading settings does not replay the recorded experiment."
          : "Choose a walkthrough and inspect its checkpoints, forwards or backwards. Then calculate with the current model or explicitly restore a recorded checkpoint. Inspecting a stop changes no laboratory settings."}
      </p>
      {loading && <p role="status">Loading recorded walkthroughs…</p>}
      {linkError && (
        <>
          <p role="alert">{linkError}</p>
          <button
            type="button"
            onClick={() => {
              setLocation({ kind: "absent" });
              setTapeId("");
              setIndex(0);
              setResult(null);
            }}
          >
            Browse this laboratory's walkthroughs
          </button>
        </>
      )}
      {loadError && (
        <>
          <p role="alert">{loadError}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>
            Retry loading walkthroughs
          </button>
        </>
      )}
      {catalogue && walkthroughs.length === 0 && (
        <p>No checkpoint walkthrough is available for this laboratory in this edition.</p>
      )}
      {catalogue && catalogue.problems.length > 0 && (
        <p>
          Some authored records could not be loaded into the player. The readable walkthrough pages
          remain available.
        </p>
      )}
      {walkthrough && (
        <fieldset disabled={working} aria-busy={working} style={{ minWidth: 0, maxWidth: "100%" }}>
          <legend>Recorded checkpoints</legend>
          <label htmlFor={`${id}-tape`}>Walkthrough</label>{" "}
          <select
            id={`${id}-tape`}
            value={walkthrough.tapeId}
            style={{ maxWidth: "100%" }}
            onChange={(event) => {
              setLocation({ kind: "absent" });
              setTapeId(event.currentTarget.value);
              setIndex(0);
              setResult(null);
            }}
          >
            {walkthroughs.map((entry) => (
              <option key={entry.tapeId} value={entry.tapeId}>
                {entry.title}
              </option>
            ))}
          </select>
          {walkthrough.description && <p>{walkthrough.description}</p>}
          <p>
            <a href={tapePath(walkthrough.tapeId)}>
              Read this walkthrough, its predictions, and its recorded values
            </a>
          </p>
          {walkthrough.checkpoints.length === 0 ? (
            <p>This walkthrough has no recorded checkpoint to restore.</p>
          ) : (
            <>
              <label htmlFor={`${id}-checkpoint`}>Checkpoint to inspect</label>{" "}
              <select
                id={`${id}-checkpoint`}
                value={index}
                style={{ maxWidth: "100%" }}
                onChange={(event) => inspect(Number(event.currentTarget.value))}
              >
                {walkthrough.checkpoints.map((stop, stopIndex) => (
                  <option key={`${stop.actionIndex}-${stop.label}`} value={stopIndex}>
                    {stopIndex + 1}. {stop.label}
                  </option>
                ))}
              </select>
              {checkpoint && (
                <div aria-live="polite" data-walkthrough-checkpoint={checkpoint.actionIndex}>
                  <p>
                    <strong>{checkpoint.label}</strong>
                  </p>
                  {checkpoint.teachingNote && <p>{checkpoint.teachingNote}</p>}
                  {!formOnly && !checkpoint.tape && (
                    <p>{checkpoint.unavailable || "This stop cannot be replayed."}</p>
                  )}
                </div>
              )}
              {checkpoint?.expectedDisplayValues && checkpoint.expectedDisplayValues.length > 0 && (
                <CheckpointReadingsPanel
                  expected={checkpoint.expectedDisplayValues}
                  settings={checkpoint.settings}
                  experimentId={experimentId}
                  owner={owner}
                  compare={result?.kind === "replayed" || result?.kind === "new-run"}
                />
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <button type="button" disabled={index <= 0} onClick={() => inspect(index - 1)}>
                  Inspect previous checkpoint
                </button>
                <button
                  type="button"
                  disabled={index >= walkthrough.checkpoints.length - 1}
                  onClick={() => inspect(index + 1)}
                >
                  Inspect next checkpoint
                </button>
                <button
                  type="button"
                  disabled={!checkpoint || (!formOnly && !checkpoint.tape)}
                  onClick={(event) =>
                    void run(
                      (signal) =>
                        applyWalkthroughCheckpointAsync(target, walkthrough, index, signal),
                      event.currentTarget,
                    )
                  }
                >
                  {formOnly ? "Load checkpoint settings" : "Restore checkpoint"}
                </button>
              </div>
              {target.kind !== "form" && target.calculate && checkpoint && (
                <p>
                  <button
                    type="button"
                    style={{ whiteSpace: "normal", maxWidth: "100%" }}
                    onClick={(event) =>
                      void run(
                        (signal) =>
                          calculateWalkthroughCheckpointAsync(target, walkthrough, index, signal),
                        event.currentTarget,
                      )
                    }
                  >
                    Calculate these settings as a new run
                  </button>{" "}
                  This uses the current laboratory, not a reproduction of the recorded run.
                </p>
              )}
            </>
          )}
          {working && (
            <p role="status">
              Checking the recorded settings and waiting for the laboratory's accepted result…
            </p>
          )}
          {result && (
            <p
              role={result.kind === "refused" ? "alert" : "status"}
              data-walkthrough-outcome={result.kind}
            >
              {result.notice}
            </p>
          )}
        </fieldset>
      )}
      {working && (
        <p>
          {/* Outside the disabled fieldset: a paused or stalled worker still has an operable exit. */}
          <button type="button" onClick={cancel}>
            Cancel calculation
          </button>
        </p>
      )}
      <p>
        <a href="/tapes/">Browse all recorded walkthroughs</a>
      </p>
    </details>
  );
}
