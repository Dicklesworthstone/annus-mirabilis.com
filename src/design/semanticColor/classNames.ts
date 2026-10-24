import { COLOR_ROLES, type ColorRole } from "./roles";

/**
 * `am-role-<meaning role>` for the seven roles of `COLOR_ROLES`: energy, time-rate,
 * space-geometry, material, statistical, field, quanta. These say what a quantity MEANS.
 *
 * THIS DOCBLOCK SAID "The only seven classes the KaTeX trust callback of am-eq-static-katex-7da
 * admits", AND THAT WAS FALSE IN BOTH DIRECTIONS. Measured 2026-10-24: the live callback
 * (src/equations/render.ts) admits `EQUATION_ROLE_CLASS_NAMES` -- am-role-input, am-role-result,
 * am-role-constant -- and those three come from a different vocabulary, `Quantity.role`, which
 * says where a number COMES FROM. The two sets are DISJOINT: not one of the seven names here is
 * admitted by that callback or styled by equations.css, and not one of its three can be produced
 * by this function. `classNames.test.ts` asserts the disjointness against the live constant, so
 * the claim cannot drift back.
 *
 * The reason the correction is worth more than its size: the next reader of the old sentence
 * reconciles the "mismatch" by adding these seven to the trust callback, which widens what a
 * source record may put in a class attribute through mathematics. AGENTS.md asks that KaTeX trust
 * stay narrowly scoped. Nothing may widen it on the strength of this module.
 *
 * No production module imports this file (src/testing/unwiredModules.baseline.json). It belongs to
 * am-design-semantic-color-8vbq, which is open at P0 and owns the meaning-role palette; the
 * generated-LaTeX consumer its bead describes is that bead's work, and it is not the equation
 * renderer's three-class vocabulary.
 */
export function roleClassName(role: ColorRole): string {
  return `am-role-${role}`;
}

export const ROLE_CLASS_NAMES: readonly string[] = Object.freeze(COLOR_ROLES.map(roleClassName));
