import { FORK_VARIES_EXPLANATIONS, type Fork as ForkType } from "../content/schemas/journey.ts";
import { Branch } from "./Branch.tsx";

export interface ForkProps {
  readonly fork: ForkType;
}

export function Fork({ fork }: ForkProps) {
  const { id, afterStageId, question, varies, branches } = fork;
  const variesExplanation = FORK_VARIES_EXPLANATIONS[varies] ?? `Varies: ${varies}`;

  return (
    <section
      id={id}
      data-fork-id={id}
      data-after-stage-id={afterStageId}
      data-varies={varies}
      className="fork my-8 p-6 rounded-xl border border-stone-700 bg-stone-900/60 text-stone-200 space-y-6"
    >
      <header className="space-y-2 border-b border-stone-800 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
            Historical Fork · {varies}
          </span>
        </div>
        <h3 className="text-xl font-serif font-bold text-stone-100">{question}</h3>
        <p className="text-xs text-stone-400 italic">{variesExplanation}</p>
      </header>

      <div className="branches-grid grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map((branch) => (
          <Branch key={branch.id} branch={branch} variesKind={varies} />
        ))}
      </div>
    </section>
  );
}
