/**
 * /capstones/mass-energy/ (am-disc-capstones-infra-3352).
 *
 * The page renders one record, so most of what could be asserted here would be a restatement of the
 * loader. What is worth asserting is where the page could sensibly be WRONG: the order it prints
 * the claims in, whether a reader can reach the source from each one, whether the arrangement count
 * is the record's or a number someone typed, and whether any of it needs JavaScript.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadCapstone } from "../../../discovery/capstone/loadCapstone.ts";
import { consistentOrderCount } from "../../../discovery/shared/dependencyFeedback.ts";
import CapstonePage from "./page";

const html = renderToStaticMarkup(<CapstonePage />);
const { capstone, equations } = loadCapstone("mass-energy");
/** Apostrophes arrive three ways, as a straight quote, an entity and a curly quote; one shape. */
const flatten = (value: string) => value.replace(/&#x27;|&rsquo;|’/g, "'").replace(/\s+/g, " ");
const text = flatten(html.replace(/<[^>]+>/g, " ")).trim();

describe("the mass-energy capstone page", () => {
  test("every claim, assumption and annotated equation reaches the reader", () => {
    expect(capstone.claims.length).toBeGreaterThan(0);
    for (const claim of capstone.claims) expect(html).toContain(`id="${claim.id}"`);
    for (const assumption of capstone.assumptions)
      expect([assumption.id, text.includes(flatten(assumption.statement).slice(0, 48))]).toEqual([
        assumption.id,
        true,
      ]);
    for (const equation of equations) expect(text).toContain(equation.title);
  });

  test("the claims print in the paper's order, which is not the worksheet's start order", () => {
    // The discriminator: a page that rendered `capstone.claims` or `startOrder` instead of
    // `paperOrder` would still show all six, so presence proves nothing about order.
    expect(capstone.startOrder).not.toEqual(capstone.paperOrder);
    const positions = capstone.paperOrder.map((id) => html.indexOf(`id="${id}"`));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    const startPositions = capstone.startOrder.map((id) => html.indexOf(`id="${id}"`));
    expect(startPositions).not.toEqual([...startPositions].sort((a, b) => a - b));
  });

  test("each claim and assumption links to the passage it is read from", () => {
    for (const claim of capstone.claims)
      expect([claim.id, html.includes(`href="/papers/mass-energy/#${claim.anchor}"`)]).toEqual([
        claim.id,
        true,
      ]);
    for (const equation of equations)
      expect(html).toContain(`href="/papers/mass-energy/#${equation.displayUnit}"`);
    for (const preset of capstone.presets) {
      expect(html).toContain(`href="/lab/${preset.instrumentId}/"`);
      if (preset.tapeId !== undefined) expect(html).toContain(`/tapes/${preset.tapeId}/`);
    }
  });

  test("the number of arrangements is the record's chain, not a number in the prose", () => {
    const count = consistentOrderCount(
      capstone.claims.map((claim) => claim.id),
      capstone.claims.flatMap((claim) => claim.buildsOn.map((from) => ({ from, to: claim.id }))),
    );
    expect(count).toBe(2);
    expect(text).toContain(`${count} arrangements satisfy it`);
    // The page must not be claiming the paper's order is the only one that works.
    expect(text).not.toContain("1 arrangement satisfies it");
  });

  test("nothing on this page needs JavaScript", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/capstones/mass-energy/page.tsx"),
      "utf8",
    );
    expect(source).not.toContain("use client");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<button");
    // Every action is a link, so scripts off changes nothing about what can be done here.
    expect(html).toContain("<a ");
  });

  test("this route does not reach the content compiler, which no test lane would notice", () => {
    // The hazard this guards is documented and has broken the build three times: a route imports a
    // convenience helper, the helper imports a registry, and the registry brings a few hundred
    // modules into a page that needed a string. Rendering still passes, typechecking still passes,
    // and only `next build` has an opinion. So the graph is walked here instead.
    const reached = new Set<string>();
    const queue = ["src/app/capstones/mass-energy/page.tsx"];
    while (queue.length > 0) {
      const file = queue.pop();
      if (file === undefined || reached.has(file) || !existsSync(join(process.cwd(), file)))
        continue;
      reached.add(file);
      const source = readFileSync(join(process.cwd(), file), "utf8");
      for (const match of source.matchAll(/from "(\.[^"]+)"/g)) {
        const target = join(file, "..", match[1] ?? "");
        for (const candidate of [target, `${target}.ts`, `${target}.tsx`]) {
          if (/\.tsx?$/.test(candidate) && existsSync(join(process.cwd(), candidate))) {
            queue.push(candidate);
            break;
          }
        }
      }
    }
    // Non-vacuity first: a walker that found nothing would satisfy every exclusion below.
    expect(reached.has("src/discovery/capstone/capstoneSchema.ts")).toBe(true);
    expect(reached.size).toBeGreaterThan(5);
    for (const heavy of [
      "src/content/server.ts",
      "src/content/compiler/compile.ts",
      "src/experiments/catalogue.ts",
      "src/reader/paperRoutes.ts",
    ])
      expect([heavy, reached.has(heavy)]).toEqual([heavy, false]);
    expect(reached.size).toBeLessThan(30);
  });

  test("the print rules reach the parts a printed capstone would otherwise lose", () => {
    const css = readFileSync(join(process.cwd(), "src/app/capstones/capstones.css"), "utf8");
    const print = css.slice(css.indexOf("@media print"));
    expect(print.startsWith("@media print")).toBe(true);
    // A claim split across a page break, and a link whose address is gone, are the two ways a
    // printed copy of this page stops being usable.
    expect(print).toContain(".capstone-claim");
    expect(print).toContain("break-inside: avoid");
    expect(print).toContain("attr(href)");
    expect(css).toContain("@media print");
  });
});
