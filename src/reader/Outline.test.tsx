import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Outline, type OutlineSection } from "./Outline";

const SECTIONS: readonly OutlineSection[] = [
  { id: "s1", label: "1. Introduction" },
  { id: "s2", label: "2. The heat-theoretic argument" },
  { id: "s3", label: "3. Consequences" },
];

describe("Outline", () => {
  test("renders every section as a real hash link, in document order", () => {
    const html = renderToStaticMarkup(<Outline sections={SECTIONS} />);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["#s1", "#s2", "#s3"]);
  });

  test("labels are rendered as the link text", () => {
    const html = renderToStaticMarkup(<Outline sections={SECTIONS} />);
    expect(html).toContain("1. Introduction");
    expect(html).toContain("3. Consequences");
  });

  test('the current section carries aria-current="location"', () => {
    const html = renderToStaticMarkup(<Outline sections={SECTIONS} currentSectionId="s2" />);
    expect(html).toMatch(/href="#s2"[^>]*aria-current="location"/);
  });

  test("non-current sections never carry aria-current", () => {
    const html = renderToStaticMarkup(<Outline sections={SECTIONS} currentSectionId="s2" />);
    const s1Anchor = html.match(/<a[^>]*href="#s1"[^>]*>/)?.[0];
    expect(s1Anchor).toBeDefined();
    expect(s1Anchor).not.toContain("aria-current");
  });

  test("with no currentSectionId, nothing carries aria-current", () => {
    const html = renderToStaticMarkup(<Outline sections={SECTIONS} />);
    expect(html).not.toContain("aria-current");
  });

  test("an empty section list renders an empty, still-valid list", () => {
    const html = renderToStaticMarkup(<Outline sections={[]} />);
    expect(html).toContain("<ol");
    expect(html).not.toContain("<li");
  });

  test("the nav is labeled for assistive technology", () => {
    const html = renderToStaticMarkup(<Outline sections={SECTIONS} />);
    expect(html).toMatch(/<nav[^>]*aria-label="Section outline"/);
  });
});
