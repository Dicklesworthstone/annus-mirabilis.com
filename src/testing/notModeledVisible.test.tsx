import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { notModeledSentence } from "../app/lab/NotModeledLine.tsx";
import { strictParse } from "../content/schemas/strictParse.ts";
import { exportMarkup } from "./exportMarkup.ts";

/**
 * AGENTS.md: an instrument's notModeled is "shown as a plain line". On 2026-09-24 BM-01, BM-04,
 * BM-05 and BM-08 showed their limits nowhere a reader could see without opening a disclosure, and
 * a printed /lab/bm-01 had none (fixed in 0be9b273). The labs without a manifest had the same gap:
 * LQ-02, the Avogadro lab and light-thread kept their limits inside a closed disclosure, and two
 * shelves worded them in ways no one could find (d24d8aec, 2673c1a4, 0fb35e68). Every lab page that
 * renders an instrument root must show a not-modelled statement outside any closed <details>,
 * except the two below, each for a stated reason.
 */
const EXCEPT: Readonly<Record<string, string>> = {
  "bm-07/kitchen/": "no model is run until a reader loads their own observations",
  "what-can-you-infer/":
    "a reasoning workbench whose assumptions are stated in visible prose, not as a model's omissions",
};
const LAB = fileURLToPath(new URL("../app/lab/", import.meta.url));
const MANIFESTS = fileURLToPath(new URL("../../content/experiments/", import.meta.url));
const STATEMENT = /not modell?ed|leaves out/i;

/** HTML with every closed <details> removed, innermost first; an open one stays. */
function withoutClosedDisclosures(html: string): string {
  let previous = "";
  let out = html;
  while (out !== previous) {
    previous = out;
    out = out.replace(/<details\b(?![^>]*\sopen)[^>]*>(?:(?!<details\b)[\s\S])*?<\/details>/g, "");
  }
  return out;
}

describe("a lab shows what it does not model, without a disclosure", () => {
  test("closed disclosures are removed, nested ones too, and an open one is kept", () => {
    expect(withoutClosedDisclosures("<details><summary>a</summary>Not modeled: x</details>")).toBe(
      "",
    );
    expect(
      withoutClosedDisclosures("<details><details>Not modeled: x</details> y</details>z"),
    ).toBe("z");
    expect(withoutClosedDisclosures("<details open>Not modeled: x</details>")).toContain(
      "Not modeled",
    );
  });

  test("every lab page with an instrument renders a visible not-modelled statement", async () => {
    const pages = (dir: string, base: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const full = `${dir}${name}`;
        if (statSync(full).isDirectory()) return pages(`${full}/`, `${base}${name}/`);
        return name === "page.tsx" ? [base] : [];
      });
    const ids = pages(LAB, "");
    const hidden: string[] = [];
    const slack: string[] = [];
    let instruments = 0;
    let manifestBacked = 0;
    for (const id of ids) {
      const mod = await import(`${LAB}${id}page.tsx`);
      const out = mod.default({ params: Promise.resolve({}), searchParams: Promise.resolve({}) });
      const html = (await exportMarkup(out instanceof Promise ? await out : out)).replace(
        /<!-- -->/g,
        "",
      );
      if (!html.includes("data-instrument-id=")) continue;
      instruments += 1;
      if (existsSync(`${MANIFESTS}${id.replace(/\/$/, "")}.yaml`)) manifestBacked += 1;
      const visible = STATEMENT.test(withoutClosedDisclosures(html));
      if (!visible && !(id in EXCEPT)) hidden.push(id);
      // The exceptions may only shrink: an excepted page that now states its limits leaves the list.
      if (visible && id in EXCEPT) slack.push(id);
    }
    console.log(
      `[not modeled] ${instruments} lab pages with an instrument (${manifestBacked} with a manifest); ${hidden.length} with no visible statement`,
    );
    expect(manifestBacked).toBeGreaterThan(25);
    expect(hidden).toEqual([]);
    expect(slack).toEqual([]);
  });
});

/**
 * THE STATEMENT IS THE MANIFEST'S LIST, ALL OF IT (am-rc1001-bridge-plan-pcjk.26).
 *
 * The test above asks whether a lab states its limits at all. This one asks whether what it states
 * is the manifest's list, the record the audits check. Measured 2026-10-02 by rendering every lab
 * page, 150 of 210 manifest items were shown, and seven labs were short:
 * - lq-01 and sr-03 printed hand-written paraphrases;
 * - bm-07 printed a list in other words;
 * - lq-04 and lq-06 printed constants that had drifted from their manifests;
 * - bm-06 printed its assumptions under the heading "What this model leaves out";
 * - sr-05 kept its list inside the closed model note.
 *
 * WHAT COUNTS AS SHOWN. An item counts as shown when it is one of these, outside any closed
 * disclosure and outside <noscript>:
 * - the whole text of a list item, paragraph or div;
 * - a part of one bounded by "; " or " · " (the joins the labs use).
 * Whole parts and not substrings: an unanchored search found 182 of 210 on the same pages, because
 * short items such as "Gravity" or "Drift" occur in the prose around them. Case and a closing full
 * stop are ignored, because labs that join items into a sentence lower-case them.
 */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.;]\s*$/, "")
    .trim();

