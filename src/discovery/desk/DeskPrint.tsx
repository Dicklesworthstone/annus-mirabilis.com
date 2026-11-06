"use client";

import { useEffect } from "react";

/** Print every answer and source, then restore the reader's open/closed choices. CSS covers no JS. */
export function DeskPrint() {
  useEffect(() => {
    let closed: HTMLDetailsElement[] = [];
    let printing = false;
    const before = () => {
      if (printing) return;
      printing = true;
      closed = [...document.querySelectorAll<HTMLDetailsElement>(".desk-page details:not([open])")];
      for (const details of closed) details.open = true;
    };
    const after = () => {
      for (const details of closed) if (details.isConnected) details.open = false;
      closed = [];
      printing = false;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
      after();
    };
  }, []);
  return null;
}
