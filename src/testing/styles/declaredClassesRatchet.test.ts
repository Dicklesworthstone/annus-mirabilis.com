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
 *
 * WHAT THIS DOES NOT PROVE. That a class HAS a rule is not that the rule is correct, that it
 * is reachable, or that the stylesheet declaring it is loaded on the route that renders the
 * component. This gate matches a token against every `.selector` in every stylesheet under
 * src/ and public/, so a rule inside an unused media query, a rule in a stylesheet no route
 * imports, and a rule whose declarations are wrong all satisfy it equally. It closes exactly
 * one hole - a class name that resolves to nothing anywhere - and that is all.
 *
 * WHY IT NAMES THE TOKEN. It used to report only a count. On 2026-09-21 the message
 * `GermanDraftFace.tsx: 1 undeclared class token(s), baseline 0` sent two people bisecting a
 * file by hand for nineteen minutes, checking the three classes that did have rules and never
 * reaching the one that did not. The token was known at the point of failure and thrown away
 * before the message was built. A count is a fact about the problem; the name is the problem.
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

/** Every undeclared token, in source order, repeats included. The counting entry point is
 *  derived from this one so the two can never disagree about what was found. */
export function findUndeclaredClasses(
  source: string,
  declaredClasses: ReadonlySet<string>,
): string[] {
  const found: string[] = [];
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
        found.push(t);
      }
    }
  }
  return found;
}

export function countUndeclaredClasses(
  source: string,
  declaredClasses: ReadonlySet<string>,
): number {
  return findUndeclaredClasses(source, declaredClasses).length;
}

/**
 * The regression line, naming the tokens rather than counting them.
 *
 * Distinct names are listed because a token repeated nine times is one thing to fix, not
 * nine. The count stays in the line because it is what the baseline compares.
 */
export function describeUndeclared(
  rel: string,
  tokens: readonly string[],
  allowed: number,
): string {
  const distinct = [...new Set(tokens)].sort();
  const shown = distinct.slice(0, MAX_NAMED_TOKENS);
  const named = shown.map((t) => `\`${t}\``).join(", ");
  const rest =
    distinct.length > shown.length ? ` (+${distinct.length - shown.length} more distinct)` : "";
  return (
    `${rel}: ${tokens.length} undeclared class token(s), baseline ${allowed}. ` +
    `Undeclared: ${named}${rest}. ` +
    "Declare rules in a project stylesheet or migrate to semantic CSS. (See am-vw1o)"
  );
}

/** Enough to fix a regression by reading it; a legacy file is bounded rather than unbounded. */
const MAX_NAMED_TOKENS = 20;

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
      const undeclared = findUndeclaredClasses(source, declaredClasses);
      const count = undeclared.length;
      const allowed = baseline.get(rel) ?? 0;

      if (count > allowed) {
        regressions.push(describeUndeclared(rel, undeclared, allowed));
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

    assert.deepEqual(
      improvements,
      [],
      `Ratchet pawl engaged: ${improvements.length} baseline entr(y/ies) are now slack:\n${improvements.join("\n")}\n` +
        "Tighten the baseline to the observed count in this same commit to permanently lock in the improvement. " +
        "A baseline left above the real count is pre-authorised headroom for a future regression. " +
        "See am-vw1o.",
    );
  });

  test("the detector fires on an undeclared class name (planted negative)", () => {
    const planted = '<div className="totally-undeclared-class-xyz123" />';
    assert.equal(countUndeclaredClasses(planted, declaredClasses), 1);
  });

  test("the detector passes on declared project classes", () => {
    const valid = '<a href="/lab/bm-01" className="button secondary" />';
    assert.equal(countUndeclaredClasses(valid, declaredClasses), 0);
  });

  test("the failure message NAMES the undeclared token, not just a count", () => {
    // The arm that would have saved the nineteen minutes. A gate that knows which token is
    // undeclared and reports only how many is the defect this file was asked to stop being.
    const source = '<section className="source-footnotes" />';
    const withoutTheRule = new Set(declaredClasses);
    withoutTheRule.delete("source-footnotes");

    const tokens = findUndeclaredClasses(source, withoutTheRule);
    assert.deepEqual(tokens, ["source-footnotes"]);

    const message = describeUndeclared("src/reader/faces/GermanDraftFace.tsx", tokens, 0);
    assert.ok(
      message.includes("source-footnotes"),
      `the message must name the token, and said: ${message}`,
    );
    // And the count is still there, because it is what the baseline compares.
    assert.match(message, /1 undeclared class token\(s\), baseline 0/);
  });

  test("the failure message lists each distinct token once and bounds a long list", () => {
    const declared = new Set<string>();
    // A token repeated is one thing to fix, not three.
    const repeated = findUndeclaredClasses('<div className="a a a" />', declared);
    assert.equal(repeated.length, 3);
    const line = describeUndeclared("x.tsx", repeated, 0);
    assert.equal(line.match(/`a`/g)?.length, 1);
    assert.match(line, /3 undeclared class token\(s\)/);

    // And a legacy file with many does not produce an unreadable wall.
    const many = Array.from({ length: 30 }, (_, i) => `undeclared-${i}`);
    const bounded = describeUndeclared("y.tsx", many, 0);
    assert.match(bounded, /\(\+10 more distinct\)/);
  });

  test("the detector ignores template literal expressions", () => {
    const template = `<div className={\`button \${isActive ? "secondary" : ""}\`} />`;
    assert.equal(countUndeclaredClasses(template, declaredClasses), 0);
  });
});
