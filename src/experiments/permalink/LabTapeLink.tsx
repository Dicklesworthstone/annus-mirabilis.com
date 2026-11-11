"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type DraftTapeBinding,
  draftTapeForSettings,
  loadDraftTapeAsCurrentSettings,
  loadDraftTapeFromUrl,
} from "./draftTape.ts";
import { ExperimentRecorder } from "./ExperimentRecorder.tsx";
import { ShareControl } from "./ShareControl.tsx";
import {
  calculateNewRun,
  calculateTapeAsNewRun,
  type LabTapeBinding,
  requirementsOf,
  restoreTape,
  restoreTapeFromUrl,
  settingsFromTape,
  type TapeNewRunRequest,
  type TapeSession,
  tapeForSettings,
} from "./sessionTape.ts";
import type { TapePredictionEvent, TapeV2 } from "./types.ts";
import { WalkthroughPlayer } from "./WalkthroughPlayer.tsx";
import {
  type RetainedWalkthroughTape,
  retainedWalkthroughTape,
  type WalkthroughTarget,
  type WorkerWalkthroughTarget,
} from "./walkthroughActions.ts";

export type LabTapeLinkState = Readonly<{
  notice: string;
  shareTape: TapeV2 | null;
  /** A fresh accepted-settings snapshot, separate from an authored checkpoint retained for sharing. */
  recordingTape?: TapeV2 | null | undefined;
  /** A link read without fault, said plainly rather than as an error (a worker lab's loaded form). */
  note?: string | undefined;
  walkthrough?: WalkthroughTarget | undefined;
  /** A refused historical record can be reused only through the reader's explicit choice. */
  recovery?: Readonly<{ label: string; explanation: string; run(): void }> | undefined;
}>;

/**
 * A laboratory's ?tape= link (am-inst-permalink-tape-s677): restores a shared link into the
 * laboratory's session once, on mount, and gives the tape for its accepted settings to share.
 * `enabled` is false for a laboratory the link does not describe, such as a page's optional second
 * copy.
 *
 * `onRestored` receives the restored settings, for a laboratory whose form keeps its own draft.
 * Without it the form went on showing the defaults over the restored results, and pressing Apply put
 * the defaults back: 12 of 12 laboratories with an Apply button lost the shared settings that way,
 * measured in Chromium on a build of 4c0c2c7c.
 */
