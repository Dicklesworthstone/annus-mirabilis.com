"use client";

import { useEffect, useMemo, useState } from "react";
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
 */
export function useLabTapeLink(
  binding: LabTapeBinding,
  session: TapeSession,
  acceptedParameters: object | null | undefined,
  enabled = true,
): LabTapeLinkState {
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void restoreTapeFromUrl(binding, session, window.location.href).then((restored) => {
      if (live && restored.kind === "not-restored") setNotice(restored.notice);
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

/** The notice for a link that could not be restored, and the share control for the accepted state. */
export function LabTapeLink({ link }: Readonly<{ link: LabTapeLinkState }>) {
  return (
    <>
      {link.notice && (
        <p role="alert" className="notice error" data-tape-notice="">
          {link.notice} The laboratory shows its default settings.
        </p>
      )}
      {link.shareTape && <ShareControl tape={link.shareTape} />}
    </>
  );
}
