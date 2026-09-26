import type { JSX } from "react";
import type { AdmittedImport, PremiseStatus } from "./types.ts";

export type StatusLabelProps = Readonly<{
  status: PremiseStatus;
  admittedImport?: boolean | AdmittedImport | undefined;
  className?: string | undefined;
}>;

const baseBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  padding: "0.125rem 0.625rem",
  borderRadius: "0.25rem",
  fontSize: "0.75rem",
  fontWeight: 500,
  lineHeight: 1.4,
  background: "var(--wash)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
};

const svgStyle: React.CSSProperties = {
  width: "0.875rem",
  height: "0.875rem",
  flexShrink: 0,
};

/**
 * Renders an accessible status badge for a Knowledge Card.
 * Uses distinct text and SVG geometric icon shapes so status is never conveyed by color alone.
 */
export function StatusLabel({
  status,
  admittedImport,
  className = "",
}: StatusLabelProps): JSX.Element {
  const badgeClass = className ? `badge ${className}` : "badge";

  if (admittedImport) {
    return (
      <span
        className={badgeClass}
        // Its icon and its words set it apart, as each status's do; the accent ring added nothing a
        // reader needs, and was the only red on the shelf (dispatch 276).
        style={baseBadgeStyle}
        data-status="admitted-import"
      >
        {/* Inward / Import arrow shape */}
        <svg
          style={svgStyle}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M8 2v8M4 6l4 4 4-4M2 14h12" />
        </svg>
        <span>Admitted 1905 import</span>
      </span>
    );
  }

  if (status === "available") {
    return (
      <span
        className={badgeClass}
        // Every card on a 1904 shelf is available, so this label is the rule, not the news: it
        // keeps its words and icon for readers who need them, and drops the chip's box and field.
        style={{
          ...baseBadgeStyle,
          background: "transparent",
          borderColor: "transparent",
          color: "var(--muted)",
        }}
        data-status="available"
      >
        {/* Checkmark in circle shape */}
        <svg
          style={svgStyle}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M5.5 8l2 2 3.5-3.5" />
        </svg>
        <span>Available by the end of 1904</span>
      </span>
    );
  }

  if (status === "parallel-work") {
    return (
      <span
        className={badgeClass}
        style={{
          ...baseBadgeStyle,
          borderStyle: "dashed",
        }}
        data-status="parallel-work"
      >
        {/* Parallel split / dual track shape */}
        <svg
          style={svgStyle}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 5h10M3 11h10M6 2v6M10 8v6" />
        </svg>
        <span>Parallel work: not available to a 1904 reader</span>
      </span>
    );
  }

  // status === "later"
  return (
    <span
      className={badgeClass}
      style={{
        ...baseBadgeStyle,
        color: "var(--muted)",
      }}
      data-status="later"
    >
      {/* Clock / Forward arrow shape */}
      <svg
        style={svgStyle}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3l2.5 1.5" />
      </svg>
      <span>Later confirmation</span>
    </span>
  );
}
