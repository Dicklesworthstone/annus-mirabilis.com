import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { SketchPoint } from "../../experiments/predict/predictSketch.ts";
import { containsHeading } from "../../testing/headingText.ts";
import {
  createContainer,
  installDom,
  removeContainer,
  uninstallDom,
} from "../../testing/reactDom.ts";
import { PredictOverlay } from "./PredictOverlay.tsx";

describe("PredictOverlay (am-inst-predict-mode-ti7m)", () => {
  test("renders null when there is no prediction and no result points", () => {
    const html = renderToStaticMarkup(<PredictOverlay choice={null} resultPoints={[]} />);
    expect(html).toBe("");
  });

  test("distinguishes prediction and result curves and markers without relying on color", () => {
    const html = renderToStaticMarkup(
      <PredictOverlay
        choice={{
          form: "sketch",
          points: [
            [0, 0],
            [1, 1],
          ],
        }}
        resultPoints={[
          [0, 0],
          [0.5, 0.7],
          [1, 1],
        ]}
        resultLabel="Stokes-Einstein model"
        xLabel="Time (s)"
        yLabel="Displacement (μm)"
      />,
    );

    // Non-color distinctions in SVG
    expect(html).toContain('data-overlay-curve="prediction"');
    expect(html).toContain('stroke-dasharray="6 4"');
    expect(html).toContain('data-overlay-marker="prediction-square"');

    expect(html).toContain('data-overlay-curve="result"');
    expect(html).toContain('data-overlay-marker="result-round"');

    // Non-color distinctions in legend
    expect(html).toContain("[■ - - -]");
    expect(html).toContain("[● ───]");

    // Screen reader accessible descriptions and figure
    expect(html).toContain('<figure class="predict-overlay"');
    expect(html).toContain('data-predict-overlay=""');
    expect(containsHeading(html, "Prediction and result comparison")).toBe(true);
    expect(html).toContain(
      "Distinguished by pattern: prediction is dashed with square markers; result is solid with circular markers.",
    );
  });

  test("renders clear button when onClear callback is provided", () => {
    const html = renderToStaticMarkup(
      <PredictOverlay
        choice={{ form: "candidate", candidateId: "bm-01-predict-viscosity-root-two" }}
        resultPoints={[
          [0, 0],
          [1, 2],
        ]}
        onClear={() => {}}
      />,
    );

    expect(html).toContain("Clear comparison");
    expect(html).toContain("predict-overlay-clear");
  });

  test("handles verbal and values prediction descriptions accurately", () => {
    const verbalHtml = renderToStaticMarkup(
      <PredictOverlay
        choice={{
          form: "verbal",
          directionId: "increases",
          shapeId: "square-root",
        }}
        resultPoints={[
          [0, 0],
          [1, 1],
        ]}
      />,
    );
    expect(verbalHtml).toContain("Verbal: direction increases, shape square-root");

    const valuesHtml = renderToStaticMarkup(
      <PredictOverlay
        choice={{
          form: "values",
          targets: [{ targetId: "disp", value: 0.707 }],
        }}
        resultPoints={[
          [0, 0],
          [1, 1],
        ]}
      />,
    );
    expect(valuesHtml).toContain("Target values: disp=0.707");
    expect(valuesHtml).not.toContain('data-overlay-marker="prediction-square"');
    expect(valuesHtml).toContain("No authored x coordinate");
  });
});

