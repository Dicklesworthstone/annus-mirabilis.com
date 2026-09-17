import {
  type Branch as BranchType,
  type ForkVariesKind,
  OUTCOME_TYPE_LABELS,
} from "../content/schemas/journey.ts";

export interface BranchProps {
  readonly branch: BranchType;
  readonly variesKind?: ForkVariesKind | undefined;
}

export function Branch({ branch }: BranchProps) {
  const { id, label, proponent, hypothesis, worksWhen, steps, outcome } = branch;

  const outcomeBadgeClass = (() => {
    switch (outcome.type) {
      case "papers-route":
        return "bg-emerald-950 text-emerald-300 border-emerald-700";
      case "dead-end-on-constraint":
        return "bg-rose-950 text-rose-300 border-rose-700";
      case "correct-but-weaker":
        return "bg-sky-950 text-sky-300 border-sky-700";
      case "empirically-equivalent-not-refuted":
        return "bg-cyan-950 text-cyan-300 border-cyan-700";
      case "undecided-on-available-evidence":
        return "bg-purple-950 text-purple-300 border-purple-700";
      default:
        return "bg-stone-800 text-stone-300 border-stone-600";
    }
  })();

  return (
    <article
      id={id}
      data-branch-id={id}
      data-outcome-type={outcome.type}
      className="branch p-5 rounded-lg border border-stone-700 bg-stone-900/80 text-stone-200 space-y-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-stone-800 pb-3">
        <div>
          <h4 className="text-base font-bold text-stone-100 font-serif">{label}</h4>
          {proponent && (
            <p className="text-xs text-stone-400 mt-0.5">
              Historical proponent:{" "}
              <a
                href={`#${proponent.cardId}`}
                className="text-amber-400 hover:underline font-medium"
              >
                {proponent.name}
              </a>
            </p>
          )}
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium border ${outcomeBadgeClass}`}
        >
          {OUTCOME_TYPE_LABELS[outcome.type] ?? outcome.type}
        </span>
      </header>

      {/* Hypothesis & Domain of Validity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded bg-stone-950/60 border border-stone-800">
          <span className="font-semibold text-stone-400 uppercase tracking-wide block mb-1">
            Hypothesis
          </span>
          <p className="text-stone-200">{hypothesis}</p>
        </div>
        <div className="p-3 rounded bg-stone-950/60 border border-stone-800">
          <span className="font-semibold text-stone-400 uppercase tracking-wide block mb-1">
            Valid When
          </span>
          <p className="text-stone-200">{worksWhen}</p>
        </div>
      </div>

      {/* Deductive Steps */}
      {steps && steps.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-stone-400 hover:text-stone-200">
            Deductive steps ({steps.length})
          </summary>
          <ol className="list-decimal list-inside space-y-1.5 mt-2 p-3 rounded bg-stone-950/40 border border-stone-800 text-stone-300">
            {steps.map((step, idx) => (
              <li key={idx} className="leading-relaxed">
                <span>{step.text}</span>
                {step.presetId && (
                  <span className="ml-2 font-mono text-[10px] text-amber-400/80">
                    [{step.presetId}]
                  </span>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}

      {/* Outcome and Constraints */}
      <div className="outcome-section p-3.5 rounded bg-stone-950/70 border border-stone-800 space-y-2 text-xs">
        <p className="font-medium text-stone-100 leading-relaxed">{outcome.plainLanguage}</p>

        {outcome.constraintRef && (
          <p className="text-rose-400">
            <span className="font-semibold">Contradicted by evidence / constraint: </span>
            <a href={`#${outcome.constraintRef}`} className="underline hover:text-rose-300 font-mono">
              #{outcome.constraintRef}
            </a>
          </p>
        )}

        {outcome.scopeNote && (
          <p className="text-cyan-300">
            <span className="font-semibold">Observable class scope: </span>
            <span>{outcome.scopeNote}</span>
          </p>
        )}

        {outcome.insufficiency && (
          <p className="text-purple-300">
            <span className="font-semibold">Why 1904 evidence is insufficient: </span>
            <span>{outcome.insufficiency}</span>
          </p>
        )}

        {outcome.whatWouldDecide && (
          <p className="text-purple-300 pt-1 border-t border-stone-800/80">
            <span className="font-semibold">Later resolving measurement: </span>
            <span>{outcome.whatWouldDecide.name}</span>
            {outcome.whatWouldDecide.year && (
              <span className="ml-1 text-stone-400 font-mono">
                ({outcome.whatWouldDecide.year})
              </span>
            )}
            <span className="ml-2 font-mono text-stone-400">
              [#{outcome.whatWouldDecide.recordId}]
            </span>
          </p>
        )}
      </div>
    </article>
  );
}
