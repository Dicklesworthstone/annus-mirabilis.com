import type { ExerciseRef } from "../content/schemas/journey.ts";

export interface ExerciseListProps {
  readonly exercises: readonly ExerciseRef[];
}

export function ExerciseList({ exercises }: ExerciseListProps) {
  if (!exercises || exercises.length === 0) return null;

  const instrumented = exercises.filter((e) => e.role === "instrumented");
  const explanation = exercises.filter((e) => e.role === "explanation");

  return (
    <div
      style={{
        margin: "2rem 0",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
      }}
    >
      <h3
        style={{
          fontSize: "1.25rem",
          fontFamily: "var(--font-serif)",
          fontWeight: "bold",
          color: "var(--ink)",
        }}
      >
        Discovery Exercises &amp; Checks
      </h3>

      {instrumented.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h4
            className="eyebrow"
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono, monospace)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--accent)",
            }}
          >
            Instrumented Checks ({instrumented.length})
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
              gap: "0.75rem",
            }}
          >
            {instrumented.map((ex) => (
              <div
                key={ex.id}
                id={ex.id}
                data-exercise-id={ex.id}
                data-role="instrumented"
                style={{
                  padding: "1rem",
                  borderRadius: "0.5rem",
                  background: "var(--wash)",
                  border: "1px solid var(--line)",
                  fontSize: "0.75rem",
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
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      color: "var(--muted)",
                      fontWeight: 500,
                    }}
                  >
                    #{ex.id}
                  </span>
                  <span
                    className="badge"
                    style={{
                      padding: "0.125rem 0.5rem",
                      borderRadius: "0.25rem",
                      background: "var(--panel)",
                      color: "var(--ink)",
                      border: "1px solid var(--line)",
                      fontSize: "0.625rem",
                    }}
                  >
                    Instrumented
                  </span>
                </div>
                {ex.prompt && <p style={{ color: "var(--ink)", margin: 0 }}>{ex.prompt}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {explanation.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <h4
            className="eyebrow"
            style={{
              fontSize: "0.75rem",
              fontFamily: "var(--font-mono, monospace)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--muted)",
            }}
          >
            Explanation Exercises ({explanation.length})
          </h4>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
              gap: "0.75rem",
            }}
          >
            {explanation.map((ex) => (
              <div
                key={ex.id}
                id={ex.id}
                data-exercise-id={ex.id}
                data-role="explanation"
                style={{
                  padding: "1rem",
                  borderRadius: "0.5rem",
                  background: "var(--wash)",
                  border: "1px solid var(--line)",
                  fontSize: "0.75rem",
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
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      color: "var(--muted)",
                      fontWeight: 500,
                    }}
                  >
                    #{ex.id}
                  </span>
                  <span
                    className="badge"
                    style={{
                      padding: "0.125rem 0.5rem",
                      borderRadius: "0.25rem",
                      background: "var(--panel)",
                      color: "var(--ink)",
                      border: "1px solid var(--line)",
                      fontSize: "0.625rem",
                    }}
                  >
                    Verbal Reasoning
                  </span>
                </div>
                {ex.prompt && <p style={{ color: "var(--ink)", margin: 0 }}>{ex.prompt}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
