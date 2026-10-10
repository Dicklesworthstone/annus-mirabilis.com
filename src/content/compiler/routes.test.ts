/**
 * EVERY FILE UNDER content/source-blocks IS ROUTED, EXACTLY ONCE
 * (am-rc1001-bridge-plan-pcjk.10).
 *
 * `matchContentRoute` had no test at all, and two defects were sitting in route 14 where nothing
 * could see them. Both were invisible for the same reason: NOTHING FEEDS THESE PATHS to the
 * compiler today, so the function was never asked about them.
 *
 *  1. The id group was `[a-z0-9-]+`, which REFUSES `source-blocks/special-relativity/eq-A.yaml`.
 *     That file is the display Einstein printed as label (A) on p. 918 of s10; the manifest
 *     records `originalLabel: "(A)"`, so the id is correct under the grammar in docs/CONTENT_IDS.md
 *     and the pattern was wrong. It is the only uppercase id in the corpus, which is why one
 *     character class had hidden one real file.
 *  2. `manifest.yaml` matched route 12 (source-manifest) AND route 14, so `matchContentRoute`
 *     THREW "Ambiguous content route" on it. A caller feeding the directory whole got a crash, not
 *     a diagnostic.
 *
 * Measured by feeding the directory to `compileContent` in a scratch probe on 2026-10-10: before
 * the repair, one `unrouted-content` error for eq-A.yaml, and a thrown ambiguity for each
 * manifest.yaml. The wider widening those probes were for -- making the structural checks see the
 * 453 blocks -- is NOT this test's subject and does not land with it: feeding the blocks also
 * crashes compiler.ts:465 on an equation record with no `notes`, and feeding the manifests raises
 * 31 `sequence-gap` errors from an empty alias context. Those are recorded on the bead. The route
 * table is correct on its own merits and is a precondition for any of it.
 *
 * The population is read from DISK rather than listed here, so a new block is covered the day it
 * is written rather than the day someone remembers this file.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { matchContentRoute } from "./routes.ts";

const ROOT = process.cwd();
const SOURCE_BLOCKS = join(ROOT, "content", "source-blocks");

/** Every file under content/source-blocks, as the compiler would be handed it. */
function sourceBlockPaths(): string[] {
  const out: string[] = [];
  for (const paper of readdirSync(SOURCE_BLOCKS).sort()) {
    const dir = join(SOURCE_BLOCKS, paper);
    if (!statSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir).sort()) {
      out.push(`content/source-blocks/${paper}/${name}`);
    }
  }
  return out;
}

describe("content routes over the real source-block tree", () => {
  test("every file routes to exactly one kind, or to a named absence", () => {
    const paths = sourceBlockPaths();
    expect(paths.length).toBeGreaterThanOrEqual(460);

    const byKind = new Map<string, number>();
    const unrouted: string[] = [];
    const threw: string[] = [];
    for (const path of paths) {
      try {
        const match = matchContentRoute(path);
        if (match === null) unrouted.push(path);
        else byKind.set(match.kind, (byKind.get(match.kind) ?? 0) + 1);
      } catch (error) {
        threw.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log(
      `[content routes] ${paths.length} file(s) under content/source-blocks: ` +
        `${[...byKind]
          .sort()
          .map(([k, n]) => `${k} ${n}`)
          .join(", ")}; ` +
        `${unrouted.length} unrouted, ${threw.length} ambiguous`,
    );

    // AMBIGUITY IS THE ONE THAT CANNOT BE TOLERATED, because it is a throw rather than a
    // diagnostic: the caller gets no list of what else was wrong.
    expect(threw).toEqual([]);

    // The only unrouted file is ledger-allowlist.yaml, and that is deliberate rather than a gap:
    // no route owns it, src/content/ledger/validateLedger.ts reads it directly, and admitting it
    // to route 14 would hand the SourceBlock schema a file that is not one. Named here so that a
    // NEW unrouted file fails instead of joining a silent allowance.
    expect(unrouted.map((p) => p.split("/").pop())).toEqual(
      unrouted.map(() => "ledger-allowlist.yaml"),
    );

    // Non-vacuity with its reason: a tree that routed nothing would satisfy both assertions above.
    expect(byKind.get("source-block") ?? 0).toBeGreaterThanOrEqual(450);
    expect(byKind.get("source-manifest") ?? 0).toBeGreaterThanOrEqual(4);
    expect(byKind.get("frozen-id-snapshot") ?? 0).toBeGreaterThanOrEqual(4);
  });

  test("the uppercase id that one character class had hidden", () => {
    // The real defect, named by its real path rather than a fixture.
    const match = matchContentRoute("content/source-blocks/special-relativity/eq-A.yaml");
    expect(match?.kind).toBe("source-block");
    expect(match?.params.id).toBe("eq-A");
    expect(match?.params.paper).toBe("special-relativity");
  });

  test("the reserved names in that directory take their own routes, and do not throw", () => {
    expect(matchContentRoute("content/source-blocks/special-relativity/manifest.yaml")?.kind).toBe(
      "source-manifest",
    );
    expect(
      matchContentRoute("content/source-blocks/special-relativity/manifest.ids.snapshot.txt")?.kind,
    ).toBe("frozen-id-snapshot");
    expect(
      matchContentRoute("content/source-blocks/special-relativity/ledger-allowlist.yaml"),
    ).toBe(null);
  });

  test("the boundaries: a lowercase id still routes, and the PAPER group stays lowercase", () => {
    // The control. Widening the id group must not have widened anything else.
    expect(
      matchContentRoute("content/source-blocks/brownian-motion/eq-s1-d1.yaml")?.params.id,
    ).toBe("eq-s1-d1");
    // A paper directory is a route slug and those are lowercase, so an uppercase one is not a
    // source block. Without this, the next person to widen a character class has nothing telling
    // them where the widening stopped.
    expect(matchContentRoute("content/source-blocks/Special-Relativity/eq-1.yaml")).toBe(null);
    // And a name beginning "manifest" is reserved even when it is not exactly manifest.yaml, so
    // the lookahead cannot be defeated by a suffix.
    expect(matchContentRoute("content/source-blocks/brownian-motion/manifest.extra.yaml")).toBe(
      null,
    );
  });

  test("the journey route added for am-4k0m still owns its path", () => {
    // Routes are one table; a change to one entry can shadow another. This is the most recent
    // addition and the cheapest canary.
    const match = matchContentRoute("content/journeys/mass-energy.yaml");
    expect(match?.kind).toBe("journey");
    expect(match?.params.paper).toBe("mass-energy");
  });
});
