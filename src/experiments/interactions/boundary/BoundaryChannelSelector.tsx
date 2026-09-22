/**
 * BoundaryChannelSelector Primitive (energy-accounting family).
 * Specification: am-inst-interaction-families-m2ps, AGENTS.md §10.4–10.5.
 *
 * Visual: Drag a boundary around objects.
 * Equivalent: Select the objects included in the system and inspect energy crossing that boundary.
 * Default Command Class: measurement-change.
 */

import { useId, useState } from "react";
import type { BaseInteractionProps, TypedActionPayload } from "../types.ts";

export interface SystemMemberOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface BoundaryChannelSelectorInputs {
  readonly selectedMemberIds: readonly string[];
}

export interface BoundaryChannelSelectorProps
  extends BaseInteractionProps<BoundaryChannelSelectorInputs> {
  readonly systemMembers?: readonly SystemMemberOption[] | undefined;
  readonly selectedMemberIds?: readonly string[] | undefined;
  readonly energyChange?: number | string | undefined;
  readonly massChange?: number | string | undefined;
  readonly systemEnergyChange?: number | string | undefined;
  readonly systemMassChange?: number | string | undefined;
}

export const DEFAULT_ME03_MEMBERS: readonly SystemMemberOption[] = [
  {
    id: "emitting-body",
    label: "Emitting Body",
    description: "The physical body emitting opposite light pulses (loses energy L and mass L/c²).",
  },
  {
    id: "emitted-radiation",
    label: "Emitted Radiation",
    description: "The pair of light pulses carrying energy L in opposite directions.",
  },
];

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

export function BoundaryChannelSelector({
  instrumentId,
  actionId,
  commandClass = "measurement-change",
  systemMembers = DEFAULT_ME03_MEMBERS,
  selectedMemberIds = ["emitting-body"],
  energyChange,
  massChange,
  systemEnergyChange,
  systemMassChange,
  onAction,
  disabled = false,
  className = "",
  "data-testid": testId = "boundary-channel-selector",
}: BoundaryChannelSelectorProps) {
  const compId = useId();
  const [selectedIds, setSelectedIds] = useState<readonly string[]>(selectedMemberIds);
  const [announcement, setAnnouncement] = useState<string>("");

  const displayEnergy = energyChange ?? systemEnergyChange;
  const displayMass = massChange ?? systemMassChange;

  const handleToggleMember = (memberId: string) => {
    if (disabled) return;
    const next = selectedIds.includes(memberId)
      ? selectedIds.filter((id) => id !== memberId)
      : [...selectedIds, memberId];
    setSelectedIds(next);

    const action: TypedActionPayload<BoundaryChannelSelectorInputs> = {
      instrumentId,
      actionId,
      commandClass,
      inputs: { selectedMemberIds: next },
    };
    onAction(action);
    setAnnouncement(`System boundary updated. Included members: ${next.join(", ") || "none"}.`);
  };

  const handleSelectPreset = (presetMemberIds: readonly string[]) => {
    if (disabled) return;
    setSelectedIds(presetMemberIds);
    const action: TypedActionPayload<BoundaryChannelSelectorInputs> = {
      instrumentId,
      actionId,
      commandClass,
      inputs: { selectedMemberIds: presetMemberIds },
    };
    onAction(action);
    setAnnouncement(`System boundary set to preset: ${presetMemberIds.join(", ")}.`);
  };

  return (
    <div
      className={className || undefined}
      data-interaction-family="energy-accounting"
      data-testid={testId}
    >
      {/* Live Region Announcement */}
      <div style={srOnlyStyle} aria-live="polite" role="status">
        {announcement}
      </div>

      <div
        style={{
          padding: "0.75rem",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "0.25rem",
        }}
      >
        <h4
          className="eyebrow"
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--ink)",
            marginBottom: "0.5rem",
          }}
        >
          System boundary and energy accounting
        </h4>

        {/* Visual Boundary Presets */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginBottom: "0.75rem",
          }}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleSelectPreset(["emitting-body"])}
            className="button"
            style={{
              padding: "0.25rem 0.625rem",
              fontSize: "0.75rem",
              fontWeight: 500,
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "0.25rem",
              color: "var(--ink)",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            Body alone (Boundary 1)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleSelectPreset(["emitted-radiation"])}
            className="button"
            style={{
              padding: "0.25rem 0.625rem",
              fontSize: "0.75rem",
              fontWeight: 500,
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "0.25rem",
              color: "var(--ink)",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            Radiation alone (Boundary 2)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleSelectPreset(["emitting-body", "emitted-radiation"])}
            className="button"
            style={{
              padding: "0.25rem 0.625rem",
              fontSize: "0.75rem",
              fontWeight: 500,
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "0.25rem",
              color: "var(--ink)",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            Combined isolated system (Boundary 3)
          </button>
        </div>

        {/* Accessible Checklist Form */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
            marginBottom: "0.75rem",
          }}
        >
          {systemMembers.map((member) => {
            const isChecked = selectedIds.includes(member.id);
            return (
              <label
                key={member.id}
                htmlFor={`${compId}-member-${member.id}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.625rem",
                  padding: "0.5rem",
                  borderRadius: "0.25rem",
                  border: isChecked ? "1px solid var(--accent)" : "1px solid var(--line)",
                  background: isChecked ? "var(--wash)" : "var(--panel)",
                  color: "var(--ink)",
                  fontSize: "0.75rem",
                  fontWeight: isChecked ? 500 : "normal",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  id={`${compId}-member-${member.id}`}
                  checked={isChecked}
                  disabled={disabled}
                  onChange={() => handleToggleMember(member.id)}
                  style={{
                    marginTop: "0.125rem",
                    accentColor: "var(--accent)",
                  }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: "var(--ink)" }}>{member.label}</div>
                  <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                    {member.description}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Boundary Balance Readout */}
        <div
          style={{
            marginTop: "0.75rem",
            paddingTop: "0.5rem",
            borderTop: "1px solid var(--line)",
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "0.5rem",
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          <div
            style={{
              background: "var(--wash)",
              padding: "0.5rem",
              border: "1px solid var(--line)",
              borderRadius: "0.25rem",
            }}
          >
            <span style={{ color: "var(--muted)", display: "block" }}>
              Energy crossing boundary ΔE:
            </span>
            <span
              style={{
                fontWeight: 600,
                color: "var(--ink)",
                fontSize: "0.875rem",
              }}
            >
              {displayEnergy !== undefined ? String(displayEnergy) : "—"}
            </span>
          </div>
          <div
            style={{
              background: "var(--wash)",
              padding: "0.5rem",
              border: "1px solid var(--line)",
              borderRadius: "0.25rem",
            }}
          >
            <span style={{ color: "var(--muted)", display: "block" }}>System mass change Δm:</span>
            <span
              style={{
                fontWeight: 600,
                color: "var(--ink)",
                fontSize: "0.875rem",
              }}
            >
              {displayMass !== undefined ? String(displayMass) : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
