/**
 * The explorer's "every term's meaning" list says each meaning once. The cutoff record prints the
 * cutoff frequency twice, U(nu_c) and nu_c cubed, and both occurrences carry the same note, so the
 * list read "Cutoff frequency: the highest frequency the sum includes." twice in a row. 24 records
 * repeated a note this way. The chips keep one per occurrence: each selects a different place in
 * the formula.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import type { EquationRecord } from "./record.ts";
import { compileEquation } from "./render.ts";
import { SemanticEquation } from "./SemanticEquation.tsx";

const record = JSON.parse(
  readFileSync(
    new URL("../../content/equations/light-quanta/eq-model-lq-cutoff-total.json", import.meta.url),
    "utf8",
  ),
) as EquationRecord;
const html = renderToStaticMarkup(<SemanticEquation equation={compileEquation(record)} />);
const meanings = html.slice(html.indexOf("every term"));
const count = (s: string, needle: string) => s.split(needle).length - 1;

describe("the explorer's list of meanings", () => {
  test("the record really prints the cutoff twice, with identical notes", () => {
    const cutoffNotes = record.notes.filter((n) => n.title === "Cutoff frequency");
    expect(cutoffNotes.length).toBe(2);
    expect(cutoffNotes[0]?.explanation).toBe(cutoffNotes[1]?.explanation as string);
  });

  test("the list says it once; the chips keep both occurrences", () => {
    expect(count(meanings, "<dt>Cutoff frequency</dt>")).toBe(1);
    const chips = html.slice(0, html.indexOf("every term"));
    expect(count(chips, 'aria-label="Cutoff frequency term"')).toBe(2);
  });

  test("distinct meanings are all still listed", () => {
    const titles = new Set(record.notes.map((n) => n.title));
    // Each title as React escapes it, so an apostrophe matches.
    for (const title of titles) expect(meanings).toContain(renderToStaticMarkup(<dt>{title}</dt>));
  });
});
