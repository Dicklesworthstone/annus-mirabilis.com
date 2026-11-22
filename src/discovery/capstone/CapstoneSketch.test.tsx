import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { act, useState } from "react";
import type { Root } from "react-dom/client";
import { installDom, uninstallDom } from "../../testing/reactDom.ts";
import { CapstoneSketch } from "./CapstoneSketch.tsx";
import { emptySketch, SKETCH_LIMITS, type WorksheetSketch } from "./worksheetSketch.ts";

type Work = Readonly<{
  explanation: string;
  table: readonly (readonly string[])[];
  sketch: WorksheetSketch;
}>;

let root: Root | null = null;
let host: HTMLDivElement;
let work: Work;
let admit = true;
let attempts: WorksheetSketch[];
let replaceDrawing: (sketch: WorksheetSketch) => void;

function WorksheetHost() {
  const [state, setState] = useState(work);
  work = state;
  replaceDrawing = (sketch) => setState((current) => ({ ...current, sketch }));
  return (
    <CapstoneSketch
      sketch={state.sketch}
      onChange={(next) => {
        attempts.push(next);
        if (!admit) return false;
        setState((current) => ({ ...current, sketch: next }));
        return true;
      }}
    />
  );
}

beforeEach(async () => {
  await installDom();
  host = document.createElement("div");
  document.body.append(host);
  const { createRoot } = await import("react-dom/client");
  root = createRoot(host);
  work = {
    explanation: "The body emits light in opposite directions.",
    table: [["before", "after"]],
    sketch: emptySketch(),
  };
  admit = true;
  attempts = [];
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  await uninstallDom();
});

async function mount(sketch: WorksheetSketch = emptySketch()) {
  work = { ...work, sketch };
  await act(async () => root?.render(<WorksheetHost />));
  const surface = drawing();
  Object.defineProperty(surface, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(10, 20, 500, 300),
  });
}

function drawing(): SVGSVGElement {
  return required(host.querySelector<SVGSVGElement>("svg"));
}

function required<T>(value: T | null | undefined): T {
  assert.ok(value, "The rendered sketch must provide this control or drawing surface.");
  return value;
}

function findButton(label: string): HTMLButtonElement | undefined {
  return [...host.querySelectorAll("button")].find((button) => button.textContent === label);
}

async function click(label: string) {
  const control = required(findButton(label));
  await act(async () => control.click());
}

async function pointerEvent(type: string, x: number, y: number, pointerId = 1, isPrimary = true) {
  await act(async () => {
    drawing().dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId,
        isPrimary,
        button: 0,
        clientX: 10 + x * 5,
        clientY: 20 + y * 3,
      }),
    );
  });
}

