"use client";
import { type ReactNode, useEffect, useRef } from "react";
import { makeDismissible } from "../../a11y/modal/dismiss.ts";
import { ModalCloseButton } from "../../a11y/modal/ModalCloseButton.tsx";

type SheetProps = { title: string; children: ReactNode };

/**
 * The companion on the narrow tier. Implemented as details/summary so it works without
 * JavaScript: keyboard open/close, passage stays in the document, peek via the summary. CSS hides
 * this on wide/medium tiers.
 *
 * Open, it is sticky at the bottom and covers up to 70% of a phone's screen, over the text: an
 * overlay by the owner's rule ("any modal should be able to be closed by clicking/tapping anywhere
 * outside of it, and should always have an X button in the upper right corner"). So it has the X,
 * and a tap outside or Escape closes it; focus goes back to its summary after the X or Escape,
 * and stays where the reader tapped after a tap outside.
 */
export function BottomSheet({ title, children }: SheetProps) {
  const sheet = useRef<HTMLDetailsElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const details = sheet.current;
    if (!details) return;
    const dismissal = new AbortController();
    makeDismissible(details, {
      signal: dismissal.signal,
      closeButton: close.current,
      onDismiss: (reason) => {
        details.open = false;
        if (reason !== "outside") details.querySelector("summary")?.focus();
      },
    });
    return () => dismissal.abort();
  }, []);
  return (
    <details ref={sheet} data-bottom-sheet="" className="reader-bottom-sheet">
      <summary>{title}</summary>
      <ModalCloseButton ref={close} label={`Close ${title.toLowerCase()}`} />
      {children}
    </details>
  );
}
