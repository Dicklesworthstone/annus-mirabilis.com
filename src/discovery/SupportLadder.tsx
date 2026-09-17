import type { StageSupport } from "../content/schemas/journey.ts";

export interface SupportLadderProps {
  readonly support: StageSupport;
}

export function SupportLadder({ support }: SupportLadderProps) {
  const { workedExample, partialComparison, prediction, explanation, transferCase } = support;

  return (
    <div className="support-ladder space-y-6 my-6 p-5 rounded-lg border border-stone-700 bg-stone-900/60 text-stone-200">
      <h4 className="text-xs font-mono uppercase tracking-wider text-amber-400">
        Support Ladder · Five Rungs of Understanding
      </h4>

      {/* Rung 1: Worked Example */}
      {workedExample && (
        <section className="rung-worked-example p-4 rounded bg-stone-800/80 border border-stone-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">
            1. Worked Example
          </p>
          <p className="font-medium text-sm text-stone-100 mb-2">{workedExample.prompt}</p>
          {workedExample.steps.length > 0 && (
            <ol className="list-decimal list-inside space-y-1 text-xs text-stone-300 mb-2">
              {workedExample.steps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          )}
          {workedExample.result && (
            <p className="text-xs font-mono text-emerald-400 bg-emerald-950/40 p-2 rounded border border-emerald-800/40">
              <span className="font-bold">Result: </span>
              {workedExample.result}
            </p>
          )}
        </section>
      )}

      {/* Rung 2: Partial Comparison */}
      {partialComparison && (
        <section className="rung-partial-comparison p-4 rounded bg-stone-800/80 border border-stone-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">
            2. Partial Comparison
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2 text-xs">
            <div className="p-2.5 rounded bg-stone-900/80 border border-stone-800">
              <span className="font-semibold text-stone-400 block mb-0.5">Given:</span>
              <span className="text-stone-200">{partialComparison.given}</span>
            </div>
            <div className="p-2.5 rounded bg-stone-900/80 border border-stone-800">
              <span className="font-semibold text-stone-400 block mb-0.5">To Complete:</span>
              <span className="text-stone-200">{partialComparison.toComplete}</span>
            </div>
          </div>
          {partialComparison.explanation && (
            <p className="text-xs text-stone-300 italic">{partialComparison.explanation}</p>
          )}
        </section>
      )}

      {/* Rung 3: Prediction (if present) */}
      {prediction && (
        <section className="rung-prediction p-4 rounded bg-stone-800/80 border border-stone-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-1">
            3. Prediction Opportunity
          </p>
          <p className="font-medium text-sm text-stone-100 mb-2">{prediction.prompt}</p>
          {prediction.choices && prediction.choices.length > 0 && (
            <ul className="space-y-1.5 mb-3 text-xs">
              {prediction.choices.map((choice, idx) => (
                <li
                  key={idx}
                  className="px-3 py-1.5 rounded bg-stone-900/60 border border-stone-700/60 text-stone-200"
                >
                  {choice}
                </li>
              ))}
            </ul>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-amber-300 font-medium hover:underline">
              Reveal prediction reasoning
            </summary>
            <p className="mt-2 p-2.5 rounded bg-stone-900/90 text-stone-300 border border-stone-800">
              {prediction.explanation}
            </p>
          </details>
        </section>
      )}

      {/* Rung 4: Full Explanation */}
      {explanation && (
        <section className="rung-explanation p-4 rounded bg-stone-800/80 border border-stone-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">
            4. Physical Explanation
          </p>
          <p className="text-sm text-stone-200 leading-relaxed">{explanation}</p>
        </section>
      )}

      {/* Rung 5: Transfer Case (if present) */}
      {transferCase && (
        <section className="rung-transfer-case p-4 rounded bg-stone-800/80 border border-stone-700">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">
            5. Transfer Case
          </p>
          <p className="font-medium text-sm text-stone-100 mb-2">{transferCase.condition}</p>
          <p className="text-xs text-stone-300 mb-3">{transferCase.explanation}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded bg-stone-900/80 border border-stone-800">
              <span className="font-semibold text-rose-400 block mb-0.5">What Changes:</span>
              <span className="text-stone-300">{transferCase.whatChanges}</span>
            </div>
            <div className="p-2.5 rounded bg-stone-900/80 border border-stone-800">
              <span className="font-semibold text-emerald-400 block mb-0.5">What Stays Valid:</span>
              <span className="text-stone-300">{transferCase.whatStaysValid}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
