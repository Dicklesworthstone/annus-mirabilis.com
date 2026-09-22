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
      style={{
        padding: "1.25rem",
        borderRadius: "0.75rem",
        border: "1px solid var(--accent)",
        background: "var(--wash)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
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
            fontWeight: "bold",
          }}
        >
          Source bridge · Where the move appears in 1905
        </span>
        {weavePredicateId && (
          <span
            style={{
              fontSize: "0.6875rem",
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--muted)",
            }}
          >
            predicate: {weavePredicateId}
          </span>
        )}
      </div>

      <p
        style={{
          fontSize: "0.875rem",
          fontFamily: "var(--font-serif)",
          color: "var(--ink)",
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {pointer}
      </p>

      <div style={{ paddingTop: "0.5rem" }}>
        <a
          href={targetHref}
          className="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            background: "var(--panel)",
            color: "var(--accent)",
            border: "1px solid var(--accent)",
            fontSize: "0.875rem",
            fontWeight: 500,
            textDecoration: "none",
            minHeight: "auto",
          }}
        >
          <span>{label}</span>
          <span>→</span>
        </a>
      </div>
    </div>
  );
}
