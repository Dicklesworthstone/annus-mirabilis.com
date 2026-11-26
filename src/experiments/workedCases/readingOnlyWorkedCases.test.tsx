import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { display } from "../../components/lab/presentation.ts";
import { parseYaml } from "../../content/provenance/yaml.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { CATALOGUE_IDS, CATALOGUE_STATUS } from "../catalogue.ts";
import { ExperimentDispatch, type ViewLoaders } from "../dispatch.tsx";
import { SHELF_DEFINITIONS as SHELF_CONTEXT } from "../shelf/definition.ts";
import { SHELF_DEFINITIONS, SHELF_IDS, shelfDraft } from "../shelfOptics/definition.ts";
import {
  findWorkedCase,
  type InstrumentWorkedCaseIndex,
  WORKED_CASE_SCHEMA_VERSION,
} from "./types.ts";
import { WorkedCase } from "./WorkedCase.tsx";

function generatedCases(): InstrumentWorkedCaseIndex {
  return JSON.parse(
    readFileSync(new URL("../../generated/instrument-worked-cases.json", import.meta.url), "utf8"),
  );
}

describe("the real prepared laboratory cases", () => {
  test("every registered core laboratory has meaningful default settings, readouts, complete limits and source links", () => {
    const index = generatedCases();
    expect(index.schemaVersion).toBe(WORKED_CASE_SCHEMA_VERSION);
    const ids = CATALOGUE_IDS.filter(
      (id) => /^(?:bm|lq|sr|me)-\d{2}$/.test(id) && CATALOGUE_STATUS[id] === "registered",
    );
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const record = findWorkedCase(index, id);
      expect(record?.kind, id).toBe("prepared");
      if (record?.kind !== "prepared") continue;
      expect(record.origin, id).toBe("prepared-default");
      expect(record.mode, id).toBeNull();
      expect(record.settings.length, id).toBeGreaterThan(0);
      expect(
        record.tables.some((table) =>
          table.rows.some((row) => row.some((cell) => cell.content.length > 0)),
        ) ||
          record.statements.some(
            (statement) => statement.kind === "calculation" && statement.content.length > 0,
          ),
        id,
      ).toBe(true);
      const manifest = parseYaml(
        readFileSync(
          new URL("../../../content/experiments/" + id + ".yaml", import.meta.url),
          "utf8",
        ),
      ) as { notModeled: string[]; sourceRefs: { paper: string; id: string }[] };
      expect(record.notModeled, id).toEqual(manifest.notModeled);
      expect(
        record.sources.map((source) => source.href),
        id,
      ).toEqual(manifest.sourceRefs.map((ref) => "/papers/" + ref.paper + "/#" + ref.id));
      const html = renderToStaticMarkup(
        <WorkedCase record={record} instrumentId={id} mode={null} />,
      );
      expect(html, id).toContain("data-prepared-worked-case");
      expect(html, id).not.toContain("The static worked case stays in the page");
    }
  });

  test("the three optical shelves prepare the reader's illustrative model values without historical observations", () => {
    const index = generatedCases();
    const expected = {
      "shelf-michelson-morley": ["0.4"],
      "shelf-fizeau": ["0.4526", "0.1979"],
      "shelf-maxwell-galilean": ["0.19"],
    };
    for (const id of SHELF_IDS) {
      const record = findWorkedCase(index, id);
      expect(record?.kind, id).toBe("prepared");
      if (record?.kind !== "prepared") continue;
      expect(record.origin, id).toBe("prepared-default");
      expect(record.mode, id).toBeNull();
      expect(record.tables.length, id).toBe(1);
      expect(record.tables[0]?.caption, id).toContain("not experimental observations");
      const html = renderToStaticMarkup(
        <WorkedCase record={record} instrumentId={id} mode={null} />,
      );
      for (const value of expected[id]) expect(html, id).toContain(">" + value + "<");
      const definition = SHELF_DEFINITIONS[id];
      const defaults = shelfDraft(definition.defaults);
      for (const field of definition.fields) {
        const label = field.label + (field.unit === "1" ? "" : " (" + field.unit + ")");
        expect(record.settings.find((setting) => setting.label === label)?.value, id).toBe(
          String(defaults[field.key]),
        );
      }
      for (const field of definition.switches)
        expect(record.settings.find((setting) => setting.label === field.label)?.value, id).toBe(
          defaults[field.key] ? "On" : "Off",
        );
      expect(record.notes.join(" "), id).toContain("modern SI calibration");
      expect(record.notModeled, id).toEqual(SHELF_CONTEXT[id].notModeled);
      expect(record.sources.map((source) => source.href), id).toContain(
        "/papers/special-relativity/#" + SHELF_CONTEXT[id].sourceSection,
      );
      expect(html, id).not.toContain("Measured mean");
      expect(html, id).not.toContain("published upper limit of 0.02");
      expect(html, id).not.toContain("A prepared worked example is not available");
    }
  });

  test("the probability case contains its real prepared interval result and the clock case retains event identity", () => {
    const index = generatedCases();
    const probability = findWorkedCase(index, "bm-06");
    const html = renderToStaticMarkup(
      <WorkedCase record={probability} instrumentId="bm-06" mode={null} />,
    );
    const prepared = JSON.parse(
      readFileSync(new URL("../../generated/bm06-example.json", import.meta.url), "utf8"),
    ) as { results: string[] };
    const result = prepared.results
      .map((row) => JSON.parse(row))
      .find((row) => row.quantityId === "intervalProbability");
    expect(result.status).toBe("value");
    expect(html).toContain("Probability inside that interval");
    expect(html).toContain(display(result.value, 100) + "%");
    expect(html).toContain("Selected closed interval");
    const clock = renderToStaticMarkup(
      <WorkedCase record={findWorkedCase(index, "sr-01")} instrumentId="sr-01" mode={null} />,
    );
    expect(clock).toContain("Event ledger");
    expect(clock).toContain("Coordinate time (s)");
    expect(clock).toContain("Clock&#x27;s own reading (s)");
    expect(clock).toContain("Assigned remote time");
  });

  test("the inference example identifies its synthetic data and an apparatus mode has its own prepared case", () => {
    const index = generatedCases();
    const inference = renderToStaticMarkup(
      <WorkedCase record={findWorkedCase(index, "bm-07")} instrumentId="bm-07" mode={null} />,
    );
    expect(inference).toContain("data made with a hidden number");
    expect(inference).toContain("Declare an independent radius to condition the estimate");
    const apparatus = findWorkedCase(index, "sr-02:apparatus");
    expect(apparatus?.kind).toBe("prepared");
    if (apparatus?.kind !== "prepared") return;
    expect(apparatus.mode).toBe("apparatus");
    expect(apparatus.address).toBe("sr-02:apparatus");
    expect(apparatus.tables).toEqual([]);
    expect(apparatus.statements.length).toBeGreaterThan(0);
    expect(apparatus.statements.every((statement) => statement.kind === "qualitative")).toBe(true);
    const apparatusHtml = renderToStaticMarkup(
      <WorkedCase record={apparatus} instrumentId="sr-02" mode="apparatus" />,
    );
    expect(apparatusHtml).toContain("Prepared qualitative reconstruction");
    expect(apparatusHtml).toContain("Description frame: Magnet at rest");
    expect(apparatusHtml).toContain("Which body moves: Magnet moves");
    const analytic = findWorkedCase(index, "sr-02");
    expect(analytic?.kind).toBe("prepared");
    if (analytic?.kind !== "prepared") return;
    expect(JSON.stringify(apparatus.tables)).not.toBe(JSON.stringify(analytic.tables));
  });
});

