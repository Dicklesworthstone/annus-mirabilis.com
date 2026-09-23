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

const srOnlyStyle: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: 0,
};

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
      className={className || undefined}
      data-interaction-family="clock-event"
      data-testid={testId}
    >
      {/* Live Region for Screen-Reader Announcements */}
      <div style={srOnlyStyle} aria-live="polite" role="status">
        {announcement}
      </div>

      {/* Visual Diagram Representation */}
      <div
        style={{
          padding: "0.75rem",
          borderRadius: "0.25rem",
          background: "var(--wash)",
          border: "1px solid var(--line)",
        }}
      >
        <h4
          className="eyebrow"
          style={{
            fontSize: "var(--type-fine)",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--ink)",
            marginBottom: "0.5rem",
          }}
        >
          Space-time event selection
        </h4>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginBottom: "0.75rem",
          }}
        >
          {events.map((ev) => {
            const isSelected = selectedIds.includes(ev.id);
            return (
              <button
                key={ev.id}
                type="button"
                disabled={disabled}
                onClick={() => handleToggleEvent(ev.id)}
                aria-pressed={isSelected}
                className="button"
                style={{
                  padding: "0.375rem 0.75rem",
                  borderRadius: "0.25rem",
                  fontSize: "var(--type-fine)",
                  fontFamily: "var(--font-mono, monospace)",
                  cursor: disabled ? "not-allowed" : "pointer",
                  background: isSelected ? "var(--accent)" : "var(--panel)",
                  color: isSelected ? "var(--panel)" : "var(--ink)",
                  fontWeight: isSelected ? 700 : "normal",
                  border: isSelected ? "1px solid var(--accent)" : "1px solid var(--line)",
                }}
              >
                {ev.label} (t={ev.t}s, x={ev.x}ls)
              </button>
            );
          })}
        </div>

        {/* Frame Observer Control */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            fontSize: "var(--type-fine)",
          }}
        >
          <label
            htmlFor={`${compId}-velocity`}
            style={{
              fontFamily: "var(--font-sans, inherit)",
              color: "var(--ink)",
            }}
          >
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
            style={{
              width: "9rem",
              accentColor: "var(--accent)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--ink)",
            }}
          >
            {beta.toFixed(2)}c
          </span>
        </div>
      </div>

      {/* Accessible Equivalent Table Panel */}
      <div
        style={{
          marginTop: "0.75rem",
          padding: "0.75rem",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
      >
        <h5
          style={{
            fontSize: "var(--type-fine)",
            fontWeight: 700,
            color: "var(--ink)",
            marginBottom: "0.25rem",
          }}
        >
          Accessible event roster and simultaneity
        </h5>
        <table
          style={{
            width: "100%",
            fontSize: "var(--type-fine)",
            textAlign: "left",
            borderCollapse: "collapse",
          }}
          aria-label="Event Coordinates and Simultaneity"
        >
          <thead>
            <tr
              style={{
                borderBottom: "1px solid var(--line)",
                color: "var(--muted)",
              }}
            >
              <th style={{ padding: "0.25rem 0.5rem" }}>Select</th>
              <th style={{ padding: "0.25rem 0.5rem" }}>Event</th>
              <th style={{ padding: "0.25rem 0.5rem" }}>Rest (t, x)</th>
              <th style={{ padding: "0.25rem 0.5rem" }}>Frame S&apos; (t&apos;, x&apos;)</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => {
              const isSelected = selectedIds.includes(ev.id);
              const trans = transformedCoordinates?.[ev.id];
              return (
                <tr
                  key={ev.id}
                  style={{
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <td style={{ padding: "0.25rem 0.5rem" }}>
                    <input
                      type="checkbox"
                      id={`${compId}-check-${ev.id}`}
                      checked={isSelected}
                      disabled={disabled}
                      onChange={() => handleToggleEvent(ev.id)}
                      aria-label={`Select event ${ev.label}`}
                      style={{ accentColor: "var(--accent)" }}
                    />
                  </td>
                  <td
                    style={{
                      padding: "0.25rem 0.5rem",
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}
                  >
                    <label htmlFor={`${compId}-check-${ev.id}`}>{ev.label}</label>
                  </td>
                  <td
                    style={{
                      padding: "0.25rem 0.5rem",
                      fontFamily: "var(--font-mono, monospace)",
                      color: "var(--ink)",
                    }}
                  >
                    t={ev.t}s, x={ev.x}ls
                  </td>
                  <td
                    style={{
                      padding: "0.25rem 0.5rem",
                      fontFamily: "var(--font-mono, monospace)",
                      color: "var(--ink)",
                    }}
                  >
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
            style={{
              marginTop: "0.5rem",
              fontSize: "var(--type-fine)",
              color: "var(--accent)",
              fontWeight: 500,
            }}
            data-testid="simultaneity-status"
          >
            Simultaneity Verdict: {simultaneityStatus}
          </div>
        )}
      </div>
    </div>
  );
}
