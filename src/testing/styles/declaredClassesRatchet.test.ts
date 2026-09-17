import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * A ratchet gate against undeclared CSS classes in TSX components (am-vw1o).
 *
 * 61+ components carried thousands of inert Tailwind utility classes (e.g. text-xs, flex-col,
 * gap-1, font-medium, p-3) without Tailwind being installed or configured.
 *
 * Under decision D-2026-09-17-tailwind-styling-resolution, the project uses semantic CSS
 * exclusively. This ratchet ensures that:
 * 1. Pre-existing legacy utility classes are pinned per file in declaredClassesBaseline.json.
 * 2. The baseline may only SHRINK: a file exceeding its baseline count fails.
 * 3. A new file not in the baseline fails at the first undeclared class.
 * 4. As components are refactored to semantic CSS, counts are ratcheted down.
 */

const ROOT = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const BASELINE_PATH = join(ROOT, "src/testing/styles/declaredClassesBaseline.json");

export function findCssClasses(dir: string): Set<string> {
  const classes = new Set<string>();
  if (!existsSync(dir)) return classes;
  function walk(d: string): void {
    for (const e of readdirSync(d)) {
      const full = join(d, e);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (e.endsWith(".css")) {
        const content = readFileSync(full, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
        const matches = content.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g);
        for (const m of matches) {
          if (m[1]) classes.add(m[1]);
        }
      }
    }
  }
  walk(dir);
  return classes;
}

export function findTsxFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...findTsxFiles(full));
    } else if (entry.endsWith(".tsx") && !entry.includes(".test.")) {
      out.push(full);
    }
  }
  return out;
}

const CLASSNAME_RE = /className=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|\{"([^"]*)"\})/g;

export function countUndeclaredClasses(
  source: string,
  declaredClasses: ReadonlySet<string>,
): number {
  let count = 0;
  for (const m of source.matchAll(CLASSNAME_RE)) {
    const raw = m[1] ?? m[2] ?? m[3] ?? m[4] ?? "";
    const cleaned = raw.replace(/\$\{[^}]*\}/g, " ");
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      if (
        t === "?" ||
        t === ":" ||
        t === "true" ||
        t === "false" ||
        t.includes("${") ||
        t.includes("}")
      ) {
        continue;
      }
      if (!declaredClasses.has(t)) {
        count++;
      }
    }
  }
  return count;
}

describe("declared CSS classes ratchet (am-vw1o)", () => {
  const declaredClasses = findCssClasses(join(ROOT, "src"));
  for (const c of findCssClasses(join(ROOT, "public"))) {
    declaredClasses.add(c);
  }

  test("no file exceeds its recorded baseline and no new file introduces undeclared classes", () => {
    const baselineRaw = JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Record<string, number>;
    const baseline = new Map<string, number>(Object.entries(baselineRaw));

    const regressions: string[] = [];
    const improvements: string[] = [];

    for (const file of findTsxFiles(join(ROOT, "src"))) {
      const rel = relative(ROOT, file);
      const source = readFileSync(file, "utf8");
      const count = countUndeclaredClasses(source, declaredClasses);
      const allowed = baseline.get(rel) ?? 0;

      if (count > allowed) {
        regressions.push(
          `${rel}: ${count} undeclared class token(s), baseline ${allowed}. ` +
            "Declare rules in a project stylesheet or migrate to semantic CSS. (See am-vw1o)",
        );
      } else if (count < allowed) {
        improvements.push(`${rel}: ${count} < ${allowed}`);
      }
    }

    assert.deepEqual(
      regressions,
      [],
      `Undeclared CSS classes increased:\n${regressions.join("\n")}\n` +
        "Class names in className must be declared in a project stylesheet. See am-vw1o.",
    );

    if (improvements.length > 0) {
      console.log(
        `[am-vw1o] baseline can be lowered for ${improvements.length} file(s): ${improvements.join(", ")}`,
      );
    }
  });

  test("the detector fires on an undeclared class name (planted negative)", () => {
    const planted = '<div className="totally-undeclared-class-xyz123" />';
    assert.equal(countUndeclaredClasses(planted, declaredClasses), 1);
  });

  test("the detector passes on declared project classes", () => {
    const valid = '<a href="/lab/bm-01" className="button secondary" />';
    assert.equal(countUndeclaredClasses(valid, declaredClasses), 0);
  });

  test("the detector ignores template literal expressions", () => {
    const template = `<div className={\`button \${isActive ? "secondary" : ""}\`} />`;
    assert.equal(countUndeclaredClasses(template, declaredClasses), 0);
  });
});
