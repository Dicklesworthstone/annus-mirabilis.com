/**
 * /instruments/: an instrument that answers with a table shows its laboratory's own table, values
 * and all.
 *
 * Before dispatch 129, eleven of the catalogue's registered instruments (lq-02, lq-04, lq-06, sr-01,
 * sr-02, sr-04, sr-07, the three shelf comparisons and light-thread) had the same grey box
 * captioned "Answers in a table". Dispatch 129 gave each its row labels, beside an empty dotted
 * rule where each value stood. Live at 1440 on 2026-09-25 that read "Mean energy per resonator
 * oscillation ……", a widget that had failed to load (TanElk, dispatch 246). Now each row carries
 * the value its laboratory prints at its default settings. scripts/generate-instrument-table-plates.ts
 * reads it from the laboratory's own page in prepare:lab, so none is typed anywhere.
 *
 * These checks read the real page and, for the values, the real laboratory pages, so a laboratory
 * whose table changes changes the expectation with it. Nothing here counts the eleven. Each
 * property holds at any size and is guarded against passing over an empty population.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CATALOGUE_IDS, CATALOGUE_STATUS } from "../../experiments/catalogue.ts";
import { exportMarkup } from "../../testing/exportMarkup.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import InstrumentsIndex from "./page";

const manifest = JSON.parse(readFileSync("public/figures/instruments/manifest.json", "utf8")) as {
  pictures: Record<string, string>;
};

type Entry = {
  id: string;
  kind: "picture" | "table" | "drawn";
  heads: string[];
  rows: { label: string; values: string[]; valueMarkup: string[] }[];
  hidden: boolean;
};

async function readCatalogue(): Promise<Entry[]> {
  await installDom();
  try {
    const html = renderToStaticMarkup(<InstrumentsIndex />);
    const page = new DOMParser().parseFromString(html, "text/html");
    return [...page.querySelectorAll("li.instrument-specimen")].map((li) => {
      const href = li.querySelector("a")?.getAttribute("href") ?? "";
      const plate = li.querySelector(".instrument-plate");
      const kind = plate?.querySelector("img")
        ? "picture"
        : plate?.classList.contains("instrument-plate-words")
          ? "table"
          : "drawn";
      return {
        id: /^\/lab\/([^/]+)\/$/.exec(href)?.[1] ?? href,
        kind,
        heads: [...(plate?.querySelectorAll(".plate-table-head > span") ?? [])]
          .map((span) => span.textContent ?? "")
          .filter((name) => name.length > 0),
        rows: [...(plate?.querySelectorAll(".plate-table-row") ?? [])].map((row) => {
          const values = [...row.querySelectorAll(".plate-table-value")];
          return {
            label: row.querySelector(".plate-table-label")?.textContent ?? "",
            values: values.map((value) => value.textContent ?? ""),
            valueMarkup: values.map((value) => value.innerHTML),
          };
        }),
        hidden: plate?.getAttribute("aria-hidden") === "true",
      };
    });
  } finally {
    await uninstallDom();
  }
}

/**
 * A laboratory page's text as a browser without JavaScript receives it: `compact` with whitespace
 * removed, for finding a label, and the numbers it prints, read with every tag as a space. The two
 * differ because textContent joins adjacent cells with nothing between them: lq-04's two
 * "9.598486" cells read as "9.5984869.598486", whose first number is 9.5984869.
 */
async function laboratoryText(id: string): Promise<{ compact: string; numbers: number[] }> {
  const route = (await import(join(process.cwd(), "src/app/lab", id, "page.tsx"))) as {
    default: (props: unknown) => ReactElement | Promise<ReactElement>;
  };
  const html = await exportMarkup(
    await route.default({ params: Promise.resolve({}), searchParams: Promise.resolve({}) }),
  );
  await installDom();
  try {
    const page = new DOMParser().parseFromString(html, "text/html");
    for (const hidden of page.querySelectorAll("script, style")) hidden.remove();
    const spaced = page.body.innerHTML.replace(/<[^>]+>/g, " ");
    return {
      compact: (page.body.textContent ?? "").replace(/\s+/g, ""),
      numbers: [...spaced.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0])),
    };
  } finally {
    await uninstallDom();
  }
}

const entries = await readCatalogue();
const registered = CATALOGUE_IDS.filter((id) => CATALOGUE_STATUS[id] === "registered");
const tables = entries.filter((entry) => entry.kind === "table");

