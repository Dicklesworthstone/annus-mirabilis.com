/**
 * /capstones/light-quanta/ (am-1nnj follow-on, dispatch 360).
 *
 * The usual page assertions, plus the three this record needs that the other two did not. The
 * paper's conclusion is a heuristic in a restricted regime, and the ways a capstone of it goes
 * wrong are all firming that up: dropping the as-if, letting the predictions read as evidence for
 * the viewpoint they were drawn from, and stopping at the famous part before section nine. Each is
 * asserted below as a property of the record as rendered, not as a spelling check on prose.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadCapstone } from "../../../discovery/capstone/loadCapstone.ts";
import {
  consistentOrderCount,
  dependencyFeedback,
} from "../../../discovery/shared/dependencyFeedback.ts";
import { DEFAULT_FACE, FACE_REGISTRY } from "../../../reader/faces/registry.ts";
import CapstonePage from "./page";

const html = renderToStaticMarkup(<CapstonePage />);
const { capstone, equations } = loadCapstone("light-quanta");
/** Apostrophes arrive three ways, as a straight quote, an entity and a curly quote; one shape. */
const flatten = (value: string) => value.replace(/&#x27;|&rsquo;|’/g, "'").replace(/\s+/g, " ");
const text = flatten(html.replace(/<[^>]+>/g, " ")).trim();

describe("the light-quanta capstone page", () => {
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
    // argument ids. A link to /papers/light-quanta/#s1-p3 would land at the top of the page and
    // return 200 while doing it.
    expect(FACE_REGISTRY.parallel.id).toBe("parallel");
    expect(DEFAULT_FACE).not.toBe("parallel");
    for (const claim of capstone.claims)
      expect(html).not.toContain(`href="/papers/light-quanta/#${claim.anchor}"`);

    for (const claim of capstone.claims)
      expect([
        claim.id,
        html.includes(`href="/papers/light-quanta/view/parallel/#${claim.anchor}"`),
      ]).toEqual([claim.id, true]);
    for (const assumption of capstone.assumptions)
      if (assumption.anchor !== undefined)
        expect([
          assumption.id,
          html.includes(`href="/papers/light-quanta/view/parallel/#${assumption.anchor}"`),
        ]).toEqual([assumption.id, true]);
    for (const equation of equations)
      expect(html).toContain(`href="/papers/light-quanta/view/parallel/#${equation.displayUnit}"`);
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
    expect(count).toBe(63);
    expect(text).toContain(`${count} arrangements satisfy it`);
    expect(text).not.toContain("1 arrangement satisfies it");
  });

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

  test("the conclusion is carried as a heuristic and the wave theory is not refuted", () => {
    // The paper calls its own standpoint heuristic in its title, and the conclusion is an as-if
    // about thermal behaviour. A capstone that promoted it to a statement about what light IS would
    // still render, still validate and still link correctly, so the property is asserted here.
    const heuristic = capstone.claims.filter((c) => c.logicalRole === "heuristic-inference");
    expect(heuristic.length).toBe(1);
    const conclusion = heuristic[0];
    expect(conclusion?.assumptionIds.length ?? 0).toBeGreaterThan(0);
    expect(flatten(conclusion?.text ?? "")).toContain("as if");
    // The opening's scope survives into the page: the wave theory is kept, not set aside.
    expect(text).toContain("wave theory");
    // Scanned over the CLAIMS, not the whole page. The record's limits deny each of these in so
    // many words, so a scan of the rendered text would match the denial and fail on the sentence
    // that does the work. Text describing a forbidden claim is not the claim, and this test read
    // the page before it read the claims, which is how that was found.
    const asserted = capstone.claims
      .map((c) => flatten(c.text).toLowerCase())
      .concat(flatten(capstone.question).toLowerCase())
      .concat(flatten(capstone.explanationPrompt).toLowerCase());
    for (const firmedUp of [
      "light is not a wave",
      "light is made of particles",
      "proves that light",
      "disproves the wave",
    ])
      expect([firmedUp, asserted.some((s) => s.includes(firmedUp))]).toEqual([firmedUp, false]);
    // And the denial is required rather than merely permitted: the limits say it outright.
    expect(flatten(capstone.limits).toLowerCase()).toContain(
      "does not say that light is not a wave",
    );
  });

  test("the predictions descend from the viewpoint, never the other way round", () => {
    // The named prohibited circle: a prediction drawn FROM the viewpoint read as evidence FOR it.
    // Every claim anchored in the photoelectric or ionization sections must have the heuristic
    // claim among its ancestors, and the heuristic claim must not have any of them among its own.
    const conclusion = capstone.claims.find((c) => c.logicalRole === "heuristic-inference");
    expect(conclusion).toBeDefined();
    const predictions = capstone.claims.filter((c) => /^s[89]\b|^s[89]-/.test(c.anchor));
    expect(predictions.length).toBeGreaterThan(0);
    for (const prediction of predictions) {
      expect([prediction.id, ancestors(prediction.id).has(conclusion?.id ?? "")]).toEqual([
        prediction.id,
        true,
      ]);
      expect([prediction.id, ancestors(conclusion?.id ?? "").has(prediction.id)]).toEqual([
        prediction.id,
        false,
      ]);
    }
  });

  test("the closing section is in the rebuild, not left behind the famous part", () => {
    // A capstone whose claims stop at the quanta hypothesis has selected the headline. Section nine
    // is where the viewpoint is exposed to a measurement, so a claim has to reach it.
    const section = (anchor: string) => /^(?:eq-)?(s\d+)/.exec(anchor)?.[1] ?? anchor;
    const claimSections = capstone.claims.map((c) => section(c.anchor));
    expect(claimSections).toContain("s9");
    // The bead requires anchors for sections one to nine to resolve. Claims reach seven of them and
    // the assumptions carry the other two, so the union is what is asserted.
    const reached = new Set([
      ...claimSections,
      ...capstone.assumptions.flatMap((a) => (a.anchor ? [section(a.anchor)] : [])),
    ]);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9])
      expect([`s${n}`, reached.has(`s${n}`)]).toEqual([`s${n}`, true]);
  });

  test("the graph is the one the bead specifies, orders and violations both", () => {
    // am-disc-capstone-light-quanta-98xc fixes the chain: five edges, sixty-three consistent orders,
    // the paper order reporting none and the authored start order reporting exactly four, named.
    // Asserting the violated edges by name rather than the count alone, because four violations of
    // the wrong four would be a different chain with the same arithmetic.
    const ids = capstone.claims.map((c) => c.id);
    const edges = capstone.claims.flatMap((c) => c.buildsOn.map((from) => ({ from, to: c.id })));
    expect(edges.length).toBe(5);
    expect(consistentOrderCount(ids, edges)).toBe(63);
    expect(dependencyFeedback(ids, edges, capstone.paperOrder).violated).toEqual([]);
    const started = dependencyFeedback(ids, edges, capstone.startOrder).violated.map(
      (e) => `${e.from}->${e.to}`,
    );
    expect([...started].sort()).toEqual(["c1->c2", "c3->c4", "c4->c6", "c5->c6"]);
  });

  test("the heuristic step maps to independence and the Wien regime", () => {
    // The bead names both: c6 is heuristic and rests on a1 and a3. A capstone that kept the role and
    // dropped either assumption would still validate.
    const c6 = capstone.claims.find((c) => c.id === "c6");
    expect(c6?.logicalRole).toBe("heuristic-inference");
    const regime = capstone.assumptions.find((a) => /Wien regime/.test(a.statement));
    const independence = capstone.assumptions.find((a) =>
      /independent of one another/.test(a.statement),
    );
    expect(regime?.kind).toBe("approximation");
    expect(c6?.assumptionIds).toContain(regime?.id ?? "");
    expect(c6?.assumptionIds).toContain(independence?.id ?? "");
  });

  test("no claim or prompt says Planck proposed Einstein's quanta", () => {
    // The third of the bead's three refusals, and the one the other tests do not cover. Scanned over
    // the claims and prompt, not the page, because the record says in so many words that Planck's
    // elements belong to his oscillators and a page scan would match that sentence.
    const asserted = capstone.claims
      .map((c) => flatten(c.text).toLowerCase())
      .concat(flatten(capstone.explanationPrompt).toLowerCase());
    for (const wrong of [
      "planck proposed",
      "planck's light quanta",
      "planck introduced light quanta",
    ])
      expect([wrong, asserted.some((s) => s.includes(wrong))]).toEqual([wrong, false]);
    // And the phrase that is Ehrenfest's, 1911, appears nowhere on the page at all.
    expect(text.toLowerCase()).not.toContain("ultraviolet catastrophe");
  });

  test("the regime the inference is confined to is stated and used", () => {
    // Wien's law is a domain, not a detail. The capstone schema has no scope field, so the
    // restriction is carried by an assumption, and that assumption has to be one the conclusion
    // actually names rather than a sentence sitting unused beside it.
    const conclusion = capstone.claims.find((c) => c.logicalRole === "heuristic-inference");
    const regime = capstone.assumptions.find((a) => /Wien/.test(a.statement));
    expect(regime).toBeDefined();
    expect(regime?.kind).toBe("approximation");
    expect(conclusion?.assumptionIds).toContain(regime?.id ?? "");
    expect(text).toContain(flatten(regime?.statement ?? "").slice(0, 40));
  });

  test("nothing on this page needs JavaScript", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/capstones/light-quanta/page.tsx"),
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
    const queue = ["src/app/capstones/light-quanta/page.tsx"];
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
    expect(sitemap).toContain('"/capstones/light-quanta/"');
  });
});
