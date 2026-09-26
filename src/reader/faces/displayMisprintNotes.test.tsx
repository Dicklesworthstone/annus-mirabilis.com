/**
 * A display that prints a recorded mathematical misprint carries one quiet note under it, on the
 * German and parallel faces, and the English face none (dispatch 266).
 *
 * The misprint inline (dispatch 262) wraps a printed word. A display is a coloured
 * PrintedDisplayTerms block, and wrapping its mathematics would disturb it, so the note goes
 * under the display instead: the record's proposed reading, the first sentence of its reasoning,
 * and a link to its correction-log entry. The display itself is untouched.
 *
 * The receipt names the display, in the record's locator (`displayId`). The six live records that
 * sit in a display are named here by identity, because they are permanent records of the 1905
 * print, not a count that grows:
 * - relativity: err-typo-p905-1 (eq-s5-d4, w_y over w_x), err-typo-p915-1 (eq-s8-d12, the
 *   denominator), err-typo-p916-1 (eq-s9-d3, no 1/V), err-typo-p919-1 (eq-s10-d4, the z row's
 *   beta^3), err-typo-p920-1 (eq-s10-d8, no mu);
 * - light quanta: typo-dropped-T-footnote-p142 (eq-s5-d9, no T).
 * Other live mathematical records (p908, p912, p552, p557, p146, p147) sit in running text and are
 * not display notes.
 *
 * The faces are the real pages, rendered as the static export renders them.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { parseReceipt } from "../../content/provenance/parseReceipt.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { PaperPage } from "../PaperPage.tsx";

const DISPLAY_RECORDS: Readonly<Record<string, readonly [string, string]>> = {
  "err-typo-p905-1": ["special-relativity", "eq-s5-d4"],
  "err-typo-p915-1": ["special-relativity", "eq-s8-d12"],
  "err-typo-p916-1": ["special-relativity", "eq-s9-d3"],
  "err-typo-p919-1": ["special-relativity", "eq-s10-d4"],
  "err-typo-p920-1": ["special-relativity", "eq-s10-d8"],
  "typo-dropped-T-footnote-p142": ["light-quanta", "eq-s5-d9"],
};

type Row = Readonly<{
  id: string;
  slug: string;
  live: boolean;
  layer: string;
  displayId: string | undefined;
}>;

function records(): Row[] {
  const dir = "docs/provenance";
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .flatMap((f) => {
      const fm = parseReceipt(readFileSync(join(dir, f), "utf8"), f).frontMatter as
        | {
            slug: string;
            typographicalErrors?: readonly {
              id: string;
              layer: string;
              status?: string;
              locator: { displayId?: string };
            }[];
          }
        | undefined;
      return (fm?.typographicalErrors ?? []).map((r) => ({
        id: r.id,
        slug: fm?.slug ?? "",
        live: r.status !== "retracted",
        layer: r.layer,
        displayId: r.locator.displayId,
      }));
    });
}

async function face(slug: string, which: "german" | "parallel" | "english") {
  const html = await exportMarkup(await PaperPage({ paperId: slug, face: which } as never));
  const { document } = new Window();
  document.body.innerHTML = html;
  return document;
}

/** The note stands under its display: right after it, or last in the display's own block. */
type Placed = Readonly<{
  previousElementSibling: { id: string; querySelector(selector: string): unknown } | null;
  parentElement: { id: string } | null;
}>;
function underItsDisplay(note: Placed, displayId: string): boolean {
  const before = note.previousElementSibling;
  if (before?.id === displayId || before?.querySelector(`[id="${displayId}"]`)) return true;
  return note.parentElement?.id === displayId;
}

const all = records();
const byId = new Map(all.map((r) => [r.id, r]));

describe("a recorded misprint in a printed display is noted under the display", () => {
  test("each receipt names the display its mathematical misprint stands in", () => {
    for (const [id, [slug, displayId]] of Object.entries(DISPLAY_RECORDS)) {
      const r = byId.get(id);
      expect(r?.slug, id).toBe(slug);
      expect(r?.live && r.layer === "source", id).toBe(true);
      expect(r?.displayId, id).toBe(displayId);
    }
    // A retracted record names no display: it is not a misprint, so it has no note to place.
    for (const r of all.filter((x) => !x.live)) expect(r.displayId, r.id).toBeUndefined();
  });

  for (const slug of ["special-relativity", "light-quanta"]) {
    test(`${slug}: every live display record renders its note exactly once, under its display, on the German and parallel faces, and none on the English`, async () => {
      const due = all.filter(
        (r) => r.slug === slug && r.live && r.layer === "source" && r.displayId,
      );
      // Non-vacuity: both papers have display records (DISPLAY_RECORDS).
      expect(due.length).toBeGreaterThan(0);
      const problems: string[] = [];
      for (const which of ["german", "parallel"] as const) {
        const document = await face(slug, which);
        for (const r of due) {
          const notes = [...document.querySelectorAll(`[data-display-misprint="${r.id}"]`)];
          if (notes.length !== 1) {
            problems.push(
              `${which}: ${r.id} has ${notes.length} notes under ${r.displayId}, not 1`,
            );
            continue;
          }
          const note = notes[0];
          if (note && !underItsDisplay(note, r.displayId ?? ""))
            problems.push(`${which}: ${r.id}'s note is not under ${r.displayId}`);
          if (note && !note.querySelector(`a[href="/sources/#${r.id}"]`))
            problems.push(`${which}: ${r.id}'s note has no link to its correction-log entry`);
        }
        for (const note of document.querySelectorAll("[data-display-misprint]")) {
          const r = byId.get(note.getAttribute("data-display-misprint") ?? "");
          if (!r?.live) problems.push(`${which}: a note names a retracted or unknown record`);
        }
      }
      const english = await face(slug, "english");
      const onEnglish = english.querySelectorAll("[data-display-misprint]").length;
      if (onEnglish > 0) problems.push(`english: ${onEnglish} display notes, not 0`);
      expect(problems).toEqual([]);
    }, 120_000);
  }
});
