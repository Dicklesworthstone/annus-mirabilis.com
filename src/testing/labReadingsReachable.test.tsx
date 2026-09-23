import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { installDom, uninstallDom } from "./reactDom.ts";

/**
 * Every laboratory whose definition authors the four instrument readings (an `XX_CAPTION` with r0 to
 * r3) renders them where the reader's detail setting can switch them: as `p[data-detail="0".."3"]`,
 * direct children of the lab root, which labShell.css selects with a child combinator.
 *
 * Two failures this guards, both found on 2026-09-23: three labs (lq-05, lq-07, lq-09) authored their
 * readings and never rendered them, and bm-03's readings, once rendered, sat one element too deep for
 * the rule to reach, so the overview and full explanation showed together and "show every step" never
 * could. Neither broke any other test.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EXPERIMENTS = join(ROOT, "src", "experiments");

function labsWithReadings(): string[] {
  const ids: string[] = [];
  for (const dir of readdirSync(EXPERIMENTS)) {
    const def = join(EXPERIMENTS, dir, "definition.ts");
    if (!existsSync(def)) continue;
    const source = readFileSync(def, "utf8");
    if (!/export const [A-Z0-9]+_CAPTION = Object\.freeze\(\{/.test(source)) continue;
    const route = dir.replace(/^([a-z]+)(\d+)$/, "$1-$2");
    if (existsSync(join(ROOT, "src", "app", "lab", route, "page.tsx"))) ids.push(route);
  }
  return ids.sort();
}

describe("lab readings are reachable by the detail setting", () => {
  beforeAll(async () => {
    await installDom();
  });
  afterAll(async () => {
    await uninstallDom();
  });

  const routes = labsWithReadings();

  test("the population is the labs that author readings, and it is not empty", () => {
    // Seventeen on 2026-09-23. Asserted non-empty rather than counted: a new lab with readings joins
    // the population, and an empty population would pass every check below vacuously.
    expect(routes.length).toBeGreaterThan(0);
    expect(routes).toContain("sr-11");
  });

  for (const route of routes) {
    test(`${route} renders readings 0 to 3 as direct children of its lab root`, async () => {
      const mod = (await import(join(ROOT, "src", "app", "lab", route, "page.tsx"))) as {
        default: (props: Record<string, unknown>) => unknown;
      };
      const element = await mod.default({ params: Promise.resolve({}) });
      const host = document.createElement("div");
      host.innerHTML = renderToStaticMarkup(element as never);
      const root = host.querySelector(".laboratory, .laboratory-shell");
      expect(root).not.toBeNull();
      const reached = Array.from(root?.children ?? [])
        .filter((el) => el.tagName === "P" && el.hasAttribute("data-detail"))
        .map((el) => el.getAttribute("data-detail"));
      expect(reached).toEqual(["0", "1", "2", "3"]);
      // None elsewhere: a reading nested deeper is one the rule cannot switch.
      expect(host.querySelectorAll("p[data-detail]").length).toBe(4);
    });
  }
});
