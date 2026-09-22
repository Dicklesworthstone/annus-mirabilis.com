import type { Doors as DoorsType } from "../content/schemas/journey.ts";

export interface DoorsProps {
  readonly doors: DoorsType;
}

export function Doors({ doors }: DoorsProps) {
  const { frontDoor, sideDoors } = doors;

  return (
    <section
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
          Entry Portals · Front & Side Doors
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
          All doors converge on equation:{" "}
          <span
            style={{
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--accent)",
              fontWeight: 600,
            }}
          >
            {frontDoor.arrivesAtEquationId}
          </span>
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
          gap: "1rem",
          fontSize: "0.75rem",
        }}
      >
        {/* Front Door */}
        <div
          id={frontDoor.id}
          data-door-id={frontDoor.id}
          data-door-type="front-door"
          style={{
            padding: "1rem",
            borderRadius: "0.5rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span
              className="eyebrow"
              style={{
                fontWeight: "bold",
                color: "var(--accent)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Front Door · Primary Route
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.625rem",
                color: "var(--muted)",
              }}
            >
              #{frontDoor.id}
            </span>
          </div>
          <h4
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-serif, serif)",
              fontWeight: "bold",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            {frontDoor.title}
          </h4>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            Arrives at:{" "}
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                color: "var(--accent)",
              }}
            >
              {frontDoor.arrivesAtEquationId}
            </span>
          </p>
        </div>

        {/* Side Doors */}
        {sideDoors.map((sideDoor) => (
          <div
            key={sideDoor.id}
            id={sideDoor.id}
            data-door-id={sideDoor.id}
            data-door-type="side-door"
            style={{
              padding: "1rem",
              borderRadius: "0.5rem",
              background: "var(--wash)",
              border: "1px solid var(--line)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                className="eyebrow"
                style={{
                  fontWeight: "bold",
                  color: "var(--accent)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Side Door · Alternative Perspective
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.625rem",
                  color: "var(--muted)",
                }}
              >
                #{sideDoor.id}
              </span>
            </div>
            <h4
              style={{
                fontSize: "0.875rem",
                fontFamily: "var(--font-serif, serif)",
                fontWeight: "bold",
                color: "var(--ink)",
                margin: 0,
              }}
            >
              {sideDoor.title}
            </h4>
            <p style={{ color: "var(--muted)", margin: 0 }}>
              Arrives at:{" "}
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  color: "var(--accent)",
                }}
              >
                {sideDoor.arrivesAtEquationId}
              </span>
            </p>
            {sideDoor.entryRecordId && (
              <p
                style={{
                  fontSize: "0.6875rem",
                  color: "var(--muted)",
                  fontFamily: "var(--font-mono, monospace)",
                  margin: 0,
                }}
              >
                entry: #{sideDoor.entryRecordId}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
