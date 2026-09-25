import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadFirstPages } from "../components/home/firstPages.ts";
import { loadGermanSourceFace } from "../content/editions/germanSourceFace.ts";
import { germanTextCount, germanTextSentences } from "../content/germanTextState.ts";
import type { RouteSlug } from "../content/ids.ts";
import { nameInSentence } from "../content/translationState.ts";
import About from "./about/page";
import Home from "./page";
import Papers from "./papers/page";

/**
 * The top-level pages' status claims follow the records (dispatch 153). Each one used to be a typed
 * sentence that went false when the work moved on: "English translation not started" on all four
 * papers after mass-energy's draft went live, and "None yet: no English translation has been made"
 * on /about. Every expectation below is read from the records a second way - the German faces'
 * own loader, the translation-unit files on disk - never from the helper the page calls.
 */
const ROOT = process.cwd();
const papers = loadFirstPages();
const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&rsquo;/g, "’")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

/** Whether each paper's German face renders, from the loader the German face itself uses. */
const faceRenders = new Map(
  papers.map((p) => [p.slug, loadGermanSourceFace(p.slug as RouteSlug, ROOT) !== null]),
);
/** Which papers have translation units on disk. */
const unitsDir = join(ROOT, "content", "translation-units");
const translated = new Set(
  existsSync(unitsDir)
    ? readdirSync(unitsDir).filter(
        (slug) => readdirSync(join(unitsDir, slug)).filter((f) => f.endsWith(".yaml")).length > 0,
      )
    : [],
);

describe("status claims on the top-level pages follow the records", () => {
  test("guards: the records these tests read are not empty", () => {
    expect(papers.length).toBe(4);
    expect([...faceRenders.values()].some(Boolean)).toBe(true);
  });

  // The badges went (D-2026-09-25-no-review-status-banners): an entry names a layer only when it is
  // missing, which is navigation, and claims no review of any kind.
  test("/papers/: no review badge; an entry names a layer only when it is missing, and claims no review", () => {
    const html = renderToStaticMarkup(<Papers />);
    const text = textOf(html);
    expect(html).not.toContain('<p class="badge">');
    for (const claim of [
      "unreviewed draft",
      "checked by AI agents",
      "English translation reviewed",
      "German text reviewed",
      "in transcription",
    ])
      expect(text).not.toContain(claim);
    expect(text).not.toMatch(/\breviewed\b/);
    // Each missing layer, counted a second way: the English from the unit files on disk, the German
    // only for a paper whose German face does not render.
    const missing = [
      ...html.matchAll(/<p class="notice" data-missing-layers="[^"]*">([^<]*)<\/p>/g),
    ].map((m) => m[1] ?? "");
    for (const line of missing) expect(line).toMatch(/^Not yet available: /);
    expect(missing.filter((line) => line.includes("the English translation")).length).toBe(
      4 - translated.size,
    );
    const noGermanFace = papers.filter((p) => !faceRenders.get(p.slug)).length;
    expect(missing.filter((line) => line.includes("the German text")).length).toBeLessThanOrEqual(
      noGermanFace,
    );
  });

  test("the home page names every paper whose German face does not render as still being transcribed, and no other", () => {
    const text = textOf(renderToStaticMarkup(<Home />));
    for (const paper of papers) {
      const transcribing = text.includes(
        `The ${nameInSentence(paper.title)} paper is still being transcribed`,
      );
      expect({ paper: paper.slug, transcribing }).toEqual({
        paper: paper.slug,
        transcribing: !faceRenders.get(paper.slug),
      });
    }
    const set = [...faceRenders.values()].filter(Boolean).length;
    const words = ["none", "one", "two", "three", "four"];
    expect(text).toContain(`The German text is set for ${words[set]} of the four`);
  });

  test("/about/ gives the translation's state from the units, not 'None yet'", () => {
    const text = textOf(renderToStaticMarkup(<About />));
    if (translated.size > 0) {
      expect(text).not.toContain("no English translation has been made");
      expect(text).toContain("The English translation has begun");
    } else {
      expect(text).toContain("The English translation has not been started");
    }
  });
});

describe("the German-text sentences say each state plainly", () => {
  const four = (states: readonly string[]) =>
    ["Light quanta", "Brownian motion", "Special relativity", "Mass and energy"].map(
      (title, i) => ({
        title,
        state: states[i] as "reviewed" | "draft" | "in-transcription" | "not-started",
      }),
    );

  test("drafts are called drafts, transcription and not-started are named, Brownian keeps its capital", () => {
    const s = germanTextSentences(four(["draft", "draft", "in-transcription", "draft"]));
    expect(s).toContain(
      "The German text is set, as unreviewed drafts, for the light quanta, Brownian motion and mass and energy papers.",
    );
    expect(s).toContain("The special relativity paper is still being transcribed");
    const t = germanTextSentences(four(["reviewed", "not-started", "draft", "draft"]));
    expect(t).toContain("The German text of the light quanta paper is set and reviewed.");
    expect(t).toContain("The German text of the Brownian motion paper has not been started.");
  });

  test("the caption counts what is set, and says how many are reviewed", () => {
    expect(germanTextCount(four(["draft", "draft", "in-transcription", "draft"]))).toBe(
      "The German text is set for three of the four, as unreviewed drafts.",
    );
    expect(germanTextCount(four(["reviewed", "draft", "draft", "draft"]))).toBe(
      "The German text is set for four of the four, 1 of them reviewed.",
    );
  });
});