export function useLabTapeLink<P extends object>(
  binding: LabTapeBinding,
  session: Omit<TapeSession, "acceptedParameters"> & Readonly<{ acceptedParameters(): P }>,
  acceptedParameters: object | null | undefined,
  enabled = true,
  onRestored?: (parameters: P) => void,
): LabTapeLinkState {
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const [pendingNewRun, setPendingNewRun] = useState<Readonly<{
    binding: LabTapeBinding;
    session: TapeSession;
    request: TapeNewRunRequest;
  }> | null>(null);
  const [checkpointShare, setCheckpointShare] = useState<RetainedWalkthroughTape | null>(null);
  // The latest callback, so a new closure on each render neither re-runs the restore nor goes stale.
  const restoredRef = useRef(onRestored);
  restoredRef.current = onRestored;
  useEffect(() => {
    setPendingNewRun(null);
    setNote("");
    setNotice("");
    if (!enabled) return;
    let live = true;
    void restoreTapeFromUrl(binding, session, window.location.href).then((restored) => {
      if (!live) return;
      if (restored.kind === "not-restored") {
        setNotice(restored.notice);
        if (restored.newRun) setPendingNewRun({ binding, session, request: restored.newRun });
      } else if (restored.kind === "restored") restoredRef.current?.(session.acceptedParameters());
    });
    return () => {
      live = false;
    };
  }, [binding, session, enabled]);
  const sharedCheckpoint =
    enabled && acceptedParameters
      ? retainedWalkthroughTape(checkpointShare, binding, session, acceptedParameters)
      : null;
  useEffect(() => {
    if (checkpointShare && !sharedCheckpoint) setCheckpointShare(null);
  }, [checkpointShare, sharedCheckpoint]);
  const recordingTape = useMemo(
    () => (enabled && acceptedParameters ? tapeForSettings(binding, acceptedParameters) : null),
    [binding, acceptedParameters, enabled],
  );
  const shareTape = sharedCheckpoint ?? recordingTape;
  const recovery = useMemo<LabTapeLinkState["recovery"]>(
    () =>
      enabled && pendingNewRun?.binding === binding && pendingNewRun.session === session
        ? {
            label: "Calculate this checkpoint as a new run",
            explanation:
              "The recorded result could not be verified. You can calculate its controls with the current model as a separate run; the original record keeps its identity.",
            run() {
              const calculated = calculateTapeAsNewRun(binding, session, pendingNewRun.request);
              if (calculated.kind !== "calculated") {
                setNotice(calculated.notice);
                return;
              }
              setPendingNewRun(null);
              setCheckpointShare(null);
              setNotice("");
              setNote(
                "Calculated the shared checkpoint as a new run with the current model. The recorded result has not been verified.",
              );
              restoredRef.current?.(session.acceptedParameters());
            },
          }
        : undefined,
    [binding, session, enabled, pendingNewRun],
  );
  const walkthrough = useMemo<WalkthroughTarget | undefined>(
    () =>
      enabled
        ? {
            kind: "session",
            experimentId: binding.environment.experimentId,
            restore(tape) {
              const restored = restoreTape(binding, session, tape);
              if (restored.kind === "restored") {
                setPendingNewRun(null);
                setNote("");
                setNotice("");
                const parameters = session.acceptedParameters();
                setCheckpointShare({ binding, session, parameters: { ...parameters }, tape });
                restoredRef.current?.(parameters);
                return { kind: "restored" };
              }
              return {
                kind: "not-restored",
                notice:
                  restored.kind === "not-restored"
                    ? restored.notice
                    : "The checkpoint could not be restored.",
              };
            },
            calculate(recorded) {
              const settings = {
                ...binding.defaults,
                ...settingsFromTape(recorded, binding.defaults),
              };
              const calculated = calculateNewRun(binding, session, settings);
              if (calculated.kind !== "calculated") return calculated;
              setPendingNewRun(null);
              setNote("");
              setCheckpointShare(null);
              setNotice("");
              restoredRef.current?.(session.acceptedParameters());
              return calculated;
            },
          }
        : undefined,
    [binding, session, enabled],
  );
  return { notice, shareTape, recordingTape, note, recovery, walkthrough };
}

/**
 * A worker laboratory's ?tape= link (draftTape.ts): a shared link's settings go into the form through
 * `onLoaded`, and no calculation starts until the reader applies them, as the lab's own settings links
 * already behave. The share control offers the tape for the accepted settings.
 */
