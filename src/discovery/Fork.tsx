import { FORK_VARIES_EXPLANATIONS, type Fork as ForkType } from "../content/schemas/journey.ts";
import { Branch } from "./Branch.tsx";

export interface ForkProps {
  readonly fork: ForkType;
}

export function Fork({ fork }: ForkProps) {
  const { id, afterStageId, question, varies, branches } = fork;
  const variesExplanation = FORK_VARIES_EXPLANATIONS[varies] ?? `Varies: ${varies}`;

  return (
    <section
      id={id}
      data-fork-id={id}
      data-after-stage-id={afterStageId}
      data-varies={varies}
      style={{
        margin: "2rem 0",
        padding: "1.5rem",
        borderRadius: "0.75rem",
        border: "1px solid var(--line)",
        background: "var(--wash)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          borderBottom: "1px solid var(--line)",
          paddingBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            className="badge"
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono, monospace)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--accent)",
              background: "var(--panel)",
              padding: "0.125rem 0.5rem",
              borderRadius: "0.25rem",
              border: "1px solid var(--accent)",
              fontWeight: 600,
            }}
          >
            Historical Fork · {varies}
          </span>
        </div>
        <h3
          style={{
            fontSize: "1.25rem",
            fontFamily: "var(--font-serif)",
            fontWeight: "bold",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {question}
        </h3>
        <p
          style={{
            fontSize: "0.75rem",
            color: "var(--muted)",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          {variesExplanation}
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))",
          gap: "1rem",
        }}
      >
        {branches.map((branch) => (
          <Branch key={branch.id} branch={branch} variesKind={varies} />
        ))}
      </div>
    </section>
  );
}
