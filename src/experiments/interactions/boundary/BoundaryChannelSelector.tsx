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
      className={`boundary-channel-selector ${className}`}
      data-interaction-family="energy-accounting"
      data-testid={testId}
    >
      {/* Live Region Announcement */}
      <div className="sr-only" aria-live="polite" role="status">
        {announcement}
      </div>

      <div className="p-3 bg-stone-50 border border-stone-200 rounded">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-800 mb-2">
          System Boundary & Energy Accounting
        </h4>

        {/* Visual Boundary Presets */}
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleSelectPreset(["emitting-body"])}
            className="px-2.5 py-1 text-xs font-medium bg-white border border-stone-300 rounded hover:bg-stone-100"
          >
            Body alone (Boundary 1)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleSelectPreset(["emitted-radiation"])}
            className="px-2.5 py-1 text-xs font-medium bg-white border border-stone-300 rounded hover:bg-stone-100"
          >
            Radiation alone (Boundary 2)
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleSelectPreset(["emitting-body", "emitted-radiation"])}
            className="px-2.5 py-1 text-xs font-medium bg-white border border-stone-300 rounded hover:bg-stone-100"
          >
            Combined isolated system (Boundary 3)
          </button>
        </div>

        {/* Accessible Checklist Form */}
        <div className="space-y-2 mb-3">
          {systemMembers.map((member) => {
            const isChecked = selectedIds.includes(member.id);
            return (
              <label
                key={member.id}
                htmlFor={`${compId}-member-${member.id}`}
                className={`flex items-start gap-2.5 p-2 rounded border text-xs cursor-pointer transition-colors ${
                  isChecked
                    ? "bg-amber-50/70 border-amber-300 text-stone-900 font-medium"
                    : "bg-white border-stone-200 text-stone-700 hover:bg-stone-50"
                }`}
              >
                <input
                  type="checkbox"
                  id={`${compId}-member-${member.id}`}
                  checked={isChecked}
                  disabled={disabled}
                  onChange={() => handleToggleMember(member.id)}
                  className="mt-0.5 accent-amber-600"
                />
                <div>
                  <div className="font-semibold text-stone-900">{member.label}</div>
                  <div className="text-stone-500 text-xs">{member.description}</div>
                </div>
              </label>
            );
          })}
        </div>

        {/* Boundary Balance Readout */}
        <div className="mt-3 pt-2 border-t border-stone-200 grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-white p-2 border border-stone-200 rounded">
            <span className="text-stone-500 block">Energy crossing boundary ΔE:</span>
            <span className="font-semibold text-stone-900 text-sm">
              {displayEnergy !== undefined ? String(displayEnergy) : "—"}
            </span>
          </div>
          <div className="bg-white p-2 border border-stone-200 rounded">
            <span className="text-stone-500 block">System mass change Δm:</span>
            <span className="font-semibold text-stone-900 text-sm">
              {displayMass !== undefined ? String(displayMass) : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
