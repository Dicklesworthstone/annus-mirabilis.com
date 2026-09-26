/**
 * THE SPEED-SPREAD FIGURE'S LABELS SIT UNDER WHAT THEY LABEL, AND NOTHING OVERLAPS (dispatch 280).
 *
 * The owner: "this graph is messed up and has overlapping elements". Measured on the drawing of
 * 57ee48eb: the numbers ±295 stood between the dashed edges of the shaded middle (half a width)
 * and under no mark; "−590" and "−295" were 38 units apart with labels about 34 wide; and the
 * dashed axis ran over the tails' heavy outline.
 *
 * The labels are SVG text in the drawing's own units (13.2, the site-wide fine size), so their size
 * against the drawing is the same at every width and zoom: a layout that clears here clears at
 * 320px, 390px, 1440px and 200%. A label's box is bounded by 0.66 em a character across, 1 em
 * above its baseline and 0.3 below: in Chromium, on the build of 61f173a7, "−590" measured 33.7
 * units across and 1.25 em high at this size. The figure is read from the component's own markup
 * and its stylesheet, as they ship, for each particle the reader can label it for.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { PARTICLES } from "../../foundations/speedSpread.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { SpeedSpread } from "./SpeedSpread.tsx";

/** The site-wide label size: globals.css, svg[role="img"] text, var(--type-fine), 0.825rem. */
const LABEL_SIZE = 13.2;
const EM_ACROSS_PER_CHARACTER = 0.66;
/** The least clear space between two neighbouring numbers: half an em. */
const LEAST_GAP_EM = 0.5;

type Axis = Readonly<{
  width: number;
  numbers: readonly Readonly<{ text: string; x: number }>[];
  /** The x of every mark a number could stand under. */
  marks: readonly number[];
  markBottom: number;
  numberBaseline: number;
  title: Readonly<{ text: string; x: number; baseline: number }>;
  /** Stroked lines, other than the axis, that run along the axis. */
  strokedAlongAxis: number;
}>;

const across = (text: string) => [...text].length * EM_ACROSS_PER_CHARACTER * LABEL_SIZE;

/** Every way the axis can be read wrong, by name. */
function axisProblems(a: Axis): string[] {
  const problems: string[] = [];
  for (const n of a.numbers) {
    const nearest = a.marks.length ? Math.min(...a.marks.map((m) => Math.abs(m - n.x))) : Infinity;
    if (!(nearest <= 0.5)) problems.push(`"${n.text}" stands under no mark`);
    const half = across(n.text) / 2;
    if (n.x - half < 0 || n.x + half > a.width) problems.push(`"${n.text}" runs off the drawing`);
  }
  const sorted = [...a.numbers].sort((p, q) => p.x - q.x);
  for (let i = 1; i < sorted.length; i++) {
    const [left, right] = [sorted[i - 1], sorted[i]] as const;
    if (!left || !right) continue;
    const gap = right.x - across(right.text) / 2 - (left.x + across(left.text) / 2);
    if (gap < LEAST_GAP_EM * LABEL_SIZE) problems.push(`"${left.text}" and "${right.text}" crowd`);
  }
  if (a.numberBaseline - LABEL_SIZE < a.markBottom) problems.push("the numbers touch the ticks");
  if (a.title.baseline - LABEL_SIZE < a.numberBaseline + 0.3 * LABEL_SIZE)
    problems.push("the title touches the numbers");
  const titleHalf = across(a.title.text) / 2;
  if (a.title.x - titleHalf < 0 || a.title.x + titleHalf > a.width)
    problems.push("the title runs off the drawing");
  if (a.strokedAlongAxis > 0)
    problems.push(`${a.strokedAlongAxis} stroked lines run along the axis`);
  return problems;
}

const css = readFileSync(join(process.cwd(), "src/components/foundations/foundations.css"), "utf8");
/** Whether the stylesheet strokes a class: a rule for it sets a stroke other than none. */
function stroked(className: string): boolean {
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) =>
    (m[1] ?? "").split(",").some((s) => s.trim() === `.${className}`),
  );
  return rules.some((m) => /(^|;)\s*stroke\s*:\s*(?!none\b)\S/.test(m[2] ?? ""));
}

/** The points of a path, in order. */
const points = (d: string) =>
  [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => [Number(m[1]), Number(m[2])]);
/** Whether a path has a segment lying along the horizontal line at `level`. */
const runsAlong = (d: string, level: number) => {
  const p = points(d);
  return p.some(
    (q, i) => i > 0 && q[1] === level && p[i - 1]?.[1] === level && q[0] !== p[i - 1]?.[0],
  );
};

