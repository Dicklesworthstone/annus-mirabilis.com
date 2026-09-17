import type { Doors as DoorsType } from "../content/schemas/journey.ts";

export interface DoorsProps {
  readonly doors: DoorsType;
}

export function Doors({ doors }: DoorsProps) {
  const { frontDoor, sideDoors } = doors;

  return (
    <section className="discovery-doors my-10 p-6 rounded-xl border border-stone-700 bg-stone-900/60 text-stone-200 space-y-6">
      <header className="border-b border-stone-800 pb-3">
        <span className="text-xs font-mono uppercase tracking-wider text-amber-400 block">
          Entry Portals · Front & Side Doors
        </span>
        <h3 className="text-xl font-serif font-bold text-stone-100 mt-1">
          Multiple Routes, One Arrival Point
        </h3>
        <p className="text-xs text-stone-400 mt-1">
          All doors converge on equation:{" "}
          <span className="font-mono text-amber-300 font-semibold">
            {frontDoor.arrivesAtEquationId}
          </span>
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Front Door */}
        <div
          id={frontDoor.id}
          data-door-id={frontDoor.id}
          data-door-type="front-door"
          className="p-4 rounded-lg bg-stone-950/80 border border-amber-800/40 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-400 uppercase tracking-wide">
              Front Door · Primary Route
            </span>
            <span className="font-mono text-[10px] text-stone-500">#{frontDoor.id}</span>
          </div>
          <h4 className="text-sm font-serif font-bold text-stone-100">{frontDoor.title}</h4>
          <p className="text-stone-400">
            Arrives at:{" "}
            <span className="font-mono text-amber-300">{frontDoor.arrivesAtEquationId}</span>
          </p>
        </div>

        {/* Side Doors */}
        {sideDoors.map((sideDoor) => (
          <div
            key={sideDoor.id}
            id={sideDoor.id}
            data-door-id={sideDoor.id}
            data-door-type="side-door"
            className="p-4 rounded-lg bg-stone-950/80 border border-stone-800 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-400 uppercase tracking-wide">
                Side Door · Alternative Perspective
              </span>
              <span className="font-mono text-[10px] text-stone-500">#{sideDoor.id}</span>
            </div>
            <h4 className="text-sm font-serif font-bold text-stone-100">{sideDoor.title}</h4>
            <p className="text-stone-400">
              Arrives at:{" "}
              <span className="font-mono text-cyan-300">{sideDoor.arrivesAtEquationId}</span>
            </p>
            {sideDoor.entryRecordId && (
              <p className="text-[11px] text-stone-500 font-mono">
                entry: #{sideDoor.entryRecordId}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
