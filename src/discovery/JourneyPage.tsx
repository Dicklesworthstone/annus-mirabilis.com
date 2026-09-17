import type { Journey } from "../content/schemas/journey.ts";
import { Doors } from "./Doors.tsx";
import { ExerciseList } from "./ExerciseList.tsx";
import { Fork } from "./Fork.tsx";
import { MoveMarker } from "./MoveMarker.tsx";
import { PpeTask } from "./PpeTask.tsx";
import { SourceJump } from "./SourceJump.tsx";
import { Stage } from "./Stage.tsx";
import { WorldCheck } from "./WorldCheck.tsx";

export interface JourneyPageProps {
  readonly journey: Journey;
}

export function JourneyPage({ journey }: JourneyPageProps) {
  const {
    id,
    paper,
    completeness,
    pendingElements,
    admittedImports,
    shelf,
    naggingFact,
    firstHonestQuestion,
    stages,
    forks,
    move,
    worldChecks,
    sourceJumps,
    exercises,
    ppeTask,
    doors,
  } = journey;

  return (
    <article
      data-journey-id={id}
      data-theme="slate"
      className="discovery-journey max-w-4xl mx-auto px-4 py-8 font-sans text-stone-200"
    >
      {/* Header */}
      <header className="space-y-4 mb-10 pb-8 border-b border-stone-700">
        <p className="text-xs font-mono uppercase tracking-wider text-amber-400">
          Discover · A route you could take
        </p>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-100 leading-tight">
          {paper}
        </h1>

        {/* Partial Draft Banner */}
        {completeness === "partial" && pendingElements && pendingElements.length > 0 && (
          <aside className="p-4 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs space-y-2">
            <span className="font-bold text-amber-300 uppercase tracking-wide">
              Draft Journey · Pending Elements Declared
            </span>
            <ul className="space-y-1 text-stone-300">
              {pendingElements.map((pe, idx) => (
                <li key={idx} className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-amber-400 font-semibold">{pe.element}:</span>
                  <span>{pe.reason}</span>
                  <span className="text-stone-500 font-mono text-[11px]">({pe.ownerBead})</span>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {/* Nagging Fact */}
        <div className="p-5 rounded-xl bg-stone-900/80 border border-stone-700 space-y-1.5">
          <span className="text-xs font-mono uppercase tracking-wider text-stone-400 block font-semibold">
            The Nagging Fact
          </span>
          <p className="text-base sm:text-lg font-serif text-stone-100 italic">
            "{naggingFact}"
          </p>
        </div>

        {/* First Honest Question */}
        <div className="p-5 rounded-xl bg-amber-950/30 border border-amber-800/40 space-y-1.5">
          <span className="text-xs font-mono uppercase tracking-wider text-amber-400 block font-semibold">
            The First Honest Question
          </span>
          <p className="text-lg sm:text-xl font-serif font-bold text-amber-100">
            {firstHonestQuestion}
          </p>
        </div>

        {/* The 1904 Shelf */}
        {shelf && shelf.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
            <span className="font-semibold text-stone-400">Available on the 1904 shelf:</span>
            {shelf.map((cardId) => (
              <a
                key={cardId}
                href={`#${cardId}`}
                className="px-2.5 py-1 rounded bg-stone-800/90 hover:bg-stone-700 text-stone-300 border border-stone-700 font-mono text-xs transition"
              >
                #{cardId}
              </a>
            ))}
          </div>
        )}

        {/* Admitted Imports */}
        {admittedImports && admittedImports.length > 0 && (
          <div className="p-3.5 rounded bg-stone-900/60 border border-stone-800 text-xs space-y-1.5">
            <span className="font-semibold text-stone-400 uppercase tracking-wide block">
              Admitted Cross-Paper Imports ({admittedImports.length})
            </span>
            <ul className="space-y-1 text-stone-300">
              {admittedImports.map((imp) => (
                <li key={imp.importId} className="font-mono text-[11px]">
                  <span className="text-amber-400 font-semibold">{imp.importId}</span>:{" "}
                  <span>{imp.provenance}</span> (anchor: {imp.sourceAnchor})
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>

      {/* Main Journey Stages and Interleaved Forks */}
      <div className="journey-stages-and-forks space-y-8">
        {stages.map((stage, index) => {
          const matchingForks = forks.filter((f) => f.afterStageId === stage.id);
          return (
            <div key={stage.id} className="stage-block space-y-6">
              <Stage stage={stage} index={index} />
              {matchingForks.map((fork) => (
                <Fork key={fork.id} fork={fork} />
              ))}
            </div>
          );
        })}
      </div>

      {/* The Consequential Move */}
      {move && <MoveMarker move={move} />}

      {/* World Checks */}
      {worldChecks && worldChecks.length > 0 && (
        <section className="world-checks-section my-10 space-y-4">
          <h3 className="text-xl font-serif font-bold text-stone-100">
            World Checks · Testing the Consequences
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {worldChecks.map((check) => (
              <WorldCheck key={check.id} check={check} />
            ))}
          </div>
        </section>
      )}

      {/* Predict-Perturb-Explain Task */}
      {ppeTask && <PpeTask task={ppeTask} />}

      {/* Exercises */}
      {exercises && exercises.length > 0 && <ExerciseList exercises={exercises} />}

      {/* Where this enters the paper (Source Jumps) */}
      {sourceJumps && sourceJumps.length > 0 && (
        <section className="source-jumps-section my-10 space-y-4">
          <h3 className="text-xl font-serif font-bold text-stone-100">
            Connecting to the 1905 Paper
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {sourceJumps.map((jump) => (
              <SourceJump key={jump.id} jump={jump} />
            ))}
          </div>
        </section>
      )}

      {/* Entry Portals (Doors) */}
      {doors && <Doors doors={doors} />}

      {/* Footer Navigation */}
      <footer className="mt-14 pt-8 border-t border-stone-800 flex flex-wrap items-center justify-between gap-4 text-sm">
        <a
          href={`/papers/${id}/`}
          className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-medium transition"
        >
          Read the 1905 paper edition →
        </a>
        <div className="flex items-center gap-4 text-xs text-stone-400">
          <a href="/foundations/" className="hover:text-stone-200 underline">
            Explore foundations
          </a>
          <a href="/papers/" className="hover:text-stone-200 underline">
            Paper catalogue
          </a>
        </div>
      </footer>
    </article>
  );
}
