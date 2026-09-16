import { type ReactElement, type ReactNode, useEffect, useRef, useState } from "react";
import { getScaleFactRows } from "./scale.ts";
import type { RepresentationScale } from "./types.ts";

export interface InspectableTableRow {
  readonly key: string | number;
  readonly cells: readonly (string | number)[];
}

export interface InspectableTableData {
  readonly headers: readonly string[];
  readonly rows: readonly InspectableTableRow[];
  readonly caption: string;
}

export interface AccessibleGraphViewProps {
  /** Layer 1: High-level comparison title. */
  readonly title: string;
  /** Layer 1: Accessible description of what is compared. */
  readonly description: string;
  /** Layer 2: Current scientific relation or outcome summary. */
  readonly summary: string;
  /** Layer 3: Optional detailed inspectable numerical table. */
  readonly inspectableTable?: InspectableTableData;
  /** Optional 5-field RepresentationScale for scale facts table. */
  readonly scale?: RepresentationScale;
  /** Visual chart / canvas content. */
  readonly children?: ReactNode;
  /** Live region announcement text. Throttled to prevent 60Hz stream flooding. */
  readonly liveAnnouncement?: string;
  /** Throttle interval in ms for live region updates (default 1000ms). */
  readonly liveThrottleMs?: number;
  readonly className?: string;
}

/**
 * Three-layer accessible graph container (am-inst-2d-view-kit-u75r).
 *
 * Layer 1: High-level statement of comparison.
 * Layer 2: Key findings / current relation summary.
 * Layer 3: Collapsible inspectable data table.
 * Includes scale facts table and throttled live-region stream.
 */
export function AccessibleGraphView({
  title,
  description,
  summary,
  inspectableTable,
  scale,
  children,
  liveAnnouncement,
  liveThrottleMs = 1000,
  className = "accessible-graph-view",
}: AccessibleGraphViewProps): ReactElement {
  const [throttledAnnouncement, setThrottledAnnouncement] = useState<string>("");
  const lastAnnounceTimeRef = useRef<number>(0);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!liveAnnouncement) return;

    const now = Date.now();
    const elapsed = now - lastAnnounceTimeRef.current;

    if (elapsed >= liveThrottleMs) {
      lastAnnounceTimeRef.current = now;
      setThrottledAnnouncement(liveAnnouncement);
    } else {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(() => {
        lastAnnounceTimeRef.current = Date.now();
        setThrottledAnnouncement(liveAnnouncement);
      }, liveThrottleMs - elapsed);
    }

    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    };
  }, [liveAnnouncement, liveThrottleMs]);

  const scaleRows = scale ? getScaleFactRows(scale) : [];

  return (
    <figure className={className} aria-label={title}>
      {/* Layer 1: High-level header and summary */}
      <figcaption className="graph-layer-1">
        <h4 className="graph-title">{title}</h4>
        <p className="graph-description">{description}</p>
      </figcaption>

      {/* Layer 2: Current relation summary */}
      <div className="graph-layer-2 relation-summary" role="status" aria-live="polite">
        <p>{summary}</p>
      </div>

      {/* The visual chart / SVG / Canvas */}
      <div className="graph-visual-container">{children}</div>

      {/* Throttled live region (never 60 Hz flooding) */}
      <div className="sr-only live-region" aria-live="polite" aria-atomic="true">
        {throttledAnnouncement}
      </div>

      {/* Scale facts table for screen readers and print views */}
      {scaleRows.length > 0 && (
        <details className="scale-facts-details">
          <summary>Representation scale facts (5 independent parameters)</summary>
          <table className="scale-facts-table">
            <caption>Declared representational scales for this visualization</caption>
            <thead>
              <tr>
                <th scope="col">Dimension</th>
                <th scope="col">Declared Fact</th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {scaleRows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value}</td>
                  <td>{row.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {/* Layer 3: Collapsible inspectable data table */}
      {inspectableTable && (
        <details className="graph-layer-3 inspectable-details">
          <summary>{`Inspect data points (${inspectableTable.rows.length} rows)`}</summary>
          <div className="table-scroll">
            <table className="inspectable-data-table">
              <caption>{inspectableTable.caption}</caption>
              <thead>
                <tr>
                  {inspectableTable.headers.map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inspectableTable.rows.map((row) => (
                  <tr key={row.key}>
                    {row.cells.map((cell, idx) => {
                      const colHeader = inspectableTable.headers[idx] ?? `col-${idx}`;
                      return idx === 0 ? (
                        <th key={`${row.key}-head-${colHeader}`} scope="row">
                          {cell}
                        </th>
                      ) : (
                        <td key={`${row.key}-cell-${colHeader}`}>{cell}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
