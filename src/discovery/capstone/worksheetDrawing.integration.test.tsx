import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import type { Root } from "react-dom/client";
import { CAPSTONE_WORKSHEET_KEYS } from "../../platform/storage/keys.ts";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { CapstoneWorksheet } from "./CapstoneWorksheet.tsx";
import { loadCapstone } from "./loadCapstone.ts";
import { emptySketch, SKETCH_LIMITS, sketchPath } from "./worksheetSketch.ts";
import { emptyWorksheet, readWorksheet } from "./worksheetState.ts";

const PAPERS = ["light-quanta", "brownian-motion", "special-relativity", "mass-energy"] as const;
type Paper = (typeof PAPERS)[number];
let root: Root | null = null;
let host: HTMLDivElement;
let downloads: Blob[];
let filenames: string[];
let originalCreate: PropertyDescriptor | undefined;
let originalRevoke: PropertyDescriptor | undefined;
let originalClick: PropertyDescriptor | undefined;

function required<T>(value: T | null | undefined): T {
  assert.ok(value, "The complete mounted worksheet must expose this control or saved document.");
  return value;
}

beforeEach(async () => {
  await installDom();
  window.localStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(host);
  downloads = [];
  filenames = [];
  originalCreate = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
  originalRevoke = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
  originalClick = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "click");
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (blob: Blob) => {
      downloads.push(blob);
      return `blob:http://localhost/worksheet-drawing-${downloads.length}`;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: () => {} });
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    value(this: HTMLAnchorElement) {
      filenames.push(this.download);
    },
  });
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  if (originalCreate) Object.defineProperty(URL, "createObjectURL", originalCreate);
  else Reflect.deleteProperty(URL, "createObjectURL");
  if (originalRevoke) Object.defineProperty(URL, "revokeObjectURL", originalRevoke);
  else Reflect.deleteProperty(URL, "revokeObjectURL");
  if (originalClick) Object.defineProperty(HTMLAnchorElement.prototype, "click", originalClick);
  else Reflect.deleteProperty(HTMLAnchorElement.prototype, "click");
  await uninstallDom();
});

async function mount(paper: Paper) {
  const { capstone, equations } = loadCapstone(paper);
  await act(async () => {
    root?.render(
      <div className="capstone-page">
        <div className="capstone-reference">The reference argument remains available.</div>
        <CapstoneWorksheet
          capstone={capstone}
          equations={equations.map((equation) => ({
            ...equation,
            html: "",
            href: `/papers/${paper}/view/parallel/#${equation.displayUnit}`,
          }))}
          instruments={[]}
        />
      </div>,
    );
  });
  return capstone;
}

async function click(label: string) {
  const button = required(
    [...host.querySelectorAll("button")].find((control) => control.textContent === label),
  );
  await act(async () => button.click());
}

function textarea(label: string): HTMLTextAreaElement {
  const owner = required(
    [...host.querySelectorAll("label")].find((candidate) => candidate.textContent === label),
  );
  const field = document.getElementById(owner.htmlFor);
  assert.ok(field instanceof HTMLTextAreaElement);
  return field;
}

