import type { PpeTask as PpeTaskType } from "../content/schemas/journey.ts";

export interface PpeTaskProps {
  readonly task: PpeTaskType;
}

export function PpeTask({ task }: PpeTaskProps) {
  const { promptId, task: taskPrompt, perturbPrompt, explainPrompt } = task;

  return (
    <section
      id={promptId}
      data-ppe-task-id={promptId}
      style={{
        margin: "2rem 0",
        padding: "1.5rem",
        borderRadius: "0.75rem",
        border: "1px solid var(--line)",
        background: "var(--wash)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          paddingBottom: "0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <span
            className="eyebrow"
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono, monospace)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--accent)",
              fontWeight: "bold",
              display: "block",
            }}
          >
            Predict · Perturb · Explain
          </span>
          <h3
            style={{
              fontSize: "1.125rem",
              fontFamily: "var(--font-serif)",
              fontWeight: "bold",
              color: "var(--ink)",
              margin: "0.25rem 0 0",
            }}
          >
            Physical Insight Challenge
          </h3>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.75rem",
            color: "var(--muted)",
          }}
        >
          #{promptId}
        </span>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
          gap: "1rem",
          fontSize: "0.75rem",
        }}
      >
        <div
          style={{
            padding: "0.875rem",
            borderRadius: "0.375rem",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span
            className="eyebrow"
            style={{
              fontWeight: "bold",
              color: "var(--accent)",
              display: "block",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            1. Predict
          </span>
          <p style={{ color: "var(--ink)", margin: 0 }}>{taskPrompt}</p>
        </div>

        <div
          style={{
            padding: "0.875rem",
            borderRadius: "0.375rem",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span
            className="eyebrow"
            style={{
              fontWeight: "bold",
              color: "var(--ink)",
              display: "block",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            2. Perturb
          </span>
          <p style={{ color: "var(--ink)", margin: 0 }}>{perturbPrompt}</p>
        </div>

        <div
          style={{
            padding: "0.875rem",
            borderRadius: "0.375rem",
            background: "var(--panel)",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span
            className="eyebrow"
            style={{
              fontWeight: "bold",
              color: "var(--muted)",
              display: "block",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            3. Explain
          </span>
          <p style={{ color: "var(--ink)", margin: 0 }}>{explainPrompt}</p>
        </div>
      </div>
    </section>
  );
}
