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
 * The convergence, drawn (dispatch 450). The journeys say in words that several routes reach the
 * same result; this gives that sentence a shape, for every journey, since Doors renders all four.
 *
 * EVERY ROUTE IS DRAWN THE SAME. Same box, same stroke, same length of line, same order as the
 * cards beneath. AGENTS.md requires that a journey's front door and its side doors arrive at one
 * equation and that the site says so, and that no coherent alternative is presented as the lesser
 * path; a diagram is the easiest place in the site to break that by accident, by giving one route
 * a heavier line or putting it first and on top. Nothing here distinguishes them but their label,
 * and the labels are the ones the cards already carry.
 */
function Convergence({ labels }: { readonly labels: readonly string[] }) {
  const LANE_H = 34,
    GAP = 8,
    TOP = 10;
  const height = TOP * 2 + labels.length * LANE_H + (labels.length - 1) * GAP;
  const middle = height / 2;
  const arrivalTop = middle - LANE_H / 2;
  return (
    <svg
      className="journey-doors-figure"
      viewBox={`0 0 300 ${height}`}
      role="img"
      aria-label={`${labels.length} routes drawn side by side, ${labels.join(" and ")}, each the same size and joined by a line of the same weight to one box on the right marked "one result". None of them is drawn as the main road.`}
    >
      {labels.map((label, i) => {
        const y = TOP + i * (LANE_H + GAP);
        return (
          <g key={label}>
            <rect className="journey-door-lane" x="4" y={y} width="150" height={LANE_H} rx="3" />
            <text className="journey-door-lane-label" x="79" y={y + LANE_H / 2 + 4}>
              {label}
            </text>
            <path
              className="journey-door-join"
              d={`M 154 ${y + LANE_H / 2} L 176 ${y + LANE_H / 2} L 176 ${middle} L 194 ${middle}`}
            />
          </g>
        );
      })}
      <rect
        className="journey-door-lane"
        x="196"
        y={arrivalTop}
        width="100"
        height={LANE_H}
        rx="3"
      />
      <text className="journey-door-lane-label" x="246" y={middle + 4}>
        one result
      </text>
    </svg>
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
      <Convergence labels={["the paper's route", ...sideDoors.map(() => "another route")]} />
      <p className="fine">
        The drawing gives every route the same box and the same line on purpose. Neither door is the
        real one and neither is a detour: the paper's own construction and the routes beside it
        reach the result named above, and the journey says so. What it does not show is what each
        route costs a reader to walk, which is the only respect in which they genuinely differ and
        is written in the cards below rather than in the picture.
      </p>
      <div className="journey-door-list">
        <DoorCard door={frontDoor} kind="front-door" />
        {sideDoors.map((sideDoor) => (
          <DoorCard key={sideDoor.id} door={sideDoor} kind="side-door" />
        ))}
      </div>
    </section>
  );
}
