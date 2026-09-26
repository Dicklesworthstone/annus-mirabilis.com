import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { Fork } from "./Fork.tsx";
import { FIXTURE_JOURNEY_BROWNIAN } from "./testing/fixtureJourney.ts";

describe("Fork component rendering", () => {
  const [forkObservable, forkMechanism] = FIXTURE_JOURNEY_BROWNIAN.forks;
  if (!forkObservable || !forkMechanism) throw new Error("Missing forks fixture");

  test("renders fork question and varies explanation", () => {
    const html = renderToStaticMarkup(<Fork fork={forkObservable} />);

    expect(html).toContain(
      "Which observable quantity should be measured to characterize the motion?",
    );
    expect(html).toContain("The branches vary what quantity is defined as the primary observable.");
    expect(html).toContain("arg-fork-observable");
  });

  test("renders all branches with labels, hypotheses, and outcomes", () => {
    const html = renderToStaticMarkup(<Fork fork={forkObservable} />);

    expect(html).toContain("Appren-velocity trajectory tracking");
    expect(html).toContain("Exner");
    expect(html).toContain("#card-exner-1900");
    expect(html).toContain("Mean-square displacement scaling");
    expect(html).toContain("The route taken in the 1905 paper");
  });

  test("renders dead-end-on-constraint outcome with constraint link", () => {
    const html = renderToStaticMarkup(<Fork fork={forkMechanism} />);

    expect(html).toContain("Ambient environmental vibrations");
    expect(html).toContain("Constrained by physical contradiction");
    expect(html).toContain("#card-gouy-1888");
  });

  /*
   * A journey reads like a book (dispatch 276). A fork was a bordered, filled box holding a
   * bordered box per branch, each holding bordered panels: three deep on all four journeys, under a
   * red monospace "A FORK IN THE ROUTE" stamp, with a dead end's outcome and its constraint link in
   * the accent. Now the branch is the only container, the fork is a question with an eyebrow in
   * plain words, and nothing in the skeleton is drawn in the accent, which is left for the
   * reader's place and the links they follow.
   */
  const css = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "journeySkeleton.css"),
    "utf8",
  );
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, selector, body]) => ({
    selector: (selector ?? "").replace(/\/\*[\s\S]*?\*\//g, "").trim(),
    body: body ?? "",
  }));
  const draws = (body: string) => /\b(border(-[a-z]+)?|background|box-shadow)\s*:/.test(body);

  test("the fork and its branches are styled by their stylesheet, with the branch the only container", () => {
    for (const fork of [forkObservable, forkMechanism]) {
      const html = renderToStaticMarkup(<Fork fork={fork} />);
      expect(html).not.toContain("style=");
      expect(html).toContain('class="journey-fork"');
      expect(html).toContain('class="journey-branch"');
    }
    const fork = rules.filter((r) => /^\.journey-fork(\s|$|>|,)/.test(r.selector));
    const inside = rules.filter((r) => /^\.journey-branch\s*[\s>]\s*\S/.test(r.selector));
    const branch = rules.filter((r) => /^\.journey-branch$/.test(r.selector));
    expect(fork.length).toBeGreaterThan(0);
    expect(branch.length).toBe(1);
    for (const r of [...fork, ...inside]) expect(draws(r.body), r.selector).toBe(false);
  });

  test("nothing in the fork is drawn in the accent, and its eyebrow counts the ways in words", () => {
    for (const r of rules.filter((x) => /\.journey-(fork|branch)/.test(x.selector)))
      expect(r.body, r.selector).not.toContain("--accent");
    const html = renderToStaticMarkup(<Fork fork={forkMechanism} />);
    expect(html).not.toMatch(/A fork in the route/i);
    const words = ["", "One way on", "Two ways on", "Three ways on", "Four ways on"];
    expect(html).toContain(words[forkMechanism.branches.length] ?? "?");
  });

  test("a branch step's lab preset id, a name for the build, is not printed", () => {
    const [first, ...rest] = forkObservable.branches;
    if (!first) throw new Error("Missing branch fixture");
    const withPreset = {
      ...forkObservable,
      branches: [
        { ...first, steps: [{ text: "Run the walk.", presetId: "bm-01-einstein-08" }] },
        ...rest,
      ],
    };
    const html = renderToStaticMarkup(<Fork fork={withPreset} />);
    expect(html).toContain("Run the walk.");
    expect(html).not.toContain("bm-01-einstein-08");
  });
});
