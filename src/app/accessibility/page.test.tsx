import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import Accessibility from "./page";

/**
 * /accessibility/ in its pending state. No disabled-reader testing round is recorded, so the page
 * must state the target without claiming to reach it.
 */
const html = renderToStaticMarkup(<Accessibility />);
const text = html.replace(/<[^>]+>/g, "").replace(/&#x27;|&rsquo;/g, "’");

describe("/accessibility/", () => {
  test("names the target and says conformance is not yet claimed", () => {
    expect(text).toContain("WCAG 2.2 level AA");
    expect(text).toContain("It does not yet claim to meet it.");
    expect(text).toContain("No round of testing with disabled readers");
  });

  test("makes no claim of conformance anywhere on the page", () => {
    for (const claim of [
      /\bconform(s|ant)\b/i,
      /\bcomplian(t|ce)\b/i,
      /\bfully accessible\b/i,
      /\bmeets WCAG\b/i,
    ]) {
      expect(text).not.toMatch(claim);
    }
  });

  test("gives a way to report a barrier, and no em dash", () => {
    expect(html).toContain(
      'href="https://github.com/Dicklesworthstone/annus-mirabilis.com/issues"',
    );
    expect(text).not.toContain("—");
  });
});
