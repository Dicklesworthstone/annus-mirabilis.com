import type { FourMeanings } from "../content/schemas/meanings.ts";

export interface MeaningsProps {
  readonly meanings: FourMeanings | Readonly<Record<string, unknown>>;
}

export function Meanings({ meanings }: MeaningsProps) {
  const m = meanings as Partial<FourMeanings>;
  if (!m || Object.keys(m).length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.5rem",
        fontSize: "0.6875rem",
        fontFamily: "var(--font-mono, monospace)",
      }}
    >
      {m.logicalRole && (
        <span
          className="badge"
          style={{
            padding: "0.125rem 0.5rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ color: "var(--muted)" }}>role:</span> {m.logicalRole}
        </span>
      )}
      {m.historicalStatus && (
        <span
          className="badge"
          style={{
            padding: "0.125rem 0.5rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ color: "var(--muted)" }}>history:</span> {m.historicalStatus}
        </span>
      )}
      {m.modelStatus && (
        <span
          className="badge"
          style={{
            padding: "0.125rem 0.5rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ color: "var(--muted)" }}>model:</span> {m.modelStatus}
        </span>
      )}
      {m.executionStatus && (
        <span
          className="badge"
          style={{
            padding: "0.125rem 0.5rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
          }}
        >
          <span style={{ color: "var(--muted)" }}>exec:</span> {m.executionStatus}
        </span>
      )}
    </div>
  );
}
