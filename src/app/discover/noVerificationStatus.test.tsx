/**
 * No Discover page shows verification-status copy (dispatch 243; the owner's
 * D-2026-09-25-no-review-status-banners).
 *
 * Every shelf card on the four journeys said "Awaiting verification · Source verification pending
 * library scan inspection", and each shelf's footnote said the shelf "marks each card as awaiting
 * verification". That is the category the owner ruled out, and the sweep that removed the review
 * banners searched for "review" and missed "verification". A card's verification record stays in
 * the data as the audit trail (src/content/*Shelf.ts, checked by publicationGate); only the reader
 * copy goes.
 *
 * The check is an allowlist, not a list of banned sentences: every visible "verif…", "pending" or
 * "awaiting" on these pages must sit in a phrase named below, so a status line in new words fails
 * too. The allowed phrases are not status copy: one states a model's assumptions, one is the
 * investigation's execution state.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;
/** Every Discover route that renders a knowledge card, a shelf, or a world check. */
const PAGES = [
  "page.tsx",
  ...PAPERS.flatMap((p) => [`${p}/page.tsx`, `${p}/investigate/page.tsx`]),
] as const;

const STATUS_WORD = /\b(?:un)?verif\w*|\bpending\b|\bawaiting\b/gi;
/** Phrases that carry a status word and are not status copy, each with its reason. */
const ALLOWED: readonly Readonly<{ phrase: RegExp; why: string }>[] = [
  {
    phrase: /assumed, not verified from fluid and particle data/,
    why: "TracerLab's list of the model's assumptions: what the model takes for granted",
  },
  {
    phrase: /Awaiting a completed result/,
    why: "the Brownian investigation's execution state before its first result",
  },
];

/** The page's visible text: no script, style or MathML annotation, tags as spaces. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, " ")
    .replace(/<annotation\b[\s\S]*?<\/annotation>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#x?[0-9a-f]+;/gi, " ")
    .replace(/\s+/g, " ");
}

/** Each status word in the text that no allowed phrase accounts for, with its context. */
export function statusCopy(text: string): string[] {
  const covered: [number, number][] = [];
  for (const { phrase } of ALLOWED)
    for (const m of text.matchAll(new RegExp(phrase.source, "g")))
      covered.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  const found: string[] = [];
  for (const m of text.matchAll(STATUS_WORD)) {
    const at = m.index ?? 0;
    if (covered.some(([a, b]) => at >= a && at < b)) continue;
    found.push(`…${text.slice(Math.max(0, at - 60), at + 60).trim()}…`);
  }
  return found;
}

async function render(page: string): Promise<string> {
  const mod = (await import(`./${page}`)) as { default: () => unknown };
  return visibleText(renderToStaticMarkup((await mod.default()) as never));
}

describe("the status-copy scan reads what it is pointed at", () => {
  test("it finds the label the shelf cards carried, and in other words too", () => {
    // One finding per status word: "Awaiting verification" is two.
    expect(statusCopy("Mém. Acad. Sci. 5, 339 (1826) Awaiting verification")).toHaveLength(2);
    expect(statusCopy("Source verification pending library scan inspection.")).toHaveLength(2);
    expect(statusCopy("Verified against original source by a reader")).toHaveLength(1);
    expect(statusCopy("This card is unverified.")).toHaveLength(1);
  });

  test("it passes the allowed phrases, and a word inside another word", () => {
    expect(statusCopy("assumed, not verified from fluid and particle data")).toEqual([]);
    expect(statusCopy("Awaiting a completed result")).toEqual([]);
    expect(statusCopy("the energy depending on the kind of light")).toEqual([]);
  });
});

describe("no Discover page shows verification-status copy", () => {
  for (const page of PAGES)
    test(`/discover/${page.replace(/page\.tsx$/, "")}`, async () => {
      const text = await render(page);
      // A page that rendered nothing would pass; the smallest, the index, has about 3,700 characters.
      expect(text.length).toBeGreaterThan(1000);
      expect(statusCopy(text)).toEqual([]);
    });

  test("the journeys still render their shelves, so the pages above were read with cards on them", async () => {
    for (const paper of PAPERS) {
      const html = renderToStaticMarkup(
        (await (
          (await import(`./${paper}/page.tsx`)) as { default: () => unknown }
        ).default()) as never,
      );
      expect(html).toMatch(/data-card-id="/);
    }
  });
});
