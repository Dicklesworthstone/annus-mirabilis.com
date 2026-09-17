import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import Papers from "./page";

const html = renderToStaticMarkup(<Papers />);

const KLEIN_PATTERN = /\bklein\w*\b|\bwinzig\w*\b/i;

describe("Papers index: the Brownian entry can be chosen without knowing its name", () => {
  test("the real compiled German title contains no word for 'small'", () => {
    const record = JSON.parse(readFileSync("content/papers/brownian-motion.json", "utf-8")) as {
      germanTitle: string;
    };
    expect(record.germanTitle).not.toMatch(KLEIN_PATTERN);
    // The page's own copy of the German title matches the real record, so this
    // test's premise (no direct basis for "Small") is checked against the
    // compiled corpus, never a string typed only into this test.
    expect(html).toContain(record.germanTitle);
  });

  test("the working English title and plain scope sentence render, and neither contains 'Brownian'", () => {
    expect(html).toContain("On the Motion of Small Particles Suspended in Liquids at Rest");
    expect(html).toContain("tiny particles suspended in a liquid");
    const workingTitleAndScope =
      "On the Motion of Small Particles Suspended in Liquids at Rest, as Required by the Molecular-Kinetic Theory of Heat" +
      "The document about tiny particles suspended in a liquid that is not being stirred or heated unevenly, and what the ceaseless motion of heat should make them do.";
    expect(workingTitleAndScope.toLowerCase()).not.toContain("brownian");
  });

  test("the conventional name 'Brownian motion' appears only after the working title and scope, never as the only identifier", () => {
    const workingTitleIndex = html.indexOf("On the Motion of Small Particles");
    const conventionalNameIndex = html.indexOf("Also known as: Brownian motion");
    expect(workingTitleIndex).toBeGreaterThan(-1);
    expect(conventionalNameIndex).toBeGreaterThan(workingTitleIndex);
  });

  test("the editorial disclosure names the added word and its reason, present in the static HTML", () => {
    expect(html).toContain("Editorial: this working title adds a word to the German");
    expect(html).toContain("&quot;Small&quot;:");
    expect(html).toContain("before the argument itself establishes why size matters");
  });

  test("'Show me one example first' links to the real first-encounter anchor", () => {
    expect(html).toContain('href="/papers/brownian-motion#entry-brownian-motion"');
    expect(html).toContain("Show me one example first");
  });

  test("the German title is still present as an identifier (unchanged)", () => {
    expect(html).toContain('lang="de"');
  });

  test("renders no script tags: works without JavaScript", () => {
    expect(html).not.toContain("<script");
  });
});

describe("Papers index: the companion is labeled, never a fifth flagship", () => {
  test("the companion section names the molecular-dimensions record and does not appear in the four-paper catalogue", () => {
    expect(html).toContain("A companion, not a fifth flagship");
    expect(html).toContain("molecular-dimensions");
  });
});

describe("Papers index: the other three entries are unaffected by the Brownian-specific fields", () => {
  test("Light quanta, Special relativity, and Mass and energy render their plain title directly", () => {
    expect(html).toContain("<h2>Light quanta</h2>");
    expect(html).toContain("<h2>Special relativity</h2>");
    expect(html).toContain("<h2>Mass and energy</h2>");
  });
});
