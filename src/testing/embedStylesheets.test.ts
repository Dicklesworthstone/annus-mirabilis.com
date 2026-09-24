import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * An embed loads every stylesheet its laboratory's own page loads. The embed renders the
 * laboratory component through src/experiments/embed/lazyEmbeddedLabs.tsx, never the /lab page,
 * so a stylesheet only the page imports is missing from the embed. On 2026-09-24 that was
 * shelfOptics.css, imported by ShelfOpticsPage alone: the three optics shelves' embeds had no
 * table scroll or focus outline, and the Fizeau embed ran 41px wider than a 320px screen (fixed in
 * 4e75230e).
 *
 * The walk follows local imports from each embeddable id's src/app/lab/<id>/page.tsx and from the
 * embed's two entry points, and compares the stylesheets reached. Comments are blanked before
 * matching, and `import type` is skipped, since neither loads anything.
 */
const ROOT = normalize(fileURLToPath(new URL("../../", import.meta.url)));

/** Comments blanked, keeping every newline, so an import quoted in a comment is not read. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(
      /(^|[^:"'`])\/\/[^\n]*/g,
      (m, lead: string) => lead + " ".repeat(m.length - lead.length),
    );
}

/**
 * The module specifiers a source file loads: static imports, re-exports and, unless `dynamic` is
 * false, dynamic imports.
 */
export function loadedSpecifiers(source: string, dynamic = true): string[] {
  const out: string[] = [];
  const text = code(source);
  for (const m of text.matchAll(
    /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^"';]*?\sfrom\s+)?["']([^"']+)["']/g,
  ))
    if (!m[2] && m[3]) out.push(m[3]);
  if (dynamic)
    for (const m of text.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) if (m[1]) out.push(m[1]);
  return out;
}

function resolveModule(from: string, spec: string): string | null {
  const base = normalize(join(dirname(from), spec));
  for (const candidate of [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
  ])
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return null;
}

/** The stylesheets reached from an entry through local, non-type imports. */
function stylesheetsReached(entry: string, dynamic = true): Set<string> {
  const css = new Set<string>();
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);
    for (const spec of loadedSpecifiers(readFileSync(file, "utf8"), dynamic)) {
      if (!spec.startsWith(".")) continue;
      if (spec.endsWith(".css")) {
        css.add(relative(ROOT, normalize(join(dirname(file), spec))));
        continue;
      }
      const next = resolveModule(file, spec);
      if (next && /\.(tsx?|mjs)$/.test(next)) stack.push(next);
    }
  }
  return css;
}

describe("an embed loads every stylesheet its laboratory's page loads", () => {
  test("the reader skips type imports and commented-out imports", () => {
    const source = [
      'import type { A } from "./a.tsx";',
      'import { B } from "./b.tsx";',
      'import "./c.css";',
      '// import "./d.css";',
      '/* import "./e.css"; */',
      'const F = lazy(() => import("./f.tsx"));',
      'export { G } from "./g.ts";',
    ].join("\n");
    expect(loadedSpecifiers(source)).toEqual(["./b.tsx", "./c.css", "./g.ts", "./f.tsx"]);
    expect(loadedSpecifiers(source, false)).toEqual(["./b.tsx", "./c.css", "./g.ts"]);
  });

  test("every stylesheet an embeddable laboratory's page reaches, the embed reaches too", () => {
    const catalogue = readFileSync(join(ROOT, "src/experiments/embed/catalogue.ts"), "utf8");
    const ids = [...new Set([...catalogue.matchAll(/\bid: "([a-z0-9-]+)"/g)].map((m) => m[1]))];
    // Only what the embed loads eagerly counts. A stylesheet reached through a laboratory's lazy
    // chunk arrives after hydration, and never without JavaScript; lazyEmbeddedLabs.tsx's header
    // says every one is imported there instead.
    const embed = new Set([
      ...stylesheetsReached(join(ROOT, "src/experiments/embed/lazyEmbeddedLabs.tsx"), false),
      ...stylesheetsReached(join(ROOT, "src/app/embed/lab/[experiment]/page.tsx"), false),
    ]);
    const missing: string[] = [];
    let reaches = 0;
    for (const id of ids) {
      const page = join(ROOT, `src/app/lab/${id}/page.tsx`);
      if (!existsSync(page)) {
        missing.push(`${id}: no lab page at src/app/lab/${id}/page.tsx`);
        continue;
      }
      const sheets = stylesheetsReached(page);
      reaches += sheets.size;
      for (const sheet of sheets) if (!embed.has(sheet)) missing.push(`${id}: ${sheet}`);
    }
    console.log(
      `[embed stylesheets] ${ids.length} embeddable ids, ${reaches} stylesheet reaches from their pages; the embed reaches ${embed.size}; ${missing.length} missing`,
    );
    // Not vacuous: 32 ids and 111 reaches on 2026-09-24.
    expect(ids.length).toBeGreaterThan(20);
    expect(reaches).toBeGreaterThan(50);
    expect(missing).toEqual([]);
  });
});
