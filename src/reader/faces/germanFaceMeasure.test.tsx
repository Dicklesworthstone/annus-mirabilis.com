/**
 * Every paper's German face reads at the reader's measure (dispatch 210).
 *
 * A paper with a German draft face sets its text in .source-column (germanDraftFace.css); a paper
 * whose German face is built from source blocks (GermanFace.tsx) had no measure at all: relativity's
 * ran 1,256px at 19px at 1440, 155 characters a line, beside 666px on the other three. The measure
 * is the reading column's (readingSettings.css), so this holds each German face's source body inside
 * an element that carries one of the two.
 */
import { describe, expect, test } from "bun:test";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";

const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;

/** The class attributes of the elements still open where `index` falls. */
function openClasses(html: string, index: number): string[] {
  const stack: string[] = [];
  for (const m of html.slice(0, index).matchAll(/<(\/?)(div|main|section|article)\b([^>]*)>/g)) {
    if (m[1]) stack.pop();
    else stack.push(m[3]?.match(/class="([^"]*)"/)?.[1] ?? "");
  }
  return stack;
}

describe("the German faces read at the reader's measure", () => {
  test("each paper's German source body sits in a measured column", async () => {
    const wrong: string[] = [];
    for (const paper of PAPERS) {
      const html = await exportMarkup(await PaperPage({ paperId: paper, face: "german" } as never));
      const body = html.search(/data-source-body|data-face-source/);
      if (body === -1) {
        wrong.push(`${paper}: no source body`);
        continue;
      }
      const classes = openClasses(html, body).join(" ").split(/\s+/);
      if (!classes.includes("reading-column") && !classes.includes("source-column"))
        wrong.push(`${paper}: the source body is in no measured column`);
    }
    expect(wrong).toEqual([]);
  });
});
