/**
 * Three-Layer Accessible Graph Description Provider and View (am-a11y-graph-descriptions-vxe1).
 *
 * Rules:
 * 1. Layer 1: Concise statement of what is being compared (figure accessible name / caption).
 * 2. Layer 2: Current scientific relation or change summary after an intentional action.
 * 3. Layer 3: Optional detailed inspectable numerical table with bounded pagination.
 * 4. Carries data-snapshot-version matching the accepted snapshot store.
 * 5. Provides "Describe now" button (immediate readout) and pause control for animated views.
 * 6. Supports static worked example and table fallback for no-WebGL / no-JavaScript environments.
 */

import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RepresentationScale } from "../../visuals/kit/types.ts";
import { AnnouncementManager } from "./announcementManager.ts";
import { DataTable, type DataTableColumn, type DataTableRow } from "./DataTable.tsx";
import { fillTemplate, type TemplateData } from "./templates.ts";

export interface GraphDescriptionState {
  readonly layer1Statement: string;
  readonly layer2Template: string;
  readonly layer2Summary: string;
  readonly snapshotVersion: string | number;
  readonly runId?: string | undefined;
  readonly isAnimating: boolean;
  readonly isPaused: boolean;
  readonly isTableOpen: boolean;
  readonly scale?: RepresentationScale | undefined;
  readonly togglePause: () => void;
  readonly toggleTable: () => void;
  readonly describeNow: () => void;
}

const GraphDescriptionContext = createContext<GraphDescriptionState | null>(null);

export function useGraphDescription(): GraphDescriptionState {
  const ctx = useContext(GraphDescriptionContext);
  if (!ctx) {
    throw new Error(
      "useGraphDescription must be used within a GraphDescriptionContainer or Provider",
    );
  }
  return ctx;
}

export interface GraphDescriptionContainerProps {
  /** Layer 1: Concise statement of what is compared (e.g. "The histogram of tracer positions..."). */
  readonly layer1Statement: string;
  /** Layer 2: Declarative template string with {slots}. */
  readonly layer2Template: string;
  /** Snapshot data consumed to populate the template. */
  readonly templateData: TemplateData;
  /** Accepted snapshot version. Must match the visual view. */
  readonly snapshotVersion: string | number;
  /** Run ID of the current calculation. */
  readonly runId?: string | undefined;
  /** Instrument ID for tracing (e.g. "bm-01"). */
  readonly instrumentId?: string | undefined;
  /** View ID for tracing (e.g. "histogram"). */
  readonly viewId?: string | undefined;
  /** Optional Layer 3 table data. */
  readonly tableData?:
    | {
        readonly caption: string;
        readonly columns: readonly DataTableColumn[];
        readonly rows: readonly DataTableRow[];
        readonly pageSize?: number | undefined;
      }
    | undefined;
  /** Optional RepresentationScale publishing the 5 scale facts. */
  readonly scale?: RepresentationScale | undefined;
  /** Indicates if this is an animated/continuous simulation view. */
  readonly animated?: boolean | undefined;
  /** Force reduced motion (pauses simulation animation and presents static state). */
  readonly reducedMotion?: boolean | undefined;
  /** Initial open state of Layer 3 data table (default false). */
  readonly initialTableOpen?: boolean | undefined;
  /** Visual chart / canvas / SVG children. */
  readonly children?: ReactNode | undefined;
  /** Optional custom AnnouncementManager instance. */
  readonly announcementManager?: AnnouncementManager | undefined;
  readonly className?: string | undefined;
}

