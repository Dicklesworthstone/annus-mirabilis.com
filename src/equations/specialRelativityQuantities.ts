import type { QuantityRegistry } from "./quantities.ts";

/**
 * Modern teaching notation for the relativity paper's explanation-face formulas. Empty until the
 * paper's equation records are authored (pane %43, dispatch 43). Every entry must reuse a canonical
 * id from content/quantities/ (kinematics.yaml, electrodynamics.yaml, constants.yaml), never a glyph:
 * paper 3's beta is the modern gamma, V is the speed of light, and tau is the moving frame's time,
 * not proper time. Build entries with the `quantity` helper shape used in massEnergyQuantities.ts.
 * Dimension order is length, mass, time, temperature, current, amount.
 */
export const SPECIAL_RELATIVITY_QUANTITIES: QuantityRegistry = Object.freeze({});
