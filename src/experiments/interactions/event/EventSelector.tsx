/**
 * EventSelector Primitive (clock-event family).
 * Specification: am-inst-interaction-families-m2ps, AGENTS.md §10.4–10.5.
 *
 * Visual: Select points on a space-time diagram.
 * Equivalent: Choose named events from a table and ask which frame regards them as simultaneous.
 * Default Command Class: measurement-change (event selection), observer-change (frame selection).
 */

import { useId, useState } from "react";
import type { BaseInteractionProps, TypedActionPayload } from "../types.ts";

export interface SpacetimeEvent {
  readonly id: string;
  readonly label: string;
  readonly t: number;
  readonly x: number;
  readonly y?: number | undefined;
  readonly z?: number | undefined;
  readonly description?: string | undefined;
}

export interface EventSelectorInputs {
  readonly selectedEventIds: readonly string[];
  readonly frameVelocity?: number | undefined;
}

export interface EventSelectorProps extends BaseInteractionProps<EventSelectorInputs> {
  readonly events: readonly SpacetimeEvent[];
  readonly selectedEventIds?: readonly string[] | undefined;
  readonly frameVelocity?: number | undefined;
  readonly simultaneityStatus?: string | undefined;
  readonly transformedCoordinates?:
    | Readonly<Record<string, { tPrime: number; xPrime: number }>>
    | undefined;
}

export function EventSelector({
  instrumentId,
  actionId,
  commandClass = "measurement-change",
  events,
  selectedEventIds = [],
  frameVelocity = 0,
  simultaneityStatus,
  transformedCoordinates,
  onAction,
  disabled = false,
  className = "",
  "data-testid": testId = "event-selector",
}: EventSelectorProps) {
  const compId = useId();
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(selectedEventIds);
  const [beta, setBeta] = useState<number>(frameVelocity);
  const [announcement, setAnnouncement] = useState<string>("");

  const handleToggleEvent = (eventId: string) => {
    if (disabled) return;
    const next = selectedIds.includes(eventId)
      ? selectedIds.filter((id) => id !== eventId)
      : [...selectedIds, eventId];
    setSelectedIds(next);

    const action: TypedActionPayload<EventSelectorInputs> = {
      instrumentId,
      actionId,
      commandClass,
      inputs: { selectedEventIds: next, frameVelocity: beta },
    };
    onAction(action);
    setAnnouncement(`Selected events: ${next.join(", ") || "none"}`);
  };

  const handleFrameChange = (newBeta: number) => {
    if (disabled) return;
    setBeta(newBeta);
    const action: TypedActionPayload<EventSelectorInputs> = {
      instrumentId,
      actionId,
      commandClass: "observer-change",
      inputs: { selectedEventIds: selectedIds, frameVelocity: newBeta },
    };
    onAction(action);
    setAnnouncement(`Frame velocity set to ${newBeta}c`);
  };

  return (
    <div
      className={`event-selector ${className}`}
      data-interaction-family="clock-event"
      data-testid={testId}
    >
      {/* Live Region for Screen-Reader Announcements */}
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>

      {/* Visual Diagram Representation */}
      <div className="event-diagram-pane p-3 rounded bg-amber-50/50 border border-amber-200">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-900 mb-2">
          Space-Time Event Selection
        </h4>
        <div className="flex flex-wrap gap-2 mb-3">
          {events.map((ev) => {
            const isSelected = selectedIds.includes(ev.id);
            return (
              <button
                key={ev.id}
                type="button"
                disabled={disabled}
                onClick={() => handleToggleEvent(ev.id)}
                aria-pressed={isSelected}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
                  isSelected
                    ? "bg-amber-600 text-white font-bold"
                    : "bg-white border border-amber-300 text-stone-800 hover:bg-amber-100"
                }`}
              >
                {ev.label} (t={ev.t}s, x={ev.x}ls)
              </button>
            );
          })}
        </div>

        {/* Frame Observer Control */}
        <div className="flex items-center gap-3 text-xs">
          <label htmlFor={`${compId}-velocity`} className="font-sans text-stone-700">
            Observer velocity (v/c):
          </label>
          <input
            id={`${compId}-velocity`}
            type="range"
            min="-0.99"
            max="0.99"
            step="0.05"
            value={beta}
            disabled={disabled}
            onChange={(e) => handleFrameChange(Number.parseFloat(e.target.value))}
            className="w-36 accent-amber-600"
          />
          <span className="font-mono text-stone-900">{beta.toFixed(2)}c</span>
        </div>
      </div>

      {/* Accessible Equivalent Table Panel */}
      <div className="event-table-equivalent mt-3 p-3 bg-stone-50 border border-stone-200 rounded">
        <h5 className="text-xs font-bold text-stone-800 mb-1">
          Accessible Event Roster & Simultaneity
        </h5>
        <table
          className="w-full text-xs text-left border-collapse"
          aria-label="Event Coordinates and Simultaneity"
        >
          <thead>
            <tr className="border-b border-stone-300 text-stone-600">
              <th className="py-1 px-2">Select</th>
              <th className="py-1 px-2">Event</th>
              <th className="py-1 px-2">Rest (t, x)</th>
              <th className="py-1 px-2">Frame S&apos; (t&apos;, x&apos;)</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => {
              const isSelected = selectedIds.includes(ev.id);
              const trans = transformedCoordinates?.[ev.id];
              return (
                <tr key={ev.id} className="border-b border-stone-200">
                  <td className="py-1 px-2">
                    <input
                      type="checkbox"
                      id={`${compId}-check-${ev.id}`}
                      checked={isSelected}
                      disabled={disabled}
                      onChange={() => handleToggleEvent(ev.id)}
                      aria-label={`Select event ${ev.label}`}
                    />
                  </td>
                  <td className="py-1 px-2 font-semibold">
                    <label htmlFor={`${compId}-check-${ev.id}`}>{ev.label}</label>
                  </td>
                  <td className="py-1 px-2 font-mono">
                    t={ev.t}s, x={ev.x}ls
                  </td>
                  <td className="py-1 px-2 font-mono">
                    {trans
                      ? `t'=${trans.tPrime.toFixed(2)}s, x'=${trans.xPrime.toFixed(2)}ls`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {simultaneityStatus && (
          <div
            className="mt-2 text-xs text-amber-900 font-medium"
            data-testid="simultaneity-status"
          >
            Simultaneity Verdict: {simultaneityStatus}
          </div>
        )}
      </div>
    </div>
  );
}
