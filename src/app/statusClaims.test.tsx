import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadFirstPages } from "../components/home/firstPages.ts";
import { germanTextCount, germanTextSentences } from "../content/germanTextState.ts";
import { nameInSentence } from "../content/translationState.ts";
import { PaperPage } from "../reader/PaperPage.tsx";
import { exportMarkup } from "../testing/exportMarkup.ts";
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

/**
 * Whether each paper's German face renders its whole text, read from the face itself: German prose,
 * and none of the notices it prints when something is missing (sections it does not reach,
 * printed pages not yet transcribed, or no text at all). This used to ask the ledger loader, which
 * relativity does not use: its face renders its source blocks, all 31 pages of them, while the home
 * page said it was "still being transcribed".
 */
const germanFaceSet = new Map<string, boolean>();
for (const p of papers) {
  const html = await exportMarkup(await PaperPage({ paperId: p.slug, face: "german" } as never));
  const hasText = /data-german-draft|data-source-body/.test(html) && /[äöüßÄÖÜ]/.test(html);
  const lacks = /data-missing-sections=|data-untranscribed-pages=|is not yet available/.test(html);
  germanFaceSet.set(p.slug, hasText && !lacks);
}
/** Whether the German face renders anything at all. */
const faceRenders = germanFaceSet;
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

  test("the home page calls a paper's German set exactly when its German face renders it whole", () => {
    const text = textOf(renderToStaticMarkup(<Home />));
    const setSentence = /The German text is set for the ([^.]+?) papers?\./.exec(text)?.[1] ?? "";
    for (const paper of papers) {
      const name = nameInSentence(paper.title);
      const transcribing = text.includes(`The ${name} paper is still being transcribed`);
      const named = setSentence.includes(name);
      const set = germanFaceSet.get(paper.slug) ?? false;
      expect({ paper: paper.slug, named, transcribing }).toEqual({
        paper: paper.slug,
        named: set,
        transcribing: !set,
      });
    }
    // Non-vacuity: at least one face was measured whole, so "named" was a real test.
    expect([...germanFaceSet.values()].some(Boolean)).toBe(true);
  });

  test("the first-pages caption counts the German faces that render their text whole", () => {
    const text = textOf(renderToStaticMarkup(<Home />));
    const set = [...germanFaceSet.values()].filter(Boolean).length;
    const words = ["none", "one", "two", "three", "four"];
    expect(text).toContain(`The German text is set for ${words[set]} of the four.`);
  });

  test("the mass-energy caption says its pages are set only when its German face renders them", () => {
    const text = textOf(renderToStaticMarkup(<Home />));
    const pages = papers.find((p) => p.slug === "mass-energy")?.pages ?? 0;
    const words = ["no", "one", "two", "three", "four", "five"];
    const claimed = text.includes(`all ${words[pages]} pages are set`);
    expect(claimed).toBe(germanFaceSet.get("mass-energy") ?? false);
  });

  test("/about/: the license names the translation as it exists", () => {
    const text = textOf(renderToStaticMarkup(<About />));
    // The translation exists (its unit files, read directly), so it is not "in time".
    expect(translated.size).toBeGreaterThan(0);
    expect(text).not.toContain("in time the translation");
    expect(text).toContain("the code and the translation");
  });

  test("/about/: an instrument's share link carries its settings, as the lab code does", () => {
    const text = textOf(renderToStaticMarkup(<About />));
    // Read from the lab code itself: the laboratories that restore a shared ?tape= link.
    const labDir = join(ROOT, "src", "components", "lab");
    const labFiles = readdirSync(labDir, { recursive: true }).filter(
      (f): f is string => typeof f === "string" && /\.tsx$/.test(f) && !/\.test\./.test(f),
    );
    const restoring = labFiles.filter((f) =>
      readFileSync(join(labDir, f), "utf8").includes("?tape="),
    ).length;
    expect(restoring).toBeGreaterThan(0);
    expect(text).not.toContain("cannot yet carry the settings");
    expect(text).toContain("that link carries the settings");
  });

  test("/about/: a printed equation can be linked, and the example anchor lands on its German face", async () => {
    const text = textOf(renderToStaticMarkup(<About />));
    expect(text).not.toContain("cannot yet be linked");
    const example = /\/papers\/([a-z-]+)\/view\/german\/#(eq-[a-z0-9-]+)/.exec(text);
    expect(example).not.toBeNull();
    const [, paperId, anchor] = example ?? [];
    const face = await exportMarkup(await PaperPage({ paperId, face: "german" } as never));
    expect(face).toContain(` id="${anchor}"`);
  });

  test("/about/ gives the translation's state from the units, not 'None yet'", () => {
    const text = textOf(renderToStaticMarkup(<About />));
    if (translated.size > 0) {
      expect(text).not.toContain("no English translation has been made");
      expect(text).toContain("The English translation covers the");
      // What the site holds, and nothing of review (D-2026-09-25-no-review-status-banners).
      expect(text).not.toMatch(/checked against the German by AI agents|none by a person/);
    } else {
      expect(text).toContain("The English translation has not been started");
    }
  });
});

// They say which papers have their German text and which do not yet, and nothing of review
// (D-2026-09-25-no-review-status-banners): a reviewed text and a draft are both "set".
describe("the German-text sentences say each state plainly", () => {
  const four = (states: readonly string[]) =>
    ["Light quanta", "Brownian motion", "Special relativity", "Mass and energy"].map(
      (title, i) => ({
        title,
        state: states[i] as "reviewed" | "draft" | "in-transcription" | "not-started",
      }),
    );

  test("set papers are named without review, transcription and not-started are named, Brownian keeps its capital", () => {
    const s = germanTextSentences(four(["draft", "draft", "in-transcription", "draft"]));
    expect(s).toContain(
      "The German text is set for the light quanta, Brownian motion and mass and energy papers.",
    );
    expect(s).toContain("The special relativity paper is still being transcribed");
    // A reviewed text reads exactly as a draft does: set, and no more.
    const t = germanTextSentences(four(["reviewed", "not-started", "draft", "draft"]));
    expect(t).toContain(
      "The German text is set for the light quanta, special relativity and mass and energy papers.",
    );
    expect(t).toContain("The German text of the Brownian motion paper has not been started.");
    for (const sentence of [s, t]) expect(sentence).not.toMatch(/review|draft/);
  });

  test("the caption counts what is set, and says nothing of review", () => {
    expect(germanTextCount(four(["draft", "draft", "in-transcription", "draft"]))).toBe(
      "The German text is set for three of the four.",
    );
    expect(germanTextCount(four(["reviewed", "draft", "draft", "draft"]))).toBe(
      "The German text is set for four of the four.",
    );
  });
});