describe("PredictOverlay coordinates, tables and interaction", () => {
  let container: HTMLElement;
  let root: Root;

  beforeEach(async () => {
    await installDom();
    container = createContainer();
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    removeContainer(container);
    await uninstallDom();
  });

  test("places named values at authored asymmetric coordinates, regardless of target order", async () => {
    await act(async () =>
      root.render(
        <PredictOverlay
          choice={{
            form: "values",
            targets: [
              { targetId: "right", value: 0.9 },
              { targetId: "left", value: 0.2 },
              { targetId: "middle", value: 0.75 },
            ],
          }}
          valueTargets={[
            { targetId: "middle", label: "Early rise", x: 2.5 },
            { targetId: "right", label: "Late value", x: 9 },
            { targetId: "left", label: "Beginning", x: 0 },
          ]}
          xRange={[0, 10]}
          yRange={[0, 2]}
          width={500}
          height={300}
        />,
      ),
    );
    const marks = [...container.querySelectorAll('[data-overlay-marker="prediction-square"]')];
    expect(marks.map((mark) => Number(mark.getAttribute("x")))).toEqual([36, 141, 414]);
    expect(marks.map((mark) => Number(mark.getAttribute("y")))).toEqual([234, 173.5, 157]);
    const rows = [...container.querySelectorAll('[data-overlay-table="prediction"] tbody tr')];
    expect(rows.map((row) => row.querySelector("th")?.textContent)).toEqual([
      "Late value",
      "Beginning",
      "Early rise",
    ]);
    expect(rows.map((row) => row.querySelector("td")?.textContent)).toEqual(["9", "0", "2.5"]);
  });

  test("keeps unmapped target values as text without fabricating a position", async () => {
    await act(async () =>
      root.render(
        <PredictOverlay
          choice={{
            form: "values",
            targets: [
              { targetId: "known", value: 0.25 },
              { targetId: "old-target", value: 0.875 },
            ],
          }}
          valueTargets={[{ targetId: "known", label: "Known location", x: 0.2 }]}
        />,
      ),
    );
    const marks = container.querySelectorAll('[data-overlay-marker="prediction-square"]');
    expect(marks.length).toBe(1);
    expect(Number(marks[0]?.getAttribute("x"))).toBe(88);
    expect(container.querySelector('[data-overlay-curve="prediction"]')).toBeNull();
    const missing = [
      ...container.querySelectorAll('[data-overlay-table="prediction"] tbody tr'),
    ].find((row) => row.querySelector("th")?.textContent === "old-target");
    expect(missing?.textContent).toContain("No authored x coordinate");
    expect(missing?.textContent).toContain("0.875");
    expect(missing?.textContent).toContain("Not placed");
  });

  test("the no-script disclosure retains every original prediction and exact selected accepted samples", () => {
    const results: SketchPoint[] = Array.from({ length: 101 }, (_, index) => [
      (index * index) / 13,
      (index + 0.123456789) / 19,
    ]);
    const prediction: SketchPoint[] = [
      [0.0123456789, 0.2],
      [0.3, 0.4],
      [0.3, 0.4],
    ];
    container.innerHTML = renderToStaticMarkup(
      <PredictOverlay choice={{ form: "sketch", points: prediction }} resultPoints={results} />,
    );
    const disclosure = container.querySelector("details");
    expect(disclosure?.querySelector("summary")?.textContent).toBe(
      "Read prediction and result values",
    );
    expect(disclosure?.hasAttribute("open")).toBe(false);
    const predictionRows = [
      ...container.querySelectorAll('[data-overlay-table="prediction"] tbody tr'),
    ];
    expect(
      predictionRows.map((row) =>
        [...row.querySelectorAll("td")].slice(0, 2).map((cell) => cell.textContent),
      ),
    ).toEqual(prediction.map((point) => point.map(String)));
    const resultRows = [...container.querySelectorAll('[data-overlay-table="result"] tbody tr')];
    expect(resultRows.length).toBeGreaterThan(1);
    expect(resultRows.length).toBeLessThan(results.length);
    const indices = resultRows.map((row) => Number(row.getAttribute("data-sample-index")));
    expect(indices[0]).toBe(0);
    expect(indices.at(-1)).toBe(results.length - 1);
    for (const [index, row] of resultRows.entries()) {
      const sampleIndex = Number(row.getAttribute("data-sample-index"));
      expect(sampleIndex).toBe(Math.round((index * 100) / (resultRows.length - 1)));
      expect([...row.querySelectorAll("td")].slice(0, 2).map((cell) => cell.textContent)).toEqual(
        results[sampleIndex]?.map(String),
      );
    }
    expect(container.querySelector('[data-overlay-table="result"] caption')?.textContent).toContain(
      `${resultRows.length} of 101 accepted samples, evenly spaced by sample index and including both endpoints`,
    );
    expect(container.querySelectorAll('[data-overlay-marker="result-round"]').length).toBe(
      results.length,
    );
  });

  test("clips both curves to each plot's own window while preserving outside samples", async () => {
    const resultPoints: SketchPoint[] = [
      [-2, 0.4],
      [0, 0.2],
      [5, 0.8],
    ];
    await act(async () =>
      root.render(
        <>
          <PredictOverlay
            choice={{
              form: "sketch",
              points: [
                [-1, 0.3],
                [1, 0.2],
              ],
            }}
            resultPoints={resultPoints}
            xRange={[-1, 1]}
            yRange={[0, 0.6]}
          />
          <PredictOverlay choice={null} resultPoints={resultPoints} />
        </>,
      ),
    );
    const plots = [...container.querySelectorAll(".predict-overlay-svg")];
    const clips = plots.map((plot) => plot.querySelector("clipPath")?.id);
    expect(clips[0]).toBeTruthy();
    expect(clips[1]).toBeTruthy();
    expect(clips[0]).not.toBe(clips[1]);
    for (const [index, plot] of plots.entries()) {
      expect(plot.querySelector("g")?.getAttribute("clip-path")).toBe(`url(#${clips[index]})`);
      for (const marker of plot.querySelectorAll("[data-overlay-marker]")) {
        expect(marker.parentElement?.tagName.toLowerCase()).toBe("g");
      }
    }
    const first = plots[0];
    expect(first?.getAttribute("viewBox")).toBe("0 0 340 260");
    expect(first?.querySelector('[data-overlay-marker="result-round"]')?.getAttribute("cx")).toBe(
      "-90",
    );
    const ticks = [...(first?.querySelectorAll("text") ?? [])].map((node) => node.textContent);
    expect(ticks).toContain("-1");
    expect(ticks).toContain("1");
    expect(ticks).toContain("0.6");
    const rows = [
      ...container.querySelectorAll('[data-overlay-table="result"]'),
    ][0]?.querySelectorAll("tbody tr");
    expect(rows?.[0]?.textContent).toContain("-2");
    expect(rows?.[0]?.textContent).toContain("Outside");
    expect(rows?.[1]?.textContent).toContain("Inside");
    expect(rows?.[2]?.textContent).toContain("Outside");
  });

  test("uses the supplied prediction label in the legend, plot and table", async () => {
    await act(async () =>
      root.render(
        <PredictOverlay
          choice={{
            form: "sketch",
            points: [
              [0, 0],
              [1, 1],
            ],
          }}
          predictionLabel="Shared prediction"
        />,
      ),
    );
    expect(container.querySelector("[data-legend-predict] strong")?.textContent).toBe(
      "Shared prediction",
    );
    expect(container.querySelector(".predict-overlay-svg")?.getAttribute("aria-label")).toContain(
      "comparing Shared prediction",
    );
    expect(
      container.querySelector('[data-overlay-table="prediction"] caption')?.textContent,
    ).toStartWith("Shared prediction:");
    expect(container.textContent).not.toContain("Your prediction");
  });

  test("clicking Clear comparison calls its owner and removes both layers", async () => {
    let clears = 0;
    function Comparison() {
      const [cleared, setCleared] = useState(false);
      return (
        <PredictOverlay
          choice={
            cleared
              ? null
              : {
                  form: "sketch",
                  points: [
                    [0, 0],
                    [1, 0.5],
                  ],
                }
          }
          resultPoints={
            cleared
              ? []
              : [
                  [0, 0],
                  [1, 1],
                ]
          }
          onClear={() => {
            clears++;
            setCleared(true);
          }}
        />
      );
    }
    await act(async () => root.render(<Comparison />));
    expect(container.querySelector('[data-overlay-curve="prediction"]')).not.toBeNull();
    expect(container.querySelector('[data-overlay-curve="result"]')).not.toBeNull();
    const button = container.querySelector<HTMLButtonElement>(".predict-overlay-clear");
    expect(button?.type).toBe("button");
    expect(button?.textContent).toBe("Clear comparison");
    expect(button?.getAttribute("aria-label")).toBe("Clear prediction and model overlay");
    await act(async () => button?.click());
    expect(clears).toBe(1);
    expect(container.querySelector("[data-predict-overlay]")).toBeNull();
  });
});
