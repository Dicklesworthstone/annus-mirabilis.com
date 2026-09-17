import { parseU64 } from "../../../src/experiments/identity/u64.ts";
import { setU64QueryParam } from "../../../src/experiments/identity/urlCodec.ts";

/** Builds `?seed=` with the canonical decimal, including values above 2^53. */
export function tapeUrlWithSeed(basePath: string, seed: string): string {
  const params = new URLSearchParams();
  const validatedSeed = parseU64(seed, "seed");
  setU64QueryParam(params, "seed", validatedSeed);
  const query = params.toString();
  return query.length === 0 ? basePath : `${basePath}?${query}`;
}

export function seedFromTapeUrl(url: string): string | null {
  const parsed = new URL(url, "http://127.0.0.1");
  return parsed.searchParams.get("seed");
}
