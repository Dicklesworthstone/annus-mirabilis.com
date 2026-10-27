/**
 * "Nothing is uploaded", for the discovery investigation (am-rc1001-bridge-plan-pcjk.27).
 *
 * The workspace tells the reader their investigation is kept on their device and that nothing is
 * uploaded, and since it now WRITES to that device the claim is worth an instrument rather than a
 * sentence.
 *
 * WHICH HALF OF THE QUESTION THIS ANSWERS. The bead asks for 0 network requests on a browser
 * network log. This is not that and cannot replace it: a log says what happened on one run. This
 * says what the module graph is capable of -- no module reachable from the provider, the island or
 * the persistence layer contains a network accessor at all, so there is no code that could make
 * such a request. The other half needs a built site and belongs with the Playwright reload test.
 *
 * The walk follows relative imports, static and dynamic, and skips `import type`, which emits no
 * code. Comments are blanked before matching, so a note mentioning `fetch` is not a call to it,
 * and the detector is proved in both directions below.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const NETWORK = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b|\.(ajax|submit)\(/;
const IMPORT =
  /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gs;

function blank(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

function read(rel: string): string {
  return blank(readFileSync(join(ROOT, rel), "utf8"));
}

function resolveLocal(from: string, spec: string): string | undefined {
  if (!spec.startsWith(".")) return undefined;
  const base = normalize(join(dirname(from), spec));
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    if (existsSync(join(ROOT, candidate))) return candidate;
  }
  return undefined;
}

function reachable(starts: readonly string[]): string[] {
  const seen = new Set<string>();
  const stack = [...starts];
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (seen.has(file) || !/\.(ts|tsx)$/.test(file)) continue;
    seen.add(file);
    for (const match of read(file).matchAll(IMPORT)) {
      if (/^import\s+type\b/.test(match[0])) continue;
      const target = resolveLocal(file, match[1] ?? match[2] ?? match[3] ?? "");
      if (target) stack.push(target);
    }
  }
  return [...seen].sort();
}

const STARTS = [
  "src/discovery/investigation/context.tsx",
  "src/discovery/investigation/workspace.ts",
  "src/discovery/investigation/persistence.ts",
];

describe("nothing on the investigation path can upload anything", () => {
  test("the detector sees a real request and ignores a comment describing one", () => {
    expect(NETWORK.test("await fetch(url)")).toBe(true);
    expect(NETWORK.test("navigator.sendBeacon(url, body)")).toBe(true);
    expect(NETWORK.test("new WebSocket(endpoint)")).toBe(true);
    expect(NETWORK.test(blank("// nothing here calls fetch(x)"))).toBe(false);
    expect(NETWORK.test(blank("/* sendBeacon */ const n = 1;"))).toBe(false);
    expect(NETWORK.test("const prefetched = 1;")).toBe(false);
  });

  test("the walk reaches a module it was not handed, so it is not examining three files", () => {
    const files = reachable(STARTS);
    // The storage layer is reached only THROUGH persistence.ts, so its presence proves the walk
    // followed an import rather than listing its starting points back.
    expect(files).toContain("src/platform/storage/store.ts");
    expect(files).toContain("src/platform/storage/quarantine.ts");
    expect(files).toContain("src/discovery/investigation/core.ts");
    expect(files.length).toBeGreaterThan(6);
  });

  test("a positive control: the same walk DOES find a network accessor where one exists", () => {
    // Without this, a detector that matched nothing anywhere would pass the test below. The
    // search index is loaded over the network by design, so it is the honest control.
    const withNetwork = reachable(["src/search/loadIndex.ts"]).filter((file) =>
      NETWORK.test(read(file)),
    );
    expect(withNetwork).toContain("src/search/loadIndex.ts");
  });

  test("no module reachable from the provider, the island or the storage layer holds one", () => {
    const files = reachable(STARTS);
    const offenders = files.filter((file) => NETWORK.test(read(file)));
    console.log(
      `[investigation upload reach] ${files.length} module(s) examined, ${offenders.length} with a network accessor`,
    );
    expect(offenders).toEqual([]);
  });
});
