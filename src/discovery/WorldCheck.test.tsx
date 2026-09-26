import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { FIXTURE_JOURNEY_BROWNIAN } from "./testing/fixtureJourney.ts";
import { WorldCheck } from "./WorldCheck.tsx";

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

describe("WorldCheck component rendering", () => {
  const worldCheck = FIXTURE_JOURNEY_BROWNIAN.worldChecks[0];
  if (!worldCheck) throw new Error("Missing worldChecks fixture");

  test("renders world check claim, static worked example, and a way into the instrument", () => {
    const html = renderToStaticMarkup(<WorldCheck check={worldCheck} />);

    expect(html).toContain(
      "The diffusion equation yields Avogadro&#x27;s number within experimental precision.",
    );
    expect(text(html)).toContain("A printed prediction");
    expect(html).toContain("Perrin (1908) gamboge emulsion");
    expect(html).toContain("6.8e23");
    expect(html).toContain("mol⁻¹");
    expect(html).toContain('href="/lab/bm-07/"');
  });

  test("renders the later evidence as measured later, with its year", () => {
    const html = renderToStaticMarkup(<WorldCheck check={worldCheck} />);

    expect(text(html)).toContain("Measured later, in 1908");
    expect(html).toContain(
      "Jean Perrin&#x27;s sedimentation equilibrium and displacement measurements.",
    );
  });

  /*
   * A check against the world reads as the journey's result, not a form (dispatch 276). It was a
   * box holding boxes, under a red monospace "CHECK IT AGAINST THE WORLD", with the paper's value
   * in red monospace and a red "Post-1904 Experimental Resolution"; and it printed the build's names
   * to the reader: the later record's id ("#perrin-1908-data"), the constant set's id
   * ("constants: ..."), and, without a live panel, the quantity id.
   */
  test("the build's ids are kept out of the text", () => {
    const words = text(renderToStaticMarkup(<WorldCheck check={worldCheck} />));
    expect(words).not.toContain("#perrin-1908-data");
    expect(words).not.toContain("avogadroNumber");
    expect(words).not.toContain("constants:");
  });

  test("it is one container, styled by its stylesheet, with nothing in the accent", () => {
    const html = renderToStaticMarkup(<WorldCheck check={worldCheck} />);
    expect(html).not.toContain("style=");
    expect(html).toContain('class="journey-world-check"');
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "journeySkeleton.css"),
      "utf8",
    );
    const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, selector, body]) => ({
      selector: (selector ?? "").replace(/\/\*[\s\S]*?\*\//g, "").trim(),
      body: body ?? "",
    }));
    const own = rules.filter((r) => /\.journey-world-check\b/.test(r.selector));
    expect(own.length).toBeGreaterThan(0);
    for (const r of own) expect(r.body, r.selector).not.toContain("--accent");
    for (const r of own.filter((x) => /^\.journey-world-check\s*[\s>]\s*\S/.test(x.selector)))
      expect(/\b(border(-[a-z]+)?|background|box-shadow)\s*:/.test(r.body), r.selector).toBe(false);
  });
});
