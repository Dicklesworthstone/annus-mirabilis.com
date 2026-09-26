/**
 * A FOOTNOTE IS LABELLED WITH THE MARK ITS PAGE PRINTS, NOT A NUMBER OF THE LIST'S OWN (dispatch 255).
 *
 * Einstein's pages mark their footnotes "1)", "2)", starting again on each page, and the text's
 * reference carries that mark. The English and gloss faces label each footnote with it. The
 * German and parallel faces listed their footnotes in an <ol> and showed the list's own numbers,
 * so light quanta's s1-fn3, printed "2)" and referred to as 2) in the text, read "3." at the foot.
 * Measured on a build of 7f464ab8: every .footnote-item had list-style decimal and no printed mark.
 * The German face of light quanta, Brownian and mass-energy showed the printed marks until
 * 8b1cbcb8 moved them onto the source blocks.
 *
 * This asserts, for all four papers on the German and parallel faces, that each footnote item
 * opens with its record's printed label (the source block's originalLabel, read from the edition,
 * not from what renders), and that reader.css does not number the list beside it.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";
import { loadBilingualEdition } from "./bilingualLoader.ts";

const PAPERS = ["special-relativity", "light-quanta", "brownian-motion", "mass-energy"] as const;

async function face(paper: string, name: "german" | "parallel") {
  const html = await exportMarkup(await PaperPage({ paperId: paper, face: name } as never));
  const { document } = new Window();
  document.body.innerHTML = html;
  return document as unknown as Document;
}

describe("each footnote is labelled with its printed mark (dispatch 255)", () => {
  for (const paper of PAPERS) {
    test(`${paper}: every footnote item on the German and parallel faces opens with its printed mark`, async () => {
      const edition = await loadBilingualEdition(paper);
      const footnotes = (edition?.blocks ?? []).filter((b) => b.kind === "footnote");
      // A paper whose footnotes were not found proves nothing about their labels.
      expect(footnotes.length).toBeGreaterThan(0);
      const problems: string[] = [];
      for (const name of ["german", "parallel"] as const) {
        const document = await face(paper, name);
        for (const fn of footnotes) {
          const label = fn.originalLabel?.trim();
          if (!label) {
            problems.push(`${name} ${fn.id}: the record has no printed label`);
            continue;
          }
          const item = document.querySelector(`.footnote-item[data-footnote-id="${fn.id}"]`);
          if (!item) {
            problems.push(`${name} ${fn.id}: no footnote item`);
            continue;
          }
          const opening = (item.textContent ?? "").trimStart().slice(0, 12);
          if (!opening.startsWith(label))
            problems.push(`${name} ${fn.id}: opens "${opening}…", not its printed mark "${label}"`);
        }
      }
      console.log(
        `[footnote labels] ${paper}: ${footnotes.length} footnotes on 2 faces; ${problems.length} problems`,
      );
      expect(problems).toEqual([]);
    });
  }

  test("the footnote list adds no numbers of its own beside the printed marks", () => {
    const css = readFileSync(join(process.cwd(), "src/reader/reader.css"), "utf8");
    const rule = /^\.footnotes-list\s*\{([^}]*)\}/m.exec(css)?.[1] ?? "";
    // Not vacuous: the rule is there to be read.
    expect(rule).not.toBe("");
    expect(rule).toMatch(/(^|;|\s)list-style(-type)?:\s*none\b/);
  });
});
