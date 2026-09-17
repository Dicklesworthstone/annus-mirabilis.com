import type { Stage as StageType } from "../content/schemas/journey.ts";
import { Meanings } from "./Meanings.tsx";
import { SupportLadder } from "./SupportLadder.tsx";

export interface StageProps {
  readonly stage: StageType;
  readonly index: number;
}

export function Stage({ stage, index }: StageProps) {
  const {
    id,
    title,
    question,
    computeFromShelf,
    premiseRefs,
    instrument,
    reasoning,
    prerequisites,
    support,
    meanings,
  } = stage;

  return (
    <section
      id={id}
      data-stage-id={id}
      className="stage my-10 p-6 rounded-xl border border-stone-700 bg-stone-900/70 text-stone-200 space-y-6"
    >
      <header className="space-y-2 border-b border-stone-800 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-amber-400">
            Stage {String(index + 1).padStart(2, "0")} · Inquiry
          </span>
          <Meanings meanings={meanings} />
        </div>
        <h3 className="text-2xl font-serif font-bold text-stone-100">{title}</h3>
        <p className="text-base text-amber-200/90 font-serif italic">{question}</p>
      </header>

      {/* Compute from shelf & Premises */}
      <div className="space-y-3 text-xs">
        <div className="p-3.5 rounded bg-stone-950/60 border border-stone-800">
          <span className="font-semibold text-stone-400 uppercase tracking-wide block mb-1">
            Deduction from the 1904 Shelf
          </span>
          <p className="text-stone-300 leading-relaxed">{computeFromShelf}</p>
        </div>

        {premiseRefs && premiseRefs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="font-semibold text-stone-400">Premises cited:</span>
            {premiseRefs.map((pRef, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded bg-stone-800 text-amber-300 border border-stone-700 font-mono text-[11px]"
              >
                {pRef.importId ? (
                  <span>import: {pRef.importId}</span>
                ) : (
                  <a href={`#${pRef.cardId}`} className="hover:underline">
                    #{pRef.cardId}
                  </a>
                )}
                {pRef.parallelWorkAcknowledged && (
                  <span className="ml-1 text-[10px] text-stone-400">(parallel)</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Linked Instrument (if present) */}
      {instrument && (
        <div className="p-4 rounded-lg bg-stone-950/80 border border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-semibold text-stone-300 block">
              Physical Instrument: <span className="font-mono text-amber-400">{instrument.instrumentId}</span>
            </span>
            {instrument.presetId && (
              <span className="text-stone-400">Preset: {instrument.presetId}</span>
            )}
          </div>
          <a
            href={`/lab/${instrument.instrumentId}/`}
            className="px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-medium transition"
          >
            Open in Laboratory →
          </a>
        </div>
      )}

      {/* Prerequisites & Foundations */}
      {prerequisites && prerequisites.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-stone-400">Foundations:</span>
          {prerequisites.map((prereq, idx) => (
            <a
              key={idx}
              href={`/foundations/${prereq}/`}
              className="px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 font-mono text-[11px]"
            >
              {prereq}
            </a>
          ))}
        </div>
      )}

      {/* Reasoning Steps */}
      {reasoning && reasoning.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-stone-400 hover:text-stone-200">
            Formal reasoning references ({reasoning.length})
          </summary>
          <ul className="space-y-1.5 mt-2 p-3 rounded bg-stone-950/40 border border-stone-800 text-stone-300">
            {reasoning.map((r, idx) => (
              <li key={idx} className="font-mono text-[11px]">
                {r.chainId && <span>Chain: {r.chainId} </span>}
                {r.stepId && <span>Step: {r.stepId} </span>}
                {r.foundationId && <span>Foundation: {r.foundationId} </span>}
                {r.missingStepId && <span>MissingStep: {r.missingStepId} </span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Support Ladder */}
      <SupportLadder support={support} />
    </section>
  );
}
