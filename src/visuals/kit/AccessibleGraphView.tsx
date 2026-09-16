import { type ReactElement, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  GraphDescriptionContainer,
  type GraphDescriptionContainerProps,
} from "../../a11y/descriptions/provider.tsx";
import type { TemplateData } from "../../a11y/descriptions/templates.ts";
import type { RepresentationScale } from "./types.ts";

export interface InspectableTableRow {
  readonly key: string | number;
  readonly cells: readonly (string | number)[];
}

export interface InspectableTableData {
  readonly headers: readonly string[];
  readonly rows: readonly InspectableTableRow[];
  readonly caption: string;
  readonly pageSize?: number | undefined;
}

export interface AccessibleGraphViewProps {
  /** Layer 1: High-level comparison title. */
  readonly title: string;
  /** Layer 1: Accessible description of what is compared. */
  readonly description?: string | undefined;
  /** Layer 2: Current scientific relation or outcome summary. */
  readonly summary?: string | undefined;
  /** Layer 2: Declarative template string with {slots}. */
  readonly template?: string | undefined;
  /** Snapshot data consumed to populate the template. */
  readonly templateData?: TemplateData | undefined;
  /** Layer 3: Optional detailed inspectable numerical table. */
  readonly inspectableTable?: InspectableTableData | undefined;
  /** Alternative standard tableData structure. */
  readonly tableData?: GraphDescriptionContainerProps["tableData"] | undefined;
  /** Optional 5-field RepresentationScale for scale facts table. */
  readonly scale?: RepresentationScale | undefined;
  /** Visual chart / canvas content. */
  readonly children?: ReactNode | undefined;
  /** Live region announcement text. */
  readonly liveAnnouncement?: string | undefined;
  /** Throttle interval in ms for live region updates (default 1000ms). */
  readonly liveThrottleMs?: number | undefined;
  /** Accepted snapshot version. */
  readonly snapshotVersion?: string | number | undefined;
  /** Run ID of the current calculation. */
  readonly runId?: string | undefined;
  /** Instrument ID for tracing (e.g. "bm-01"). */
  readonly instrumentId?: string | undefined;
  /** View ID for tracing (e.g. "histogram"). */
  readonly viewId?: string | undefined;
  /** Indicates if this is an animated/continuous simulation view. */
  readonly animated?: boolean | undefined;
  readonly className?: string | undefined;
}

/**
 * Three-layer accessible graph container (am-inst-2d-view-kit-u75r).
 * Builds directly against GraphDescriptionContainer (am-a11y-graph-descriptions-vxe1).
 *
 * Layer 1: High-level statement of comparison.
 * Layer 2: Key findings / current relation summary (via template or string summary).
 * Layer 3: Collapsible inspectable data table.
 * Includes scale facts table and throttled live-region stream.
 */
export function AccessibleGraphView({
  title,
  description,
  summary,
  template,
  templateData,
  inspectableTable,
  tableData,
  scale,
  children,
  liveAnnouncement,
  liveThrottleMs = 1000,
  snapshotVersion = "1",
  runId,
  instrumentId,
  viewId,
  animated = false,
  className = "accessible-graph-view",
}: AccessibleGraphViewProps): ReactElement {
  const [throttledAnnouncement, setThrottledAnnouncement] = useState<string>(
    liveAnnouncement ?? "",
  );
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

  const layer1Statement = description ? `${title}. ${description}` : title;
  const layer2Template = template ?? summary ?? "";
  const mergedTemplateData: TemplateData = useMemo(() => {
    return {
      ...(templateData ?? {}),
      statistics: {
        ...(templateData?.statistics ?? {}),
        ...(summary ? { summary } : {}),
      },
    };
  }, [templateData, summary]);

  const resolvedTableData = useMemo(() => {
    if (tableData) return tableData;
    if (inspectableTable) {
      return {
        caption: inspectableTable.caption,
        columns: inspectableTable.headers.map((h, i) => ({ id: `col-${i}`, header: h })),
        rows: inspectableTable.rows.map((r) => ({
          id: String(r.key),
          label: String(r.cells[0] ?? r.key),
          values: r.cells,
        })),
        pageSize: inspectableTable.pageSize,
      };
    }
    return undefined;
  }, [tableData, inspectableTable]);

  return (
    <GraphDescriptionContainer
      layer1Statement={layer1Statement}
      layer2Template={layer2Template}
      templateData={mergedTemplateData}
      snapshotVersion={snapshotVersion}
      runId={runId}
      instrumentId={instrumentId}
      viewId={viewId}
      tableData={resolvedTableData}
      scale={scale}
      animated={animated}
      initialTableOpen={true}
      className={`accessible-graph-view ${className}`}
    >
      {children}
      {throttledAnnouncement && (
        <div className="sr-only live-region" aria-live="polite" aria-atomic="true">
          {throttledAnnouncement}
        </div>
      )}
    </GraphDescriptionContainer>
  );
}
