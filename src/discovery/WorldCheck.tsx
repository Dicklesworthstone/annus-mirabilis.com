import type { WorldCheck as WorldCheckType } from "../content/schemas/journey.ts";

export interface WorldCheckProps {
  readonly check: WorldCheckType;
}

export function WorldCheck({ check }: WorldCheckProps) {
  const {
    id,
    claim,
    instrumentId,
    quantityId,
    expected,
    tolerance,
    laterEvidence,
    staticWorkedExample,
    comparisonKind,
  } = check;

  const comparisonKindLabels: Record<string, string> = {
    "measured-fact": "Empirical Fact",
    "printed-prediction": "Printed Prediction",
    "theoretical-bound": "Theoretical Bound",
  };

  return (
    <article
      id={id}
      data-world-check-id={id}
      data-comparison-kind={comparisonKind}
      className="world-check p-5 rounded-xl border border-stone-700 bg-stone-900/80 text-stone-200 space-y-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-800 pb-3">
        <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
          World Check · #{id}
        </span>
        <span className="px-2.5 py-0.5 rounded text-xs font-medium bg-cyan-950 text-cyan-300 border border-cyan-800">
          {comparisonKindLabels[comparisonKind] ?? comparisonKind}
        </span>
      </header>

      <p className="text-sm font-serif text-stone-100 font-medium leading-relaxed">
        {claim}
      </p>

      {/* Static Worked Example & Host Calculation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded bg-stone-950/70 border border-stone-800 space-y-1">
          <span className="font-semibold text-stone-400 block uppercase tracking-wide">
            Static Worked Reference
          </span>
          <p className="font-medium text-stone-200">{staticWorkedExample.label}</p>
          <p className="font-mono text-amber-300">
            {staticWorkedExample.value} {staticWorkedExample.unit}
          </p>
          <p className="text-[11px] text-stone-500 font-mono">
            constants: {staticWorkedExample.constantSetId}
          </p>
        </div>

        <div className="p-3 rounded bg-stone-950/70 border border-stone-800 space-y-1">
          <span className="font-semibold text-stone-400 block uppercase tracking-wide">
            Live Instrument Check
          </span>
          <p className="text-stone-300">
            Instrument: <a href={`/lab/${instrumentId}/`} className="font-mono text-amber-400 hover:underline">{instrumentId}</a>
          </p>
          <p className="text-stone-300">
            Quantity: <span className="font-mono text-stone-200">{quantityId}</span>
          </p>
          <p className="font-mono text-emerald-400">
            Expected: {String(expected)}
            {tolerance?.relative !== undefined && (
              <span className="text-stone-400 text-[11px]"> (±{tolerance.relative * 100}%)</span>
            )}
          </p>
        </div>
      </div>

      {/* Later Evidence Badge */}
      {laterEvidence && (
        <div className="p-3 rounded bg-purple-950/40 border border-purple-800/40 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-purple-300">
              Post-1904 Experimental Resolution ({laterEvidence.year})
            </span>
            {laterEvidence.recordId && (
              <span className="font-mono text-stone-400 text-[11px]">
                #{laterEvidence.recordId}
              </span>
            )}
          </div>
          <p className="text-stone-300">{laterEvidence.description}</p>
        </div>
      )}
    </article>
  );
}
