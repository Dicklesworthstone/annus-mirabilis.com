import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import CoefficientPage from "../app/lab/me-02/page.tsx";

/**
 * am-me-02-coefficient-dtmi: the printed-factor comparison names its two constant sets in words and
 * keeps the owner's clause inside the sentence. It once read "(modern-si-2019). the printed factor
 * is…": two ids as reader text and a sentence starting in lowercase.
 */
describe("ME-02 printed-factor sentence", async () => {
  const html = renderToStaticMarkup(await CoefficientPage());
  const text = html.replace(/<[^>]+>/g, "");
  const start = text.indexOf("Printed mass change");
  const sentence = start < 0 ? "" : text.slice(start, text.indexOf("c².", start) + 3);

  test("the sentence names the sets in words and carries the owner's wording", () => {
    expect(sentence.length).toBeGreaterThan(0);
    expect(sentence).toContain("(the paper&#x27;s printed constants)");
    expect(sentence).toContain(
      "(2019 SI): the printed factor is 0.1385 percent larger than the modern c².",
    );
  });

  test("no constant-set id is reader text, and the ids stay in data attributes", () => {
    expect(sentence).not.toMatch(/einstein-1905-mass-energy-printed|modern-si-2019/);
    expect(html).toContain('data-constant-set="einstein-1905-mass-energy-printed"');
    expect(html).toContain('data-constant-set="modern-si-2019"');
  });

  test("no sentence in the comparison starts in lowercase after a full stop", () => {
    expect(sentence).not.toMatch(/\. [a-z]/);
  });
});