export function GraphDescriptionContainer({
  layer1Statement,
  layer2Template,
  templateData,
  snapshotVersion,
  runId,
  instrumentId,
  viewId,
  tableData,
  scale,
  animated = false,
  reducedMotion,
  initialTableOpen = false,
  children,
  announcementManager,
  className = "accessible-graph-container",
}: GraphDescriptionContainerProps): ReactElement {
  const [isPaused, setIsPaused] = useState<boolean>(() => {
    if (reducedMotion) return true;
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });
  const [isTableOpen, setIsTableOpen] = useState<boolean>(initialTableOpen);

  useEffect(() => {
    if (reducedMotion) {
      setIsPaused(true);
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia) {
      const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mql.matches) {
        setIsPaused(true);
      }
      const onChange = (e: MediaQueryListEvent) => {
        if (e.matches) setIsPaused(true);
      };
      mql.addEventListener?.("change", onChange);
      return () => {
        mql.removeEventListener?.("change", onChange);
      };
    }
  }, [reducedMotion]);

  // Initialize or memoize the announcement manager
  const manager = useMemo(() => {
    return announcementManager ?? new AnnouncementManager();
  }, [announcementManager]);

  // Compute filled Layer 2 summary from template and data
  const layer2Summary = useMemo(() => {
    return fillTemplate(layer2Template, { ...templateData, scale });
  }, [layer2Template, templateData, scale]);

  // Keep announcement manager animation state updated
  useEffect(() => {
    manager.setAnimating(animated && !isPaused);
  }, [animated, isPaused, manager]);

  // Announce only when the accepted snapshot identity changes — never on mount,
  // never on a presentation-only layer-two rewrite, and never while animating
  // (the manager suppresses those). A 60 Hz snapshot stream is not a commit.
  const previousSnapshotVersion = useRef(snapshotVersion);
  useEffect(() => {
    if (previousSnapshotVersion.current === snapshotVersion) return;
    previousSnapshotVersion.current = snapshotVersion;
    manager.emitCommitAnnouncement(layer2Summary);
  }, [snapshotVersion, layer2Summary, manager]);

  const togglePause = () => {
    setIsPaused((p) => !p);
  };

  const toggleTable = () => {
    setIsTableOpen((o) => !o);
  };

  const describeNow = () => {
    manager.describeNow(layer2Summary);
  };

  const contextValue: GraphDescriptionState = {
    layer1Statement,
    layer2Template,
    layer2Summary,
    snapshotVersion,
    runId,
    isAnimating: animated && !isPaused,
    isPaused,
    isTableOpen,
    scale,
    togglePause,
    toggleTable,
    describeNow,
  };

  return (
    <GraphDescriptionContext.Provider value={contextValue}>
      <figure
        className={className}
        aria-label={layer1Statement}
        data-snapshot-version={String(snapshotVersion)}
        data-instrument-id={instrumentId}
        data-view-id={viewId}
        data-run-id={runId}
        data-reduced-motion={reducedMotion || isPaused ? "true" : undefined}
        style={{ maxWidth: "100%", margin: 0, boxSizing: "border-box" }}
      >
        {/* Layer 1: Header / Accessible name */}
        <figcaption className="graph-layer-1" data-layer="1">
          <h4 className="layer-1-statement">{layer1Statement}</h4>
        </figcaption>

        {/* Layer 2 is the persistent description, not a live region. A 60 Hz
            animation that rewrites this text must not produce a 60 Hz
            live-region stream. Announcements go through AnnouncementManager. */}
        <div
          className="graph-layer-2 graph-layer-2-region"
          data-layer="2"
          {...(viewId ? { id: `graph-layer-2-${viewId}` } : {})}
        >
          <p className="layer-2-text">{layer2Summary}</p>
        </div>

        {/* Action Controls: Describe Now, Pause/Resume, Show Table */}
        <div
          className="graph-a11y-controls"
          role="toolbar"
          aria-label="Graph accessibility controls"
        >
          <button
            type="button"
            className="a11y-btn describe-now-btn"
            onClick={describeNow}
            aria-label="Describe current graph data now"
          >
            Describe now
          </button>

          {animated && (
            <button
              type="button"
              className="a11y-btn pause-btn"
              onClick={togglePause}
              aria-label={isPaused ? "Resume simulation animation" : "Pause simulation animation"}
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
          )}

          {tableData && (
            <button
              type="button"
              className="a11y-btn toggle-table-btn"
              onClick={toggleTable}
              aria-expanded={isTableOpen}
              aria-label={
                isTableOpen ? "Hide inspectable data table" : "Show inspectable data table"
              }
            >
              {isTableOpen ? "Hide data table" : "Show data table"}
            </button>
          )}
        </div>

        {/* Visual View Canvas/SVG container */}
        <div
          className="graph-visual-canvas-container"
          role="img"
          aria-label={layer1Statement}
          {...(viewId ? { "aria-describedby": `graph-layer-2-${viewId}` } : {})}
        >
          {children}
        </div>

        {/* Layer 3: Inspectable Data Table */}
        {tableData && (isTableOpen || typeof window === "undefined") && (
          <div className="graph-layer-3-container">
            <DataTable
              caption={tableData.caption}
              columns={tableData.columns}
              rows={tableData.rows}
              snapshotVersion={snapshotVersion}
              pageSize={tableData.pageSize}
              scale={scale}
            />
          </div>
        )}
      </figure>
    </GraphDescriptionContext.Provider>
  );
}
