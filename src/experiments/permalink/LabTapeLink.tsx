"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ShareControl } from "./ShareControl.tsx";
import {
  type LabTapeBinding,
  restoreTapeFromUrl,
  type TapeSession,
  tapeForSettings,
} from "./sessionTape.ts";
import type { TapeV2 } from "./types.ts";

export type LabTapeLinkState = Readonly<{ notice: string; shareTape: TapeV2 | null }>;

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
  const shareTape = useMemo(
    () => (enabled && acceptedParameters ? tapeForSettings(binding, acceptedParameters) : null),
    [binding, acceptedParameters, enabled],
  );
  return { notice, shareTape };
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
          {link.notice} The laboratory shows its default settings.
        </p>
      )}
      {hydrated && link.shareTape && <ShareControl tape={link.shareTape} />}
    </>
  );
}
