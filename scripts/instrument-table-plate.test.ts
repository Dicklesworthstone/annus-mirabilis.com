/**
 * The plate reader takes a laboratory's first table of values in view, cell by cell, and nothing
 * else (scripts/instrument-table-plate.ts, dispatch 246). Each case below is a shape a real
 * laboratory page has: sr-07's symbol key before its residuals, light-thread's unit column, lq-02's
 * exponents, avogadro-lab's <small> second line, and the <noscript> notice every laboratory carries.
 */
import { describe, expect, test } from "bun:test";
import { readTablePlate } from "./instrument-table-plate.ts";

const text = (runs: { t: string; s?: string }[]) =>
  runs.map((run) => (run.s ? `${run.s === "sup" ? "^" : "_"}{${run.t}}` : run.t)).join("");

describe("which table a plate is read from", () => {
  test("the first table in view that holds values; a key of words is passed over", () => {
    const plate = readTablePlate(
      `<table><thead><tr><th>Printed</th><th>Role</th></tr></thead><tbody>
         <tr><th>X</th><td>electric x in K</td></tr><tr><th>Y</th><td>electric y in K</td></tr></tbody></table>
       <table><tbody><tr><th>Max residual</th><td>0.000000</td></tr>
         <tr><th>Form invariant?</th><td>yes</td></tr><tr><th>Faraday</th><td>0.0; 0.0</td></tr></tbody></table>`,
    );
    expect(plate?.rows.map((row) => text(row.label))).toEqual([
      "Max residual",
      "Form invariant?",
      "Faraday",
    ]);
    expect(plate?.rows.map((row) => row.values.map(text))).toEqual([
      ["0.000000"],
      ["yes"],
      ["0.0; 0.0"],
    ]);
    expect(plate?.columns).toEqual([]);
  });

  test("a table in <noscript>, a closed <details>, a hidden element or the introduction is not in view", () => {
    const table = (value: string) =>
      `<table><tbody><tr><th>Energy</th><td>${value}</td></tr></tbody></table>`;
    const plate = readTablePlate(
      `<header class="page-intro">${table("1")}</header><noscript>${table("2")}</noscript>` +
        `<details><summary>More</summary>${table("3")}</details><div hidden="">${table("4")}</div>` +
        `<details open="">${table("5")}</details>`,
    );
    expect(plate?.rows[0]?.values.map(text)).toEqual(["5"]);
    // aria-hidden is not hidden: a plate that is decoration to a screen reader is still on screen.
    expect(
      readTablePlate(`<div aria-hidden="true">${table("6")}</div>`)?.rows[0]?.values.map(text),
    ).toEqual(["6"]);
  });

  test("a page with no table of values gives no plate", () => {
    expect(readTablePlate("<p>No tables here.</p>")).toBeNull();
    expect(
      readTablePlate("<table><tbody><tr><th>X</th><td>electric x</td></tr></tbody></table>"),
    ).toBeNull();
  });
});

describe("what a cell is", () => {
  test("an exponent stays an exponent, and entities and comments are read as a browser reads them", () => {
    const plate = readTablePlate(
      `<table><tbody><tr><th>Mean energy e<sup>−x</sup></th><td>2.070974 × 10<sup>−20</sup><!-- --> J</td></tr>
       <tr><th>Share &amp; rest</th><td>0.9990000</td></tr></tbody></table>`,
    );
    expect(plate?.rows.map((row) => text(row.label))).toEqual([
      "Mean energy e^{−x}",
      "Share & rest",
    ]);
    expect(plate?.rows[0]?.values.map(text)).toEqual(["2.070974 × 10^{−20} J"]);
  });

  test("a cell's quieter second line in <small> is left out", () => {
    const plate = readTablePlate(
      "<table><tbody><tr><th>N<small>by diffusion</small></th><td>6.2 × 10<sup>23</sup></td></tr></tbody></table>",
    );
    expect(plate?.rows.map((row) => text(row.label))).toEqual(["N"]);
  });

  test("the columns of values keep their names, and a Unit column is set after each value", () => {
    const plate = readTablePlate(
      `<table><thead><tr><th>Quantity</th><th>Value</th><th>Unit</th></tr></thead><tbody>
         <tr><th>Frequency</th><td>500000000000000</td><td>Hz</td></tr>
         <tr><th>Pulse energy</th><td>1</td><td>J</td></tr>
         <tr><th>E/(hν)</th><td>3.0184 × 10¹⁸</td><td>1</td></tr></tbody></table>`,
    );
    expect(plate?.columns.map(text)).toEqual(["Value"]);
    // A unit of 1 says nothing beside a number, so it is not set.
    expect(plate?.rows.map((row) => row.values.map(text))).toEqual([
      ["500000000000000 Hz"],
      ["1 J"],
      ["3.0184 × 10¹⁸"],
    ]);
  });

  test("a column of words beside the values is not a column of values", () => {
    const plate = readTablePlate(
      `<table><thead><tr><th>Event</th><th>Kind</th><th>Clock</th><th>Own reading (s)</th><th>Coordinate time (s)</th></tr></thead>
       <tbody><tr><th>emission-a</th><td>emission</td><td>A</td><td>0</td><td>0</td></tr>
       <tr><th>reflection-b</th><td>reflection</td><td>B</td><td>10</td><td>10</td></tr></tbody></table>`,
    );
    expect(plate?.columns.map(text)).toEqual(["Own reading (s)", "Coordinate time (s)"]);
    expect(plate?.rows.map((row) => row.values.map(text))).toEqual([
      ["0", "0"],
      ["10", "10"],
    ]);
  });

  test("at most four rows are read", () => {
    const rows = Array.from(
      { length: 6 },
      (_, i) => `<tr><th>Row ${i}</th><td>${i}</td></tr>`,
    ).join("");
    expect(readTablePlate(`<table><tbody>${rows}</tbody></table>`)?.rows).toHaveLength(4);
  });
});
