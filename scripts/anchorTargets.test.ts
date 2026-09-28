/**
 * THE ANCHOR SWEEP, AND THE TWO TRAPS IT HAS TO SURVIVE (am-rel-candidate-checks-kc7y).
 *
 * A link to `/papers/x/#arg-foo` on a page with no `arg-foo` is HTTP 200 and broken for the reader.
 * This check exists because nothing else asks that question, and it earns its place on an observed
 * defect class: 8 of 8 fragment links on the live mass-energy capstone were broken this morning.
 *
 * TRAP ONE, AND IT NEARLY COST ME A FALSE FINDING WHILE VERIFYING THIS CHECK'S OWN OUTPUT. On the
 * relativity parallel face, `id="s1-fn1"` appears three times and NONE of them is an id attribute:
 * they are `data-footnote-id`, `data-translation-unit-id` and `data-unit-id`. An unanchored grep
 * says the anchor exists and a reader still lands at the top. `anchorIds` requires whitespace
 * before `id=` for exactly this reason, and the first test below is that case.
 *
 * TRAP TWO is the one the hand sweep hit: a trailing-slash rule that reads a dotted tail as a file
 * extension drops `/tapes/the-boost-to-0.6c`, whose id ends `.6c`. The path is taken exactly as the
 * document wrote it, and the test keeps that honest.
 */
import { describe, expect, test } from "bun:test";
import {
  anchorIds,
  describeSweep,
  fragmentLinks,
  sitemapRoutes,
  sweepAnchors,
} from "./anchorTargets.ts";
import {
  assertUniqueCheckNames,
  CandidateCheckRegistrationError,
  type Fetched,
  type Fetcher,
  fragmentAnchorsResolve,
} from "./candidate-checks.ts";

/** A site in a map: path -> HTML. Anything absent is a 404, as a server would answer. */
function siteFetcher(pages: Record<string, string>): Fetcher {
  return async (path: string): Promise<Fetched> => {
    const body = pages[path];
    return body === undefined
      ? { status: 404, body: Buffer.from("") }
      : { status: 200, body: Buffer.from(body, "utf8") };
  };
}

