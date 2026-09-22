/**
 * Per-theme role-color tokens (am-design-semantic-color-8vbq).
 *
 * DERIVATION, recorded here because the acceptance criteria require it:
 * every value below was found by an automated search over a hue/saturation/
 * lightness grid (10 degrees, 15%, 5% steps) for each theme, keeping only
 * candidates that (a) meet 4.5:1 text contrast against that theme's paper
 * (src/a11y/readingSettings/contrast.ts's real contrastRatio, reused, never
 * reimplemented), and (b) sit at least a CIEDE2000 20 from that theme's own
 * accent color and from Annalen's reserved red (#ae2119) -- then greedily
 * selecting seven of those candidates to maximize the minimum pairwise
 * CIEDE2000 distance. tokens.cvd.test.ts asserts every one of those
 * distances directly from these literals, so a hand-edit that breaks
 * separation fails the build rather than waiting for a design review to
 * notice. The resulting hues are saturated by construction (separation was
 * prioritized over subtlety); a later aesthetic pass may retune within the
 * same verified margins, but must re-run this derivation, never eyeball a
 * replacement.
 *
 * Red (crimson/rose, and coral within a CIEDE2000 20 of Annalen's red) is
 * reserved for emphasis and the move step and is never a role color, which
 * is exactly what "distance from Annalen's red" enforces on every theme,
 * not only Annalen's own.
 */

import type { ThemeId } from "../../app/theme/tokens";
import type { ColorRole } from "./roles";

export type RoleTokens = Readonly<Record<ColorRole, string>>;

export const RESERVED_RED = "#ae2119";

export const ROLE_TOKENS: Readonly<Record<ThemeId, RoleTokens>> = Object.freeze({
  annalen: Object.freeze({
    energy: "#110b09",
    "time-rate": "#8c25f4",
    "space-geometry": "#067906",
    material: "#795306",
    statistical: "#145252",
    field: "#050561",
    quanta: "#1966b3",
  }),
  "kramgasse-night": Object.freeze({
    energy: "#e4d5cd",
    "time-rate": "#d63df5",
    "space-geometry": "#2d9c16",
    material: "#368ce2",
    statistical: "#f2590d",
    field: "#25f4d1",
    quanta: "#f2f20d",
  }),
});

/**
 * The one path from a quantity's role to its color tokens for the current
 * theme. Every consumer (equations, sentences, legends, graphs, scenes,
 * code) calls this, never a private palette.
 */
export function tokensFor(role: ColorRole, theme: ThemeId): string {
  return ROLE_TOKENS[theme][role];
}
