import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { CONSTANT_SET_READER_NAMES } from "../components/lab/kitchen/KitchenResults.tsx";

/**
 * A constant set is named to readers in words ("the 2019 SI"), never by its id. On 2026-09-24
 * bm-01 printed "(modern-si-2019)" beside four displacements, the kitchen card printed
 * "Gas-constant source: scenario-gas-constant-measured", and ME-02 printed both of its set ids.
 * The ids belong in data attributes, or in <code> inside an expandable model note, where
 * AGENTS.md puts artifact identity.
 *
 * The denominator is the registered records: every file in content/quantities/constant-sets/.
 */
const SETS_DIR = fileURLToPath(new URL("../../content/quantities/constant-sets/", import.meta.url));
const LAB_DIR = fileURLToPath(new URL("../app/lab/", import.meta.url));
const SET_IDS = readdirSync(SETS_DIR)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => f.replace(/\.yaml$/, ""))
  .sort();
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ANY_SET = new RegExp(`\\b(${SET_IDS.map(escapeRegExp).join("|")})\\b`);

/** Visible text: scripts, styles and <code> removed (identity in a model note is allowed), then tags. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<code[\s\S]*?<\/code>/g, " ")
    .replace(/<[^>]+>/g, " ");
}

describe("constant sets are named in words on every lab page", () => {
  test("the registered sets are found, and the pattern matches an id as text (positive control)", () => {
    expect(SET_IDS.length).toBeGreaterThan(5);
    expect(SET_IDS).toContain("modern-si-2019");
    expect(ANY_SET.test("0.98602 / 0.92676 μm (modern-si-2019)")).toBe(true);
    expect(ANY_SET.test('<span data-constant-set-id="modern-si-2019">')).toBe(true);
    expect(ANY_SET.test(visibleText('<span data-constant-set-id="modern-si-2019">x</span>'))).toBe(
      false,
    );
  });

  test("no lab page shows a constant-set id as visible text", async () => {
    const hits: string[] = [];
    let pages = 0;
    const dirs = readdirSync(LAB_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("["))
      .map((d) => d.name)
      .sort();
    for (const dir of dirs) {
      const file = `${LAB_DIR}${dir}/page.tsx`;
      if (!existsSync(file)) continue;
      const mod = await import(file);
      const out = mod.default({ searchParams: Promise.resolve({}), params: Promise.resolve({}) });
      const html = renderToStaticMarkup(out instanceof Promise ? await out : out);
      pages += 1;
      const text = visibleText(html);
      const m = text.match(ANY_SET);
      if (m) hits.push(`${dir}: ${m[0]}`);
    }
    console.log(`[constant-set names] ${pages} lab pages, ${hits.length} with an id as text`);
    expect(pages).toBeGreaterThan(30);
    expect(hits).toEqual([]);
  });

  test("the kitchen card has a reader name for every registered constant set", () => {
    const missing = SET_IDS.filter((id) => !CONSTANT_SET_READER_NAMES[id]);
    expect(missing).toEqual([]);
    for (const name of Object.values(CONSTANT_SET_READER_NAMES)) expect(name).not.toMatch(ANY_SET);
  });
});
