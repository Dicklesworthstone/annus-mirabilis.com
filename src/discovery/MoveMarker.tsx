import type { JourneyMove } from "../content/schemas/journey.ts";

export interface MoveMarkerProps {
  readonly move: JourneyMove;
}

export function MoveMarker({ move }: MoveMarkerProps) {
  const { label, chainId, stepId, r0Summary } = move;

  const isReviewed = r0Summary.reviewState === "reviewed";

  return (
    <aside
      data-move-marker
      className="move-marker my-10 p-6 rounded-xl border-2 border-rose-600/80 bg-stone-900/90 text-stone-100 shadow-lg space-y-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-800/40 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-500 inline-block animate-pulse" />
          <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-bold">
            The Consequential Move
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-stone-400">
            {chainId} · {stepId}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
              isReviewed
                ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                : "bg-amber-950 text-amber-300 border-amber-800"
            }`}
          >
            {r0Summary.reviewState}
          </span>
        </div>
      </header>

      <div>
        <h3 className="text-xl font-serif font-bold text-stone-100 mb-2">{label}</h3>
        <p className="text-base text-stone-200 leading-relaxed font-serif">{r0Summary.text}</p>
      </div>
    </aside>
  );
}
