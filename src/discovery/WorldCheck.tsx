import type { WorldCheck as WorldCheckType } from "../content/schemas/journey.ts";

export interface WorldCheckProps {
  readonly check: WorldCheckType;
}

export function WorldCheck({ check }: WorldCheckProps) {
  const {
    id,
    claim,
    instrumentId,
    quantityId,
    expected,
    tolerance,
    laterEvidence,
    staticWorkedExample,
    comparisonKind,
  } = check;

  const comparisonKindLabels: Record<string, string> = {
    "measured-fact": "Empirical Fact",
    "printed-prediction": "Printed Prediction",
    "theoretical-bound": "Theoretical Bound",
  };

  return (
    <article
      id={id}
      data-world-check-id={id}
      data-comparison-kind={comparisonKind}
      style={{
        padding: "1.25rem",
        borderRadius: "0.75rem",
        border: "1px solid var(--line)",
        background: "var(--panel)",
        color: "var(--ink)",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
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
        <span
          className="eyebrow"
          style={{
            fontSize: "0.75rem",
            fontFamily: "var(--font-mono, monospace)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--accent)",
          }}
        >
          World Check · #{id}
        </span>
        <span
          style={{
            padding: "0.125rem 0.625rem",
            borderRadius: "0.25rem",
            fontSize: "0.75rem",
            fontWeight: 500,
            background: "var(--wash)",
            color: "var(--ink)",
            border: "1px solid var(--line)",
          }}
        >
          {comparisonKindLabels[comparisonKind] ?? comparisonKind}
        </span>
      </header>

      <p
        style={{
          fontSize: "0.875rem",
          fontFamily: "var(--font-serif, serif)",
          color: "var(--ink)",
          fontWeight: 500,
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {claim}
      </p>

      {/* Static Worked Example & Host Calculation */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
          gap: "0.75rem",
          fontSize: "0.75rem",
        }}
      >
        <div
          style={{
            padding: "0.75rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span
            className="eyebrow"
            style={{
              fontWeight: 600,
              color: "var(--muted)",
              display: "block",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Static Worked Reference
          </span>
          <p style={{ margin: 0, fontWeight: 500, color: "var(--ink)" }}>
            {staticWorkedExample.label}
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--accent)",
            }}
          >
            {staticWorkedExample.value} {staticWorkedExample.unit}
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "0.6875rem",
              color: "var(--muted)",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            constants: {staticWorkedExample.constantSetId}
          </p>
        </div>

        <div
          style={{
            padding: "0.75rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <span
            className="eyebrow"
            style={{
              fontWeight: 600,
              color: "var(--muted)",
              display: "block",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Live Instrument Check
          </span>
          <p style={{ margin: 0, color: "var(--ink)" }}>
            Instrument:{" "}
            <a
              href={`/lab/${instrumentId}/`}
              style={{
                fontFamily: "var(--font-mono, monospace)",
                color: "var(--accent)",
                textDecoration: "underline",
              }}
            >
              {instrumentId}
            </a>
          </p>
          <p style={{ margin: 0, color: "var(--ink)" }}>
            Quantity:{" "}
            <span style={{ fontFamily: "var(--font-mono, monospace)", color: "var(--ink)" }}>
              {quantityId}
            </span>
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--ink)",
              fontWeight: 600,
            }}
          >
            Expected: {String(expected)}
            {tolerance?.relative !== undefined && (
              <span style={{ color: "var(--muted)", fontSize: "0.6875rem", fontWeight: "normal" }}>
                {" "}
                (±{tolerance.relative * 100}%)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Later Evidence Badge */}
      {laterEvidence && (
        <div
          style={{
            padding: "0.75rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
            fontSize: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--accent)" }}>
              Post-1904 Experimental Resolution ({laterEvidence.year})
            </span>
            {laterEvidence.recordId && (
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  color: "var(--muted)",
                  fontSize: "0.6875rem",
                }}
              >
                #{laterEvidence.recordId}
              </span>
            )}
          </div>
          <p style={{ margin: 0, color: "var(--ink)" }}>{laterEvidence.description}</p>
        </div>
      )}
    </article>
  );
}
