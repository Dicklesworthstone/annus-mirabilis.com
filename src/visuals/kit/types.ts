/**
 * Type declarations for the Annus Mirabilis 2D View Kit (am-inst-2d-view-kit-u75r).
 *
 * Primitives project accepted snapshot data and parameters into SVG and Canvas
 * coordinates. They never compute physics, evaluate densities, or maintain
 * private scientific state in React useState.
 */

export interface SpatialMagnification {
  /** "scene" if the entire visual field is magnified; otherwise the specific output/quantity ID being amplified (e.g. "centerOfMassShift"). */
  readonly appliesTo: "scene" | string;
  /** Magnification factor (1 = life-size / unmagnified). Must be > 0. */
  readonly factor: number;
  /** Optional authoring explanation (e.g. "readout magnified for visibility"). */
  readonly note?: string | undefined;
}

export interface SimulatedElapsedTime {
  /** The quantity ID of the elapsed model time (e.g. "elapsedTime" or "t"). */
  readonly quantityId: string;
  /** The numerical value of the elapsed model time. */
  readonly value: number;
  /** The physical unit of the elapsed model time (e.g. "s", "μs"). */
  readonly unit: string;
}

export interface GlyphSize {
  /** Drawn pixel size of the marker/glyph. */
  readonly drawnPx: number;
  /** "none" unless the glyph size is calibrated to represent a physical quantity extent. */
  readonly represents: "none" | string;
}

export type QuantityNormalizationKind =
  | "none"
  | "per-bin-width"
  | "per-total"
  | "per-peak"
  | (string & {});

export interface QuantityNormalization {
  /** Normalization kind applied to the displayed series. */
  readonly kind: QuantityNormalizationKind;
  /** Optional explanation of the normalization. */
  readonly note?: string | undefined;
}

/**
 * The five independent representational scale facts (am-inst-2d-view-kit-u75r).
 * Changing any one of these is a presentation change, never a scientific state change.
 */
export interface RepresentationScale {
  readonly spatialMagnification: SpatialMagnification;
  readonly simulatedElapsedTime: SimulatedElapsedTime;
  /** Model seconds per wall-clock second. 1 = true rate / real time. */
  readonly playbackMultiplier: number;
  readonly glyphSize: GlyphSize;
  readonly quantityNormalization: QuantityNormalization;
}

/**
 * Standard identity props accepted by all view kit primitives.
 */
export interface ViewIdentityProps {
  readonly instanceId: string;
  readonly runId: string;
  readonly snapshotVersion: string | number;
}

/**
 * Visually distinct classes for plot curves and series.
 */
export type PlotSeriesClass = "theoretical" | "historical" | "empirical";

/**
 * Explicit histogram bin contract. Bins are supplied by the simulation owner,
 * never computed or re-binned by the view helper.
 */
export interface HistogramBinData {
  /** Bin boundary edges, length = N + 1. */
  readonly edges: readonly number[];
  /** Integer sample counts in each bin, length = N. */
  readonly counts: readonly number[];
  /** Total or per-bin probability values, length = N. */
  readonly binProbabilities: readonly number[];
  /** Optional counts of samples outside the [min, max] range. */
  readonly overflowCounts?:
    | {
        readonly underflow: number;
        readonly overflow: number;
      }
    | undefined;
  /** Total sample count across all bins and overflows. */
  readonly totalCount?: number | undefined;
}

/**
 * Density kind for vertical axes on logarithmic or spectral plots.
 */
export type LogAxisDensityKind =
  | "per-frequency"
  | "per-wavelength"
  | "per-ln-interval"
  | "per-decade"
  | "total";

/**
 * Model reference line (e.g. for log-log plots showing slope 1/2).
 */
export interface ReferenceLine {
  readonly label: string;
  readonly slope: number;
  readonly intercept?: number | undefined;
  readonly xRange: readonly [number, number];
  readonly quantityId?: string | undefined;
}

/**
 * 2D domain to pixel coordinate mapping interface.
 */
export interface Projector {
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
  (dataValue: number): number;
  invert(pixelValue: number): number;
}
