import type { PpeTask as PpeTaskType } from "../content/schemas/journey.ts";

export interface PpeTaskProps {
  readonly task: PpeTaskType;
}

export function PpeTask({ task }: PpeTaskProps) {
  const { promptId, task: taskPrompt, perturbPrompt, explainPrompt } = task;

  return (
    <section
      id={promptId}
      data-ppe-task-id={promptId}
      className="ppe-task my-8 p-6 rounded-xl border border-indigo-700/60 bg-indigo-950/20 text-stone-200 space-y-4"
    >
      <header className="border-b border-indigo-800/40 pb-3 flex items-center justify-between">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-bold block">
            Predict · Perturb · Explain
          </span>
          <h3 className="text-lg font-serif font-bold text-stone-100 mt-1">
            Physical Insight Challenge
          </h3>
        </div>
        <span className="font-mono text-xs text-indigo-300/80">#{promptId}</span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="p-3.5 rounded bg-stone-900/80 border border-stone-800 space-y-1">
          <span className="font-bold text-amber-400 block uppercase tracking-wide">1. Predict</span>
          <p className="text-stone-200">{taskPrompt}</p>
        </div>

        <div className="p-3.5 rounded bg-stone-900/80 border border-stone-800 space-y-1">
          <span className="font-bold text-cyan-400 block uppercase tracking-wide">2. Perturb</span>
          <p className="text-stone-200">{perturbPrompt}</p>
        </div>

        <div className="p-3.5 rounded bg-stone-900/80 border border-stone-800 space-y-1">
          <span className="font-bold text-emerald-400 block uppercase tracking-wide">
            3. Explain
          </span>
          <p className="text-stone-200">{explainPrompt}</p>
        </div>
      </div>
    </section>
  );
}
