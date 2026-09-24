import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * FONTS ARE CACHED FOR A YEAR, SO THEIR URLS MUST CHANGE WHEN THEY DO (am-design-themes-typography-288q).
 *
 * The self-hosted faces were served from /fonts/ with `max-age=0, must-revalidate`, so every page
 * view asked again for each of them. vercel.json now marks font files immutable for a year. That is
 * only safe while a changed font gets a new URL, so every url("/fonts/...") in the stylesheets
 * carries ?v= and the first eight hex digits of the file's SHA-256. A font replaced without its
 * ?v changing would stay in readers' caches for a year; this test fails on that instead.
 */
const ROOT = resolve(import.meta.dirname, "../../..");

function stylesheets(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...stylesheets(full));
    else if (entry.isFile() && entry.name.endsWith(".css")) found.push(full);
  }
  return found;
}

/** Every url("/fonts/...") in a stylesheet under src/, with the file it names and its ?v. */
export function fontReferences(
  root: string = ROOT,
): { sheet: string; path: string; version: string | null }[] {
  const refs: { sheet: string; path: string; version: string | null }[] = [];
  for (const sheet of stylesheets(join(root, "src"))) {
    const css = readFileSync(sheet, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/url\(\s*["']?(\/fonts\/[^"')?]+)(?:\?v=([^"')]*))?["']?\s*\)/g)) {
      refs.push({ sheet: sheet.slice(root.length + 1), path: m[1] ?? "", version: m[2] ?? null });
    }
  }
  return refs;
}

function contentVersion(publicPath: string): string {
  return createHash("sha256")
    .update(readFileSync(join(ROOT, "public", publicPath)))
    .digest("hex")
    .slice(0, 8);
}

describe("font URLs and their cache lifetime", () => {
  test("every stylesheet font URL carries ?v= of its file's current content", () => {
    const refs = fontReferences();
    // The denominator: six faces, declared in two stylesheets.
    expect(refs.length).toBeGreaterThanOrEqual(6);
    const wrong = refs
      .filter(
        (r) => !existsSync(join(ROOT, "public", r.path)) || r.version !== contentVersion(r.path),
      )
      .map((r) => `${r.sheet}: ${r.path}?v=${r.version ?? "(none)"}`);
    expect(wrong).toEqual([]);
  });

  test("vercel.json caches font files for a year, and only font files", () => {
    const config = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as {
      headers?: { source: string; headers: { key: string; value: string }[] }[];
    };
    const rules = (config.headers ?? []).filter((rule) =>
      rule.headers.some((h) => h.key === "Cache-Control" && /immutable/.test(h.value)),
    );
    const matches = (path: string) => rules.some((r) => new RegExp(`^${r.source}$`).test(path));
    for (const ref of fontReferences()) expect(matches(ref.path)).toBe(true);
    // The licence text sits beside the fonts at a URL that never changes: it must stay revalidated.
    expect(matches("/fonts/newsreader/OFL.txt")).toBe(false);
    for (const rule of rules) {
      const value = rule.headers.find((h) => h.key === "Cache-Control")?.value ?? "";
      expect(Number(/max-age=(\d+)/.exec(value)?.[1])).toBeGreaterThanOrEqual(31_536_000);
    }
  });

  test("the check reads what it claims to: a stale ?v and a missing one are both caught", () => {
    const [first] = fontReferences();
    expect(first).toBeDefined();
    if (!first) return;
    const current = contentVersion(first.path);
    expect(first.version).toBe(current);
    // A version from other bytes is not the file's.
    expect(current).not.toBe(createHash("sha256").update("other bytes").digest("hex").slice(0, 8));
    // The parser sees a reference without ?v as having none, rather than skipping it.
    const bare = [
      ...`url("/fonts/newsreader/Newsreader-Variable.ttf")`.matchAll(
        /url\(\s*["']?(\/fonts\/[^"')?]+)(?:\?v=([^"')]*))?["']?\s*\)/g,
      ),
    ];
    expect(bare.length).toBe(1);
    expect(bare[0]?.[2]).toBeUndefined();
  });
});