function decode(text: string): string {
  return text
    .replace(/&#x27;|&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ge;/g, "≥")
    .replace(/&amp;/g, "&");
}

/** The visible text of every list item, paragraph and div, each normalized, one per element. */
export function shownTexts(html: string): string[] {
  const visible = withoutClosedDisclosures(html)
    .replace(/<noscript\b[\s\S]*?<\/noscript>/g, " ")
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, " ");
  const texts: string[] = [];
  // One pass per tag, because matches never overlap within a pass: a div that holds a list would
  // otherwise swallow its items.
  for (const tag of ["li", "p", "div"])
    for (const [, inner = ""] of visible.matchAll(
      new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "g"),
    ))
      texts.push(
        normalize(
          decode(inner.replace(/<[^>]+>/g, " "))
            .replace(/\s+/g, " ")
            .trim()
            .replace(/^(?:•\s*)?(?:not modeled[^:]*:\s*)?/i, ""),
        ),
      );
  return texts;
}

/**
 * Whether the item is one whole part of one element's text. Bounded rather than split, because an
 * item may itself hold a ";" (sr-05's last item does).
 */
export function isShown(item: string, texts: readonly string[]): boolean {
  const escaped = normalize(item).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bounded = new RegExp(`(?:^|; |· )${escaped}(?:$|;|\\.| ·)`);
  return texts.some((text) => bounded.test(text));
}

function manifestList(id: string): string[] {
  const manifest = strictParse(readFileSync(`${MANIFESTS}${id}.yaml`, "utf8"), "yaml") as {
    notModeled?: unknown;
  };
  return Array.isArray(manifest.notModeled)
    ? manifest.notModeled.filter((x): x is string => typeof x === "string")
    : [];
}

describe("the shown-items reader matches whole items, not words inside prose", () => {
  test("an item in a joined line is found; the same words inside a sentence are not", () => {
    const line = `<p>Not modeled: ${notModeledSentence(["Gravity.", "Drift", "Wall effects"])}</p>`;
    expect(line).toContain("Not modeled: Gravity; Drift; Wall effects.");
    const texts = shownTexts(line);
    for (const item of ["Gravity.", "Drift", "Wall effects"])
      expect(isShown(item, texts)).toBe(true);
    const prose = "<p>Gravity is ignored here, and so is drift near wall effects.</p>";
    expect(isShown("Gravity", shownTexts(prose))).toBe(false);
    expect(isShown("Drift", shownTexts(prose))).toBe(false);
    // An item that itself holds a ";" is still one item.
    const semi = `<p>Not modeled: ${notModeledSentence(["Clocks (one; two)", "Noise"])}</p>`;
    expect(isShown("Clocks (one; two)", shownTexts(semi))).toBe(true);
    // A list item inside a div is read as its own element.
    expect(isShown("Noise", shownTexts("<div><ul><li>Noise</li></ul></div>"))).toBe(true);
  });

  test("a list behind a closed disclosure is not shown; behind an open one it is", () => {
    const list = "<summary>Model</summary><ul><li>Not modeled: gravity</li></ul>";
    expect(isShown("Gravity", shownTexts(`<details>${list}</details>`))).toBe(false);
    expect(isShown("Gravity", shownTexts(`<details open>${list}</details>`))).toBe(true);
  });
});

describe("every laboratory with a manifest shows that manifest's whole notModeled list", () => {
  const ids = readdirSync(MANIFESTS)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => f.slice(0, -".yaml".length))
    .sort();

  test("the population is the manifest directory, and every manifest declares a list", () => {
    // Measured 2026-10-02: 33 manifests, 210 items. A floor, not a census.
    expect(ids.length).toBeGreaterThanOrEqual(33);
    for (const id of ids) expect(manifestList(id).length, id).toBeGreaterThan(0);
  });

  test("each lab page shows every item of its manifest's list", async () => {
    let items = 0;
    const missing: string[] = [];
    for (const id of ids) {
      const page = `${LAB}${id}/page.tsx`;
      expect(existsSync(page), `${id} has a manifest and no page`).toBe(true);
      const mod = await import(page);
      const out = mod.default({ params: Promise.resolve({}), searchParams: Promise.resolve({}) });
      const html = (await exportMarkup(out instanceof Promise ? await out : out)).replace(
        /<!-- -->/g,
        "",
      );
      const texts = shownTexts(html);
      for (const item of manifestList(id)) {
        items++;
        if (!isShown(item, texts)) missing.push(`${id}: ${item}`);
      }
    }
    console.log(
      `[not modeled] ${ids.length} manifests, ${items} items, ${items - missing.length} shown outside a closed disclosure`,
    );
    expect(missing).toEqual([]);
  });
});
