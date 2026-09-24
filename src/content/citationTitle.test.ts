import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { citationTitleClose } from "./citationTitle.ts";

const title = (key: string): string =>
  JSON.parse(
    readFileSync(new URL(`../../content/bibliography/${key}.json`, import.meta.url), "utf8"),
  ).title;

describe("the mark that closes a reference title", () => {
  test("the mass-energy paper's question is not followed by a full stop", () => {
    const question = title("ap-18-639");
    expect(question.endsWith("?")).toBe(true);
    expect(`${question}${citationTitleClose(question)}`.endsWith("?.")).toBe(false);
  });

  test("a title that does not end a sentence still gets its full stop", () => {
    const relativity = title("ap-17-891");
    expect(citationTitleClose(relativity)).toBe(".");
  });

  test("a closing quote or bracket after the mark still counts as ended", () => {
    expect(citationTitleClose('He asked, "Why?"')).toBe("");
    expect(citationTitleClose("A note (unpublished.)")).toBe("");
    expect(citationTitleClose("Etc.")).toBe("");
    expect(citationTitleClose("Wait!")).toBe("");
  });
});

describe("the reference lists as rendered", () => {
  test("no paper page prints a question mark followed by a full stop", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { PaperPage } = await import("../reader/PaperPage.tsx");
    let questions = 0;
    for (const paperId of ["light-quanta", "special-relativity", "mass-energy"]) {
      const html = await exportMarkup(await PaperPage({ paperId }));
      const refs = html.slice(html.indexOf("References and source status"));
      questions += (refs.match(/\?<\/a>/g) ?? []).length;
      expect(refs).not.toMatch(/\?<\/a>\./);
    }
    // Non-vacuity: at least one rendered reference title really ends in a question mark.
    expect(questions).toBeGreaterThan(0);
  });
});
