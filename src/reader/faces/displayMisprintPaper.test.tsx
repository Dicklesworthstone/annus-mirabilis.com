/**
 * A DISPLAY'S MISPRINT NOTE COMES FROM ITS OWN PAPER'S RECEIPT (dispatch 266 follow-up).
 *
 * Display ids are per paper: eq-s9-d3 names a display of relativity and another of light quanta.
 * notesForDisplay matched a receipt's record by display id alone, so relativity's notes were set
 * under light quanta's and Brownian's displays that share an id: at 9f8f278f light quanta's § 9
 * and Brownian's § 5 carried relativity's field equation and aberration formula as "So printed.
 * Read: …". This asserts, for the German face of all four papers, that every display note names a
 * record of that paper's receipt, stands under the display the record names, and that each
 * paper's own display records all appear (read from the receipts, not from what renders).
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { misprintNotes } from "../../content/provenance/misprints.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";

const PAPERS = ["special-relativity", "light-quanta", "brownian-motion", "mass-energy"] as const;

describe("a display's misprint note comes from its own paper's receipt", () => {
  let notesSeen = 0;
  for (const paper of PAPERS) {
    test(`${paper}: every display note is one of its own receipt's records, under its display`, async () => {
      const html = await exportMarkup(await PaperPage({ paperId: paper, face: "german" } as never));
      const { document } = new Window();
      document.body.innerHTML = html;
      const records = misprintNotes();
      const problems: string[] = [];
      const shown = [...document.querySelectorAll("[data-display-misprint]")];
      notesSeen += shown.length;
      for (const el of shown) {
        const id = el.getAttribute("data-display-misprint") ?? "";
        const record = records.get(id);
        if (record?.slug !== paper)
          problems.push(
            `${id} is ${record ? `${record.slug}'s` : "no live"} record, on ${paper}'s face`,
          );
        else if (el.getAttribute("data-display-id") !== record.displayId)
          problems.push(
            `${id} stands under ${el.getAttribute("data-display-id")}, not ${record.displayId}`,
          );
      }
      const own = [...records.values()].filter((r) => r.slug === paper && r.displayId);
      for (const r of own)
        if (!shown.some((el) => el.getAttribute("data-display-misprint") === r.recordId))
          problems.push(`${r.recordId} (${r.displayId}) has no note on its own face`);
      console.log(
        `[display misprint paper] ${paper}: ${shown.length} notes shown, ${own.length} records of its own; ${problems.length} problems`,
      );
      expect(problems).toEqual([]);
    });
  }

  // Without a note anywhere, the rule above would pass having examined nothing.
  test("some display notes are shown", () => {
    expect(notesSeen).toBeGreaterThan(0);
  });
});
