import { bell, TICKS } from "../../foundations/speedSpread.ts";

/**
 * THE SPEED-SPREAD FIGURE'S GEOMETRY, in the drawing's own units (dispatch 280).
 *
 * The owner: "this graph is messed up and has overlapping elements". In the drawing of b16bc66b
 * the axis numbers ±295 stood between the dashed edges of the shaded middle, which mark half a
 * width, so each number sat between two marks and under neither; "−590" and "−295" were 38 units
 * apart with 34-unit labels; and the dashed axis ran over the heavy outline of the two tails.
 *
 * Here every number has a tick of its own, under the axis, and is centred on it. The shaded middle
 * and the outlined tails carry no line along the axis, so the axis is the only line there. The
 * labels take the site-wide svg[role="img"] text size, 13.2 of these units, so their size relative
 * to the drawing is the same at every width and zoom: if they clear each other here, they clear
 * everywhere. speedSpreadLayout.test.ts holds them to that.
 */
export const FIGURE_WIDTH = 300;
export const FIGURE_HEIGHT = 178;
/** One width of the bell curve, in drawing units. The curve is drawn three widths either way. */
export const WIDTH_UNITS = 45;
export const CENTRE = FIGURE_WIDTH / 2;
/** The axis. */
export const BASE = 128;
export const CURVE_HEIGHT = 106;
export const TICK_LENGTH = 5;
/** The site-wide label size (globals.css: svg[role="img"] text, var(--type-fine), 0.825rem). */
export const LABEL_SIZE = 13.2;
/**
 * Baselines of the axis numbers and of the axis title. A label's box, as Chromium measures it,
 * reaches about 1 em above its baseline and 0.25 below, so each clears what is above it.
 */
export const NUMBER_Y = BASE + TICK_LENGTH + LABEL_SIZE + 2;
export const TITLE_Y = NUMBER_Y + 20;
/** How far the curve is drawn, in widths. */
export const DRAWN_WIDTHS = 3;

export const x = (u: number) => CENTRE + u * WIDTH_UNITS;
export const y = (u: number) => BASE - CURVE_HEIGHT * bell(u);

const fixed = (n: number) => n.toFixed(1);

/** The curve between two widths, open. */
export function curvePath(from: number, to: number): string {
  const points: string[] = [];
  for (let u = from; u <= to + 1e-9; u += 0.05) points.push(`${fixed(x(u))},${fixed(y(u))}`);
  return `M${points.join(" L")}`;
}

/** The region under the curve between two widths, closed along the axis: a fill, never stroked. */
export function regionPath(from: number, to: number): string {
  return `${curvePath(from, to)} L${fixed(x(to))},${BASE} L${fixed(x(from))},${BASE} Z`;
}

/**
 * A tail's outline: its edge at two widths, up from the axis, then the curve out to the end of
 * the drawing. It stops at the axis and never runs along it.
 */
export function tailOutline(side: -1 | 1): string {
  const edge = side * 2;
  const end = side * DRAWN_WIDTHS;
  const [from, to] = side < 0 ? [end, edge] : [edge, end];
  const curve = curvePath(from, to);
  return side < 0
    ? `${curve} L${fixed(x(edge))},${BASE}`
    : `M${fixed(x(edge))},${BASE} L${curve.slice(1)}`;
}

/** A number as the axis prints it: a true minus sign. */
export const axisNumber = (value: number) => (value < 0 ? `−${-value}` : String(value));

/** A multiple of the spread as printed, to three figures. */
export const multiple = (u: number, spread: number) =>
  axisNumber(Number((u * spread).toPrecision(3)));

export type AxisTick = Readonly<{ u: number; x: number; label: string }>;

/** The ticks at 0, one and two widths either way, each with its number, for a given spread. */
export function axisTicks(spread: number): readonly AxisTick[] {
  return TICKS.map((u) => ({ u, x: x(u), label: multiple(u, spread) }));
}
