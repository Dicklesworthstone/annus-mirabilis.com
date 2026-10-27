"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type InvestigationKeepStatus,
  useDiscoveryInvestigation,
  useInvestigationKeepStatus,
} from "./context.tsx";
import type { InvestigationTask } from "./core.ts";
import "./investigation.css";

/**
 * What became of the reader's copy on this device, said plainly. The one thing none of these may
 * do is imply the work is kept when it is not: three of the six say it is not, and each says what
 * to do instead.
 */
function keepNotice(status: InvestigationKeepStatus): ReactNode {
  switch (status) {
    case "restored":
      return (
        <>
          Opened the investigation you kept on this device. Your explanation can still change; new
          readings belong to a new investigation, because this one's readings came from a laboratory
          session that has ended.
        </>
      );
    case "kept":
      return (
        <>
          Kept on this device, in this browser. Nothing was uploaded. You can export or clear it
          under <a href="/your-data/">your data on this device</a>.
        </>
      );
    case "unavailable":
      return (
        <>
          This browser is not keeping the investigation, so it will not be here after you leave.
          Storage is blocked or unavailable. The work stays on this page; download it to keep it.
        </>
      );
    case "quota":
      return (
        <>
          This investigation is too large to keep on this device. It stays complete on this page;
          download it to keep it.
        </>
      );
    case "unreadable":
      return (
        <>
          An investigation saved on this device could not be read, so it was set aside under{" "}
          <a href="/your-data/">your data on this device</a> rather than discarded. Nothing here was
          overwritten.
        </>
      );
    default:
      return null;
  }
}

/** Load the optional workspace only when requested; the authored task stays readable without it. */
export function InvestigationWorkspace({ task }: { task: InvestigationTask }) {
  const store = useDiscoveryInvestigation();
  const keep = useInvestigationKeepStatus();
  const host = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  // `retry` is a deliberate RE-RUN TRIGGER and is never read here, which is precisely why
  // biome calls it unnecessary. The "try again" button below increments it to re-attempt the
  // dynamic import after a failure; remove the dependency and that button does nothing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry re-attempts the import when the reader presses try again; it is a trigger, not a value
  useEffect(() => {
    if (!requested || !store || store.spec.promptId !== task.promptId) return;
    let live = true;
    let dispose: (() => void) | undefined;
    setFailed(false);
    void import("./workspace.ts")
      .then(({ mountInvestigationWorkspace }) => {
        if (!live || !host.current) return;
        dispose = mountInvestigationWorkspace(host.current, store, task).dispose;
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      dispose?.();
    };
  }, [requested, store, task, retry]);
  if (!store || store.spec.promptId !== task.promptId) return null;
  return (
    <details
      className="investigation-disclosure"
      onToggle={(event) => {
        if (event.currentTarget.open) setRequested(true);
      }}
    >
      <summary>Record a prediction and compare the laboratory readings</summary>
      <noscript>
        <p>
          The task above works on paper. Automatic capture of accepted readings needs JavaScript.
        </p>
      </noscript>
      <p className="fine" role="status" aria-live="polite" data-investigation-keep={keep}>
        {keepNotice(keep)}
      </p>
      <div ref={host} />
      {failed && (
        <p role="alert">
          The investigation controls could not load. The task and laboratory are still available.{" "}
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Retry investigation controls
          </button>
        </p>
      )}
    </details>
  );
}
