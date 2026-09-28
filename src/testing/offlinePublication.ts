import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadOfflineManifest, type OfflineManifest } from "../platform/offline/server.ts";

/*
 * TWO PROPOSITIONS THAT A TEST MUST NOT CONFUSE (dispatch 406).
 *
 *   "the published chapter set is stale relative to the content this tree compiled"
 *       an ENVIRONMENT condition, routinely true in a shared checkout the moment a peer runs
 *       prepare:content, and resolved by the test lane's own prepare step;
 *   "the offline page does not say what a chapter costs and what it does not carry"
 *       the SUBJECT of src/app/offline/page.test.tsx.
 *
 * `loadOfflineManifest` throws on a digest mismatch, which is correct and stays: a stale chapter
 * set must never be served. What was wrong is that a page test could not tell that throw apart
 * from its own subject, so it went red for an hour of peer activity that had nothing to do with
 * the page. A test that is red by default in this tree trains every pane to stop reading it, which
 * is the failure AGENTS.md records at its highest price: `bun run test:node` refused to start for
 * 49 commits and 12.5 hours because its preflight also refused on a condition permanently true in
 * a shared checkout, and it "read like diligence and nobody noticed".
 *
 * So this separates them and NAMES the condition. A caller that cannot decide its subject says so
 * in the words this returns, rather than failing or skipping quietly.
 *
 * WHICH HALF OF THE DIGEST GUARD IS PROVEN WHERE. The guard itself is proven OUTSIDE the lane that
 * prepares the chapters: `src/platform/offline/server.test.mjs`, "stale content and profile
 * mismatch fail rather than exposing a previous build", builds a temp root with mkdtemp, publishes
 * into it and asserts `loadOfflineManifest` rejects with /stale/ on a mismatched digest and on a
 * mismatched profile. It reads no generated file of this repository, so it holds whether or not
 * prepare:offline has ever run, and a guard that silently stopped refusing would turn it red.
 * The other half, whether THIS tree's published set is in fact current, cannot be established
 * outside the lane that prepares it: that is what preparing decides. This module reports that half
 * rather than asserting it.
 */

export type OfflinePublication =
  | Readonly<{ current: true; manifest: OfflineManifest; reason: string }>
  | Readonly<{ current: false; manifest: null; reason: string }>;

/** A build digest as the generated indexes carry it, or a word saying why there is none. */
function digestOf(root: string, file: string): string {
  try {
    const value = (JSON.parse(readFileSync(join(root, file), "utf8")) as { buildDigest?: unknown })
      .buildDigest;
    return typeof value === "string" && value ? value : "(no buildDigest)";
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT" ? "(absent)" : "(unreadable)";
  }
}

/**
 * Whether this tree's published offline chapters can be asserted against, and when they cannot,
 * a sentence naming the condition and both digests, short enough to travel in a test's name.
 */
export async function offlinePublication(
  root: string = process.cwd(),
): Promise<OfflinePublication> {
  const offline = digestOf(root, "generated/offline/index.json");
  const content = digestOf(root, "generated/content/index.json");
  const digests = `offline ${offline.slice(0, 12)} vs content ${content.slice(0, 12)}`;
  try {
    const manifest = await loadOfflineManifest(root);
    if (manifest === null)
      return {
        current: false,
        manifest: null,
        reason: `no offline chapters are published in this tree (${digests}); the test lane's prepare:offline writes them`,
      };
    return { current: true, manifest, reason: `chapter set current with content (${digests})` };
  } catch (error) {
    return {
      current: false,
      manifest: null,
      reason: `${(error as Error).message} (${digests})`,
    };
  }
}
