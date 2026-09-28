"use client";

import { useEffect, useId, useState } from "react";
import { DETAIL_STORAGE_KEY } from "../../reader/navigation/state.ts";

/**
 * THE DETAIL AXIS, ON THE PAGES WHERE ITS READINGS ARE (am-5bff).
 *
 * Every instrument authors four readings and a laboratory page showed one of them with no way to
 * ask for another. Measured 2026-09-27: the Detail control exists in PaperPage, PaperReader and
 * ReaderController and nowhere else, and the global reading-preferences panel in the root layout
 * carries line length, type size, contrast, paragraph spacing and reading-only, not Detail. So a
 * reader arriving at a laboratory from search or from the instruments index got R1 and could reach
 * R0 or R2 only by visiting a paper first or by typing ?detail= into the address bar.
 *
 * It was inverted, too: with the no-script rules of fd4ddf81 a reader WITHOUT JavaScript sees the
 * overview, the full explanation and every step, one after another, while a reader with it sees one
 * and cannot choose. This closes that.
 *
 * WHAT IT OWNS AND WHAT IT DOES NOT. It sets `data-detail` on the document and writes the reader's
 * own key, the same two things ReaderController does (ReaderController.tsx, DETAIL_STORAGE_KEY), so
 * a choice made on an instrument is the choice a paper opens with and the other way round. It holds
 * no reading state of its own: labShell.css decides what shows.
 *
 * IT DRAWS NOTHING UNTIL IT HAS HYDRATED, and nothing at all on a page with no readings. Without
 * JavaScript this control cannot work, and a control that cannot work is worse than none
 * (AGENTS.md: no-script readers get real links, never hydration-dependent buttons). Such a reader
 * already has all three readings on the page.
 */
const LEVELS: ReadonlyArray<Readonly<{ value: string; label: string }>> = Object.freeze([
  { value: "0", label: "In one breath" },
  { value: "1", label: "Full explanation" },
  { value: "2", label: "Every step" },
]);

export function LabDetailControl() {
  const groupId = useId();
  const [detail, setDetail] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    // A page with no authored readings gets no control: it would change nothing a reader can see.
    if (!document.querySelector("[data-detail]")) return;
    const current = document.documentElement.dataset.detail ?? "1";
    setDetail(LEVELS.some((level) => level.value === current) ? current : "1");
  }, []);

  function choose(value: string): void {
    document.documentElement.dataset.detail = value;
    setDetail(value);
    setAnnouncement(`${LEVELS.find((level) => level.value === value)?.label ?? ""}.`);
    try {
      localStorage.setItem(DETAIL_STORAGE_KEY, value);
    } catch {
      /* Storage may be blocked or full. The reading still changed on this page. */
    }
  }

  if (detail === null) return null;
  return (
    <fieldset className="lab-detail-control no-print">
      <legend>How much of the explanation</legend>
      {LEVELS.map((level) => (
        <label key={level.value} htmlFor={`${groupId}-${level.value}`}>
          <input
            type="radio"
            id={`${groupId}-${level.value}`}
            name={`${groupId}-detail`}
            value={level.value}
            checked={detail === level.value}
            onChange={() => choose(level.value)}
          />
          {level.label}
        </label>
      ))}
      <p aria-live="polite" className="visually-hidden">
        {announcement}
      </p>
    </fieldset>
  );
}
