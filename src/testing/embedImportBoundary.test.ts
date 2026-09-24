import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * am-inst-embed-route-rnyg, section A: an embed must not be able to reach the reader's local data.
 * /embed/* is the one route family anyone may frame, and it is served from the reader's origin, so
 * nothing an embed loads may import the storage layer or the notebook, or touch browser storage
 * itself. Measured when this was written: 320 files reachable from the two embed pages (276 of them
 * code), none of them storage.
 *
 * The walk follows relative imports, static and dynamic (the adapter reaches each laboratory through
 * `import()`), and skips `import type`, which emits no code. Comments are blanked before matching,
 * so a comment that mentions localStorage is not a use of it. What the walk cannot see is a module
 * reached by a computed specifier; there is none in src today.
 */
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FORBIDDEN_DIRS = ["src/platform/storage/", "src/reader/notebook/"];
const ACCESSOR =
  /\b(localStorage|sessionStorage|indexedDB|Storage\.prototype|document\.cookie)\b|\.(getItem|setItem|removeItem)\(/;
const IMPORT =
  /(?:import|export)\s[^;]*?from\s+["']([^"']+)["']|import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gs;

function blank(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

function code(path: string): string {
  return blank(readFileSync(join(ROOT, path), "utf8"));
}

function resolve(from: string, spec: string): string | undefined {
  if (!spec.startsWith(".")) return undefined;
  const base = normalize(join(dirname(from), spec));
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}/index.ts`]) {
    const full = join(ROOT, candidate);
    if (existsSync(full) && statSync(full).isFile()) return candidate;
  }
  return undefined;
}

/** Every module reachable from `starts`, with the module that first imported it. */
function reach(starts: readonly string[]): Map<string, string | null> {
  const parent = new Map<string, string | null>(starts.map((s) => [s, null]));
  const stack = [...starts];
  const seen = new Set<string>();
  while (stack.length) {
    const file = stack.pop() as string;
    if (seen.has(file) || !/\.(ts|tsx|mjs)$/.test(file)) continue;
    seen.add(file);
    for (const m of code(file).matchAll(IMPORT)) {
      if (/^import\s+type\b/.test(m[0])) continue;
      const target = resolve(file, m[1] ?? m[2] ?? m[3] ?? "");
      if (target && !parent.has(target)) {
        parent.set(target, file);
        stack.push(target);
      }
    }
  }
  return parent;
}

/** Each reachable module that is, or touches, reader storage, with the chain that reaches it. */
function storageReach(starts: readonly string[]): string[] {
  const parent = reach(starts);
  const chain = (file: string) => {
    const links: string[] = [];
    for (let f: string | null | undefined = file; f; f = parent.get(f)) links.push(f);
    return links.join(" <- ");
  };
  return [...parent.keys()]
    .filter((f) => /\.(ts|tsx|mjs)$/.test(f))
    .filter((f) => FORBIDDEN_DIRS.some((d) => f.startsWith(d)) || ACCESSOR.test(code(f)))
    .map(chain)
    .sort();
}

function embedPages(dir = join(ROOT, "src/app/embed/")): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return embedPages(`${full}/`);
    return name === "page.tsx" ? [relative(ROOT, full)] : [];
  });
}

describe("an embed cannot reach the reader's local data", () => {
  test("the detector finds a real storage import, and blanks a comment that only mentions one", () => {
    // Positive control: the kitchen keeps observations through the storage layer (dbcd3777).
    const kitchen = storageReach(["src/components/lab/kitchen/KitchenLab.tsx"]);
    expect(kitchen.some((c) => c.startsWith("src/platform/storage/"))).toBe(true);
    expect(ACCESSOR.test("window.localStorage.getItem(key)")).toBe(true);
    expect(ACCESSOR.test("performance.mark('am:input')")).toBe(false);
    expect(ACCESSOR.test(blank("// the embed never reads localStorage"))).toBe(false);
    expect(ACCESSOR.test(blank("/* localStorage */ const n = 1;"))).toBe(false);
    expect(ACCESSOR.test(blank("render(); // then\nlocalStorage.clear();"))).toBe(true);
  });

  test("no module reachable from an embed page is storage, the notebook, or a storage accessor", () => {
    const pages = embedPages();
    const reachable = reach(pages).size;
    console.log(
      `[embed boundary] ${pages.length} embed pages, ${reachable} files reachable, storage reach: ${storageReach(pages).length}`,
    );
    expect(pages.length).toBeGreaterThan(0);
    expect(reachable).toBeGreaterThan(100);
    expect(storageReach(pages)).toEqual([]);
  });
});
