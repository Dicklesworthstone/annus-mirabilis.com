/**
 * WHAT THE FROZEN-ID CHECK EXAMINED, which it used not to say.
 *
 * `validateFrozenIds` returns `ok: true` and its caller printed "Every removed id is covered by an
 * alias and added ids are valid successors (N id(s) added since the snapshot)". The clause a
 * reader acts on is the first one, and the number reported is about the second. The population the
 * first clause is about was reached by a bare `continue` and counted nowhere.
 *
 * Measured 2026-10-20 over the real corpus: `coveredByAliasCount` is 0 on all four papers, while
 * `content/aliases/*.yaml` records 37 retirements. Every snapshot was pruned to match its manifest
 * when its ids were retired, so the sentence has never been checked against one retirement.
 *
 * THIS FILE DOES NOT DECIDE WHETHER THAT IS WRONG. Whether the snapshot is a FLOOR that keeps a
 * retired id -- which is what the check in editionContract.ts says it is, "a floor under
 * retirement, not a freeze on addition" -- or a MIRROR of the current manifest, which is what four
 * manifest tests assert with `expect(snapshotIds).toEqual(manifestIds)`, is an owner's question
 * and it is recorded on am-edn-alignment-tooling-do1. What this file does is make the number
 * visible on every run, and prove the counter can be non-zero so that the 0 means something.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { load as parseYaml } from "js-yaml";
import type { AliasRecord } from "../content/aliases.ts";
import { parseIdSnapshot, validateFrozenIds } from "../content/frozenIds.ts";
import { validateSourceManifest } from "../content/manifest/schema.ts";

const ROOT = process.cwd();
const PAPERS = ["mass-energy", "brownian-motion", "light-quanta", "special-relativity"] as const;

function paper(slug: (typeof PAPERS)[number]) {
  const manifestPath = join(ROOT, "content/source-blocks", slug, "manifest.yaml");
  const manifest = validateSourceManifest(
    parseYaml(readFileSync(manifestPath, "utf8")),
    manifestPath,
  );
  const snapshotText = readFileSync(
    join(ROOT, "content/source-blocks", slug, "manifest.ids.snapshot.txt"),
    "utf8",
  );
  const aliasDoc = parseYaml(
    readFileSync(join(ROOT, "content/aliases", `${slug}.yaml`), "utf8"),
  ) as { aliases?: readonly AliasRecord[] };
  return {
    unitIds: manifest.units.map((u) => u.id),
    snapshotText,
    snapshotIds: parseIdSnapshot(snapshotText),
    aliases: aliasDoc.aliases ?? [],
  };
}

describe("the counter can be non-zero, so a zero means something", () => {
  test("a retired id present in the snapshot is counted as covered", () => {
    // The plant. Without it, `coveredByAliasCount: 0` over the corpus is indistinguishable from a
    // counter that is wired to nothing.
    const aliases: AliasRecord[] = [
      {
        retiredId: "s1-p4",
        kind: "merged",
        replacementIds: ["s1-p3"],
        reason:
          "Not a printed paragraph; it continues the paragraph that begins on the page before.",
        date: "2026-09-19",
        editor: "agent:test",
      } as AliasRecord,
    ];
    const result = validateFrozenIds("s1-p3\ns1-p4\n", ["s1-p3"], aliases);
    expect(result.ok).toBe(true);
    expect(result.coveredByAliasCount).toBe(1);
    expect(result.snapshotCount).toBe(2);
    expect(result.currentCount).toBe(1);
    expect(result.newCount).toBe(0);
  });

  test("a snapshot id with NO alias is a finding, not a covered removal", () => {
    // The negative control: counting a covered removal must not turn an uncovered one into one.
    const result = validateFrozenIds("s1-p3\ns1-p9\n", ["s1-p3"], []);
    expect(result.ok).toBe(false);
    expect(result.coveredByAliasCount).toBe(0);
    expect(result.findings.map((f) => f.kind)).toEqual(["frozen-id-missing"]);
  });

  test("an added id is counted as added and not as covered", () => {
    const result = validateFrozenIds("s1-p3\n", ["s1-p3", "s1-p4"], []);
    expect(result.ok).toBe(true);
    expect(result.newCount).toBe(1);
    expect(result.coveredByAliasCount).toBe(0);
    expect(result.currentCount).toBe(2);
  });
});

describe("the real corpus, measured rather than asserted", () => {
  test("the census is printed for every paper, and the retirement count beside it", () => {
    // Reported, not frozen: these move with the inventories and they should. The assertion is that
    // the check reaches a verdict over a real snapshot on every paper, which is the thing a count
    // of zero snapshot ids would hide.
    const lines: string[] = [];
    for (const slug of PAPERS) {
      const { unitIds, snapshotText, snapshotIds, aliases } = paper(slug);
      const result = validateFrozenIds(snapshotText, unitIds, aliases);
      const retiredInSnapshot = aliases.filter((a) => snapshotIds.includes(a.retiredId)).length;
      lines.push(
        `${slug}: ${result.snapshotCount} snapshot, ${result.currentCount} units, ` +
          `${aliases.length} retired in content/aliases, ${retiredInSnapshot} of them in the snapshot, ` +
          `${result.coveredByAliasCount} counted as covered removals, ${result.newCount} added, ok=${result.ok}`,
      );
      expect(result.snapshotCount, slug).toBeGreaterThan(50);
      expect(result.currentCount, slug).toBeGreaterThan(50);
      // `coveredByAliasCount` is exactly the retirements the snapshot still carries, whichever
      // answer the owner gives: this is the identity that holds under either reading.
      expect(result.coveredByAliasCount, slug).toBe(retiredInSnapshot);
    }
    console.log(`[census] frozen-id snapshots\n  ${lines.join("\n  ")}`);
    expect(lines).toHaveLength(PAPERS.length);
  });

  test("the corpus records retirements, so the covered count has something it could have counted", () => {
    // The non-vacuity this file exists for. If no paper had ever retired an id, a covered count of
    // zero would be correct and uninteresting. 37 retirements are on disk.
    const retired = PAPERS.reduce((total, slug) => total + paper(slug).aliases.length, 0);
    expect(retired).toBeGreaterThan(20);
  });
});
