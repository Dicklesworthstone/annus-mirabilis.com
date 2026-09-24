"use client";

import { useEffect, useRef, useState } from "react";

/** Automatic announcements are at least this far apart, as the announcement manager's are. */
const SPACING_MS = 1000;

/**
 * The line that says what a laboratory is showing, and says it again when that changes.
 *
 * A reader who changes a setting hears nothing unless something on the page is a live region: the
 * numbers change in place, silently. On 2026-09-24, 22 of the 41 live lab routes had none. This is
 * the line 19 of them already carried ("Accepted result: ..."), as one component: a polite status
 * region present from the first render, so its first change is announced, holding one sentence
 * the laboratory builds from its accepted snapshot. "Worked example" while the build's example is
 * shown and "Accepted" after a reader's change, matching the execution label.
 *
 * Dragging a slider commits at every step, so the text a region holds is spaced as the announcement
 * manager spaces its announcements (src/a11y/descriptions/announcementManager.ts): at most one
 * change a second, the newest summary replacing a waiting one, never a stream per frame.
 */
export function AcceptedStatus({
  worked,
  summary,
  response,
}: {
  worked: boolean;
  summary: string;
  /** A predict gate's attribute (PredictGate.tsx): the line states the result, so it waits too. */
  response?: Readonly<{ "data-predict-response": "shown" | "awaiting" }>;
}) {
  const text = `${worked ? "Worked example" : "Accepted"}: ${summary}`;
  const [shown, setShown] = useState(text);
  const lastChange = useRef(Number.NEGATIVE_INFINITY);
  useEffect(() => {
    if (text === shown) return;
    const wait = Math.max(0, lastChange.current + SPACING_MS - performance.now());
    const timer = setTimeout(() => {
      lastChange.current = performance.now();
      setShown(text);
    }, wait);
    return () => clearTimeout(timer);
  }, [text, shown]);
  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="status-line" {...response}>
      {shown}
    </p>
  );
}
