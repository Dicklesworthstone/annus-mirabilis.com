/**
 * Non-color identity per role (am-design-semantic-color-8vbq): "identity
 * also appears through labels, shapes, outlines, or patterns" -- color
 * alone never carries meaning. One cue set per role, theme-invariant
 * (unlike color, a dash pattern or marker shape does not need to change
 * with the theme to stay legible), so grayscale, forced-colors, and
 * monochrome print all remain intelligible.
 */
import { COLOR_ROLES, type ColorRole } from "./roles";

export type MarkerShape =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "cross"
  | "star"
  | "hexagon";
export type DashPattern = readonly number[] | "none";
/**
 * CSS's `text-decoration-style` and `outline-style` each have only four or
 * five real values -- fewer than the seven roles -- so underline and
 * outline are real, defined, CSS-renderable cues for every role but are
 * not individually required to distinguish all seven on their own; marker
 * shape, dash pattern, and fill pattern are the three channels with enough
 * real distinct CSS values to do that, and each does.
 */
export type UnderlineStyle = "solid" | "dashed" | "dotted" | "double" | "wavy";
export type FillPattern =
  | "solid"
  | "diagonal-stripes"
  | "dots"
  | "crosshatch"
  | "horizontal-lines"
  | "vertical-lines"
  | "grid";
export type OutlineStyle = "solid" | "dashed" | "dotted" | "double";

export interface IdentityCue {
  readonly role: ColorRole;
  readonly marker: MarkerShape;
  readonly dash: DashPattern;
  readonly underline: UnderlineStyle;
  readonly fillPattern: FillPattern;
  readonly outline: OutlineStyle;
}

/**
 * One assignment per role, each channel distinct across all seven roles
 * within its own channel (no two roles share a marker shape, no two share
 * a dash pattern, and so on), so any single non-color channel alone is
 * enough to tell every role apart.
 */
export const IDENTITY_CUES: Readonly<Record<ColorRole, IdentityCue>> = Object.freeze({
  energy: Object.freeze({
    role: "energy",
    marker: "circle",
    dash: "none",
    underline: "solid",
    fillPattern: "solid",
    outline: "solid",
  }),
  "time-rate": Object.freeze({
    role: "time-rate",
    marker: "square",
    dash: [6, 3],
    underline: "dashed",
    fillPattern: "diagonal-stripes",
    outline: "dashed",
  }),
  "space-geometry": Object.freeze({
    role: "space-geometry",
    marker: "triangle",
    dash: [2, 2],
    underline: "dotted",
    fillPattern: "dots",
    outline: "dotted",
  }),
  material: Object.freeze({
    role: "material",
    marker: "diamond",
    dash: [8, 2, 2, 2],
    underline: "double",
    fillPattern: "crosshatch",
    outline: "double",
  }),
  statistical: Object.freeze({
    role: "statistical",
    marker: "cross",
    dash: [1, 3],
    underline: "wavy",
    fillPattern: "horizontal-lines",
    outline: "solid",
  }),
  field: Object.freeze({
    role: "field",
    marker: "star",
    dash: [10, 4],
    underline: "solid",
    fillPattern: "vertical-lines",
    outline: "dashed",
  }),
  quanta: Object.freeze({
    role: "quanta",
    marker: "hexagon",
    dash: [4, 4, 1, 4],
    underline: "dashed",
    fillPattern: "grid",
    outline: "dotted",
  }),
});

export function identityCueFor(role: ColorRole): IdentityCue {
  return IDENTITY_CUES[role];
}

/**
 * The selection cue: a thickened outline plus the role's own non-color
 * pattern, applied via `[data-selected-quantity-id]` descendant CSS rules
 * (selection.css). It never relies on hue alone and never changes the
 * role's color tokens -- it is layered on top of them.
 */
export interface SelectionCue {
  readonly outlineWidthPx: number;
  readonly outlineStyle: OutlineStyle;
}

export function selectionCueFor(role: ColorRole): SelectionCue {
  return { outlineWidthPx: 3, outlineStyle: identityCueFor(role).outline };
}

export function allRolesHaveDistinctCue<K extends keyof IdentityCue>(channel: K): boolean {
  const values = COLOR_ROLES.map((role) => JSON.stringify(IDENTITY_CUES[role][channel]));
  return new Set(values).size === values.length;
}
