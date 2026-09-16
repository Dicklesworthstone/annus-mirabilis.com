"use client";

/**
 * am-read-detail-axis-sfc. The reader's global Detail control: a labeled radio group for
 * Overview / Full explanation / Show every step, plus "Apply this to the rest of the page" once
 * a per-unit override exists elsewhere on the page. This component owns only the control's own
 * state transition and its single change announcement.
 *
 * It never touches scroll position, storage, or the URL -- those belong to the consuming reader
 * shell (am-read-shell-routes-3ua) and the pre-paint script (src/reader/detail/prepaint.ts),
 * which this bead's own contract keeps to one attribute set before first paint. This component
 * changes `data-detail` only through the `onChange` callback its caller wires to that shell; it
 * holds no storage or history logic of its own.
 */
import { useId, useState } from "react";
import type { Detail } from "../navigation/state.ts";
import {
  applyElsewhere,
  hasOverrides,
  type OverrideState,
  setGlobalDetail,
} from "./applyElsewhere.ts";

const DETAIL_OPTIONS: ReadonlyArray<Readonly<{ value: Detail; label: string }>> = Object.freeze([
  { value: 0, label: "Overview" },
  { value: 1, label: "Full explanation" },
  { value: 2, label: "Show every step" },
]);

function labelFor(level: Detail): string {
  return DETAIL_OPTIONS.find((option) => option.value === level)?.label ?? "";
}

export type DetailControlProps = Readonly<{
  state: OverrideState;
  onChange: (next: OverrideState) => void;
}>;

export function DetailControl({ state, onChange }: DetailControlProps) {
  const groupId = useId();
  const [announcement, setAnnouncement] = useState("");

  function selectGlobal(level: Detail): void {
    const next = setGlobalDetail(state, level);
    if (next === state) return;
    onChange(next);
    setAnnouncement(`Detail set to ${labelFor(next.globalDetail)}`);
  }

  function applyToRest(): void {
    const next = applyElsewhere(state);
    if (next === state) return;
    onChange(next);
    setAnnouncement(`Detail set to ${labelFor(next.globalDetail)}`);
  }

  return (
    <fieldset data-detail-control>
      <legend id={groupId}>Detail</legend>
      <div role="radiogroup" aria-labelledby={groupId}>
        {DETAIL_OPTIONS.map((option) => (
          <label key={option.value} data-detail-option={option.value}>
            <input
              type="radio"
              name={`detail-${groupId}`}
              value={option.value}
              checked={state.globalDetail === option.value}
              onChange={() => selectGlobal(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
      {hasOverrides(state) ? (
        <button type="button" data-detail-apply-elsewhere onClick={applyToRest}>
          Apply this to the rest of the page
        </button>
      ) : null}
      <p aria-live="polite" data-detail-announcement>
        {announcement}
      </p>
    </fieldset>
  );
}
