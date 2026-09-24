import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * A reader who moves through a page by heading needs an outline with no gaps. On 2026-09-24
 * /lab/lq-05/ and /lab/lq-07/ went from h2 straight to h4: each plot's own heading was an h4 placed
 * before any h3 (fixed in 3ed17d73). Every lab and embed page must open with its single h1 and
 * never go down more than one level at a time.
 */
const APP = fileURLToPath(new URL("../app/", import.meta.url));

function pages(dir: string, base: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}${name}`;
    if (statSync(full).isDirectory()) return pages(`${full}/`, `${base}${name}/`);
    return name === "page.tsx" ? [base] : [];
  });
}

/** The problems in a sequence of heading levels: a first heading that is not h1, a count of h1
 * other than one, and every step down by more than one level. */
function outlineProblems(levels: readonly number[]): string[] {
  const problems: string[] = [];
  if (levels[0] !== 1) problems.push(`opens with h${levels[0] ?? "none"}`);
  const h1 = levels.filter((level) => level === 1).length;
  if (h1 !== 1) problems.push(`${h1} h1`);
  levels.forEach((level, i) => {
    const previous = levels[i - 1];
    if (previous !== undefined && level > previous + 1) problems.push(`h${previous} to h${level}`);
  });
  return problems;
}

describe("lab and embed pages have a heading outline without gaps", () => {
  test("the outline check names a skipped level, a missing or second h1, and passes a sound outline", () => {
    expect(outlineProblems([1, 2, 4])).toEqual(["h2 to h4"]);
    expect(outlineProblems([2, 3])).toEqual(["opens with h2", "0 h1"]);
    expect(outlineProblems([1, 2, 1])).toEqual(["2 h1"]);
    expect(outlineProblems([1, 2, 3, 3, 2, 3, 4, 2])).toEqual([]);
  });

  test("every lab and embed page opens with one h1 and never skips a level", async () => {
    const routes = [...pages(`${APP}lab/`, "lab/"), ...pages(`${APP}embed/`, "embed/")].sort();
    const found: string[] = [];
    let renders = 0;
    for (const rel of routes) {
      const mod = await import(`${APP}${rel}page.tsx`);
      const list: object[] =
        rel.includes("[") && mod.generateStaticParams ? await mod.generateStaticParams() : [{}];
      for (const params of list) {
        const out = mod.default({
          params: Promise.resolve(params),
          searchParams: Promise.resolve({}),
        });
        const html = await exportMarkup(out instanceof Promise ? await out : out);
        renders += 1;
        const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
        const problems = outlineProblems(levels);
        if (problems.length)
          found.push(
            `${rel}${rel.includes("[") ? JSON.stringify(params) : ""}: ${problems.join(", ")}`,
          );
      }
    }
    console.log(`[headings] ${renders} lab and embed renders; ${found.length} with a gap`);
    expect(renders).toBeGreaterThan(60);
    expect(found).toEqual([]);
  });
});
