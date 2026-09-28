/**
 * THE SOURCE-BLOCK POPULATION, LOADED SEPARATELY AND ON PURPOSE (am-as1w follow-on).
 *
 * `structural.ts` resolves an editorial note's `affectedIds` against the source blocks of its
 * paper, and until now it had nothing to resolve against: `loadReadingFiles` skips every `.yaml`,
 * source blocks are `.yaml`, and 0 of the 456 block files reached the compiler. The check declined
 * rather than condemning, and counted what it declined, which is why it read honestly instead of
 * reporting 17 false positives. This supplies the population it was declining for.
 *
 * WHY NOT WIDEN `loadReadingFiles`, measured rather than assumed. It has 35 call sites and a hard
 * `files.length >= 512` budget; it loads 317 files today, and 317 + 456 = 773 would throw for every
 * one of them. It is the reading-record loader, and source blocks are a different family.
 *
 * WHY NOT APPEND THEM TO THE COMPILER'S FILE LIST EITHER, which is the obvious alternative and is
 * worse. Measured 2026-09-28: compiling the 456 blocks as ordinary records takes the content lane
 * from 247 diagnostics and ok=true to 517 and ok=false, adding 70 `duplicate-id` errors and 1
 * `unrouted-content`. Neither is about the blocks being wrong. The duplicates are a rule that treats
 * an equation id as GLOBAL meeting ids that are per-paper by design, so `eq-s1-d1` exists in four
 * papers and collides with itself; 115 of the 456 basenames are shared between papers. The unrouted
 * one is `source-blocks/special-relativity/eq-A.yaml`, whose capital A the route's `[a-z0-9-]+`
 * cannot spell. Both are real findings and neither is this bead's, so routing the population through
 * every check would take the gate red for every pane to fix a check that judges 17 ids.
 *
 * So the index travels as a compiler OPTION, reaches the check context, and is read by the one check
 * that needs it. Nothing else sees a new record.
 *
 * WHAT THE IDS ARE. A block's id is its filename and its paper is its directory, which is the
 * corpus's own authority and the same rule the route pattern encodes. Sentence-span ids are read
 * from the file, because a note may attach to a sentence rather than a whole paragraph.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export type PaperSourceIds = Readonly<{
  blocks: ReadonlySet<string>;
  /** Block ids plus every sentence-span id declared inside those blocks. */
  sentences: ReadonlySet<string>;
}>;

/** Keyed by paper slug, as the directory names it. */
export type SourceBlockIndex = ReadonlyMap<string, PaperSourceIds>;

/** A `- id: "s3-p2-s1"` line inside a block, anchored so a prose mention cannot match. */
const ID_LINE = /^\s*-?\s*id:\s*"?([A-Za-z0-9][A-Za-z0-9.-]*)"?\s*$/gm;

export function loadSourceBlockIndex(root: string): SourceBlockIndex {
  const dir = resolve(root, "content/source-blocks");
  const index = new Map<string, PaperSourceIds>();
  if (!existsSync(dir)) return index;
  for (const paper of readdirSync(dir).sort()) {
    const paperDir = resolve(dir, paper);
    if (!existsSync(paperDir)) continue;
    const blocks = new Set<string>();
    const sentences = new Set<string>();
    for (const file of readdirSync(paperDir).sort()) {
      // `manifest.yaml` is the source MANIFEST, a different record kind with its own route, and
      // feeding it here would also hit the route ambiguity it shares with the block pattern.
      if (!file.endsWith(".yaml") || file === "manifest.yaml") continue;
      const id = file.replace(/\.yaml$/, "");
      blocks.add(id);
      sentences.add(id);
      for (const m of readFileSync(resolve(paperDir, file), "utf8").matchAll(ID_LINE)) {
        if (m[1]) sentences.add(m[1]);
      }
    }
    if (blocks.size > 0) index.set(paper, Object.freeze({ blocks, sentences }));
  }
  return index;
}

/** How many blocks the index holds, for a caller that must print what it examined. */
export function sourceBlockCount(index: SourceBlockIndex): number {
  let n = 0;
  for (const paper of index.values()) n += paper.blocks.size;
  return n;
}