describe("/instruments/ shows a table instrument by its laboratory's own table", () => {
  test("every registered instrument is listed once, and every one without a picture is a table plate", () => {
    expect(entries.map((entry) => entry.id).sort()).toEqual([...registered].sort());
    // Non-vacuity: with no table plates every check below would iterate nothing.
    expect(tables.length).toBeGreaterThan(0);
    // The drawn box is what the generator falls back to when it cannot read a laboratory. None of
    // the catalogue's laboratories needs it, so one appearing is a laboratory the generator lost.
    const drawn = entries.filter((entry) => entry.kind === "drawn").map((entry) => entry.id);
    expect(drawn).toEqual([]);
    for (const entry of tables) expect(manifest.pictures[entry.id]).toBeUndefined();
  });

  test("no value on a plate is empty, and a plate is not read out beside its question", () => {
    const cells = tables.flatMap((entry) => entry.rows.flatMap((row) => row.values));
    expect(cells.length).toBeGreaterThan(0);
    for (const entry of tables) {
      expect(entry.rows.length).toBeGreaterThan(0);
      for (const row of entry.rows) {
        expect(row.label.trim(), entry.id).not.toBe("");
        expect(row.values.length, `${entry.id}: ${row.label}`).toBeGreaterThan(0);
        for (const value of row.values)
          expect(value.trim(), `${entry.id}: ${row.label}`).not.toBe("");
      }
      // The question beside the plate is the link's name; the plate is not read out twice.
      expect(entry.hidden).toBe(true);
    }
  });

  test("every label and value on a plate is one its laboratory prints at its default settings", async () => {
    // Each label is found in the laboratory page's own text, rendered as its route renders it. A
    // value may show a long decimal at four significant figures (mail 40667), so a value is checked
    // in two parts: its shape (units, exponents, words) is the laboratory's own, and every number in
    // it is a number the laboratory prints, rounded no further than the digits it shows. A number
    // typed onto the plate, or one read from the wrong laboratory, passes neither.
    const NUMBER = /\d+(?:\.\d+)?/g;
    for (const entry of tables) {
      const { compact: text, numbers: printed } = await laboratoryText(entry.id);
      const shape = text.replace(NUMBER, "#");
      for (const row of entry.rows) {
        expect(text, `${entry.id}: ${row.label}`).toContain(row.label.replace(/\s+/g, ""));
        row.values.forEach((value, i) => {
          const compact = value.replace(/\s+/g, "");
          expect(shape, `${entry.id}: ${row.label} = ${value}`).toContain(
            compact.replace(NUMBER, "#"),
          );
          // Numbers read with tags as spaces, so an exponent is not glued to its base ("1010").
          const spaced = (row.valueMarkup[i] ?? "").replace(/<[^>]+>/g, " ");
          for (const shown of spaced.match(NUMBER) ?? []) {
            const half = 0.5 * 10 ** -(shown.split(".")[1]?.length ?? 0);
            const found = printed.some((p) => Math.abs(p - Number(shown)) <= half * (1 + 1e-9));
            expect(found, `${entry.id}: ${row.label} shows ${shown}`).toBe(true);
          }
        });
      }
    }
  });

  test("a plate shows no number to more than four significant figures, and stores them all", () => {
    // Mail 40667: "2.070974 × 10⁻²⁰ J" is seven significant figures on a preview. A zero printed to
    // a resolution ("0.000000") makes no precision claim and is left as printed.
    const DECIMAL = /\d+\.\d+/g;
    const shown = tables.flatMap((entry) =>
      entry.rows.flatMap((row) => row.values.flatMap((value) => value.match(DECIMAL) ?? [])),
    );
    expect(shown.length).toBeGreaterThan(0);
    for (const token of shown) {
      if (Number(token) === 0) continue;
      expect(token.replace(".", "").replace(/^0+/, "").length, token).toBeLessThanOrEqual(4);
    }
    // The stored plates keep the laboratory's full precision: some stored decimal is longer than any
    // plate shows. Without one, the rounding above would be vacuous.
    const stored = readFileSync("src/generated/instrument-table-plates.json", "utf8");
    const long = (stored.match(DECIMAL) ?? []).filter(
      (token) => Number(token) !== 0 && token.replace(".", "").replace(/^0+/, "").length > 4,
    );
    expect(long.length).toBeGreaterThan(0);
  });

  test("an exponent in a value is set as a superscript, never flattened into the line", () => {
    const marked = tables.flatMap((entry) =>
      entry.rows.flatMap((row) => row.valueMarkup.filter((markup) => markup.includes("<sup>"))),
    );
    // Non-vacuity: lq-02's 10⁻²⁰ J and lq-06's 10¹⁰ quanta are set with <sup> by their laboratories.
    expect(marked.length).toBeGreaterThan(0);
    for (const markup of marked) expect(markup).toMatch(/\d<sup>[−-]?\d+<\/sup>/);
  });

  test("a reader never meets two columns of numbers without their names", () => {
    const compared = tables.filter((entry) => (entry.rows[0]?.values.length ?? 0) > 1);
    // Both shapes occur in the real catalogue: shelf-fizeau compares three drags, lq-02 has one column.
    expect(compared.length).toBeGreaterThan(0);
    expect(tables.length - compared.length).toBeGreaterThan(0);
    for (const entry of tables) {
      const width = entry.rows[0]?.values.length ?? 0;
      for (const row of entry.rows) expect(row.values.length, entry.id).toBe(width);
      if (width > 1) expect(entry.heads.length, entry.id).toBe(width);
      expect(width, entry.id).toBeLessThanOrEqual(3);
    }
  });
});
