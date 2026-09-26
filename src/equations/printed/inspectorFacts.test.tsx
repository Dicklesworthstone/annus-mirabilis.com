/**
 * Every printed term opens an inspector (dispatch 250). The owner asked for the printed equations
 * to be interactive "like classic-patents.com", where every term explains itself; before this,
 * 309 of 1,134 printed terms had an inspector, only those named by a linked model record.
 *
 * The population is what ships: src/generated/printed-displays.json, which the faces render. The
 * plant runs the real printedDisplays on relativity with one reader description removed.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { loadReaderDescriptions } from "../../content/quantities/readerDescriptions.ts";
import { isRegisteredQuantityId } from "../../content/quantities/registry.ts";
import printedPayload from "../../generated/printed-displays.json";
import { paperQuantityColours } from "../quantityColourView.ts";
import { SymbolicValue, TermInspector } from "../TermInspector.tsx";
import { DIMENSION_OPEN_IN_SOURCE, DIMENSION_STATE_DEPENDENT } from "../termFacts.ts";
import type { CompiledEquation } from "../viewTypes.ts";
import {
  boundEquations,
  inspectorGaps,
  type PrintedDisplayPayload,
  printedDisplays,
} from "./paperDisplays.ts";

const ROOT = process.cwd();
const DISPLAYS = (printedPayload as unknown as { displays: readonly PrintedDisplayPayload[] })
  .displays;
const nameOf = (paper: string, quantityId: string) => paperQuantityColours(paper)[quantityId]?.name;

/** Each paper's compiled model records, as scripts/build-equations.ts wrote them. */
function paperEquations(paper: string): readonly CompiledEquation[] {
  const file = paper === "brownian-motion" ? "brownian" : paper;
  const raw = JSON.parse(
    readFileSync(join(ROOT, "src", "generated", `${file}-equations.json`), "utf8"),
  ) as { equations: readonly CompiledEquation[] };
  return raw.equations;
}

/** Whether a record the display is linked to names the quantity: the linked path's condition. */
const linkedBy = new Map<string, (display: string, quantityId: string) => boolean>();
function isLinked(paper: string, display: string, quantityId: string): boolean {
  let test = linkedBy.get(paper);
  if (!test) {
    const bound = boundEquations(ROOT, paper);
    const byId = new Map(paperEquations(paper).map((e) => [e.id, e]));
    test = (d, q) =>
      (bound.get(d) ?? []).some((id) => byId.get(id)?.terms.some((t) => t.quantityId === q));
    linkedBy.set(paper, test);
  }
  return test(display, quantityId);
}

/** The inspector as a face shows it: inline, with the chip's name and the display's facts. */
function inspectorHtml(d: PrintedDisplayPayload, quantityId: string): string {
  const facts = d.facts[quantityId];
  if (!facts) return "";
  return renderToStaticMarkup(
    <TermInspector
      inline
      name={nameOf(d.paper, quantityId) ?? ""}
      facts={facts}
      value={<SymbolicValue lab={facts.lab} />}
    />,
  );
}

const ROW = /class="term-inspector-fact-name">([^<]+)</g;
const rowsOf = (html: string) => [...html.matchAll(ROW)].map((m) => m[1] ?? "");

