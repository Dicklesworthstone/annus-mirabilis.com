/**
 * The parallel face sets each German block beside its own English (parallelRows.ts, dispatch 149).
 *
 * The pairing is checked against the alignment, not against the pairing code: every alignment edge
 * names a German block and an English unit, and the two must render in the same row. That holds
 * whatever the grouping does, so a row that took its neighbour's English, or a display whose English
 * stayed in its paragraph while the German printed it apart, fails here. Run on the Brownian fixture,
 * which has such a display (bm-s4-eq1), and on mass-energy's real compiled edition.
 */
import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  Alignment,
  Paper,
  SourceBlock,
  TranslationUnit,
} from "../../content/schemas/source.ts";
import {
  FIXTURE_BROWNIAN_ALIGNMENT,
  FIXTURE_BROWNIAN_PAPER,
  FIXTURE_BROWNIAN_SOURCE_BLOCKS,
  FIXTURE_BROWNIAN_TRANSLATION_UNITS,
} from "../../testing/fixtures/bilingual/brownianBilingualFixture.ts";
import { loadBilingualEdition } from "./bilingualLoader.ts";
import { ParallelFace } from "./ParallelFace.tsx";
import { parallelRows } from "./parallelRows.ts";
import type { Group } from "./TranslationParagraphs.tsx";

type Edition = {
  paper: Paper;
  blocks: readonly SourceBlock[];
  units: readonly TranslationUnit[];
  alignment: Alignment;
};

function render(edition: Edition) {
  const html = renderToStaticMarkup(
    <ParallelFace
      paper={edition.paper}
      blocks={edition.blocks}
      units={edition.units}
      alignment={edition.alignment}
    />,
  );
  const { document } = new Window();
  document.body.innerHTML = html;
  return document;
}

const rowOf = (el: {
  closest(selector: string): { getAttribute(name: string): string | null } | null;
}) => el.closest("[data-parallel-row]")?.getAttribute("data-parallel-row") ?? null;

function expectRowsPairTheAlignment(edition: Edition) {
  const document = render(edition);
  const rows = [...document.querySelectorAll("[data-parallel-row]")];
  expect(rows.length).toBeGreaterThan(0);

  // Every aligned German block and English unit sit in the same row.
  const apart: string[] = [];
  const missing: string[] = [];
  for (const edge of edition.alignment.edges) {
    const german = document.querySelector(
      `[data-parallel-half="german"] [data-block-id="${edge.source.blockId}"], [data-parallel-half="german"] [data-footnote-id="${edge.source.blockId}"]`,
    );
    const english = document.querySelector(
      `[data-parallel-half="english"] [data-translation-unit-id="${edge.target.translationUnitId}"]`,
    );
    if (german === null || english === null) {
      missing.push(`${edge.source.blockId} -> ${edge.target.translationUnitId}`);
      continue;
    }
    if (rowOf(german) !== rowOf(english)) {
      apart.push(
        `${edge.source.blockId} (row ${rowOf(german)}) -> ${edge.target.translationUnitId} (row ${rowOf(english)})`,
      );
    }
  }
  // Non-vacuity: a face with no edges rendered, or none found, would pass the pairing over nothing.
  expect(edition.alignment.edges.length).toBeGreaterThan(0);
  expect(missing).toEqual([]);
  expect(apart).toEqual([]);

  // Every unit is on the page exactly once, in an English half.
  for (const unit of edition.units) {
    const found = document.querySelectorAll(
      `[data-parallel-half="english"] [data-translation-unit-id="${unit.id}"]`,
    );
    expect({ unit: unit.id, count: found.length }).toEqual({ unit: unit.id, count: 1 });
  }

  // No id is repeated: the English ids carry their prefix (ENGLISH_ANCHOR_PREFIX).
  const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
  expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);

  // In each row the German comes first, then its English, which is the order a phone stacks them.
  for (const row of rows) {
    const halves = [...row.children].map((child) => child.getAttribute("data-parallel-half"));
    expect(["german,english", "german", "english"]).toContain(halves.join(","));
  }
}

describe("the parallel face pairs each German block with its own English", () => {
  test("on the Brownian fixture, whose German prints a display as its own block", () => {
    expectRowsPairTheAlignment({
      paper: FIXTURE_BROWNIAN_PAPER,
      blocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
      units: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
      alignment: FIXTURE_BROWNIAN_ALIGNMENT,
    });
    // The display's English is beside the display, not in the paragraph before it.
    const document = render({
      paper: FIXTURE_BROWNIAN_PAPER,
      blocks: FIXTURE_BROWNIAN_SOURCE_BLOCKS,
      units: FIXTURE_BROWNIAN_TRANSLATION_UNITS,
      alignment: FIXTURE_BROWNIAN_ALIGNMENT,
    });
    const english = document.querySelector('[data-translation-unit-id="tr-bm-s4-eq1"]');
    expect(english === null ? null : rowOf(english)).toBe("bm-s4-eq1");
  });

  test("on mass-energy's compiled edition", async () => {
    const edition = await loadBilingualEdition("mass-energy");
    expect(edition).not.toBeNull();
    if (edition === null) return;
    expect(edition.units.length).toBeGreaterThan(0);
    expectRowsPairTheAlignment({
      paper: edition.paper,
      blocks: edition.blocks,
      units: edition.units,
      alignment: edition.alignment ?? { id: "none", paper: "mass-energy", edges: [] },
    });
  });
});

describe("parallelRows", () => {
  const block = (id: string, kind: SourceBlock["kind"] = "paragraph") =>
    ({ id, kind }) as unknown as SourceBlock;
  const group = (key: string, kind: Group["kind"] = "paragraph"): Group => ({
    kind,
    key,
    units: [{ id: `u-${key}` } as unknown as TranslationUnit],
  });

  test("gives English whose block the German does not print a row of its own, where it falls", () => {
    const { rows } = parallelRows(
      [block("p1"), block("p2")],
      [],
      [group("p1"), group("stray"), group("p2")],
      [block("p1"), block("p2")],
    );
    expect(rows.map((row) => [row.key, row.block === null, row.english.map((g) => g.key)])).toEqual(
      [
        ["p1", false, ["p1"]],
        ["stray", true, ["stray"]],
        ["p2", false, ["p2"]],
      ],
    );
  });

  test("keeps a display the German prints inside its paragraph with that paragraph's English", () => {
    const display = { id: "d1", kind: "equation", containedIn: "p1" } as unknown as SourceBlock;
    const { rows } = parallelRows(
      [block("p1")],
      [],
      [group("p1"), group("d1", "display")],
      [block("p1"), display],
    );
    expect(rows.map((row) => [row.key, row.english.map((g) => g.key)])).toEqual([
      ["p1", ["p1", "d1"]],
    ]);
  });

  test("pairs each footnote with its own English, after the text", () => {
    const { rows, footnoteRows } = parallelRows(
      [block("p1")],
      [block("fn1", "footnote"), block("fn2", "footnote")],
      [group("p1"), group("fn2", "footnote")],
      [block("p1"), block("fn1", "footnote"), block("fn2", "footnote")],
    );
    expect(rows.map((row) => row.key)).toEqual(["p1"]);
    expect(footnoteRows.map((row) => [row.key, row.english.map((g) => g.key)])).toEqual([
      ["fn1", []],
      ["fn2", ["fn2"]],
    ]);
  });
});