async function type(label: string, value: string) {
  const field = textarea(label);
  const setValue = required(
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set,
  );
  await act(async () => {
    setValue.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(field.value).toBe(value);
}

function saved(paper: Paper) {
  return required(
    readWorksheet(
      JSON.parse(required(window.localStorage.getItem(CAPSTONE_WORKSHEET_KEYS[paper]))),
    ),
  );
}

describe("drawings in the complete capstone worksheet", () => {
  test("each real paper persists keyboard drawing and description through reload, export and print", async () => {
    for (const paper of PAPERS) {
      const capstone = await mount(paper);
      const description = `My sketch for ${paper}, with left and right positions.`;
      const explanation = `My explanation of ${capstone.title}.`;
      await type("Your explanation", explanation);
      await type("Describe your drawing, or use words instead", description);
      await click("Start a line here");
      await click("Finish this line");
      const beforeReload = saved(paper);
      expect(beforeReload.explanation).toBe(explanation);
      expect(beforeReload.sketch).toEqual({
        description,
        strokes: [[{ x: SKETCH_LIMITS.width / 2, y: SKETCH_LIMITS.height / 2 }]],
      });

      await act(async () => root?.render(null));
      await mount(paper);
      expect(textarea("Your explanation").value).toBe(explanation);
      expect(textarea("Describe your drawing, or use words instead").value).toBe(description);
      const svg = required(host.querySelector<SVGSVGElement>(".capstone-sketch-surface"));
      const expectedPath = sketchPath(beforeReload.sketch.strokes);
      expect(required(svg.querySelector("path")).getAttribute("d")).toBe(expectedPath);
      expect(required(svg.querySelector("desc")).textContent).toBe(description);

      await click("Export this worksheet");
      expect(filenames.at(-1)).toBe(`${capstone.id}-worksheet.json`);
      expect(JSON.parse(await required(downloads.at(-1)).text())).toEqual(beforeReload);

      let printedPath: string | null = null;
      let printedDescription: string | null = null;
      let worksheetSelected = false;
      Object.defineProperty(window, "print", {
        configurable: true,
        value: () => {
          worksheetSelected = required(host.querySelector(".capstone-page")).hasAttribute(
            "data-print-worksheet",
          );
          printedPath = required(host.querySelector(".capstone-sketch-ink")).getAttribute("d");
          printedDescription = required(host.querySelector(".capstone-sketch desc")).textContent;
        },
      });
      await click("Print this worksheet");
      expect(worksheetSelected).toBe(true);
      expect(printedPath).toBe(expectedPath);
      expect(printedDescription).toBe(description);
      await act(async () => {
        window.dispatchEvent(new Event("afterprint"));
      });
      expect(
        required(host.querySelector(".capstone-page")).hasAttribute("data-print-worksheet"),
      ).toBe(false);
      await act(async () => root?.render(null));
    }
    // Each edition has its own registered document; revisiting one must not replace another.
    for (const paper of PAPERS) {
      expect(saved(paper).sketch.description).toBe(
        `My sketch for ${paper}, with left and right positions.`,
      );
    }
  });

  test("a version-one file imports through the real control and can gain a drawing without losing answers", async () => {
    const paper = "mass-energy";
    const capstone = await mount(paper);
    const { sketch: _sketch, ...fields } = emptyWorksheet(capstone);
    const legacy = {
      ...fields,
      schemaVersion: 1,
      order: [...capstone.paperOrder],
      explanation: "An earlier answer, before worksheets could hold drawings.",
      annotations: { [required(capstone.equations[0]).equationId]: "An earlier equation note." },
      table: [["before", "after"]],
    };
    const file = new File([JSON.stringify(legacy)], "earlier-worksheet.json", {
      type: "application/json",
    });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const input = required(host.querySelector<HTMLInputElement>('input[type="file"]'));
    await act(async () => {
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(window.localStorage.getItem(CAPSTONE_WORKSHEET_KEYS[paper])).toBeNull();
    await click("Replace with imported worksheet");
    expect(saved(paper)).toEqual({ ...legacy, schemaVersion: 2, sketch: emptySketch() });
    expect(textarea("Your explanation").value).toBe(legacy.explanation);

    await click("Start a line here");
    await click("Finish this line");
    const updated = saved(paper);
    expect(updated.explanation).toBe(legacy.explanation);
    expect(updated.annotations).toEqual(legacy.annotations);
    expect(updated.order).toEqual(legacy.order);
    expect(updated.table).toEqual(legacy.table);
    expect(updated.sketch.strokes).toEqual([
      [{ x: SKETCH_LIMITS.width / 2, y: SKETCH_LIMITS.height / 2 }],
    ]);
    await click("Export this worksheet");
    expect(JSON.parse(await required(downloads.at(-1)).text())).toEqual(updated);
  });
});
