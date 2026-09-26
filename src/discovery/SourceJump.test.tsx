import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { SourceJump } from "./SourceJump.tsx";
import { FIXTURE_JOURNEY_BROWNIAN } from "./testing/fixtureJourney.ts";

describe("SourceJump component rendering", () => {
  const jump = FIXTURE_JOURNEY_BROWNIAN.sourceJumps[0];
  if (!jump) throw new Error("Missing sourceJumps fixture");

  test("renders jump label, pointer text, and correct href to the paper section", () => {
    const html = renderToStaticMarkup(<SourceJump jump={jump} />);

    expect(html).toContain("Read Section 4: On the movement of suspended particles");
    expect(html).toContain(
      "This is where the paper connects the diffusion coefficient to osmotic pressure.",
    );
    expect(html).toContain('href="/papers/brownian-motion/s4/#s4-p1"');
    expect(html).toContain("pred-bm-diffusion");
  });

  /*
   * A pointer into the paper reads as a note in the margin, not a warning (dispatch 276). It was a
   * box ringed in the accent with a red monospace "IN THE 1905 PAPER" and a red-bordered button,
   * 3 to 4 times on each journey (the most red on light quanta's page after the forks), and it
   * printed the build's weave predicate id ("predicate: pred-...") to the reader.
   */
  const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  test("the weave predicate is kept for the build, not printed to the reader", () => {
    const html = renderToStaticMarkup(<SourceJump jump={jump} />);
    expect(html).toContain('data-weave-predicate="pred-bm-diffusion"');
    expect(text(html)).not.toContain("pred-bm-diffusion");
    expect(text(html)).not.toContain("predicate:");
  });

  test("it is styled by its stylesheet, draws no accent, and its way into the paper is a link", () => {
    const html = renderToStaticMarkup(<SourceJump jump={jump} />);
    expect(html).not.toContain("style=");
    expect(html).toContain('class="source-jump"');
    expect(html).not.toContain('class="button"');
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "journeySkeleton.css"),
      "utf8",
    );
    const rules = [...css.matchAll(/(\.source-jump[^{]*)\{([^}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(0);
    for (const [, selector, body] of rules)
      expect(`${selector}{${body}}`).not.toContain("--accent");
  });
});