async function position(axis: "x" | "y", value: number) {
  const input = required(
    [...host.querySelectorAll<HTMLInputElement>('input[type="range"]')][axis === "x" ? 0 : 1],
  );
  const setter = required(
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set,
  );
  await act(async () => {
    setter.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(input?.getAttribute("aria-valuetext")).toBe(
    `${value} percent from the ${axis === "x" ? "left" : "top"}`,
  );
}

describe("optional capstone drawing", () => {
  test("pointer drawing is opt-in, commits on release and keeps the description", async () => {
    await mount({ description: "Two opposite light pulses.", strokes: [] });
    await pointerEvent("pointerdown", 20, 30);
    await pointerEvent("pointerup", 70, 80);
    expect(attempts).toEqual([]);
    await click("Enable pointer drawing");
    await pointerEvent("pointerdown", 20, 30);
    await pointerEvent("pointermove", 70, 80);
    expect(attempts).toEqual([]);
    expect(work.sketch.strokes).toEqual([]);
    await pointerEvent("pointerup", 70, 80);
    expect(work.sketch).toEqual({
      description: "Two opposite light pulses.",
      strokes: [
        [
          { x: 200, y: 180 },
          { x: 700, y: 480 },
        ],
      ],
    });
    expect(attempts).toHaveLength(1);
    expect(findButton("Keep unfinished stroke")).toBeUndefined();
  });

  test("keyboard positions construct the same vector stroke as pointer input", async () => {
    await mount();
    await click("Enable pointer drawing");
    await pointerEvent("pointerdown", 20, 30);
    await pointerEvent("pointerup", 70, 80);
    const pointerStrokes = work.sketch.strokes;
    await act(async () => replaceDrawing(emptySketch()));
    await position("x", 20);
    await position("y", 30);
    await click("Start a line here");
    expect(work.sketch.strokes).toEqual([[{ x: 200, y: 180 }]]);
    await position("x", 70);
    await position("y", 80);
    await click("Add this point to the line");
    await click("Finish this line");
    expect(work.sketch.strokes).toEqual(pointerStrokes);
    expect(findButton("Add this point to the line")?.disabled).toBe(true);
  });

  test("undo and confirmed clearing preserve the description and other worksheet work", async () => {
    const sketch: WorksheetSketch = {
      description: "An annotation worth keeping without the marks.",
      strokes: [[{ x: 10, y: 20 }], [{ x: 30, y: 40 }]],
    };
    await mount(sketch);
    const otherWork = { explanation: work.explanation, table: work.table };
    await click("Undo last stroke");
    expect(work.sketch.strokes).toEqual([sketch.strokes[0]]);
    await click("Clear drawing strokes");
    await click("Keep the drawing");
    expect(work.sketch.strokes).toEqual([sketch.strokes[0]]);
    await click("Clear drawing strokes");
    await click("Confirm clear drawing strokes");
    expect(work.sketch).toEqual({ description: sketch.description, strokes: [] });
    expect({ explanation: work.explanation, table: work.table }).toEqual(otherWork);
  });

  test("a refused stroke remains available and only an explicit retry may save it", async () => {
    await mount();
    await click("Enable pointer drawing");
    await pointerEvent("pointerdown", 20, 30);
    admit = false;
    await pointerEvent("pointerup", 70, 80);
    expect(work.sketch.strokes).toEqual([]);
    expect(attempts).toHaveLength(1);
    expect(findButton("Keep unfinished stroke")).toBeDefined();
    admit = true;
    await act(async () => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("beforeprint"));
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(attempts).toHaveLength(1);
    expect(work.sketch.strokes).toEqual([]);
    await click("Keep unfinished stroke");
    expect(work.sketch.strokes).toEqual([
      [
        { x: 200, y: 180 },
        { x: 700, y: 480 },
      ],
    ]);
    expect(findButton("Keep unfinished stroke")).toBeUndefined();
  });

  test("a replacement during a pointer stroke requires explicit consent before adding that stroke", async () => {
    await mount();
    await click("Enable pointer drawing");
    await pointerEvent("pointerdown", 20, 30);
    const imported: WorksheetSketch = {
      description: "Imported attempt",
      strokes: [[{ x: 90, y: 90 }]],
    };
    await act(async () => replaceDrawing(imported));
    await pointerEvent("pointerup", 70, 80);
    expect(work.sketch).toEqual(imported);
    expect(attempts).toEqual([]);
    await act(async () => {
      window.dispatchEvent(new Event("beforeprint"));
      window.dispatchEvent(new Event("blur"));
    });
    expect(work.sketch).toEqual(imported);
    expect(attempts).toEqual([]);
    await click("Discard unfinished stroke");
    expect(work.sketch).toEqual(imported);
  });

  test("replacing a keyboard drawing cannot reuse its old open line even when the last stroke matches", async () => {
    await mount({ description: "Earlier attempt", strokes: [[{ x: 10, y: 10 }]] });
    await click("Start a line here");
    const imported: WorksheetSketch = {
      description: "Imported attempt",
      strokes: [[{ x: 90, y: 90 }], [{ x: 500, y: 300 }]],
    };
    await act(async () => replaceDrawing(imported));
    await position("x", 70);
    await click("Add this point to the line");
    expect(work.sketch).toEqual(imported);
    expect(attempts).toHaveLength(1);
    expect(findButton("Add this point to the line")?.disabled).toBe(true);
  });

  test("another pointer's cancellation or capture loss does not finish the active stroke", async () => {
    await mount();
    await click("Enable pointer drawing");
    await pointerEvent("pointerdown", 20, 30);
    await pointerEvent("pointercancel", 30, 40, 2, false);
    await pointerEvent("lostpointercapture", 30, 40, 2, false);
    expect(attempts).toEqual([]);
    await pointerEvent("pointerup", 70, 80);
    expect(work.sketch.strokes).toEqual([
      [
        { x: 200, y: 180 },
        { x: 700, y: 480 },
      ],
    ]);
  });

  test("a full point budget cannot start a pointer stroke or keyboard line", async () => {
    const full: WorksheetSketch = {
      description: "A full drawing",
      strokes: Array.from({ length: SKETCH_LIMITS.points / SKETCH_LIMITS.pointsPerStroke }, () =>
        Array.from({ length: SKETCH_LIMITS.pointsPerStroke }, (_, x) => ({ x, y: 100 })),
      ),
    };
    await mount(full);
    await click("Start a line here");
    expect(attempts).toEqual([]);
    expect(work.sketch).toEqual(full);
    await click("Enable pointer drawing");
    await pointerEvent("pointerdown", 20, 30);
    expect(attempts).toEqual([]);
    expect(findButton("Keep unfinished stroke")).toBeUndefined();
    expect(host.textContent).toContain("The drawing is full");
  });
});