function sitemapOf(paths: readonly string[]): string {
  return `<?xml version="1.0"?><urlset>${paths
    .map((p) => `<loc>https://annus-mirabilis.com${p}</loc>`)
    .join("")}</urlset>`;
}

describe("reading ids off a page", () => {
  test("a data-*-id carrying the value is NOT an anchor", () => {
    const html =
      '<li data-footnote-id="s1-fn1" data-unit-id="s1-fn1" class="footnote-item">note</li>';
    const ids = anchorIds(html);
    expect(ids.has("s1-fn1")).toBe(false);
    // Both directions: a real id attribute on the same page IS found.
    expect(anchorIds(`${html}<div id="s1-fn1"></div>`).has("s1-fn1")).toBe(true);
  });

  test("a legacy name anchor counts, and an id elsewhere in the document does too", () => {
    expect(anchorIds('<a name="old-anchor"></a>').has("old-anchor")).toBe(true);
    expect(anchorIds('<section class="x" id="arg-me-1">').has("arg-me-1")).toBe(true);
  });
});

describe("collecting fragment links", () => {
  test("an id ending in a dot-digit survives, because the path is not parsed as a filename", () => {
    const links = fragmentLinks('<a href="/tapes/the-boost-to-0.6c#step-2">x</a>', "/papers/a/");
    expect(links).toHaveLength(1);
    expect(links[0]?.target).toBe("/tapes/the-boost-to-0.6c");
    expect(links[0]?.fragment).toBe("step-2");
  });

  test("a bare fragment targets its own page, and a relative href resolves against it", () => {
    const links = fragmentLinks('<a href="#arg-1">a</a><a href="../b/#arg-2">b</a>', "/papers/a/");
    expect(links[0]?.target).toBe("/papers/a/");
    expect(links[1]?.target).toBe("/papers/b/");
  });

  test("what is not a claim about an id on this site is excluded", () => {
    const html =
      '<a href="https://example.com/x#y">ext</a><a href="mailto:a@b.c#z">m</a><a href="#">top</a><a href="//other.example/p#q">proto</a>';
    expect(fragmentLinks(html, "/papers/a/")).toEqual([]);
  });
});

describe("the sweep and the candidate check", () => {
  const good = {
    "/sitemap.xml": sitemapOf(["/a/", "/b/"]),
    "/a/": '<a href="/b/#target-one">go</a><a href="#here">self</a><div id="here"></div>',
    "/b/": '<h2 id="target-one">One</h2>',
  };

  test("a sweep reports what it examined, not only what it found", () => {
    const sweep = { pages: 2, pairs: 7, distinct: 5, targets: 3, broken: [], unreachable: [] };
    const line = describeSweep(sweep);
    expect(line).toContain("7 fragment links");
    expect(line).toContain("5 distinct");
    expect(line).toContain("3 target pages");
    expect(line).toContain("0 broken");
  });

  test("anchors that resolve are found to resolve", async () => {
    const sweep = await sweepAnchors(siteFetcher(good), ["/a/", "/b/"]);
    expect(sweep.broken).toEqual([]);
    expect(sweep.pairs).toBe(2);
    expect(sweep.distinct).toBe(2);
  });

  test("PLANTED: one fragment that does not exist refuses promotion, by name", async () => {
    const planted = { ...good, "/b/": '<h2 id="target-renamed">One</h2>' };
    const result = await fragmentAnchorsResolve(siteFetcher(planted));
    expect(result.name).toBe("fragment-anchors-resolve");
    // It fails for the floor here rather than the break, because this fixture is tiny; the sweep
    // itself is what must name the broken pair, and it does.
    const sweep = await sweepAnchors(siteFetcher(planted), ["/a/", "/b/"]);
    expect(sweep.broken).toHaveLength(1);
    expect(sweep.broken[0]?.target).toBe("/b/");
    expect(sweep.broken[0]?.fragment).toBe("target-one");
    expect(describeSweep(sweep)).toContain("/a/ -> /b/#target-one");
    expect(result.status).toBe("failed");
  });

  test("a sweep that examined almost nothing FAILS rather than reporting a clean site", async () => {
    // The non-vacuity floor. An href pattern that collects nothing produces the cleanest possible
    // result, which is why zero is a failure and not a pass.
    const empty = { "/sitemap.xml": sitemapOf(["/a/"]), "/a/": "<p>no links at all</p>" };
    const result = await fragmentAnchorsResolve(siteFetcher(empty));
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("examined too little");
  });

  test("no sitemap means nothing was checked, and says so", async () => {
    const result = await fragmentAnchorsResolve(siteFetcher({}));
    expect(result.status).toBe("failed");
    expect(result.detail).toContain("sitemap.xml");
  });

  test("a route list is read from the sitemap in either URL form", () => {
    expect(sitemapRoutes(sitemapOf(["/a/", "/b/"]))).toEqual(["/a/", "/b/"]);
    expect(sitemapRoutes("<urlset><loc>/relative/</loc></urlset>")).toEqual(["/relative/"]);
    expect(sitemapRoutes("<urlset></urlset>")).toEqual([]);
  });
});

describe("registering a candidate check", () => {
  const result = (name: string) => ({ name, status: "passed" as const, detail: "" });

  test("a duplicate id is refused by a typed code, not a bare Error", () => {
    // The refusal this guard exists for, driven rather than left to a mistake. 24d51b7a threw a
    // bare Error here, which refused a deploy at the fast-gate ratchets because the file carries no
    // refusal baseline; a candidate check that refuses a promotion has to say which check failed.
    let thrown: unknown;
    try {
      assertUniqueCheckNames([result("a"), result("b"), result("a")]);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CandidateCheckRegistrationError);
    expect((thrown as CandidateCheckRegistrationError).code).toBe("duplicate-candidate-check-id");
    // The reader-facing words name the offending id, so a log says what to fix.
    expect((thrown as Error).message).toContain("a");
    expect((thrown as Error).message).toContain("Every check registers one name");
  });

  test("distinct ids are accepted, so the guard is not simply always throwing", () => {
    expect(() => assertUniqueCheckNames([result("a"), result("b")])).not.toThrow();
    expect(() => assertUniqueCheckNames([])).not.toThrow();
  });
});
