/**
 * /instruments/: an instrument that answers with a table is shown by its own words.
 *
 * Before: eleven of the catalogue's 37 registered instruments (lq-02, lq-04, lq-06, sr-01, sr-02,
 * sr-04, sr-07, the three shelf comparisons and light-thread) had a grey ruled box captioned
 * "Answers in a table", the same box for all eleven, so a reader learned nothing about any of
 * them from its plate. The generator (scripts/generate-instrument-thumbnails.ts) now reads each
 * one's first table on the live laboratory: its row labels and the names of the columns of values
 * it compares, with superscripts and subscripts kept. The page sets those words as a small table.
 *
 * Checked against the real manifest and the real page, so a lab whose table changes changes the
 * expectation with it. Nothing here counts the eleven: the properties hold at any size, and each
 * is guarded against passing over an empty population.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { CATALOGUE_IDS, CATALOGUE_STATUS } from "../../experiments/catalogue.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import InstrumentsIndex from "./page";

type Run = { t: string; s?: "sup" | "sub" };
const manifest = JSON.parse(readFileSync("public/figures/instruments/manifest.json", "utf8")) as {
  pictures: Record<string, string>;
  tables?: Record<string, { head: Run[][]; rows: Run[][] }>;
};
const tables = manifest.tables ?? {};

const text = (label: Run[]) => label.map((run) => run.t).join("");
/** The label as the page must mark it up: a superscript as <sup>, a subscript as <sub>. */
const markup = (label: Run[]) =>
  label.map((run) => (run.s ? `<${run.s}>${run.t}</${run.s}>` : run.t)).join("");

type Entry = {
  id: string;
  kind: "picture" | "words" | "drawn";
  heads: string[];
  labels: string[];
  labelMarkup: string[];
  plateText: string;
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
          ? "words"
          : "drawn";
      const labels = [...(plate?.querySelectorAll(".plate-table-label") ?? [])];
      return {
        id: /^\/lab\/([^/]+)\/$/.exec(href)?.[1] ?? href,
        kind,
        heads: [...(plate?.querySelectorAll(".plate-table-head > span") ?? [])]
          .map((span) => span.textContent ?? "")
          .filter((name) => name.length > 0),
        labels: labels.map((label) => label.textContent ?? ""),
        labelMarkup: labels.map((label) => label.innerHTML),
        plateText: plate?.textContent ?? "",
        hidden: plate?.getAttribute("aria-hidden") === "true",
      };
    });
  } finally {
    await uninstallDom();
  }
}

const entries = await readCatalogue();
const registered = CATALOGUE_IDS.filter((id) => CATALOGUE_STATUS[id] === "registered");
const words = entries.filter((entry) => entry.kind === "words");

describe("/instruments/ shows a table instrument by its own words", () => {
  test("every registered instrument is listed once, and every one the generator read is a words plate", () => {
    expect(entries.map((entry) => entry.id).sort()).toEqual([...registered].sort());
    const read = registered.filter((id) => tables[id] && !manifest.pictures[id]);
    // Non-vacuity: with no tables in the manifest every check below would iterate nothing.
    expect(read.length).toBeGreaterThan(0);
    expect(words.map((entry) => entry.id).sort()).toEqual(read.sort());
    // The grey box is left only for an instrument the generator has neither pictured nor read.
    for (const entry of entries.filter((e) => e.kind === "drawn")) {
      expect(manifest.pictures[entry.id]).toBeUndefined();
      expect(tables[entry.id]).toBeUndefined();
    }
  });

  test("a plate's rows are the laboratory's first row labels, in order, and nothing else is copied", () => {
    for (const entry of words) {
      const table = tables[entry.id];
      expect(table).toBeDefined();
      const shown = (table?.rows ?? []).slice(0, entry.heads.length > 0 ? 3 : 4);
      expect(entry.labels).toEqual(shown.map(text));
      // No value reaches the plate: its whole text is the heading names and the labels. A number
      // copied from the laboratory would go stale while the laboratory moved on.
      expect(entry.plateText).toBe([...entry.heads, ...entry.labels].join(""));
      // The question beside the plate is the link's name; the plate is not read out twice.
      expect(entry.hidden).toBe(true);
    }
  });

  test("a superscript or subscript in a label is set as one, never flattened into the line", () => {
    const marked = words.flatMap((entry) => {
      const table = tables[entry.id];
      return (table?.rows ?? [])
        .slice(0, entry.labels.length)
        .map((label, i) => ({ label, shown: entry.labelMarkup[i] ?? "" }))
        .filter(({ label }) => label.some((run) => run.s));
    });
    // Non-vacuity: e^{-x} on lq-04 and n_eff on lq-06 are why this test exists.
    expect(marked.length).toBeGreaterThan(0);
    for (const { label, shown } of marked) expect(shown).toBe(markup(label));
  });

  test("the heading names two or three columns of values, and only when the names fit", () => {
    const shown = words.filter((entry) => entry.heads.length > 0);
    const withheld = words.filter((entry) => entry.heads.length === 0);
    // Both branches are exercised by the real catalogue, or this test proves one of them only.
    expect(shown.length).toBeGreaterThan(0);
    expect(withheld.length).toBeGreaterThan(0);
    for (const entry of words) {
      const head = tables[entry.id]?.head ?? [];
      const fitsThree = head.every((name) =>
        text(name)
          .split(/\s+/)
          .every((word) => word.length <= 8),
      );
      const expected = head.length === 2 || (head.length === 3 && fitsThree) ? head.map(text) : [];
      expect(entry.heads).toEqual(expected);
    }
  });
});
