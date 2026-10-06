import { parseU64 } from "../../../src/experiments/identity/u64.ts";
import { setU64QueryParam } from "../../../src/experiments/identity/urlCodec.ts";

/**
 * Builds `?seed=` with the canonical decimal, including values above 2^53.
 *
 * THE QUERY GOES BEFORE ANY FRAGMENT, which this did not do until 2026-10-06 and which made it wrong
 * for exactly the routes this harness uses. Appending blindly to a hash route produced
 * `...html#/runtime?seed=1`, where the query is part of the FRAGMENT: `new URL(u).searchParams` returns
 * null for it, the page's own `new URLSearchParams(location.search)` never sees it, and the seed is
 * silently ignored. The module's test only ever passed a fragment-free path, so nothing caught it, and
 * it surfaced the moment the builder was first used by a check against the fixture's `#/runtime` route.
 * An existing query in the base path is joined with `&` rather than a second `?`.
 */
export function tapeUrlWithSeed(basePath: string, seed: string): string {
  const params = new URLSearchParams();
  const validatedSeed = parseU64(seed, "seed");
  setU64QueryParam(params, "seed", validatedSeed);
  const query = params.toString();
  if (query.length === 0) return basePath;
  const hashAt = basePath.indexOf("#");
  if (hashAt === -1) {
    return `${basePath}${basePath.includes("?") ? "&" : "?"}${query}`;
  }
  const before = basePath.slice(0, hashAt);
  const fragment = basePath.slice(hashAt);
  return `${before}${before.includes("?") ? "&" : "?"}${query}${fragment}`;
}

export function seedFromTapeUrl(url: string): string | null {
  const parsed = new URL(url, "http://127.0.0.1");
  return parsed.searchParams.get("seed");
}
