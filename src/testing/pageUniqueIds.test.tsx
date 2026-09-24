import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { exportMarkup } from "./exportMarkup.ts";
import { idProblems, pageRoutes, withoutNoscript } from "./idProblems.ts";

/**
 * An id names one element on every page outside the laboratories (labUniqueIds.test.tsx covers
 * lab and embed). Measured 2026-09-24: /notation/ without JavaScript carried 376 repeated ids,
 * because its <noscript> fallback repeated a catalogue the server had already rendered; with
 * JavaScript, which does not parse <noscript>, it carried none. So both readings are checked.
 * After that fix, a sweep of every route found no other repeat.
 */
const APP = fileURLToPath(new URL("../app/", import.meta.url));

describe("an id names one element on every page, with and without JavaScript", () => {
  test("every route outside lab and embed, in both readings", async () => {
    const routes = pageRoutes(APP)
      .filter((r) => !r.startsWith("lab/") && !r.startsWith("embed/"))
      .sort();
    const found: string[] = [];
    const rendered = new Set<string>();
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
        renders += 1;
        rendered.add(rel.split("/")[0] ?? "");
        for (const [reading, html] of [
          ["JavaScript on", withoutNoscript(noScript)],
          ["JavaScript off", noScript],
        ] as const)
          for (const problem of idProblems(html))
            found.push(`/${rel}${JSON.stringify(params)} (${reading}): ${problem}`);
      }
    }
    console.log(`[page ids] ${routes.length} routes, ${renders} renders, ${found.length} problems`);
    // Non-vacuity: the pages this was found on, and the densest ones, were among those rendered.
    for (const section of ["notation", "papers", "foundations", "discover"])
      expect(rendered.has(section), section).toBe(true);
    expect(renders).toBeGreaterThan(200);
    expect(found).toEqual([]);
  }, 300_000);
});
