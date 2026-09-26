/**
 * EVERY REAL SOURCE BLOCK PASSES validateSourceBlock (dispatch 247).
 *
 * The readers load content/source-blocks raw (bilingualLoader.ts, sourceBlockFace.ts), and until
 * this test the validator ran only on fixtures, so a rule added to it bound nothing that ships. It
 * matters now because of page turns: a turn naming the wrong page, or words the block does not
 * contain, must fail here and not reach a results card as a wrong page. pageTurns.test.ts proves
 * each refusal on fixtures; this file applies them all to the corpus.
 *
 * A page turn that says only a block's displays stand on a page is checked here too, against the
 * displays the paper's other blocks place there, since no single record can see that.
 *
 * The files beside the blocks are not blocks: the manifest, its id snapshot, and the
 * ledger allowlist. They are named, not skipped by shape, so a block file that stopped looking like
 * a block would fail rather than drop out of the count.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../provenance/yaml.ts";
import { unbackedDisplaysOnlyTurns } from "./pageTurns.ts";
import { type SourceBlock, validateSourceBlock } from "./source.ts";

const DIR = join(process.cwd(), "content", "source-blocks");
const NOT_BLOCKS = new Set(["manifest.yaml", "manifest.ids.snapshot.txt", "ledger-allowlist.yaml"]);
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"];

describe("the source-block corpus", () => {
  for (const paper of PAPERS) {
    test(`${paper}: every block validates`, () => {
      const files = readdirSync(join(DIR, paper)).filter((f) => !NOT_BLOCKS.has(f));
      // Non-vacuity: a paper with no blocks here would pass the loop below having checked nothing.
      expect(files.length).toBeGreaterThan(0);
      const refused: string[] = [];
      const blocks: SourceBlock[] = [];
      for (const file of files) {
        const raw = readFileSync(join(DIR, paper, file), "utf8");
        try {
          blocks.push(
            validateSourceBlock(file.endsWith(".json") ? JSON.parse(raw) : parseYaml(raw), file),
          );
        } catch (e) {
          refused.push(e instanceof Error ? e.message : String(e));
        }
      }
      expect(refused).toEqual([]);
      // A displays-only page turn is a claim about other blocks, so it is checked across the paper.
      expect(unbackedDisplaysOnlyTurns(blocks)).toEqual([]);
    });
  }
});
