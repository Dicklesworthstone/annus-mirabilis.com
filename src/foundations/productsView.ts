/**
 * The projection and oriented-area view of foundation:dot-cross-products
 * (am-found-linear-geometry-7w15): arrow a fixed along x, arrow b turned to an angle the reader
 * chooses, and their dot product, b's projection on a, and the cross product as a signed area.
 * Pure and throw-free.
 */

/** Arrow a, 4 long along x. */
export const A = { x: 4, y: 0 } as const;
/** Arrow b's length. */
export const B_LENGTH = 3;

export const ANGLE_SLIDER = { min: -180, max: 180, step: 15 } as const;
export const ANGLE_LIMIT = 360;

export interface ProductsView {
  /** Degrees from a to b, counterclockwise. */
  readonly angle: number;
  readonly b: { readonly x: number; readonly y: number };
  readonly dot: number;
  /** How much of b lies along a: a·b / |a|. */
  readonly projection: number;
  /** The z component of a × b: the signed area of the parallelogram a and b span. */
  readonly cross: number;
  readonly crossDirection: "out of the page" | "into the page" | "none";
}

export type ProductsOutcome =
  | { readonly status: "shown"; readonly view: ProductsView }
  | { readonly status: "refused"; readonly message: string };

export const PRODUCTS_REFUSALS = {
  empty: "Type an angle in degrees, for example 60 or −45.",
  unreadable: "The construction cannot read that as an angle. Write it like 60, 22,5 or −45.",
  "out-of-range": `Choose an angle between −${ANGLE_LIMIT} and ${ANGLE_LIMIT} degrees.`,
} as const;

/** Areas smaller than this, in square units, are drawn and read as no area at all. */
const NO_AREA = 5e-4;

export function showProducts(angle: number): ProductsOutcome {
  if (!Number.isFinite(angle)) return { status: "refused", message: PRODUCTS_REFUSALS.unreadable };
  if (Math.abs(angle) > ANGLE_LIMIT)
    return { status: "refused", message: PRODUCTS_REFUSALS["out-of-range"] };
  const radians = (angle * Math.PI) / 180;
  const b = { x: B_LENGTH * Math.cos(radians), y: B_LENGTH * Math.sin(radians) };
  const dot = A.x * b.x + A.y * b.y;
  const cross = A.x * b.y - A.y * b.x;
  const lengthA = Math.hypot(A.x, A.y);
  return {
    status: "shown",
    view: {
      angle,
      b,
      dot,
      projection: dot / lengthA,
      cross,
      crossDirection:
        cross > NO_AREA ? "out of the page" : cross < -NO_AREA ? "into the page" : "none",
    },
  };
}

/** Reads a typed angle in degrees: 60, 22.5, 22,5, −45, -45 or 60°. */
export function showProductsTyped(text: string): ProductsOutcome {
  const trimmed = text.trim().replace(/−/g, "-").replace(",", ".").replace(/°$/, "");
  if (trimmed === "") return { status: "refused", message: PRODUCTS_REFUSALS.empty };
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(trimmed))
    return { status: "refused", message: PRODUCTS_REFUSALS.unreadable };
  return showProducts(Number(trimmed));
}
