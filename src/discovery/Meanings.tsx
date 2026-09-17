import type { FourMeanings } from "../content/schemas/meanings.ts";

export interface MeaningsProps {
  readonly meanings: FourMeanings | Readonly<Record<string, unknown>>;
}

export function Meanings({ meanings }: MeaningsProps) {
  const m = meanings as Partial<FourMeanings>;
  if (!m || Object.keys(m).length === 0) return null;

  return (
    <div className="four-meanings flex flex-wrap gap-2 text-[11px] font-mono">
      {m.logicalRole && (
        <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
          <span className="text-stone-500">role:</span> {m.logicalRole}
        </span>
      )}
      {m.historicalStatus && (
        <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
          <span className="text-stone-500">history:</span> {m.historicalStatus}
        </span>
      )}
      {m.modelStatus && (
        <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
          <span className="text-stone-500">model:</span> {m.modelStatus}
        </span>
      )}
      {m.executionStatus && (
        <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
          <span className="text-stone-500">exec:</span> {m.executionStatus}
        </span>
      )}
    </div>
  );
}
