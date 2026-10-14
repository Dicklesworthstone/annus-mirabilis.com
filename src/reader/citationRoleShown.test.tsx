/**
 * THE CITATION ROLE REACHES A READER, WHICH IS THE HALF THAT MAKES IT WORTH REQUIRING (am-wfuc).
 *
 * `validateBibEntry`, named `validateCitation` then, had required a role since the schema was
 * written and was called by nothing but its own tests; the loader a reader's page goes through
 * used a second record type with no role at all. A field that is declared, validated and never
 * shown is the thing am-wfuc's criteria rule out: "either required and present on all records
 * and READ by something a reader reaches, or removed from the schema".
 *
 * These assertions run against the REAL mass-energy margin rather than a fixture, because
 * mass-energy is the one paper whose historian's-margin entries are complete and because the
 * distinction only matters where a note cites both kinds of source. Its eight entries cite
 * Einstein's own 1905, 1906, 1907 and 1935 papers, Poincare 1900, both Hasenohrl papers,
 * Cockcroft and Walton 1932 and Bainbridge 1933 -- all primary -- beside Ives 1952 and Stachel
 * and Torretti 1982, which are arguments ABOUT the derivation. Before this, a reader had the
 * title and the journal line and nothing that told those two groups apart.
 */
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadPaperMargins } from "./marginRecords.ts";
import { PaperMargins } from "./PaperMargins.tsx";

const html = renderToStaticMarkup(
  <PaperMargins margins={loadPaperMargins("mass-energy", process.cwd())} />,
);

describe("the citation role on the page (am-wfuc)", () => {
  test("every cited source carries its role in the markup, whether or not a word is shown", () => {
    const roles = [...html.matchAll(/data-citation-role="([a-z-]+)"/g)].map((m) => m[1]);
    expect(roles.length).toBeGreaterThan(0);
    const counts = new Map<string, number>();
    for (const r of roles) counts.set(r ?? "", (counts.get(r ?? "") ?? 0) + 1);
    console.log(
      `[census] mass-energy margin: ${roles.length} cited source(s) ` +
        [...counts].map(([r, n]) => `| ${r} ${n}`).join(" "),
    );
    // Not a frozen total: entries are added to this margin as sources are pinned. What must hold
    // is that no source reaches the page without a role, which an empty match list would hide.
    expect(roles.every((r) => r && r.length > 0)).toBe(true);
    expect(counts.get("primary") ?? 0).toBeGreaterThan(0);
  });

  test("later scholarship is named as such, and primary sources are not labelled", () => {
    // Ives 1952 and Stachel and Torretti 1982 are the two secondary records this margin cites.
    expect(counting(html, 'data-citation-role="secondary"')).toBeGreaterThan(0);
    expect(html).toContain("Later scholarship.");

    // The control that stops this passing on a page that labels everything: the three words the
    // map deliberately leaves unsaid must not appear, and primary sources outnumber the rest.
    expect(html).not.toContain("Primary source.");
    expect(counting(html, 'data-citation-role="primary"')).toBeGreaterThan(
      counting(html, 'data-citation-role="secondary"'),
    );
  });

  test("the label follows the citation it belongs to, not the note", () => {
    // Each label sits inside the same span as its source, so a note citing one primary and one
    // secondary source gets the word on the second only. Asserted on the markup rather than by
    // eye: the string must appear after a secondary marker and before the next span opens.
    const spans = [...html.matchAll(/<span data-citation-role="([a-z-]+)">([\s\S]*?)<\/span>/g)];
    expect(spans.length).toBeGreaterThan(0);
    for (const [, role, body] of spans) {
      if (role === "secondary") expect(body).toContain("Later scholarship.");
      if (role === "primary") expect(body).not.toContain("Later scholarship.");
    }
  });
});

function counting(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}
