"use client";

import { useEffect, useRef, useState } from "react";
import type { InvestigationTask } from "./core.ts";
import { useDiscoveryInvestigation } from "./context.tsx";
import "./investigation.css";

/** Load the optional workspace only when requested; the authored task stays readable without it. */
export function InvestigationWorkspace({ task }: { task: InvestigationTask }) {
  const store = useDiscoveryInvestigation();
  const host = useRef<HTMLDivElement>(null);
  const [requested, setRequested] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!requested || !store || store.spec.promptId !== task.promptId) return;
    let live = true;
    let dispose: (() => void) | undefined;
    setFailed(false);
    void import("./workspace.ts").then(({ mountInvestigationWorkspace }) => {
      if (!live || !host.current) return;
      dispose = mountInvestigationWorkspace(host.current, store, task).dispose;
    }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; dispose?.(); };
  }, [requested, store, task, retry]);
  if (!store || store.spec.promptId !== task.promptId) return null;
  return <details className="investigation-disclosure" onToggle={(event) => {
    if (event.currentTarget.open) setRequested(true);
  }}>
    <summary>Record a prediction and compare the laboratory readings</summary>
    <noscript><p>The task above works on paper. Automatic capture of accepted readings needs JavaScript.</p></noscript>
    <div ref={host} />
    {failed && <p role="alert">The investigation controls could not load. The task and laboratory are still available. <button type="button" onClick={() => setRetry((n) => n + 1)}>Retry investigation controls</button></p>}
  </details>;
}
