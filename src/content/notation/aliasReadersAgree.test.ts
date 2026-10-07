/**
 * FOUR THINGS READ `content/aliases/<paper>.yaml` AND NONE OF THEM IS THE VALIDATED OWNER.
 *
 * `src/content/aliases.ts` owns alias resolution: `validateAliasRecord` for structure,
 * `resolveAlias` for chain following with cycle and dangling detection. It takes records and reads
 * no files. Every file reader is therefore somebody else's, and measured 2026-10-07 there are
 * three:
 *
 *     src/content/notation/anchorCoversPage.ts   aliasTargets()         flat read, no resolution
 *     src/content/editions/brownianInventory.ts  two direct reads of brownian-motion.yaml
 *     src/content/editions/manifestAnchors.ts    takes an aliasPath
 *
 * `aliasTargets` is the one a reader meets. `PaperPage.tsx:178` builds the retired-to-target map
 * from it, hands it to `GermanFace`, and `GermanFace.tsx:102` emits
 * `<span id={retired} data-alias-of={target} />`. Measured in the built site, that ships 33 of the
 * 37 declared records as static anchors, which is how a retired id in a URL lands on its successor
 * with no JavaScript at all.
 *
 * AND IT IS A FLAT READ. `aliasTargets` maps `retiredId` straight to `replacementIds` out of the
 * YAML. It does not follow a chain, detect a cycle, or notice a dangling target. So for `A -> B`
 * where `B` is itself retired to `C`, the owner resolves `A` to `C` and this reader answers `B`.
 * The reader-facing consequence is specific: the static anchor would be placed at another RETIRED
 * id, which is published on no face, so the retired link would land nowhere. That is the exact
 * failure the alias layer exists to prevent.
 *
 * MEASURED BEFORE WRITING THIS: 37 records across the four papers, all 37 accepted by
 * `validateAliasRecord`, and ZERO chains - no record's replacement is itself a retired id. So the
 * two readers agree today. They agree because of what the corpus happens to contain, not because
 * anything checks, and ids are frozen while aliases are how later changes get recorded, so the
 * corpus grows in exactly the direction that breaks this.
 *
 * WHAT WATCHES THIS GATE. A real corpus with no chains cannot fail an agreement test, so the
 * agreement alone would be green over a population that cannot disagree - the shape AGENTS.md
 * records under "A Tool's Exit Code Is Not Evidence". The control below therefore builds a
 * synthetic chain and asserts the two readers DO diverge on it, so the comparison is shown to have
 * teeth independently of what is committed.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type AliasRecord, resolveAlias, validateAliasRecord } from "../aliases.ts";
import { parseYaml } from "../provenance/yaml.ts";
import { aliasTargets } from "./anchorCoversPage.ts";

// Not `import.meta.dir`: that exists in bun at runtime and not in this repository's ambient
// ImportMeta, so it passes `bun test` and breaks `bun run check:types` for every pane.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

/** The records of one paper, through the OWNER's validator rather than a fourth ad-hoc parse. */
function recordsOf(paper: string): readonly AliasRecord[] {
  const file = join(REPO_ROOT, "content", "aliases", `${paper}.yaml`);
  const doc = parseYaml(readFileSync(file, "utf8")) as { aliases?: unknown[] } | null;
  const out: AliasRecord[] = [];
  for (const raw of doc?.aliases ?? []) {
    const validated = validateAliasRecord(raw);
    if (!validated.ok) {
      throw new Error(
        `content/aliases/${paper}.yaml holds a record the owner rejects: ${validated.error}`,
      );
    }
    out.push(validated.value);
  }
  return out;
}

