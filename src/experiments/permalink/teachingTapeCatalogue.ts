/**
 * THE AUTHORED WALKTHROUGHS WHERE AN INSTRUMENT RUNS (am-2rl9, dispatch 382).
 *
 * `loadWireTeachingTapes` reads the YAML records with `node:fs`, which is right for a server
 * component and impossible in a browser. This is the same map as a build product, imported the way
 * every other laboratory result already reaches a page, so `resolveTeachingTape` works on both
 * sides of that line with one implementation behind it.
 *
 * `src/generated/teaching-tapes.json` is written by `scripts/generate-tape-links.ts`, which
 * `prepare:lab` runs, beside `tape-links.json` and from the same source. It is NEVER hand-edited
 * and never committed: `src/generated/` is in `.gitignore` ("regenerated before dev/build/test"),
 * so the artifact cannot drift from the records by anyone's hand, only by a lane failing to run.
 *
 * SIZE, MEASURED BEFORE CHOOSING THE SHAPE (2026-09-28): 15,816 bytes raw and 2,850 gzipped
 * compacted, which is what a bundler ships; 20,926 on disk pretty-printed. Against the initial
 * reading route's 200 KiB compressed budget that is about 1.4 per cent, so it ships as ONE file. A
 * per-instrument split would save under 2 kB and cost a loader, and the largest single instrument
 * is 2,010 bytes raw.
 *
 * WHAT IS NOT IN IT, AND WHY THAT IS VISIBLE. 12 of the 22 authored records convert; the other 10
 * carry a descriptive checkpoint digest the permalink schema refuses, since it requires hex. They
 * travel as `problems` rather than being dropped, because a walkthrough missing from a resolver and
 * a walkthrough that never existed look identical to a caller.
 */

import generated from "../../generated/teaching-tapes.json";
import { createTeachingTapeResolver, type TeachingTapeResolver } from "./teachingTapeResolver.ts";
import type { TapeV2 } from "./types.ts";

const payload = generated as unknown as {
  tapes: Record<string, TapeV2>;
  problems: readonly string[];
};

/** Every authored walkthrough that can be carried in a link, by tape id. */
export const TEACHING_TAPES: ReadonlyMap<string, TapeV2> = new Map(Object.entries(payload.tapes));

/** The records that could not be carried, each naming its file and the field that stopped it. */
export const TEACHING_TAPE_PROBLEMS: readonly string[] = payload.problems;

/**
 * The `ReplayRunner.resolveTeachingTape` hook over the generated catalogue. Give it to a runner and
 * a permalink tape carrying a `teachingTapeRef` replays the authored walkthrough instead of its own
 * recorded events.
 */
export const resolveTeachingTape: TeachingTapeResolver = createTeachingTapeResolver(TEACHING_TAPES);
