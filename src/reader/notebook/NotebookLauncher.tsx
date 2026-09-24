"use client";

import { useEffect, useRef, useState } from "react";
import { FIRST_INTERACTION, MOUNT_FALLBACK_MS, mountsAtOnce } from "./mountTiming.ts";
import "./notebook.css";

/**
 * Only the launcher hydrates; private notebook data is read on the device after hydration. On a
 * reading page the notebook itself loads on the reader's first interaction, or after five seconds
 * at the browser's next idle moment (mountTiming.ts says why, and which pages mount at once).
 */
export function NotebookLauncher() {
  const trigger = useRef<HTMLAnchorElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let started = false;
    let disconnect: (() => void) | undefined;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;
    const waiting = new AbortController();
    function mount(event?: Event) {
      if (disposed || started) return;
      started = true;
      waiting.abort();
      if (fallback !== undefined) clearTimeout(fallback);
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      const main = document.querySelector("main");
      const interacted = event?.target instanceof Node && main?.contains(event.target) === true;
      void Promise.all([import("./browser.ts"), import("./browserStore.ts")])
        .then(([browser, notebook]) => {
          if (disposed || !trigger.current || !host.current) return;
          disconnect = browser.mountReaderNotebook(
            host.current,
            trigger.current,
            notebook.getNotebookStore(),
            undefined,
            undefined,
            { interacted },
          );
        })
        .catch(() => {
          // Keep the ordinary link usable; failure of an optional feature must not break reading.
          if (!disposed) setFailed(true);
        });
    }
    if (mountsAtOnce(document, window.location.pathname)) mount();
    else {
      for (const name of FIRST_INTERACTION)
        window.addEventListener(name, mount, {
          capture: true,
          passive: true,
          signal: waiting.signal,
        });
      fallback = setTimeout(() => {
        fallback = undefined;
        if (typeof window.requestIdleCallback === "function")
          idle = window.requestIdleCallback(() => mount(), { timeout: 2000 });
        else mount();
      }, MOUNT_FALLBACK_MS);
    }
    return () => {
      disposed = true;
      waiting.abort();
      if (fallback !== undefined) clearTimeout(fallback);
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      disconnect?.();
    };
  }, []);
  return (
    <>
      <a ref={trigger} href="/notebook/">
        Notebook
      </a>
      <div className="notebook-host" ref={host} />
      {failed && (
        <span role="status">
          Notebook controls could not load. Reload to try again; reading is unaffected.
        </span>
      )}
    </>
  );
}
