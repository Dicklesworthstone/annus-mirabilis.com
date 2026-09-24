import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { checkVoice } from "../../content/checks/voice/index.ts";
import { CONSTRUCTIONS_WITH_CONTROLS, FOUNDATION_CONSTRUCTION_IDS } from "./constructionIds.ts";
import { FoundationConstruction } from "./FoundationConstruction.tsx";

/**
 * Without JavaScript a construction's buttons, fields, sliders and choices change nothing.
 * Measured on live at 01478983 with scripting off: 19 of the 22 constructions on lesson pages
 * showed such controls and none said they were inert. FoundationConstruction now puts a
 * <noscript> notice before each of them, and this file keeps CONSTRUCTIONS_WITH_CONTROLS honest:
 * the list must name exactly the constructions whose rendered markup holds a control.
 */

const CONTROL = /<(?:button|input|select|textarea)\b/;
const NOTICE = "JavaScript is off, so the controls below cannot change anything.";
const withoutNoscript = (html: string) => html.replace(/<noscript>[\s\S]*?<\/noscript>/g, "");

const rendered = FOUNDATION_CONSTRUCTION_IDS.map((id) => ({
  id,
  html: renderToStaticMarkup(<FoundationConstruction foundationId={id} />),
}));

describe("a construction a reader operates says, without JavaScript, that its controls need it", () => {
  test("the list names exactly the constructions whose markup holds a control", () => {
    const operated = rendered.filter((r) => CONTROL.test(withoutNoscript(r.html))).map((r) => r.id);
    // Both groups populated, so neither direction of the comparison is vacuous.
    expect(operated.length).toBeGreaterThan(0);
    expect(operated.length).toBeLessThan(rendered.length);
    expect([...operated].sort()).toEqual([...CONSTRUCTIONS_WITH_CONTROLS].sort());
  });

  test("each of those opens with the notice, and a construction without controls has none", () => {
    for (const { id, html } of rendered) {
      const operated = CONSTRUCTIONS_WITH_CONTROLS.includes(id);
      expect(html.startsWith(`<noscript><p class="notice">${NOTICE}`), id).toBe(operated);
      expect(html.includes(NOTICE), id).toBe(operated);
    }
  });

  test("the paragraph the notice points to is in every construction that carries it", () => {
    for (const { id, html } of rendered)
      if (CONSTRUCTIONS_WITH_CONTROLS.includes(id))
        expect(withoutNoscript(html), id).toContain("What it shows, in words");
  });

  test("the notice passes the voice lint", () => {
    const html = rendered.find((r) => r.html.includes(NOTICE))?.html ?? "";
    const notice = (html.match(/<noscript>([\s\S]*?)<\/noscript>/)?.[1] ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    expect(notice.startsWith(NOTICE)).toBe(true);
    const errors = checkVoice(notice, { context: "prose" }).filter((f) => f.severity !== "info");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
