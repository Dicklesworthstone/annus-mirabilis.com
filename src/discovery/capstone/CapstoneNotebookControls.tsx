"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CaptureEquation } from "../../reader/notebook/capstoneEntry.ts";
import type { Capstone } from "./capstoneSchema.ts";
import type { WorksheetState } from "./worksheetState.ts";

/** Load the notebook only after the reader asks; the initial worksheet imports no replay engine. */
export function CapstoneNotebookControls(props: Readonly<{
  capstone: Capstone;
  worksheet: WorksheetState;
  equations: readonly CaptureEquation[];
  onRestore(worksheet: WorksheetState): void;
  download(text: string, filename: string): void;
}>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const capstoneId = props.capstone.id;
  useEffect(() => {
    if (!open || !host.current) return;
    const container = host.current;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    setLoading(true);
    setError("");
    void Promise.all([import("../../reader/notebook/browserStore.ts"), import("./notebookControls.ts")])
      .then(([browser, controls]) => {
        if (cancelled) return;
        const mounted = controls.mountCapstoneNotebook(container, browser.getNotebookStore(), {
          capstone: () => latest.current.capstone,
          worksheet: () => latest.current.worksheet,
          equations: () => latest.current.equations,
          restore: (worksheet) => latest.current.onRestore(worksheet),
          download: (text, filename) => latest.current.download(text, filename),
        });
        dispose = mounted.dispose;
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          setError("The notebook could not be opened. Your worksheet is unchanged. Close these controls and try again, or export your worksheet.");
        }
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [open, capstoneId]);
  return <div className="capstone-controls">
    <button type="button" ref={trigger} aria-expanded={open} aria-controls={id}
      onClick={() => {
        setOpen(!open);
        if (open) trigger.current?.focus();
      }}>
      {open ? "Close notebook snapshot controls" : "Keep or restore attempts in your notebook"}
    </button>
    {open && loading && <p role="status">Opening your notebook…</p>}
    {open && error && <p role="alert">{error}</p>}
    <div ref={host} id={id} hidden={!open} />
  </div>;
}