describe("every printed term opens an inspector (dispatch 250)", () => {
  const terms = DISPLAYS.flatMap((d) => d.legend.map((l) => ({ d, ...l })));

  test("across the four papers, each term has a name, a line saying what it is, and a unit or dimension", () => {
    expect(new Set(DISPLAYS.map((d) => d.paper))).toEqual(
      new Set(["mass-energy", "light-quanta", "brownian-motion", "special-relativity"]),
    );
    expect(terms.length).toBeGreaterThan(0);
    expect(inspectorGaps(DISPLAYS, nameOf)).toEqual([]);
    // And rendered, as the face renders it: every term's chip exists (a line without a colour gets
    // no chip), and its inspector names it and carries a meaning row and a unit or dimension row.
    const wrong: string[] = [];
    for (const { d, quantityId, glyph } of terms) {
      const at = `${d.paper} ${d.display} "${glyph}" (${quantityId})`;
      if (!paperQuantityColours(d.paper)[quantityId]) wrong.push(`${at}: no chip`);
      const html = inspectorHtml(d, quantityId);
      const rows = rowsOf(html);
      if (!html.includes("<strong>")) wrong.push(`${at}: no name`);
      if (!rows.some((r) => ["In this formula", "What it is", "Here"].includes(r)))
        wrong.push(`${at}: no meaning row (${rows.join(", ")})`);
      if (!rows.some((r) => r === "Unit" || r === "Dimension"))
        wrong.push(`${at}: no unit or dimension row`);
    }
    expect(wrong).toEqual([]);
  });

  test("a linked term keeps the linked path exactly, and only an unlinked one gets the fallback", () => {
    let linked = 0;
    let fallback = 0;
    const wrong: string[] = [];
    for (const d of DISPLAYS)
      for (const [quantityId, facts] of Object.entries(d.facts)) {
        const at = `${d.paper} ${d.display} ${quantityId}`;
        const rows = rowsOf(inspectorHtml(d, quantityId));
        if (isLinked(d.paper, d.display, quantityId)) {
          linked++;
          if ("about" in facts || "notation" in facts)
            wrong.push(`${at}: linked, given fallback lines`);
          if (facts.roles.length === 0) wrong.push(`${at}: linked, without its record's note`);
          if (facts.unit === undefined) wrong.push(`${at}: linked, without a unit`);
          // The rows the linked inspector showed before dispatch 250, in its order.
          if (rows.join("|") !== "In this formula|Unit|Dimension|Value")
            wrong.push(`${at}: linked rows are ${rows.join("|")}`);
        } else {
          fallback++;
          if (facts.roles.length > 0) wrong.push(`${at}: unlinked, yet has a record's note`);
          if (!facts.about) wrong.push(`${at}: unlinked, without "what it is"`);
          if (facts.lab !== undefined) wrong.push(`${at}: unlinked, yet names a laboratory`);
          if (!rows.includes("What it is")) wrong.push(`${at}: no "What it is" row`);
        }
      }
    // Both paths are populated, so neither half of this test passes on an empty set.
    expect(linked).toBeGreaterThan(0);
    expect(fallback).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });

  test("a quantity with no reader description is named, term by term, and the real file leaves none", async () => {
    const equations = paperEquations("special-relativity");
    const real = loadReaderDescriptions(ROOT, isRegisteredQuantityId);
    expect(real.has("speedOfLight")).toBe(true);
    const planted = new Map(real);
    planted.delete("speedOfLight");
    expect(planted.has("speedOfLight")).toBe(false);

    const withAll = await printedDisplays(ROOT, ["special-relativity"], equations, {
      readerDescriptions: real,
    });
    expect(withAll.displays.length).toBeGreaterThan(0);
    expect(inspectorGaps(withAll.displays, nameOf)).toEqual([]);

    const without = await printedDisplays(ROOT, ["special-relativity"], equations, {
      readerDescriptions: planted,
    });
    const gaps = inspectorGaps(without.displays, nameOf);
    expect(gaps.length).toBeGreaterThan(0);
    // Every gap is the planted quantity, named with its display and printed glyph.
    expect(gaps.filter((g) => !g.includes("(speedOfLight)"))).toEqual([]);
    expect(gaps).toContain(
      'special-relativity eq-s6-d4 "V" (speedOfLight): no line says what it is; content/reader-descriptions/quantities.yaml has no speedOfLight',
    );
  });

  test("the fallback reads the registry and the concordance: V in § 6, and the deflectabilities", () => {
    const at = (paper: string, display: string) =>
      DISPLAYS.find((d) => d.paper === paper && d.display === display);
    // § 6's V, bound to no linked record: what it is, what the letter means here, the modern
    // symbol c said in MathML, and the first use on p. 892, linked to the page that prints it.
    const v = at("special-relativity", "eq-s6-d4")?.facts.speedOfLight;
    expect(v?.roles).toEqual([]);
    expect(v?.about).toBe("The speed of light in empty space.");
    expect(v?.unit).toBe("m/s");
    const [here] = v?.notation ?? [];
    expect(here?.meaning).toBe("Speed of light in empty space, as printed");
    expect(here?.modernHtml).toContain("<mi>c</mi>");
    expect(here?.firstUsePage).toBe(892);
    expect(here?.firstUseHref?.startsWith("/papers/special-relativity/")).toBe(true);
    const html = inspectorHtml(
      at("special-relativity", "eq-s6-d4") as PrintedDisplayPayload,
      "speedOfLight",
    );
    expect(html).toContain("Speed of light in empty space, as printed.");
    expect(html).toContain(`<a href="${here?.firstUseHref}">First used on p. 892</a>`);
    // A letter printed as it is written today gets no "Today" line: § 2's v is v.
    const frame = at("special-relativity", "eq-s2-d2")?.facts.frameSpeed;
    expect(frame?.about).toBeDefined();
    expect(frame?.notation?.map((n) => n.meaning)).toEqual([
      "Speed of the moving system k relative to the stationary system K",
    ]);
    expect(frame?.notation?.every((n) => n.modernHtml === undefined)).toBe(true);

    // § 10's deflectabilities: the registry says the paper leaves their dimension open, and no
    // table gives them a unit, so the dimension line says so and there is no unit row. The
    // concordance reads the printed A_e in § 10 (p. 920, dispatch 277), so a "Here" row says what
    // the letter means there.
    const deflect = at("special-relativity", "eq-s10-d9");
    expect(deflect?.facts.electricDeflectability?.dimension).toBe(DIMENSION_OPEN_IN_SOURCE);
    expect(deflect?.facts.electricDeflectability?.unit).toBeUndefined();
    expect(
      rowsOf(inspectorHtml(deflect as PrintedDisplayPayload, "electricDeflectability")),
    ).toEqual(["What it is", "Here", "Dimension", "Value"]);

    // A state variable's dimension is that of whichever coordinate it is.
    const state = DISPLAYS.flatMap((d) =>
      d.paper === "brownian-motion" && d.facts.stateVariable ? [d.facts.stateVariable] : [],
    );
    expect(state.length).toBeGreaterThan(0);
    expect(state.every((f) => f.dimension === DIMENSION_STATE_DEPENDENT)).toBe(true);
  });
});