let root: Root | undefined;
let container: HTMLElement;

beforeEach(async () => {
  await installDom();
  container = createContainer();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  removeContainer(container);
  await uninstallDom();
});

test("the default reading preference loads the prepared case and live module together", async () => {
  let liveImports = 0;
  const Live = () => <p data-live-test>Accepted live view</p>;
  const loaders: ViewLoaders = {
    "bm-06": async () => {
      liveImports++;
      return { default: Live };
    },
  };
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <ExperimentDispatch id="bm-06" instanceId="default-reading-case" viewLoaders={loaders} />,
    );
    await import("./PreparedWorkedCase.tsx");
  });
  expect(liveImports).toBe(1);
  const prepared = container.querySelector('[data-prepared-worked-case="bm-06"]');
  expect(prepared?.textContent).toContain("Probability inside that interval");
  expect(prepared?.textContent).toContain("Prepared model example using the default settings");
  expect(container.querySelector("[data-live-test]")?.textContent).toBe("Accepted live view");
});

test("the real dispatcher exposes prepared results in reading-only mode without importing the live lab, and preserves them after load", async () => {
  let liveImports = 0;
  const loaders: ViewLoaders = {
    "bm-06": async () => {
      liveImports++;
      return { default: () => <p data-live-test>New live results</p> };
    },
  };
  document.documentElement.dataset.readingOnly = "on";
  root = createRoot(container);
  await act(async () => {
    root?.render(
      <ExperimentDispatch id="bm-06" instanceId="reading-worked-case" viewLoaders={loaders} />,
    );
    await import("./PreparedWorkedCase.tsx");
  });
  const prepared = container.querySelector('[data-prepared-worked-case="bm-06"]');
  expect(prepared).not.toBeNull();
  expect(prepared?.textContent).toContain("Probability inside that interval");
  expect(prepared?.textContent).toContain("Temperature");
  expect(prepared?.textContent).toContain("Not modeled");
  expect(liveImports).toBe(0);
  expect(container.querySelector("[data-live-test]")).toBeNull();
  const original = prepared?.innerHTML;
  const load = container.querySelector<HTMLButtonElement>("[data-load-experiment]");
  expect(load).not.toBeNull();
  await act(async () => load?.click());
  expect(liveImports).toBe(1);
  expect(container.querySelector("[data-live-test]")?.textContent).toBe("New live results");
  expect(container.querySelector('[data-prepared-worked-case="bm-06"]')?.innerHTML).toBe(original);
});
