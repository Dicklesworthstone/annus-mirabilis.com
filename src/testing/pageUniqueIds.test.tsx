import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { exportMarkup } from "./exportMarkup.ts";
import { idProblems, pageRoutes, withoutNoscript } from "./idProblems.ts";
import { offlinePublication } from "./offlinePublication.ts";

/**
 * An id names one element on every page outside the laboratories (labUniqueIds.test.tsx covers
 * lab and embed). Measured 2026-09-24: /notation/ without JavaScript carried 376 repeated ids,
 * because its <noscript> fallback repeated a catalogue the server had already rendered; with
 * JavaScript, which does not parse <noscript>, it carried none. So both readings are checked.
 * After that fix, a sweep of every route found no other repeat.
 */
const APP = fileURLToPath(new URL("../app/", import.meta.url));

/*
 * THIS SWEEP CANNOT RUN ON A STALE CHAPTER SET, AND IT USED TO REPORT THAT AS A DUPLICATE ID.
 *
 * `loadOfflineManifest` refuses a published chapter set that does not match the compiled content,
 * which is right and stays. `prepare-lane.ts` takes NO LOCK, so two lanes in one checkout interleave:
 * one pane's prepare:content rewrites generated/content/index.json while another pane's
 * prepare:offline has already stamped the previous digest. 35 content files landed in commits in the
 * 90 minutes before this was written.
 *
 * The refusal does not arrive from /offline/ alone. `OfflineChapterLinks` sits on every paper page
 * and every laboratory page by design, so a stale chapter set puts most of the site out of this
 * sweep's reach, and the failure read as an id fault on the route the loop happened to be on. It
 * cost the orchestrator several minutes believing the site had a duplicate id.
 *
 * So the whole sweep is skipped, named and reported, rather than passing over a handful of routes it
 * could still render: a green from a sweep that examined a fraction of the site is worse than no
 * green, and the count it prints would have hidden that. Bun prints neither a skipped test's name nor
 * a reason, which is why the reason goes to the console. The lane's own prepare:offline is what makes
 * the condition false, so the lane runs this in full.
 */
const publication = await offlinePublication();
if (!publication.current)
  console.warn(
    `pageUniqueIds: the id sweep did not run. ${publication.reason}. Every page carrying ` +
      "OfflineChapterLinks cannot render while that is true, which is most of the site.",
  );

describe("an id names one element on every page, with and without JavaScript", () => {
  test.skipIf(!publication.current)(
    "every route outside lab and embed, in both readings",
    async () => {
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
      console.log(
        `[page ids] ${routes.length} routes, ${renders} renders, ${found.length} problems`,
      );
      // Non-vacuity: the pages this was found on, and the densest ones, were among those rendered.
      for (const section of ["notation", "papers", "foundations", "discover"])
        expect(rendered.has(section), section).toBe(true);
      expect(renders).toBeGreaterThan(200);
      expect(found).toEqual([]);
    },
    300_000,
  );
});
