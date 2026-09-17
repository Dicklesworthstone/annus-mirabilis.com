import type { SourceJump as SourceJumpType } from "../content/schemas/journey.ts";

export interface SourceJumpProps {
  readonly jump: SourceJumpType;
}

export function SourceJump({ jump }: SourceJumpProps) {
  const { id, label, paperId, section, targetAnchor, weavePredicateId, pointer } = jump;

  const targetHref = section
    ? `/papers/${paperId}/${section}/#${targetAnchor}`
    : `/papers/${paperId}/#${targetAnchor}`;

  return (
    <div
      id={id}
      data-source-jump-id={id}
      data-target-anchor={targetAnchor}
      className="source-jump p-5 rounded-xl border border-amber-800/60 bg-amber-950/20 text-stone-200 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-mono uppercase tracking-wider text-amber-400">
          Source Bridge · Where the Move Appears in 1905
        </span>
        {weavePredicateId && (
          <span className="text-[11px] font-mono text-stone-400">
            predicate: {weavePredicateId}
          </span>
        )}
      </div>

      <p className="text-sm font-serif text-stone-200">{pointer}</p>

      <div className="pt-2">
        <a
          href={targetHref}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-sm font-medium transition"
        >
          <span>{label}</span>
          <span>→</span>
        </a>
      </div>
    </div>
  );
}