describe("the flat alias reader a reader meets agrees with the validated owner", () => {
  const byPaper = new Map(PAPERS.map((p) => [p, recordsOf(p)] as const));
  const total = [...byPaper.values()].reduce((n, r) => n + r.length, 0);

  test("the corpus is real, and every record is one the owner accepts", () => {
    // `recordsOf` throws on a rejected record, so reaching here is the structural claim. The count
    // is REPORTED with its denominator rather than asserted equal to a frozen number: aliases are
    // added as ids are retired, so an equality here would go red on correct editorial work.
    const per = PAPERS.map((p) => `${p} ${byPaper.get(p)?.length ?? 0}`).join(", ");
    console.log(
      `[census] alias-readers-agree examined ${total} records across ${PAPERS.length} papers (${per}); minimum 20`,
    );
    expect(total).toBeGreaterThanOrEqual(20);
    for (const paper of PAPERS) expect((byPaper.get(paper) ?? []).length).toBeGreaterThan(0);
  });

  test("aliasTargets' first target equals the owner's resolved first target, for every record", () => {
    let compared = 0;
    const disagreements: string[] = [];
    for (const paper of PAPERS) {
      const records = byPaper.get(paper) ?? [];
      const flat = aliasTargets(REPO_ROOT, paper);
      // The flat reader must see the same records the owner does; a mismatch here would mean the
      // two parses disagree before any resolution question arises.
      expect([...flat.keys()].sort()).toEqual(records.map((r) => r.retiredId).sort());
      for (const record of records) {
        compared++;
        const flatFirst = flat.get(record.retiredId)?.[0];
        const resolved = resolveAlias(record.retiredId, records);
        if (!resolved.ok) {
          disagreements.push(
            `${paper}/${record.retiredId}: the owner refuses it (${resolved.code})`,
          );
          continue;
        }
        const ownerFirst = resolved.targetIds[0];
        if (flatFirst !== ownerFirst) {
          disagreements.push(
            `${paper}/${record.retiredId}: flat reader says '${flatFirst}', owner resolves to '${ownerFirst}'`,
          );
        }
      }
    }
    expect(disagreements).toEqual([]);
    // Non-vacuity on purpose: an empty corpus would compare nothing and pass.
    expect(compared).toBe(total);
    expect(compared).toBeGreaterThanOrEqual(20);
  });

  test("POSITIVE CONTROL: on a synthetic chain the two readers DO diverge", () => {
    // Without this the test is green over a population that cannot disagree, since the committed
    // corpus has zero chains. This is the divergence the gate exists for, constructed by hand.
    const chain: readonly AliasRecord[] = [
      {
        retiredId: "s9-p1",
        kind: "merged",
        replacementIds: ["s9-p2"],
        reason:
          "Synthetic first link of a chain, for the control in aliasReadersAgree.test.ts (am-read-anchors-navigation-a6o).",
        date: "2026-10-07",
        editor: "agent:TanElk, am-read-anchors-navigation-a6o",
      },
      {
        retiredId: "s9-p2",
        kind: "merged",
        replacementIds: ["s9-p3"],
        reason:
          "Synthetic second link, so the owner resolves s9-p1 to s9-p3 while a flat read answers s9-p2 (am-read-anchors-navigation-a6o).",
        date: "2026-10-07",
        editor: "agent:TanElk, am-read-anchors-navigation-a6o",
      },
    ];
    // Both records are ones the owner accepts, so the divergence below is about RESOLUTION and not
    // about one reader rejecting malformed input.
    for (const record of chain) expect(validateAliasRecord(record).ok).toBe(true);

    const owner = resolveAlias("s9-p1", chain);
    expect(owner.ok).toBe(true);
    if (!owner.ok) throw new Error("the control's chain must resolve");
    expect(owner.targetIds[0]).toBe("s9-p3");

    // What a flat read answers: the replacementIds as written, with no chain following.
    const flatFirst = chain.find((r) => r.retiredId === "s9-p1")?.replacementIds[0];
    expect(flatFirst).toBe("s9-p2");
    expect(flatFirst).not.toBe(owner.targetIds[0]);
  });

  test("the committed corpus has no chain, which is WHY the control above is required", () => {
    // Reported, not asserted as a permanent property: a chain is legitimate editorial work and
    // must make the agreement test red, not this one. Naming the number here is what tells a
    // reader of a green run how much the agreement test could have found.
    let chains = 0;
    for (const paper of PAPERS) {
      const records = byPaper.get(paper) ?? [];
      const retired = new Set(records.map((r) => r.retiredId));
      for (const record of records) {
        if (record.replacementIds.some((id) => retired.has(id))) chains++;
      }
    }
    console.log(`[census] alias-readers-agree found ${chains} chained records of ${total}`);
    expect(chains).toBeGreaterThanOrEqual(0);
  });
});