export function useDraftTapeLink(
  binding: DraftTapeBinding,
  acceptedParameters: object | null | undefined,
  enabled: boolean,
  onLoaded: (
    settings: Readonly<Record<string, unknown>>,
    predictions?: readonly TapePredictionEvent[],
  ) => void,
): LabTapeLinkState {
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const [pendingSettings, setPendingSettings] = useState<Readonly<{
    binding: DraftTapeBinding;
    tape: TapeV2;
  }> | null>(null);
  const loadedRef = useRef(onLoaded);
  loadedRef.current = onLoaded;
  useEffect(() => {
    setPendingSettings(null);
    setNote("");
    setNotice("");
    if (!enabled) return;
    let live = true;
    void loadDraftTapeFromUrl(binding, window.location.href).then((loaded) => {
      if (!live) return;
      if (loaded.kind === "not-restored") {
        setNotice(loaded.notice);
        if (loaded.newSettings) setPendingSettings({ binding, tape: loaded.newSettings });
      } else if (loaded.kind === "loaded") {
        loadedRef.current(loaded.settings, loaded.predictions);
        setNote("The shared link's settings are in the form. Apply them to calculate.");
      }
    });
    return () => {
      live = false;
    };
  }, [binding, enabled]);
  const shareTape = useMemo(
    () =>
      enabled && acceptedParameters ? draftTapeForSettings(binding, acceptedParameters) : null,
    [binding, acceptedParameters, enabled],
  );
  const recovery = useMemo<LabTapeLinkState["recovery"]>(
    () =>
      enabled && pendingSettings?.binding === binding
        ? {
            label: "Copy these settings for a new calculation",
            explanation:
              "The recorded result could not be verified. Copy its validated settings into the form, then Apply to calculate with the current model.",
            run() {
              const loaded = loadDraftTapeAsCurrentSettings(binding, pendingSettings.tape);
              if (loaded.kind !== "loaded") {
                if (loaded.kind === "not-restored") setNotice(loaded.notice);
                return;
              }
              loadedRef.current(loaded.settings, loaded.predictions);
              setPendingSettings(null);
              setNotice("");
              setNote(
                "Settings copied for a new calculation. Apply them to calculate with the current model. The recorded result has not been verified.",
              );
            },
          }
        : undefined,
    [binding, enabled, pendingSettings],
  );
  const walkthrough = useMemo<WalkthroughTarget | undefined>(
    () =>
      enabled
        ? {
            kind: "form",
            experimentId: binding.environment.experimentId,
            load(recorded) {
              const settings = {
                ...binding.defaults,
                ...settingsFromTape(recorded, binding.defaults),
              };
              const checked = binding.validate(settings);
              if (checked.kind !== "accepted")
                return {
                  kind: "not-restored",
                  notice:
                    requirementsOf(checked) ||
                    "This laboratory does not accept the recorded settings.",
                };
              const data = checked.data;
              loadedRef.current(
                data && typeof data === "object" ? (data as Record<string, unknown>) : settings,
              );
              setPendingSettings(null);
              setNotice("");
              setNote("");
              return { kind: "loaded" };
            },
          }
        : undefined,
    [binding, enabled],
  );
  return { notice, shareTape, recordingTape: shareTape, note, recovery, walkthrough };
}

/**
 * The notice for a link that could not be restored, and the share control for the accepted state.
 *
 * The share control is drawn only after hydration. Without JavaScript nothing can be encoded, so
 * there is no link to copy, and a reader without it gets no control that cannot work (AGENTS.md:
 * "No-JavaScript readers get real links, never hydration-dependent buttons"). Drawn in the server
 * markup, its field sat ahead of the "controls need JavaScript" notice on five lab pages.
 */
export function LabTapeLink({
  link,
  workerWalkthrough,
}: Readonly<{
  link: LabTapeLinkState;
  /** Explicit worker playback; the recorder and ordinary incoming links can remain form-only. */
  workerWalkthrough?: WorkerWalkthroughTarget | undefined;
}>) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <>
      {link.notice && (
        <p role="alert" className="notice error" data-tape-notice="">
          {link.notice}
        </p>
      )}
      {hydrated && link.recovery && (
        <div className="notice" data-tape-recovery="">
          <p>{link.recovery.explanation}</p>
          <button type="button" onClick={link.recovery.run}>
            {link.recovery.label}
          </button>
        </div>
      )}
      {link.note && (
        <p role="status" className="notice" data-tape-loaded="">
          {link.note}
        </p>
      )}
      {link.walkthrough && (
        <p>
          <a href="/tapes/">Read recorded walkthroughs</a>
        </p>
      )}
      {hydrated && link.walkthrough && (
        <WalkthroughPlayer
          key={link.walkthrough.experimentId}
          target={workerWalkthrough ?? link.walkthrough}
        />
      )}
      {hydrated && link.walkthrough && (
        <ExperimentRecorder
          key={`recording-${link.walkthrough.experimentId}`}
          target={link.walkthrough}
          tape={link.recordingTape ?? null}
        />
      )}
      {hydrated && link.shareTape && <ShareControl tape={link.shareTape} />}
    </>
  );
}
