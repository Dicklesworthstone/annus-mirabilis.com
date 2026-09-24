import type { Door, Doors as DoorsType } from "../content/schemas/journey.ts";

export interface DoorsProps {
  readonly doors: DoorsType;
}

const monoFine = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "0.6875rem",
  color: "var(--muted)",
} as const;

/**
 * One door. When the record carries a link, a summary and a readable arrival, the reader sees
 * those; the ids beside them are for the build and are shown only for a record that has nothing
 * else to show (the framework's fixtures).
 */
function DoorCard({ door, kind }: { door: Door; kind: "front-door" | "side-door" }) {
  const readable = door.href !== undefined;
  return (
    <div
      id={door.id}
      data-door-id={door.id}
      data-door-type={kind}
      style={{
        padding: "1rem",
        borderRadius: "0.5rem",
        border: kind === "front-door" ? "1px solid var(--accent)" : "1px solid var(--line)",
        background: "var(--wash)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        fontSize: "0.875rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <span
          className="eyebrow"
          style={{
            fontSize: "0.6875rem",
            fontFamily: "var(--font-mono, monospace)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: kind === "front-door" ? "var(--accent)" : "var(--muted)",
          }}
        >
          {kind === "front-door" ? "Front door · Primary route" : "Side door"}
        </span>
        {!readable && <span style={monoFine}>#{door.id}</span>}
      </div>
      <h4
        style={{
          fontSize: "1rem",
          fontWeight: "bold",
          color: "var(--ink)",
          fontFamily: "var(--font-serif, serif)",
          margin: 0,
        }}
      >
        {door.href ? <a href={door.href}>{door.title}</a> : door.title}
      </h4>
      {door.summary && <p style={{ margin: 0, color: "var(--ink)" }}>{door.summary}</p>}
      <p style={{ color: "var(--muted)", margin: 0 }}>
        Arrives at: {door.arrivesAtLabel ?? door.arrivesAtEquationId}
      </p>
      {!readable && door.entryRecordId && (
        <p style={{ ...monoFine, margin: 0 }}>entry: #{door.entryRecordId}</p>
      )}
    </div>
  );
}

export function Doors({ doors }: DoorsProps) {
  const { frontDoor, sideDoors } = doors;
  const arrival = frontDoor.arrivesAtLabel ?? frontDoor.arrivesAtEquationId;

  return (
    <section
      data-journey-doors
      style={{
        margin: "2.5rem 0",
        padding: "1.5rem",
        borderRadius: "0.75rem",
        border: "1px solid var(--line)",
        background: "var(--panel)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          paddingBottom: "0.75rem",
        }}
      >
        <span
          className="eyebrow"
          style={{
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono, monospace)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--accent)",
            display: "block",
          }}
        >
          Entry portals · Front & side doors
        </span>
        <h3
          style={{
            fontSize: "1.25rem",
            fontFamily: "var(--font-serif, serif)",
            fontWeight: "bold",
            color: "var(--ink)",
            marginTop: "0.25rem",
            marginBottom: 0,
          }}
        >
          Multiple routes, one arrival point
        </h3>
        <p
          className="fine"
          style={{
            fontSize: "0.75rem",
            color: "var(--muted)",
            marginTop: "0.25rem",
            marginBottom: 0,
          }}
        >
          All doors arrive at the same result: {arrival}
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
          gap: "1rem",
        }}
      >
        <DoorCard door={frontDoor} kind="front-door" />
        {sideDoors.map((sideDoor) => (
          <DoorCard key={sideDoor.id} door={sideDoor} kind="side-door" />
        ))}
      </div>
    </section>
  );
}
