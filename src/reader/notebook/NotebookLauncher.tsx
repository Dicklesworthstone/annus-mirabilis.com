"use client";

import { useEffect, useRef, useState } from "react";
import "./notebook.css";

/** Only the launcher hydrates; private notebook data is read on the device after hydration. */
export function NotebookLauncher() {
  const trigger = useRef<HTMLAnchorElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let disconnect: (() => void) | undefined;
    void Promise.all([import("./browser.ts"), import("./notebookStore.ts"), import("./storage.ts")])
      .then(([browser, notebook, storage]) => {
        if (disposed || !trigger.current || !host.current) return;
        disconnect = browser.mountReaderNotebook(
          host.current,
          trigger.current,
          notebook.createNotebookStore(storage.createNotebookStorage()),
        );
      })
      .catch(() => {
        // Keep the ordinary link usable; failure of an optional feature must not break reading.
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
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