/** The figure as the component draws it, read back from the page. */
function drawnAxis(root: ParentNode): Axis {
  const svg = root.querySelector(
    '[data-foundation-construction="temperature-thermal-energy"] svg[role="img"]',
  );
  if (!svg) throw new Error("the figure is not drawn");
  const texts = [...svg.querySelectorAll("text")];
  const title = texts.at(-1);
  const ticks = [...svg.querySelectorAll("line[data-tick]")];
  const lines = [...svg.querySelectorAll("line")];
  // The axis: the longest horizontal line.
  const axis = lines
    .filter((l) => l.getAttribute("y1") === l.getAttribute("y2"))
    .sort(
      (p, q) =>
        Math.abs(Number(q.getAttribute("x2")) - Number(q.getAttribute("x1"))) -
        Math.abs(Number(p.getAttribute("x2")) - Number(p.getAttribute("x1"))),
    )[0];
  const level = Number(axis?.getAttribute("y1"));
  return {
    width: Number(svg.getAttribute("viewBox")?.split(" ")[2]),
    numbers: texts
      .slice(0, -1)
      .map((t) => ({ text: t.textContent ?? "", x: Number(t.getAttribute("x")) })),
    marks: ticks.map((l) => Number(l.getAttribute("x1"))),
    markBottom: Math.max(level, ...ticks.map((l) => Number(l.getAttribute("y2")))),
    numberBaseline: Number(texts[0]?.getAttribute("y")),
    title: {
      text: title?.textContent ?? "",
      x: Number(title?.getAttribute("x")),
      baseline: Number(title?.getAttribute("y")),
    },
    strokedAlongAxis: [...svg.querySelectorAll("path")].filter(
      (p) =>
        (p.getAttribute("class") ?? "").split(/\s+/).some(stroked) &&
        runsAlong(p.getAttribute("d") ?? "", level),
    ).length,
  };
}

describe("the speed-spread figure's axis", () => {
  let container: HTMLElement;
  beforeEach(async () => {
    await installDom();
    container = createContainer();
  });
  afterEach(async () => {
    removeContainer(container);
    await uninstallDom();
  });

  test("for each particle: every number under its own tick, none crowding, the axis alone on the axis", async () => {
    const root = createRoot(container);
    await act(async () => root.render(<SpeedSpread />));
    let read = 0;
    for (const p of PARTICLES) {
      const button = [...container.querySelectorAll("button")].find(
        (b) => b.textContent === p.name,
      );
      await act(async () => button?.click());
      const axis = drawnAxis(container);
      // The denominator: what was read.
      console.log(
        `[speed spread] ${p.id}: ${axis.numbers.length} numbers, ${axis.marks.length} ticks, width ${axis.width}: ${axis.numbers.map((n) => n.text).join(" ")}`,
      );
      expect(axis.numbers.length).toBe(5);
      expect(axisProblems(axis)).toEqual([]);
      read++;
    }
    expect(read).toBe(PARTICLES.length);
    await act(async () => root.unmount());
  });

  test("the plant: the drawing of 57ee48eb is refused, for each of the owner's faults by name", () => {
    // Its geometry: 250 units, a width of 38, numbers at 0, ±1 and ±2 widths 18 below the axis,
    // no ticks. The only lines meeting the axis were the shaded middle's dashed edges at half a
    // width and the tails' edges at two widths; the tails were closed, outlined paths, so their
    // heavy stroke ran along the axis at both ends, under the dashed axis.
    const at = (u: number) => 125 + u * 38;
    const numbers = [-2, -1, 0, 1, 2].map((u) => ({
      text: u < 0 ? `−${-u * 295}` : String(u * 295),
      x: at(u),
    }));
    const problems = axisProblems({
      width: 250,
      numbers,
      marks: [at(-2), at(-0.5), at(0.5), at(2)],
      markBottom: 128,
      numberBaseline: 146,
      title: { text: "speed along one axis, m/s", x: 125, baseline: 166 },
      strokedAlongAxis: 2,
    });
    expect(problems).toContain('"−295" stands under no mark');
    expect(problems).toContain('"295" stands under no mark');
    expect(problems).toContain('"−590" and "−295" crowd');
    expect(problems).toContain("2 stroked lines run along the axis");
  });

  test("the stroke and segment readers see a stroke and a run, and see none where there is none", () => {
    // They decide which paths count, so each is shown to work both ways.
    expect(stroked("speed-spread-tail-edge")).toBe(true);
    expect(stroked("curves-overlap")).toBe(true);
    expect(stroked("speed-spread-tail")).toBe(false);
    expect(stroked("speed-spread-middle")).toBe(false);
    expect(runsAlong("M10,128 L20,128", 128)).toBe(true);
    expect(runsAlong("M10,128 L10,100", 128)).toBe(false);
  });
});
