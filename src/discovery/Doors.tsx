import type { Door, Doors as DoorsType } from "../content/schemas/journey.ts";
import "./journeySkeleton.css";

export interface DoorsProps {
  readonly doors: DoorsType;
}

/**
 * One way in (dispatch 276), a door's one container: its label in the reader's words, its title
 * as a link, what it does, and where it arrives. The ids beside them are for the build and are
 * shown only for a record that has nothing else to show (the framework's fixtures).
 */
function DoorCard({ door, kind }: { door: Door; kind: "front-door" | "side-door" }) {
  const readable = door.href !== undefined;
  return (
    <div id={door.id} className="journey-door" data-door-id={door.id} data-door-type={kind}>
      <p className="eyebrow">
        {kind === "front-door" ? "The paper's route" : "Another route"}
        {!readable ? ` · #${door.id}` : null}
      </p>
      <h4>{door.href ? <a href={door.href}>{door.title}</a> : door.title}</h4>
      {door.summary ? <p>{door.summary}</p> : null}
      <p className="fine">Arrives at: {door.arrivesAtLabel ?? door.arrivesAtEquationId}</p>
      {!readable && door.entryRecordId ? (
        <p className="fine">entry: #{door.entryRecordId}</p>
      ) : null}
    </div>
  );
}

/**
 * The ways into a journey's result (dispatch 276): the paper's own route and the side routes that
 * reach the same equation, and the site says so. The section draws no box; each door is the one
 * container, with a rule on its leading edge (journeySkeleton.css), and none is in the accent.
 */
export function Doors({ doors }: DoorsProps) {
  const { frontDoor, sideDoors } = doors;
  const arrival = frontDoor.arrivesAtLabel ?? frontDoor.arrivesAtEquationId;

  return (
    <section data-journey-doors className="journey-doors">
      <p className="eyebrow">Ways in</p>
      <h3>Multiple routes, one arrival point</h3>
      <p className="fine">All doors arrive at the same result: {arrival}</p>
      <div className="journey-door-list">
        <DoorCard door={frontDoor} kind="front-door" />
        {sideDoors.map((sideDoor) => (
          <DoorCard key={sideDoor.id} door={sideDoor} kind="side-door" />
        ))}
      </div>
    </section>
  );
}
