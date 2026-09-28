/**
 * /capstones/brownian-motion/ (am-1nnj follow-on, dispatch 355).
 *
 * The second capstone page, asserted where it could sensibly be WRONG rather than where it would
 * restate the loader: the order it prints the claims in, whether a reader can reach the source from
 * each one on a face that actually carries the anchor, whether the arrangement count comes from the
 * record's chain or from someone's arithmetic, and whether any of it needs JavaScript.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadCapstone } from "../../../discovery/capstone/loadCapstone.ts";
import { consistentOrderCount } from "../../../discovery/shared/dependencyFeedback.ts";
import { DEFAULT_FACE, FACE_REGISTRY } from "../../../reader/faces/registry.ts";
import { tapePath } from "../../../reader/sitePaths.ts";
import CapstonePage from "./page";

const html = renderToStaticMarkup(<CapstonePage />);
const { capstone, equations } = loadCapstone("brownian-motion");
/** Apostrophes arrive three ways, as a straight quote, an entity and a curly quote; one shape. */
const flatten = (value: string) => value.replace(/&#x27;|&rsquo;|’/g, "'").replace(/\s+/g, " ");
const text = flatten(html.replace(/<[^>]+>/g, " ")).trim();

describe("the brownian-motion capstone page", () => {
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
    // `paperOrder` would still show all seven, so presence proves nothing about order.
    expect(capstone.startOrder).not.toEqual(capstone.paperOrder);
    const positions = capstone.paperOrder.map((id) => html.indexOf(`id="${id}"`));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    const startPositions = capstone.startOrder.map((id) => html.indexOf(`id="${id}"`));
    expect(startPositions).not.toEqual([...startPositions].sort((a, b) => a - b));
  });

  test("each claim and assumption links to the passage it is read from, on a face that has it", () => {
    // Measured on a render for THIS paper rather than inherited from the mass-energy page: the
    // twelve anchors this page links to appear 0 of 12 times on the paper's default face and 12 of
    // 12 on the parallel face, because the default face is the explanation, whose anchors are
    // argument ids. A link to /papers/brownian-motion/#s1-p3 would land at the top of the page and
    // return 200 while doing it.
    expect(FACE_REGISTRY.parallel.id).toBe("parallel");
    expect(DEFAULT_FACE).not.toBe("parallel");
    for (const claim of capstone.claims)
      expect(html).not.toContain(`href="/papers/brownian-motion/#${claim.anchor}"`);

    for (const claim of capstone.claims)
      expect([
        claim.id,
        html.includes(`href="/papers/brownian-motion/view/parallel/#${claim.anchor}"`),
      ]).toEqual([claim.id, true]);
    for (const assumption of capstone.assumptions)
      if (assumption.anchor !== undefined)
        expect([
          assumption.id,
          html.includes(`href="/papers/brownian-motion/view/parallel/#${assumption.anchor}"`),
        ]).toEqual([assumption.id, true]);
    for (const equation of equations)
      expect(html).toContain(
        `href="/papers/brownian-motion/view/parallel/#${equation.displayUnit}"`,
      );
    for (const preset of capstone.presets) {
      expect(html).toContain(`href="/lab/${preset.instrumentId}/"`);
      // THROUGH `tapePath`, NEVER A TEMPLATE (am-tpzn, dispatch 390). The site serves an id whose
      // last segment carries a dot WITHOUT a trailing slash and every other id with one, so a
      // hand-built `/tapes/${id}/` is wrong for `the-boost-to-0.6c`, which answers 308 in that form.
      // BOTH of this capstone's presets name a tape and NEITHER id is dotted, so the template this
      // replaces was passing by coincidence rather than by rule: it asserted the right string for
      // these two ids and would assert a 308ing one for the first dotted id to appear here.
      if (preset.tapeId !== undefined) expect(html).toContain(`href="${tapePath(preset.tapeId)}"`);
    }
  });

  test("the number of arrangements is the record's chain, not a number in the prose", () => {
    const count = consistentOrderCount(
      capstone.claims.map((claim) => claim.id),
      capstone.claims.flatMap((claim) => claim.buildsOn.map((from) => ({ from, to: claim.id }))),
    );
    // Two chains of three that meet at the last claim, so the interleavings are the ways to choose
    // which three of the first six positions the thermodynamic branch takes.
    expect(count).toBe(20);
    expect(text).toContain(`${count} arrangements satisfy it`);
    expect(text).not.toContain("1 arrangement satisfies it");
  });

  test("the chain keeps the two branches separate until they meet", () => {
    // The record's editorial point, asserted as a property rather than a census: the osmotic
    // argument and the argument from independent steps share no claim until the last one joins
    // them, which is why there are twenty arrangements rather than one.
    const buildsOn = new Map(capstone.claims.map((c) => [c.id, c.buildsOn]));
    const ancestors = (id: string): Set<string> => {
      const out = new Set<string>();
      const queue = [...(buildsOn.get(id) ?? [])];
      while (queue.length > 0) {
        const next = queue.pop();
        if (next === undefined || out.has(next)) continue;
        out.add(next);
        queue.push(...(buildsOn.get(next) ?? []));
      }
      return out;
    };
    const joining = capstone.claims.filter((c) => c.buildsOn.length > 1);
    expect(joining.length).toBe(1);
    const [left, right] = (joining[0]?.buildsOn ?? []) as [string, string];
    const overlap = [...ancestors(left)].filter((id) => ancestors(right).has(id));
    expect(overlap).toEqual([]);
  });

  test("nothing on this page needs JavaScript", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/capstones/brownian-motion/page.tsx"),
      "utf8",
    );
    expect(source).not.toContain("use client");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<button");
    expect(html).toContain("<a ");
  });

  test("this route does not reach the content compiler, which no test lane would notice", () => {
    // The hazard is documented and has broken the build three times: a route imports a convenience
    // helper, the helper imports a registry, and a few hundred modules follow it into a page that
    // needed a string. Rendering passes, typechecking passes, and only `next build` has an opinion,
    // so the import graph is walked here instead.
    const reached = new Set<string>();
    const queue = ["src/app/capstones/brownian-motion/page.tsx"];
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

  test("the record is in the sitemap, so a reader who never passes the discovery route can find it", () => {
    const sitemap = readFileSync(join(process.cwd(), "src/app/sitemap.ts"), "utf8");
    expect(sitemap).toContain('"/capstones/brownian-motion/"');
  });
});
