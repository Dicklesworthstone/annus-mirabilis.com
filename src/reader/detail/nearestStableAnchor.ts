/**
 * Which addressable unit is "at the reading line" right now, for a permalink
 * or a restored scroll position that survives reflow (a Detail-level toggle,
 * a font-size change, a window resize): the deepest unit whose rectangle
 * intersects the reading band at the top of the viewport. Geometry is
 * supplied by the caller (real layout in the browser, fixtures in tests);
 * this function does no measuring of its own.
 */

export interface AddressableUnit {
  readonly id: string;
  readonly top: number;
  readonly height: number;
}

const READING_BAND_FRACTION = 0.4;

function intersectsReadingBand(unit: AddressableUnit, bandEnd: number): boolean {
  return unit.top <= bandEnd && unit.top + unit.height >= 0;
}

/**
 * `urlAnchor`, when given, wins outright and skips the geometric
 * computation entirely: the caller already knows where the reader meant to
 * land. Otherwise the deepest unit (largest `top`) intersecting the top 40
 * percent of the viewport is returned; a tie on `top` resolves to whichever
 * unit appears earlier in `units` (its document order).
 */
export function nearestStableAnchor(
  units: readonly AddressableUnit[],
  viewportHeight: number,
  urlAnchor?: string,
): string | undefined {
  if (urlAnchor !== undefined) return urlAnchor;
  if (units.length === 0) return undefined;
  const bandEnd = viewportHeight * READING_BAND_FRACTION;
  let deepest: AddressableUnit | undefined;
  for (const unit of units) {
    if (!intersectsReadingBand(unit, bandEnd)) continue;
    if (!deepest || unit.top > deepest.top) deepest = unit;
  }
  return deepest?.id;
}
