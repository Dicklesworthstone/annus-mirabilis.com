"use client";

import { useEffect, useId, useState } from "react";
import {
  applyWalkthroughCheckpoint,
  calculateWalkthroughCheckpoint,
  type WalkthroughAction,
  type WalkthroughTarget,
} from "./walkthroughActions.ts";
import { tapePath } from "../../reader/sitePaths.ts";
import { checkpointAt, type WalkthroughCatalogue } from "./walkthroughCheckpoints.ts";

async function loadCatalogue(): Promise<WalkthroughCatalogue> {
  const { WALKTHROUGH_CATALOGUE } = await import("./walkthroughCatalogue.ts");
  return WALKTHROUGH_CATALOGUE;
}

/**
 * One checkpoint player for all shared-link laboratories (am-rt-control-tapes-0gc).
 * The catalogue is loaded only when opened. Every instance has its own selection and labels;
 * the only application path is the supplied laboratory adapter, never a second numeric owner.
 */
export function WalkthroughPlayer({
  target,
  load = loadCatalogue,
}: Readonly<{
  target: WalkthroughTarget;
  load?: (() => Promise<WalkthroughCatalogue>) | undefined;
}>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [catalogue, setCatalogue] = useState<WalkthroughCatalogue | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [tapeId, setTapeId] = useState("");
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<WalkthroughAction | null>(null);
  const experimentId = target.experimentId;

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
  }, [open, catalogue, load, retry]);

  const walkthroughs =
    catalogue?.walkthroughs.filter((entry) => entry.experimentId === experimentId) ?? [];
  const walkthrough = walkthroughs.find((entry) => entry.tapeId === tapeId) ?? walkthroughs[0];
  const checkpoint = walkthrough ? checkpointAt(walkthrough, index) : null;
  const formOnly = target.kind === "form";

  const apply = (nextIndex: number) => {
    if (!walkthrough) return;
    setIndex(nextIndex);
    setResult(applyWalkthroughCheckpoint(target, walkthrough, nextIndex));
  };

  return (
    <details
      className="notice"
      data-walkthrough-player={experimentId}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Explore recorded walkthroughs</summary>
      <p>
        {formOnly
          ? "Load a recorded stop into the form, then Apply to make a new calculation. Loading settings does not replay the recorded experiment."
          : "Choose a walkthrough and restore its recorded checkpoints, forwards or backwards. Selecting a stop previews its note; use Restore to change the laboratory."}
      </p>
      {loading && <p role="status">Loading recorded walkthroughs…</p>}
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
        <fieldset style={{ minWidth: 0, maxWidth: "100%" }}>
          <legend>Recorded checkpoints</legend>
          <label htmlFor={`${id}-tape`}>Walkthrough</label>{" "}
          <select
            id={`${id}-tape`}
            value={walkthrough.tapeId}
            style={{ maxWidth: "100%" }}
            onChange={(event) => {
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
                onChange={(event) => {
                  setIndex(Number(event.currentTarget.value));
                  setResult(null);
                }}
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                <button type="button" disabled={index <= 0} onClick={() => apply(index - 1)}>
                  {formOnly ? "Load previous settings" : "Restore previous checkpoint"}
                </button>
                <button
                  type="button"
                  disabled={!checkpoint || (!formOnly && !checkpoint.tape)}
                  onClick={() => apply(index)}
                >
                  {formOnly ? "Load checkpoint settings" : "Restore checkpoint"}
                </button>
                <button
                  type="button"
                  disabled={index >= walkthrough.checkpoints.length - 1}
                  onClick={() => apply(index + 1)}
                >
                  {formOnly ? "Load next settings" : "Restore next checkpoint"}
                </button>
              </div>
              {target.kind === "session" &&
                target.calculate &&
                checkpoint &&
                (!checkpoint.tape || result?.kind === "refused") && (
                  <p>
                    <button
                      type="button"
                      style={{ whiteSpace: "normal", maxWidth: "100%" }}
                      onClick={() =>
                        setResult(calculateWalkthroughCheckpoint(target, walkthrough, index))
                      }
                    >
                      Calculate these settings as a new run
                    </button>{" "}
                    This uses the current laboratory, not a reproduction of the recorded run.
                  </p>
                )}
            </>
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
      <p>
        <a href="/tapes/">Browse all recorded walkthroughs</a>
      </p>
    </details>
  );
}
