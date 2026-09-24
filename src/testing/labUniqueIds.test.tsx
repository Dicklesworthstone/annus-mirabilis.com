import { describe, expect, test } from "bun:test";
import { readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * An id names one element on a lab or embed page. SR-12 drew each of its two frames with its own
 * <marker id="sr12-arrow">, so /lab/sr-12/ and its embed carried the id twice and every arrowhead
 * resolved to the first frame's marker (measured in a browser on live, 2026-09-24, with JavaScript
 * on and off). A sweep of all 79 lab and embed renders found no other repeat.
 *
 * Checked in both readings of a page: as a browser with JavaScript parses it (<noscript> content
 * inert) and as one without (<noscript> content parsed). A url(#id) reference, as SVG markers,
 * gradients and clip paths use, must resolve to exactly one element.
 */
const APP = fileURLToPath(new URL("../app/", import.meta.url));

function pages(dir: string, base: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}${name}`;
    if (statSync(full).isDirectory()) return pages(`${full}/`, `${base}${name}/`);
    return name === "page.tsx" ? [base] : [];
  });
}

/** Ids that occur more than once, and url(#id) references that do not name exactly one element. */
export function idProblems(html: string): string[] {
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/\sid="([^"]+)"/g))
    counts.set(m[1] ?? "", (counts.get(m[1] ?? "") ?? 0) + 1);
  const problems = [...counts].filter(([, n]) => n > 1).map(([id, n]) => `id ${id} ×${n}`);
  for (const m of html.matchAll(/url\(#([^)"']+)\)/g)) {
    const n = counts.get(m[1] ?? "") ?? 0;
    if (n !== 1) problems.push(`url(#${m[1]}) names ${n} elements`);
  }
  return [...new Set(problems)];
}

describe("an id names one element on every lab and embed page", () => {
  test("the check finds the defect as it shipped, and passes one id per element", () => {
    const shipped =
      '<svg><defs><marker id="sr12-arrow"></marker></defs><line marker-end="url(#sr12-arrow)"/></svg>'.repeat(
        2,
      );
    expect(idProblems(shipped)).toEqual(["id sr12-arrow ×2", "url(#sr12-arrow) names 2 elements"]);
    expect(idProblems('<line marker-end="url(#nowhere)"/>')).toEqual([
      "url(#nowhere) names 0 elements",
    ]);
    expect(idProblems('<p id="a"></p><p id="b"></p>')).toEqual([]);
  });

  test("no page repeats an id, with or without JavaScript", async () => {
    const routes = [...pages(`${APP}lab/`, "lab/"), ...pages(`${APP}embed/`, "embed/")].sort();
    const found: string[] = [];
    let renders = 0;
    for (const rel of routes) {
      const mod = await import(`${APP}${rel}page.tsx`);
      const list: object[] =
        rel.includes("[") && mod.generateStaticParams ? await mod.generateStaticParams() : [{}];
      for (const params of list) {
        const out = mod.default({
          searchParams: Promise.resolve({}),
          params: Promise.resolve(params),
        });
        const noScript = await exportMarkup(out instanceof Promise ? await out : out);
        const withScript = noScript.replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
        renders += 1;
        for (const [reading, html] of [
          ["JavaScript on", withScript],
          ["JavaScript off", noScript],
        ] as const)
          for (const problem of idProblems(html))
            found.push(`${rel}${JSON.stringify(params)} (${reading}): ${problem}`);
      }
    }
    console.log(`[lab ids] ${renders} renders, ${found.length} problems`);
    expect(renders).toBeGreaterThan(60);
    expect(found).toEqual([]);
  });
});
