import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { labsWithWrongTurns, wrongTurnsForLab } from "../../content/labWrongTurns.ts";
import { LabWrongTurns } from "./LabWrongTurns.tsx";

/**
 * THE REVERSE LINK, AND THE QUESTION "DID I MISS ONE" WITH AN ANSWER.
 *
 * A misconception record names its laboratory, and before this the laboratory said nothing back.
 * The component renders null for a laboratory no record names, which is what makes it safe to add
 * anywhere and also what would let it fail silently: a laboratory that gains a record and not the
 * component would simply render nothing and nobody would know. So the population here is derived
 * from the RECORDS, not from a list of pages, and every laboratory a record names must render its
 * link. A record retargeted to a laboratory whose page has no component turns this red.
 *
 * The page half is asserted in the same file rather than in the lane the component controls: the
 * component rendering correctly in isolation says nothing about whether a page mounts it, and that
 * was exactly the defect this unit repaired.
 */

const labs = labsWithWrongTurns();

describe("a laboratory names the wrong turns its records name it for", () => {
  test("every laboratory a record names renders that record's claim and a link to it", () => {
    // Non-vacuity, with the number written down: 14 laboratories carried 22 records when this
    // landed, and a ledger that failed to load would make every loop below pass over nothing.
    expect(labs.length).toBeGreaterThan(10);
    let rendered = 0;
    for (const lab of labs) {
      const turns = wrongTurnsForLab(lab);
      expect(turns.length, lab).toBeGreaterThan(0);
      const html = renderToStaticMarkup(<LabWrongTurns lab={lab} />);
      for (const turn of turns) {
        expect(html, `${lab} -> ${turn.id}`).toContain(turn.href);
        expect(turn.overview.length, `${lab} -> ${turn.id}`).toBeGreaterThan(20);
        rendered++;
      }
    }
    expect(rendered).toBeGreaterThan(labs.length);
  });

  test("a laboratory no record names renders nothing at all", () => {
    // The property that lets the component sit on a page that does not need it yet.
    expect(renderToStaticMarkup(<LabWrongTurns lab="bm-02" />)).toBe("");
    expect(wrongTurnsForLab("bm-02")).toEqual([]);
    expect(labs).not.toContain("bm-02");
  });

  test("no claim reaches a reader as raw LaTeX", () => {
    // Eight of the bound fields carry \\( ... \\) mathematics. Printed raw they would be visible.
    let withMath = 0;
    for (const lab of labs) {
      const html = renderToStaticMarkup(<LabWrongTurns lab={lab} />);
      expect(/\\\(|\\\[/.test(html), lab).toBe(false);
      for (const turn of wrongTurnsForLab(lab))
        if (/\\\(|\\\[/.test(turn.claim) || /\\\(|\\\[/.test(turn.overview)) withMath++;
    }
    // Positive control: the assertion above is only meaningful because some records DO carry
    // mathematics, so a run where none did would prove nothing about the typesetting.
    expect(withMath).toBeGreaterThan(0);
  });

  test("every page that should carry the section does carry it", () => {
    // node:fs, not Bun.file: this repository's ambient Bun type declares only `build`, so a
    // Bun.file here is the sole `error TS` in the tree and breaks check:types for every pane.
    const missing: string[] = [];
    for (const lab of labs) {
      const page = readFileSync(`src/app/lab/${lab}/page.tsx`, "utf8");
      if (!page.includes(`<LabWrongTurns lab="${lab}" />`)) missing.push(lab);
    }
    expect(missing).toEqual([]);
  });
});
