"use client";

import { useSyncExternalStore } from "react";
import { numberText, unitText } from "../controls/declaredDomain.ts";
import type { ExpectedDisplayValue } from "../tapes/schema.ts";
import {
  type CheckpointReadoutOwner,
  compareRecordedReading,
  currentCheckpointReadings,
} from "./checkpointReadings.ts";

const noSnapshot = () => null;
const noSubscription = () => () => {};

function Reading({ value, unit }: Readonly<{ value: number; unit: string }>) {
  const text = unitText(unit);
  return (
    <data value={String(value)}>
      {numberText(value)}
      {text === "°" ? text : text && ` ${text}`}
    </data>
  );
}

/** Recorded figures survive form-only and refused actions. Live figures follow the owner's store. */
export function CheckpointReadingsPanel({
  expected,
  settings,
  experimentId,
  owner,
  compare,
}: Readonly<{
  expected: readonly ExpectedDisplayValue[];
  settings: Readonly<Record<string, number | string>>;
  experimentId: string;
  owner?: CheckpointReadoutOwner | undefined;
  compare: boolean;
}>) {
  const session = compare ? owner?.session : undefined;
  const view = useSyncExternalStore(
    session?.subscribe ?? noSubscription,
    session?.subscribe ? session.getSnapshot : noSnapshot,
    noSnapshot,
  );
  const accepted =
    compare && owner ? currentCheckpointReadings(view, owner.binding, experimentId, settings) : null;

  return (
    <details className="fine" data-checkpoint-readings="">
      <summary>
        {compare ? "Compare recorded and laboratory readings" : "Recorded readings at this stop"}
      </summary>
      {compare && !accepted && (
        <p>Comparison needs a final laboratory result at this stop’s settings.</p>
      )}
      {accepted && (
        <p data-accepted-reading-run={accepted.runId}>
          Laboratory values come from the current accepted run at these settings.
          Figures are rounded for display.
        </p>
      )}
      <dl>
        {expected.map((reading, index) => {
          const actual = accepted && compareRecordedReading(reading, accepted);
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: authored readings retain their published order, including repeated labels
            <div key={`${reading.label}-${index}`}>
              <dt>{reading.label}</dt>
              <dd>
                Recorded <Reading value={reading.value} unit={reading.unit} />
                {actual && (
                  <span data-checkpoint-lab-reading={actual.kind}>
                    {" · "}
                    {actual.kind === "value" ? (
                      <>Laboratory <Reading value={actual.value} unit={reading.unit} /></>
                    ) : (
                      actual.reason
                    )}
                  </span>
                )}
                <small>
                  {reading.constantSetId === "not-applicable"
                    ? " (no physical constants required)"
                    : ` (recorded with ${reading.constantSetId})`}
                </small>
              </dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}
