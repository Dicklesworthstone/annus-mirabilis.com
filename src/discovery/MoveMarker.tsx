import type { JourneyMove } from "../content/schemas/journey.ts";

export interface MoveMarkerProps {
  readonly move: JourneyMove;
  /**
   * Where the marked step opens in the reading face. Given, the marker links there in words; the
   * chain and step ids are for the build, and a reader cannot use them.
   */
  readonly href?: string | undefined;
}

export function MoveMarker({ move, href }: MoveMarkerProps) {
  const { label, chainId, stepId, r0Summary } = move;

  const isReviewed = r0Summary.reviewState === "reviewed";

  return (
    <aside
      data-move-marker
      style={{
        margin: "2.5rem 0",
        padding: "1.5rem",
        borderRadius: "0.75rem",
        border: "2px solid var(--accent)",
        background: "var(--wash)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          borderBottom: "1px solid var(--line)",
          paddingBottom: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              width: "0.75rem",
              height: "0.75rem",
              borderRadius: "50%",
              background: "var(--accent)",
              display: "inline-block",
            }}
          />
          <span
            className="eyebrow"
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono, monospace)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--accent)",
              fontWeight: "bold",
            }}
          >
            The move
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.75rem",
          }}
        >
          {href ? (
            <a href={href}>Open this step in the derivation</a>
          ) : (
            <span
              style={{
                fontFamily: "var(--font-mono, monospace)",
                color: "var(--muted)",
              }}
            >
              {chainId} · {stepId}
            </span>
          )}
          <span
            className="badge"
            style={{
              padding: "0.125rem 0.5rem",
              borderRadius: "0.25rem",
              fontSize: "0.6875rem",
              fontWeight: 500,
              border: isReviewed ? "1px solid var(--accent)" : "1px solid var(--line)",
              background: isReviewed ? "var(--panel)" : "var(--wash)",
              color: isReviewed ? "var(--accent)" : "var(--muted)",
            }}
          >
            {r0Summary.reviewState}
          </span>
        </div>
      </header>

      <div>
        <h3
          style={{
            fontSize: "1.25rem",
            fontFamily: "var(--font-serif)",
            fontWeight: "bold",
            color: "var(--ink)",
            marginBottom: "0.5rem",
          }}
        >
          {label}
        </h3>
        <p
          style={{
            fontSize: "1rem",
            color: "var(--ink)",
            lineHeight: 1.6,
            fontFamily: "var(--font-serif)",
            margin: 0,
          }}
        >
          {r0Summary.text}
        </p>
      </div>
    </aside>
  );
}
