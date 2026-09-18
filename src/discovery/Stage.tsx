import type { Stage as StageType } from "../content/schemas/journey.ts";
import { Meanings } from "./Meanings.tsx";
import { SupportLadder } from "./SupportLadder.tsx";

export interface StageProps {
  readonly stage: StageType;
  readonly index: number;
}

export function Stage({ stage, index }: StageProps) {
  const {
    id,
    title,
    question,
    computeFromShelf,
    premiseRefs,
    instrument,
    reasoning,
    prerequisites,
    support,
    meanings,
  } = stage;

  return (
    <section
      id={id}
      data-stage-id={id}
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
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          borderBottom: "1px solid var(--line)",
          paddingBottom: "1rem",
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
              letterSpacing: "0.05em",
              color: "var(--accent)",
            }}
          >
            Stage {String(index + 1).padStart(2, "0")} · Inquiry
          </span>
          <Meanings meanings={meanings} />
        </div>
        <h3
          style={{
            fontSize: "1.5rem",
            fontFamily: "var(--font-serif, Georgia, serif)",
            fontWeight: "bold",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontSize: "1rem",
            color: "var(--accent)",
            fontFamily: "var(--font-serif, Georgia, serif)",
            fontStyle: "italic",
            margin: 0,
          }}
        >
          {question}
        </p>
      </header>

      {/* Compute from shelf & Premises */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          fontSize: "0.75rem",
        }}
      >
        <div
          style={{
            padding: "0.875rem",
            borderRadius: "0.25rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
          }}
        >
          <span
            className="eyebrow"
            style={{
              fontWeight: 600,
              letterSpacing: "0.05em",
              display: "block",
              marginBottom: "0.25rem",
            }}
          >
            Deduction from the 1904 Shelf
          </span>
          <p
            className="fine"
            style={{
              margin: 0,
              lineHeight: 1.6,
              color: "var(--ink)",
            }}
          >
            {computeFromShelf}
          </p>
        </div>

        {premiseRefs && premiseRefs.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.5rem",
              paddingTop: "0.25rem",
            }}
          >
            <span className="fine" style={{ fontWeight: 600 }}>
              Premises cited:
            </span>
            {premiseRefs.map((pRef) => (
              <span
                key={pRef.importId ? `import-${pRef.importId}` : `card-${pRef.cardId}`}
                style={{
                  padding: "0.125rem 0.5rem",
                  borderRadius: "0.25rem",
                  background: "var(--wash)",
                  color: "var(--accent)",
                  border: "1px solid var(--line)",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.6875rem",
                }}
              >
                {pRef.importId ? (
                  <span>import: {pRef.importId}</span>
                ) : (
                  <a href={`#${pRef.cardId}`} style={{ color: "inherit", textDecoration: "none" }}>
                    #{pRef.cardId}
                  </a>
                )}
                {pRef.parallelWorkAcknowledged && (
                  <span className="fine" style={{ marginLeft: "0.25rem", fontSize: "0.625rem" }}>
                    (parallel)
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Linked Instrument (if present) */}
      {instrument && (
        <div
          style={{
            padding: "1rem",
            borderRadius: "0.5rem",
            background: "var(--wash)",
            border: "1px solid var(--line)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            fontSize: "0.75rem",
          }}
        >
          <div>
            <span style={{ fontWeight: 600, display: "block" }}>
              Physical Instrument:{" "}
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  color: "var(--accent)",
                }}
              >
                {instrument.instrumentId}
              </span>
            </span>
            {instrument.presetId && <span className="fine">Preset: {instrument.presetId}</span>}
          </div>
          <a
            href={`/lab/${instrument.instrumentId}/`}
            className="button"
            style={{
              padding: "0.375rem 0.75rem",
              borderRadius: "0.25rem",
              background: "rgba(245, 158, 11, 0.2)",
              color: "var(--accent)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Open in Laboratory →
          </a>
        </div>
      )}

      {/* Prerequisites & Foundations */}
      {prerequisites && prerequisites.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.75rem",
          }}
        >
          <span className="fine" style={{ fontWeight: 600 }}>
            Foundations:
          </span>
          {prerequisites.map((prereq) => (
            <a
              key={prereq}
              href={`/foundations/${prereq}/`}
              style={{
                padding: "0.125rem 0.5rem",
                borderRadius: "0.25rem",
                background: "var(--wash)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.6875rem",
                textDecoration: "none",
              }}
            >
              {prereq}
            </a>
          ))}
        </div>
      )}

      {/* Reasoning Steps */}
      {reasoning && reasoning.length > 0 && (
        <details style={{ fontSize: "0.75rem" }}>
          <summary
            className="fine"
            style={{
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Formal reasoning references ({reasoning.length})
          </summary>
          <ul
            style={{
              margin: "0.5rem 0 0",
              padding: "0.75rem",
              borderRadius: "0.25rem",
              background: "var(--wash)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
            }}
          >
            {reasoning.map((r) => (
              <li
                key={`${r.chainId ?? ""}-${r.stepId ?? ""}-${r.foundationId ?? ""}-${r.missingStepId ?? ""}`}
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.6875rem",
                }}
              >
                {r.chainId && <span>Chain: {r.chainId} </span>}
                {r.stepId && <span>Step: {r.stepId} </span>}
                {r.foundationId && <span>Foundation: {r.foundationId} </span>}
                {r.missingStepId && <span>MissingStep: {r.missingStepId} </span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Support Ladder */}
      <SupportLadder support={support} />
    </section>
  );
}
