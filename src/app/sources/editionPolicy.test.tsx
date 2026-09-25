import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadFirstPages } from "../../components/home/firstPages.ts";
import { translationSentence, translationState } from "../../content/translationState.ts";
import About from "../about/page";
import Home from "../page";
import Sources from "./page";

/**
 * The edition's policy on its sources, stated on /sources/, and the English translation's state,
 * counted from content/translation-units on every page that mentions it (dispatch 150, item 3).
 * Three pages said "The English translation has not been started" after 43 machine-drafted units
 * of the mass-energy paper went live.
 */
const ROOT = process.cwd();
const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/\s+/g, " ");
const names = new Map(loadFirstPages().map((paper) => [paper.slug, paper.title]));

describe("the edition's policy on its sources", () => {
  const html = renderToStaticMarkup(<Sources />);
  const start = html.indexOf('id="edition-policy"');
  const policy = textOf(html.slice(start, html.indexOf("</section>", start)));

  test("/sources/ states its rules plainly, with one line on who made the translation", () => {
    expect(start).toBeGreaterThan(-1);
    expect(policy).toContain("The English translation is the edition’s own, made from the German");
    expect(policy).toContain("Published translations are cited only as comparison witnesses");
    // D-2026-09-25-no-review-status-banners: one plain, factual line on who made the translation,
    // and no review tally. "A machine draft is labelled as a draft wherever it appears" went too:
    // no face labels one any more, so it would be false.
    expect(policy).toContain(
      "AI agents made the English translation from the German, and agents other than its translator checked each passage against the German in two rounds.",
    );
    expect(policy).not.toContain("labelled as a draft");
    expect(policy).not.toContain("wherever it appears");
    // The honesty rule holds: nothing claims a person's review.
    expect(policy).not.toMatch(/reviewed by (?:a person|[A-Z])/);
    expect(policy).not.toContain("—");
  });
});

describe("the translation's state is counted from its units", () => {
  const state = translationState(ROOT);

  test("the count matches the unit files, read a second way", () => {
    // Independent of translationState's YAML parse: count the files and their review lines.
    const dir = join(ROOT, "content", "translation-units");
    for (const paper of state) {
      const files = readdirSync(join(dir, paper.slug)).filter((f) => f.endsWith(".yaml"));
      const texts = files.map((f) => readFileSync(join(dir, paper.slug, f), "utf8"));
      expect(paper.units).toBe(texts.filter((t) => /^kind: "?translation-unit"?$/m.test(t)).length);
      expect(paper.machineDrafts).toBe(
        texts.filter((t) => /^reviewState: "?machine-draft"?$/m.test(t)).length,
      );
      expect(paper.reviewed).toBe(
        texts.filter((t) => /^reviewState: "?reviewed"?$/m.test(t)).length,
      );
      expect(paper.byModel).toBe(
        texts.filter((t) => /^translator:\n(?: {2}.*\n)*? {2}kind: "?model"?$/m.test(t)).length,
      );
      expect(paper.agentChecked).toBe(
        texts.filter((t) => /^reviewState: "?reviewed"?$/m.test(t) && /^agentReview:$/m.test(t))
          .length,
      );
    }
  });

  test("/sources/ carries no review tally; /about/ and the home page carry the counted sentence, and none the stale one", () => {
    const sentence = translationSentence(state, names);
    const sources = textOf(renderToStaticMarkup(<Sources />));
    expect(sources).not.toContain(sentence);
    expect(sources).not.toContain("How far the text has got");
    for (const [page, html] of [
      ["/about/", renderToStaticMarkup(<About />)],
      ["/", renderToStaticMarkup(<Home />)],
    ] as const) {
      const text = textOf(html);
      expect({ page, counted: text.includes(sentence) }).toEqual({ page, counted: true });
      if (state.length > 0) {
        expect({ page, stale: text.includes("has not been started") }).toEqual({
          page,
          stale: false,
        });
      }
    }
  });

  // It says which papers the English covers and which it does not yet, and nothing of who drafted
  // or checked it (D-2026-09-25-no-review-status-banners): the records keep that.
  test("the sentence says which papers have English, in the journal's order, and nothing of review", () => {
    expect(translationSentence([], names)).toBe("The English translation has not been started.");
    const one = translationSentence(
      [{ slug: "mass-energy", units: 43, machineDrafts: 40, reviewed: 3 }],
      names,
    );
    expect(one).toBe(
      "The English translation covers the mass and energy paper; the light quanta, Brownian motion and special relativity papers have none yet.",
    );
    const all = translationSentence(
      ["special-relativity", "mass-energy", "light-quanta", "brownian-motion"].map((slug) => ({
        slug,
        units: 10,
        machineDrafts: 0,
        reviewed: 10,
        byModel: 10,
        agentChecked: 10,
      })),
      names,
    );
    expect(all).toBe(
      "The English translation covers the light quanta, Brownian motion, special relativity and mass and energy papers.",
    );
    for (const s of [one, all]) expect(s).not.toMatch(/review|draft|machine|AI agents|person/);
  });
});
