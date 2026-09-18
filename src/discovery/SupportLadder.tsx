import type { StageSupport } from "../content/schemas/journey.ts";

export interface SupportLadderProps {
  readonly support: StageSupport;
}

export function SupportLadder({ support }: SupportLadderProps) {
  const { workedExample, partialComparison, prediction, explanation, transferCase } = support;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        margin: "1.5rem 0",
        padding: "1.25rem",
        borderRadius: "0.5rem",
        border: "1px solid var(--line)",
        background: "var(--panel)",
        color: "var(--ink)",
      }}
    >
      <h4
        className="eyebrow"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.75rem",
          letterSpacing: "0.08em",
          margin: 0,
        }}
      >
        Support Ladder · Five Rungs of Understanding
      </h4>

      {/* Rung 1: Worked Example */}
      {workedExample && (
        <section
          style={{
            padding: "1rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
          }}
        >
          <p
            className="fine"
            style={{
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 0.25rem",
            }}
          >
            1. Worked Example
          </p>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 500, fontSize: "0.875rem" }}>
            {workedExample.prompt}
          </p>
          {workedExample.steps.length > 0 && (
            <ol
              className="fine"
              style={{
                margin: "0 0 0.5rem",
                paddingLeft: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
              }}
            >
              {workedExample.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          {workedExample.result && (
            <p
              style={{
                margin: 0,
                fontSize: "0.75rem",
                fontFamily: "var(--font-mono)",
                color: "var(--plot)",
                background: "var(--panel)",
                padding: "0.5rem",
                borderRadius: "0.25rem",
                border: "1px solid var(--line)",
              }}
            >
              <span style={{ fontWeight: "bold" }}>Result: </span>
              {workedExample.result}
            </p>
          )}
        </section>
      )}

      {/* Rung 2: Partial Comparison */}
      {partialComparison && (
        <section
          style={{
            padding: "1rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
          }}
        >
          <p
            className="fine"
            style={{
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 0.25rem",
            }}
          >
            2. Partial Comparison
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.75rem",
              margin: "0 0 0.5rem",
              fontSize: "0.75rem",
            }}
          >
            <div
              style={{
                padding: "0.625rem",
                borderRadius: "0.25rem",
                background: "var(--panel)",
                border: "1px solid var(--line)",
              }}
            >
              <span
                className="fine"
                style={{ fontWeight: 600, display: "block", marginBottom: "0.125rem" }}
              >
                Given:
              </span>
              <span style={{ color: "var(--ink)" }}>{partialComparison.given}</span>
            </div>
            <div
              style={{
                padding: "0.625rem",
                borderRadius: "0.25rem",
                background: "var(--panel)",
                border: "1px solid var(--line)",
              }}
            >
              <span
                className="fine"
                style={{ fontWeight: 600, display: "block", marginBottom: "0.125rem" }}
              >
                To Complete:
              </span>
              <span style={{ color: "var(--ink)" }}>{partialComparison.toComplete}</span>
            </div>
          </div>
          {partialComparison.explanation && (
            <p className="fine" style={{ margin: 0, fontStyle: "italic" }}>
              {partialComparison.explanation}
            </p>
          )}
        </section>
      )}

      {/* Rung 3: Prediction (if present) */}
      {prediction && (
        <section
          style={{
            padding: "1rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
          }}
        >
          <p
            className="eyebrow"
            style={{
              fontSize: "0.75rem",
              margin: "0 0 0.25rem",
            }}
          >
            3. Prediction Opportunity
          </p>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 500, fontSize: "0.875rem" }}>
            {prediction.prompt}
          </p>
          {prediction.choices && prediction.choices.length > 0 && (
            <ul
              style={{
                margin: "0 0 0.75rem",
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
                fontSize: "0.75rem",
              }}
            >
              {prediction.choices.map((choice) => (
                <li
                  key={choice}
                  style={{
                    padding: "0.375rem 0.75rem",
                    borderRadius: "0.25rem",
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                    color: "var(--ink)",
                  }}
                >
                  {choice}
                </li>
              ))}
            </ul>
          )}
          <details style={{ fontSize: "0.75rem" }}>
            <summary
              style={{
                cursor: "pointer",
                color: "var(--accent)",
                fontWeight: 500,
              }}
            >
              Reveal prediction reasoning
            </summary>
            <p
              className="fine"
              style={{
                marginTop: "0.5rem",
                padding: "0.625rem",
                borderRadius: "0.25rem",
                background: "var(--panel)",
                border: "1px solid var(--line)",
              }}
            >
              {prediction.explanation}
            </p>
          </details>
        </section>
      )}

      {/* Rung 4: Full Explanation */}
      {explanation && (
        <section
          style={{
            padding: "1rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
          }}
        >
          <p
            className="fine"
            style={{
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 0.25rem",
            }}
          >
            4. Physical Explanation
          </p>
          <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.6, color: "var(--ink)" }}>
            {explanation}
          </p>
        </section>
      )}

      {/* Rung 5: Transfer Case (if present) */}
      {transferCase && (
        <section
          style={{
            padding: "1rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
          }}
        >
          <p
            className="fine"
            style={{
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              margin: "0 0 0.25rem",
            }}
          >
            5. Transfer Case
          </p>
          <p style={{ margin: "0 0 0.5rem", fontWeight: 500, fontSize: "0.875rem" }}>
            {transferCase.condition}
          </p>
          <p className="fine" style={{ margin: "0 0 0.75rem" }}>
            {transferCase.explanation}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.75rem",
              fontSize: "0.75rem",
            }}
          >
            <div
              style={{
                padding: "0.625rem",
                borderRadius: "0.25rem",
                background: "var(--panel)",
                border: "1px solid var(--line)",
              }}
            >
              <span
                className="fine"
                style={{
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.125rem",
                  color: "var(--accent)",
                }}
              >
                What Changes:
              </span>
              <span style={{ color: "var(--ink)" }}>{transferCase.whatChanges}</span>
            </div>
            <div
              style={{
                padding: "0.625rem",
                borderRadius: "0.25rem",
                background: "var(--panel)",
                border: "1px solid var(--line)",
              }}
            >
              <span
                className="fine"
                style={{
                  fontWeight: 600,
                  display: "block",
                  marginBottom: "0.125rem",
                  color: "var(--plot)",
                }}
              >
                What Stays Valid:
              </span>
              <span style={{ color: "var(--ink)" }}>{transferCase.whatStaysValid}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
