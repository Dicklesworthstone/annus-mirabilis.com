"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type DraftTapeBinding, draftTapeForSettings, loadDraftTapeFromUrl } from "./draftTape.ts";
import { ShareControl } from "./ShareControl.tsx";
import {
  type LabTapeBinding,
  restoreTapeFromUrl,
  restoreTape,
  requirementsOf,
  settingsFromTape,
  type TapeSession,
  tapeForSettings,
} from "./sessionTape.ts";
import type { TapeV2 } from "./types.ts";
import {
  retainedWalkthroughTape,
  type RetainedWalkthroughTape,
  type WalkthroughTarget,
} from "./walkthroughActions.ts";
import { WalkthroughPlayer } from "./WalkthroughPlayer.tsx";

export type LabTapeLinkState = Readonly<{
  notice: string;
  shareTape: TapeV2 | null;
  /** A link read without fault, said plainly rather than as an error (a worker lab's loaded form). */
  note?: string | undefined;
  walkthrough?: WalkthroughTarget | undefined;
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
  const [checkpointShare, setCheckpointShare] = useState<RetainedWalkthroughTape | null>(null);
  // The latest callback, so a new closure on each render neither re-runs the restore nor goes stale.
  const restoredRef = useRef(onRestored);
  restoredRef.current = onRestored;
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void restoreTapeFromUrl(binding, session, window.location.href).then((restored) => {
      if (!live) return;
      if (restored.kind === "not-restored") setNotice(restored.notice);
      else if (restored.kind === "restored") restoredRef.current?.(session.acceptedParameters());
    });
    return () => {
      live = false;
    };
  }, [binding, session, enabled]);
  const sharedCheckpoint = enabled && acceptedParameters
    ? retainedWalkthroughTape(checkpointShare, binding, session, acceptedParameters) : null;
  useEffect(() => {
    if (checkpointShare && !sharedCheckpoint) setCheckpointShare(null);
  }, [checkpointShare, sharedCheckpoint]);
  const shareTape = useMemo(
    () => sharedCheckpoint ?? (enabled && acceptedParameters
      ? tapeForSettings(binding, acceptedParameters) : null),
    [binding, acceptedParameters, enabled, sharedCheckpoint],
  );
  const walkthrough = useMemo<WalkthroughTarget | undefined>(() => enabled ? {
    kind: "session",
    experimentId: binding.environment.experimentId,
    restore(tape) {
      const restored = restoreTape(binding, session, tape);
      if (restored.kind === "restored") {
        setNotice("");
        const parameters = session.acceptedParameters();
        setCheckpointShare({ binding, session, parameters: { ...parameters }, tape });
        restoredRef.current?.(parameters);
        return { kind: "restored" };
      }
      return { kind: "not-restored", notice: restored.kind === "not-restored"
        ? restored.notice : "The checkpoint could not be restored." };
    },
    calculate(recorded) {
      const settings = { ...binding.defaults, ...settingsFromTape(recorded, binding.defaults) };
      const tape = tapeForSettings(binding, settings);
      if (!tape) return {
        kind: "not-restored",
        notice: requirementsOf(binding.validate(settings)) || "This laboratory does not accept the recorded settings.",
      };
      const restored = restoreTape(binding, session, tape);
      if (restored.kind !== "restored") return {
        kind: "not-restored",
        notice: restored.kind === "not-restored" ? restored.notice : "The new calculation could not be applied.",
      };
      setCheckpointShare(null);
      setNotice("");
      restoredRef.current?.(session.acceptedParameters());
      return { kind: "calculated" };
    },
  } : undefined, [binding, session, enabled]);
  return { notice, shareTape, walkthrough };
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
  onLoaded: (settings: Readonly<Record<string, unknown>>) => void,
): LabTapeLinkState {
  const [notice, setNotice] = useState("");
  const [note, setNote] = useState("");
  const loadedRef = useRef(onLoaded);
  loadedRef.current = onLoaded;
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void loadDraftTapeFromUrl(binding, window.location.href).then((loaded) => {
      if (!live) return;
      if (loaded.kind === "not-restored") setNotice(loaded.notice);
      else if (loaded.kind === "loaded") {
        loadedRef.current(loaded.settings);
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
  const walkthrough = useMemo<WalkthroughTarget | undefined>(() => enabled ? {
    kind: "form",
    experimentId: binding.environment.experimentId,
    load(recorded) {
      const settings = { ...binding.defaults, ...settingsFromTape(recorded, binding.defaults) };
      const checked = binding.validate(settings);
      if (checked.kind !== "accepted") return {
        kind: "not-restored",
        notice: requirementsOf(checked) || "This laboratory does not accept the recorded settings.",
      };
      const data = checked.data;
      loadedRef.current(data && typeof data === "object" ? data as Record<string, unknown> : settings);
      setNotice("");
      setNote("");
      return { kind: "loaded" };
    },
  } : undefined, [binding, enabled]);
  return { notice, shareTape, note, walkthrough };
}

/**
 * The notice for a link that could not be restored, and the share control for the accepted state.
 *
 * The share control is drawn only after hydration. Without JavaScript nothing can be encoded, so
 * there is no link to copy, and a reader without it gets no control that cannot work (AGENTS.md:
 * "No-JavaScript readers get real links, never hydration-dependent buttons"). Drawn in the server
 * markup, its field sat ahead of the "controls need JavaScript" notice on five lab pages.
 */
export function LabTapeLink({ link }: Readonly<{ link: LabTapeLinkState }>) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <>
      {link.notice && (
        <p role="alert" className="notice error" data-tape-notice="">
          {link.notice}
        </p>
      )}
      {link.note && (
        <p role="status" className="notice" data-tape-loaded="">
          {link.note}
        </p>
      )}
      {link.walkthrough && <p><a href="/tapes/">Read recorded walkthroughs</a></p>}
      {hydrated && link.walkthrough && <WalkthroughPlayer key={link.walkthrough.experimentId} target={link.walkthrough} />}
      {hydrated && link.shareTape && <ShareControl tape={link.shareTape} />}
    </>
  );
}
