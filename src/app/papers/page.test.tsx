import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { loadFirstPages } from "../../components/home/firstPages.ts";
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
    expect(html).toContain(
      "a particle visible under a microscope and suspended in a liquid at rest",
    );
    // Read from the rendered entry. This used to check a string typed into the test, which was
    // already a different sentence from the page's and could not fail whatever the page said.
    const entry =
      html
        .split('<li class="paper-entry">')
        .find((e) => e.includes("Also known as: Brownian motion.")) ?? "";
    const heading = /<h2 class="paper-entry-title">([\s\S]*?)<\/h2>/.exec(entry)?.[1] ?? "";
    const scope = /<\/h2>(?:[\s\S]*?<\/details>)?\s*<p>([\s\S]*?)<\/p>/.exec(entry)?.[1] ?? "";
    // Both must be found, or the check below would pass on two empty strings.
    expect(heading).toContain("On the Motion of Small Particles");
    expect(scope.length).toBeGreaterThan(20);
    expect(`${heading} ${scope}`.toLowerCase()).not.toContain("brownian");
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

  test("the first-encounter anchor is offered as a labelled link", () => {
    // ASSERT THE PROPERTY, NOT THE WORDING. This used to require the literal label "Show me one
    // example first" beside the href. That label was first-person marketing register and the
    // de-slop pass replaced it with "Start with one worked example", which broke this test
    // although the thing it protects - that the real first-encounter anchor is reachable from a
    // link a reader can see - had not changed. A copy-verbatim assertion does not merely go
    // stale; it actively resists the campaign that is meant to improve the copy.
    const anchor =
      /<a[^>]*href="\/papers\/brownian-motion\/#entry-brownian-motion"[^>]*>([^<]*)<\/a>/.exec(
        html,
      );
    expect(anchor, "the first-encounter anchor must be rendered as an <a>").not.toBeNull();
    expect((anchor?.[1] ?? "").trim().length).toBeGreaterThan(0);
  });

  test("the German title is still present as an identifier (unchanged)", () => {
    expect(html).toContain('lang="de"');
  });

  test("renders no script tags: works without JavaScript", () => {
    expect(html).not.toContain("<script");
  });
});

describe("Papers index: the companion is presented as a companion, outside the four", () => {
  test("the companion section names the molecular-dimensions record and does not appear in the four-paper catalogue", () => {
    // The old assertion required the heading "A companion, not a fifth flagship" verbatim. That
    // heading was a not-X reversal and the de-slop pass replaced it, which broke a test whose
    // subject is a STRUCTURAL claim: the dissertation is a companion and is not one of the four.
    // The wording of the heading was never the thing being protected.
    // The container is found by either of its two shapes (a div of <article>s, then an <ol> of
    // .paper-entry items when each entry gained its first page); the claim is the count, not the
    // markup.
    const catalogue =
      /<(div|ol) class="paper-(?:catalogue|index)">([\s\S]*?)<\/\1><section/.exec(html)?.[2] ?? "";
    expect(
      catalogue.match(/<article>|<li class="paper-entry">/g)?.length,
      "the catalogue holds exactly four papers",
    ).toBe(4);
    expect(catalogue.toLowerCase()).not.toContain("molecular-dimensions");

    // The section may carry more classes than "reading" (page-flush sets it on the page's left
    // edge); the claim is what the section holds, not how it is laid out.
    const companion =
      /<section class="reading(?: [^"]*)?">([\s\S]*?)<\/section>/.exec(html)?.[1] ?? "";
    expect(companion.toLowerCase()).toContain("molecular-dimensions");
    expect(companion.toLowerCase()).toContain("companion");
  });
});

describe("Papers index: every entry can be chosen without knowing its name", () => {
  // am-design-papers-index-afnu: each entry leads with its English working title and a plain
  // scope sentence, and names the paper conventionally only after them (TanElk's ruling,
  // dispatch 99, extended the Brownian order check above to all four).
  const entries = html.split('<li class="paper-entry">').slice(1);
  const receipts = loadFirstPages();
  const expected = [
    { name: "Light quanta", key: "ap-17-132" },
    {
      name: "Brownian motion",
      title:
        "On the Motion of Small Particles Suspended in Liquids at Rest, as Required by the Molecular-Kinetic Theory of Heat",
    },
    { name: "Special relativity", key: "ap-17-891" },
    { name: "Mass and energy", key: "ap-18-639" },
  ].map((paper) => ({
    ...paper,
    title: paper.title ?? receipts.find((p) => p.key === paper.key)?.workingTitle ?? "",
  }));

  test("there are four entries, in the order the journal received the papers", () => {
    expect(entries).toHaveLength(4);
    expected.forEach(({ name }, i) => {
      expect(entries[i], name).toContain(`Also known as: ${name}.`);
    });
  });

  test("each entry's heading is its working title, then its scope, then its conventional name", () => {
    expected.forEach(({ name, title }, i) => {
      const entry = entries[i] ?? "";
      expect(title.length, name).toBeGreaterThan(0);
      const heading = /<h2 class="paper-entry-title">([\s\S]*?)<\/h2>/.exec(entry)?.[1] ?? "";
      expect(heading, name).toBe(title.replaceAll("&", "&amp;").replaceAll("'", "&#x27;"));
      const scope = /<\/h2>(?:[\s\S]*?<\/details>)?\s*<p>([\s\S]*?)<\/p>/.exec(entry)?.[1] ?? "";
      expect(scope.length, `${name}: a scope sentence follows the heading`).toBeGreaterThan(20);
      expect(entry.indexOf(heading)).toBeLessThan(entry.indexOf(scope));
      expect(entry.indexOf(scope)).toBeLessThan(entry.indexOf(`Also known as: ${name}.`));
      // Neither the heading nor the scope sentence needs the name to identify the paper.
      expect(`${heading} ${scope}`.toLowerCase(), name).not.toContain(name.toLowerCase());
    });
  });
});

describe("Papers index: the other three entries are named by the site's names", () => {
  // Each entry names its paper the way the rest of the site does. Where on the entry that name
  // sits (heading, or after the working title) is the order test's business, not this one's.
  test("Light quanta, Special relativity, and Mass and energy are named on their entries", () => {
    const entries = html.split('<li class="paper-entry">').slice(1);
    for (const name of ["Light quanta", "Special relativity", "Mass and energy"]) {
      expect(
        entries.filter((entry) => entry.includes(name)).length,
        `an entry names ${name}`,
      ).toBeGreaterThan(0);
    }
  });
});

describe("Papers index: every internal page link carries the trailing slash", () => {
  test("no link on the index answers with a 308 before its page loads", () => {
    // The site exports with trailingSlash: true. On 2026-09-24 the index's "Start with one worked
    // example" pointed at /papers/brownian-motion#entry-brownian-motion, a redirect; the lab and
    // embed sweep (src/testing/labLinksTrailingSlash.test.tsx) does not render this page.
    const links = [...html.matchAll(/href="(\/[^"#?]*)([#?][^"]*)?"/g)].map((m) => m[1] ?? "");
    expect(links.length).toBeGreaterThan(4);
    const slashless = links.filter(
      (path) => path !== "/" && !/\.[a-z0-9]+$/i.test(path) && !path.endsWith("/"),
    );
    expect(slashless).toEqual([]);
  });
});
