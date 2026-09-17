import type { JSX } from "react";
import type { AdmittedImport, PremiseStatus } from "./types.ts";

export type StatusLabelProps = Readonly<{
  status: PremiseStatus;
  admittedImport?: boolean | AdmittedImport | undefined;
  className?: string | undefined;
}>;

/**
 * Renders an accessible status badge for a Knowledge Card.
 * Uses distinct text and SVG geometric icon shapes so status is never conveyed by color alone.
 */
export function StatusLabel({
  status,
  admittedImport,
  className = "",
}: StatusLabelProps): JSX.Element {
  if (admittedImport) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700/60 ${className}`}
        data-status="admitted-import"
      >
        {/* Inward / Import arrow shape */}
        <svg
          className="w-3.5 h-3.5 flex-shrink-0"
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
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700/60 ${className}`}
        data-status="available"
      >
        {/* Checkmark in circle shape */}
        <svg
          className="w-3.5 h-3.5 flex-shrink-0"
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
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-700/60 ${className}`}
        data-status="parallel-work"
      >
        {/* Parallel split / dual track shape */}
        <svg
          className="w-3.5 h-3.5 flex-shrink-0"
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium bg-sky-100 text-sky-900 border border-sky-300 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-700/60 ${className}`}
      data-status="later"
    >
      {/* Clock / Forward arrow shape */}
      <svg
        className="w-3.5 h-3.5 flex-shrink-0"
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
