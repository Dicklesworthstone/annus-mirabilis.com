import { describe, expect, test } from "bun:test";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { loadNotationPageData } from "./notationData.ts";
import NotationPage from "./page.tsx";

/**
 * /notation/ without JavaScript shows each entry once. The catalogue is rendered on the server by
 * the client component, so a reader without JavaScript already has it; the <noscript> block
 * repeated it. Measured on live 2026-09-24 with JavaScript off: 387 entry cards instead of 199,
 * 376 duplicated ids, and a page 50,373px tall instead of 24,271. With JavaScript on the browser
 * does not parse <noscript>, so the duplicates were invisible there.
 *
 * The exported markup is the page as a browser without JavaScript parses it, <noscript> content
 * included; with it removed, it is the page as a browser with JavaScript parses it.
 */
const html = await exportMarkup(await NotationPage());
const withScript = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, "");
const ids = (markup: string) => [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] ?? "");
const entryCards = (markup: string) =>
  [...markup.matchAll(/<article class="notation-entry[^"]*"[^>]*\sid="([^"]+)"/g)].map(
    (m) => m[1] ?? "",
  );

describe("/notation/ shows each entry once, with and without JavaScript", () => {
  test("without JavaScript: no id repeats, and every entry is one card", () => {
    const all = ids(html);
    const repeated = [...new Set(all.filter((id, i) => all.indexOf(id) !== i))];
    expect(all.length).toBeGreaterThan(100);
    expect(repeated).toEqual([]);
    const cards = entryCards(html);
    const entries = loadNotationPageData().papers.flatMap((p) => p.entries.map((e) => e.id));
    expect(entries.length).toBeGreaterThan(0);
    for (const id of entries) expect(cards.filter((c) => c === id).length, id).toBe(1);
  });

  test("without JavaScript the several-meanings view is still reachable, once", () => {
    // Its toggle needs JavaScript, so the fallback carries it; with JavaScript it waits for the toggle.
    expect(html.match(/id="collision-section-heading"/g)?.length).toBe(1);
    expect(withScript).not.toContain('id="collision-section-heading"');
  });

  test("with JavaScript the catalogue is the same set of cards", () => {
    expect(new Set(entryCards(withScript))).toEqual(new Set(entryCards(html)));
  });
});
