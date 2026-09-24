import type { CSSProperties } from "react";
import {
  type Branch as BranchType,
  type ForkVariesKind,
  OUTCOME_TYPE_LABELS,
} from "../content/schemas/journey.ts";

export interface BranchProps {
  readonly branch: BranchType;
  readonly variesKind?: ForkVariesKind | undefined;
}

/**
 * A knowledge card's anchor on the page. KnowledgeCardView and CardDetail anchor a card as
 * "card-<id>", and a proponent names the card by its id, so the link adds the prefix. An id that
 * already carries it (the framework's fixtures write "card-exner-1900") is left as it is.
 */
export function cardAnchor(cardId: string): string {
  return cardId.startsWith("card-") ? cardId : `card-${cardId}`;
}

export function Branch({ branch }: BranchProps) {
  const { id, label, proponent, hypothesis, worksWhen, steps, outcome } = branch;

  const outcomeBadgeStyle: CSSProperties = (() => {
    switch (outcome.type) {
      case "papers-route":
        return {
          background: "var(--wash)",
          color: "var(--plot)",
          border: "1px solid var(--plot)",
        };
      case "dead-end-on-constraint":
        return {
          background: "var(--wash)",
          color: "var(--accent)",
          border: "1px solid var(--accent)",
        };
      case "correct-but-weaker":
        return {
          background: "var(--wash)",
          color: "var(--plot)",
          border: "1px solid var(--line)",
        };
      case "empirically-equivalent-not-refuted":
        return {
          background: "var(--wash)",
          color: "var(--plot)",
          border: "1px solid var(--line)",
        };
      case "undecided-on-available-evidence":
        return {
          background: "var(--wash)",
          color: "var(--accent)",
          border: "1px solid var(--line)",
        };
      default:
        return {
          background: "var(--wash)",
          color: "var(--ink)",
          border: "1px solid var(--line)",
        };
    }
  })();

  return (
    <article
      id={id}
      data-branch-id={id}
      data-outcome-type={outcome.type}
      style={{
        padding: "1.25rem",
        borderRadius: "0.5rem",
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
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.75rem",
          borderBottom: "1px solid var(--line)",
          paddingBottom: "0.75rem",
        }}
      >
        <div>
          <h4
            style={{
              fontSize: "1rem",
              fontWeight: "bold",
              color: "var(--ink)",
              fontFamily: "var(--font-serif, serif)",
              margin: 0,
            }}
          >
            {label}
          </h4>
          {proponent && (
            <p className="fine" style={{ margin: "0.125rem 0 0" }}>
              Historical proponent:{" "}
              <a
                href={`#${cardAnchor(proponent.cardId)}`}
                style={{
                  color: "var(--accent)",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                {proponent.name}
              </a>
            </p>
          )}
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.25rem 0.625rem",
            borderRadius: "0.25rem",
            fontSize: "0.75rem",
            fontWeight: 500,
            ...outcomeBadgeStyle,
          }}
        >
          {OUTCOME_TYPE_LABELS[outcome.type] ?? outcome.type}
        </span>
      </header>

      {/* Hypothesis & Domain of Validity */}
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
            background: "var(--panel)",
            border: "1px solid var(--line)",
          }}
        >
          <span
            className="eyebrow"
            style={{
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "block",
              marginBottom: "0.25rem",
            }}
          >
            Hypothesis
          </span>
          <p style={{ margin: 0, color: "var(--ink)", lineHeight: 1.5 }}>{hypothesis}</p>
        </div>
        <div
          style={{
            padding: "0.75rem",
            borderRadius: "0.25rem",
            background: "var(--panel)",
            border: "1px solid var(--line)",
          }}
        >
          <span
            className="eyebrow"
            style={{
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "block",
              marginBottom: "0.25rem",
            }}
          >
            Valid when
          </span>
          <p style={{ margin: 0, color: "var(--ink)", lineHeight: 1.5 }}>{worksWhen}</p>
        </div>
      </div>

      {/* Deductive Steps */}
      {steps && steps.length > 0 && (
        <details style={{ fontSize: "0.75rem" }}>
          <summary
            className="fine"
            style={{
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Deductive steps ({steps.length})
          </summary>
          <ol
            style={{
              listStylePosition: "inside",
              listStyleType: "decimal",
              margin: "0.5rem 0 0",
              padding: "0.75rem",
              borderRadius: "0.25rem",
              background: "var(--panel)",
              border: "1px solid var(--line)",
              color: "var(--ink)",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
            }}
          >
            {steps.map((step) => (
              <li key={`${id}-step-${step.presetId ?? step.text}`} style={{ lineHeight: 1.6 }}>
                <span>{step.text}</span>
                {step.presetId && (
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "0.625rem",
                      color: "var(--accent)",
                    }}
                  >
                    [{step.presetId}]
                  </span>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}

      {/* Outcome and Constraints */}
      <div
        style={{
          padding: "0.875rem",
          borderRadius: "0.25rem",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          fontSize: "0.75rem",
        }}
      >
        <p style={{ fontWeight: 500, color: "var(--ink)", lineHeight: 1.6, margin: 0 }}>
          {outcome.plainLanguage}
        </p>

        {outcome.constraintRef && (
          <p style={{ margin: 0, color: "var(--accent)" }}>
            <span style={{ fontWeight: 600 }}>Contradicted by evidence / constraint: </span>
            <a
              href={`#${outcome.constraintRef}`}
              style={{
                textDecoration: "underline",
                color: "var(--accent)",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              #{outcome.constraintRef}
            </a>
          </p>
        )}

        {outcome.scopeNote && (
          <p style={{ margin: 0, color: "var(--plot)" }}>
            <span style={{ fontWeight: 600 }}>Observable class scope: </span>
            <span>{outcome.scopeNote}</span>
          </p>
        )}

        {outcome.insufficiency && (
          <p style={{ margin: 0, color: "var(--muted)" }}>
            <span style={{ fontWeight: 600 }}>Why 1904 evidence is insufficient: </span>
            <span>{outcome.insufficiency}</span>
          </p>
        )}

        {outcome.whatWouldDecide && (
          <p
            style={{
              margin: 0,
              paddingTop: "0.25rem",
              borderTop: "1px solid var(--line)",
              color: "var(--ink)",
            }}
          >
            <span style={{ fontWeight: 600 }}>Later resolving measurement: </span>
            <span>{outcome.whatWouldDecide.name}</span>
            {outcome.whatWouldDecide.year && (
              <span
                className="fine"
                style={{
                  marginLeft: "0.25rem",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                ({outcome.whatWouldDecide.year})
              </span>
            )}
            <span
              className="fine"
              style={{
                marginLeft: "0.5rem",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              [#{outcome.whatWouldDecide.recordId}]
            </span>
          </p>
        )}
      </div>
    </article>
  );
}
