import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PassageProjections } from "./PassageProjections.tsx";
import type { PassageProjection } from "./projections/passageProjections.ts";

const projection: PassageProjection = {
  german: [{ href: "/papers/mass-energy/view/german/#s0-p7", label: "The two energy balances" }],
  english: [
    { href: "/papers/mass-energy/view/english/#s0-p7-s1", label: "The two energy balances" },
  ],
  explanation: [{ href: "/papers/mass-energy/#arg-me-two-ledgers", label: "Two energy ledgers" }],
  instrument: [],
  journey: [],
};

describe("the passage's static projection links", () => {
  test("offers real exact-anchor links in a native disclosure without requiring JavaScript", () => {
    const html = renderToStaticMarkup(
      <PassageProjections projection={projection} anchor="s0-p7" label="opening paragraph 7" />,
    );
    expect(html).toContain('<details class="passage-projections"');
    expect(html).toContain('data-passage-projections="s0-p7"');
    expect(html).toContain('aria-label="Explore this passage: opening paragraph 7"');
    for (const group of [projection.german, projection.english, projection.explanation])
      for (const link of group) expect(html).toContain(`href="${link.href}"`);
    expect(html).not.toContain("<button");
    expect(html).not.toContain("data-view-link");
    expect(html).not.toContain("data-reader-anchor");
  });

  test("keeps missing experiment and journey relations visible without inventing a destination", () => {
    const html = renderToStaticMarkup(
      <PassageProjections projection={projection} anchor="s0-p7" label="opening paragraph 7" />,
    );
    for (const kind of ["instrument", "journey"]) {
      const row = new RegExp(`<li data-projection="${kind}">([\\s\\S]*?)</li>`).exec(html)?.[1];
      expect(row).toBeDefined();
      expect(row).toContain("Not yet available");
      expect(row).not.toContain("href=");
    }
  });

  test("does not replace a many-to-many relation with its first explanation", () => {
    const second = {
      href: "/papers/mass-energy/#arg-me-subtraction",
      label: "Subtract the balances",
    };
    const html = renderToStaticMarkup(
      <PassageProjections
        projection={{ ...projection, explanation: [...projection.explanation, second] }}
        anchor="s0-p7"
        label="opening paragraph 7"
      />,
    );
    expect(html).toContain('href="/papers/mass-energy/#arg-me-two-ledgers"');
    expect(html).toContain(`href="${second.href}"`);
  });
});
