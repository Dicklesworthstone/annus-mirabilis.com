import type { ExerciseRef } from "../content/schemas/journey.ts";

export interface ExerciseListProps {
  readonly exercises: readonly ExerciseRef[];
}

export function ExerciseList({ exercises }: ExerciseListProps) {
  if (!exercises || exercises.length === 0) return null;

  const instrumented = exercises.filter((e) => e.role === "instrumented");
  const explanation = exercises.filter((e) => e.role === "explanation");

  return (
    <div className="discovery-exercises my-8 space-y-6">
      <h3 className="text-xl font-serif font-bold text-stone-100">Discovery Exercises & Checks</h3>

      {instrumented.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-mono uppercase tracking-wider text-amber-400">
            Instrumented Checks ({instrumented.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {instrumented.map((ex) => (
              <div
                key={ex.id}
                id={ex.id}
                data-exercise-id={ex.id}
                data-role="instrumented"
                className="p-4 rounded-lg bg-stone-900/80 border border-stone-700 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-stone-400 font-medium">#{ex.id}</span>
                  <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700 text-[10px]">
                    Instrumented
                  </span>
                </div>
                {ex.prompt && <p className="text-stone-200">{ex.prompt}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {explanation.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-mono uppercase tracking-wider text-stone-400">
            Explanation Exercises ({explanation.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {explanation.map((ex) => (
              <div
                key={ex.id}
                id={ex.id}
                data-exercise-id={ex.id}
                data-role="explanation"
                className="p-4 rounded-lg bg-stone-900/80 border border-stone-700 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-stone-400 font-medium">#{ex.id}</span>
                  <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700 text-[10px]">
                    Verbal Reasoning
                  </span>
                </div>
                {ex.prompt && <p className="text-stone-200">{ex.prompt}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
