import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * Every core laboratory page opens by stating the question its instrument answers
 * (am-lab-manifests-embeds-questions-missing-nree). On 2026-09-24 six of the 33 intros stated
 * none: lq-02, lq-05, lq-07, bm-02, bm-08 and sr-05. lq-05's lead was a noun phrase beginning
 * "How counting ...", which reads like a question and is not one.
 *
 * The check reads the page's own `page-intro` header, with comments blanked first, so a question
 * mark in a comment is not a question on the page. The reader of that header is tested below in
 * both directions, because one that returned everything would pass every page.
 */
const LAB = fileURLToPath(new URL("../app/lab/", import.meta.url));
const CORE_ID = /^(lq|bm|sr|me)-\d\d$/;

/** The visible text of a page's intro header, or null when the page has none. */
export function introText(source: string): string | null {
  const code = source
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  const header = code.match(/<header className="page-intro">([\s\S]*?)<\/header>/);
  if (!header?.[1]) return null;
  return header[1]
    .replace(/<[^>]*>/g, " ")
    .replace(/\{"\s*"\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A question is a sentence the intro ends with a question mark. */
const statesAQuestion = (text: string) => /[A-Za-z)][^.?!]*\?/.test(text);

describe("each core laboratory page states its question", () => {
  test("the intro reader sees text and ignores comments", () => {
    const page = (lead: string) =>
      `<header className="page-intro">\n<p className="lead">${lead}</p>\n</header>`;
    expect(statesAQuestion(introText(page("Does the total ever stop growing?")) ?? "")).toBe(true);
    expect(statesAQuestion(introText(page("Widen the range and see.")) ?? "")).toBe(false);
    expect(statesAQuestion(introText(page("See it. {/* why? */}")) ?? "")).toBe(false);
    expect(
      statesAQuestion(introText(`// is this read?\n${page("Choose a worldline.")}`) ?? ""),
    ).toBe(false);
    expect(introText("<main>no intro here?</main>")).toBeNull();
  });

  test("every core lab page's intro states a question", () => {
    const ids = readdirSync(LAB)
      .filter((name) => CORE_ID.test(name))
      .sort();
    const without: string[] = [];
    for (const id of ids) {
      const text = introText(readFileSync(join(LAB, id, "page.tsx"), "utf8"));
      if (text === null || !statesAQuestion(text)) without.push(id);
    }
    console.log(
      `[lab questions] ${ids.length} core lab pages; ${ids.length - without.length} state a question`,
    );
    // Not vacuous: 33 core pages on 2026-09-24.
    expect(ids.length).toBeGreaterThan(30);
    expect(without).toEqual([]);
  });
});
