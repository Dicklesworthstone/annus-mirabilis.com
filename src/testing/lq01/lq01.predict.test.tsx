import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WaveDescriptionLab } from "../../components/lab/WaveDescriptionLab.tsx";
import { InterferencePlot, SpreadingPlot } from "../../components/lab/WaveDescriptionPlots.tsx";
import type { PreparedLq01Example } from "../../experiments/lq01/session.ts";
import rawLq01Example from "../../generated/lq01-example.json";
import { PREDICT_PROMPTS } from "../../generated/predict-prompts.ts";

/**
 * LQ-01 under predict mode (am-inst-predict-mode-ti7m, dispatch 156 option c). The controls and the
 * drawings' frames stay in view. The curve and the numbers a prompt asks about wait for an answer
 * or a skip. The shared table in PredictGate.test.tsx covers the waiting and the reveal; this file
 * covers what that table cannot see: which prompt the page asks, and what the drawings' accessible
 * names say while their numbers wait.
 */
const example = rawLq01Example as unknown as PreparedLq01Example;
const waiting = { "data-predict-response": "awaiting" } as const;
const shown = { "data-predict-response": "shown" } as const;

describe("LQ-01 asks one prompt per view", () => {
  test("the two-source view asks the phase prompt only, and the controls come before its answer", () => {
    expect(example.parameters.mode).toBe("interference");
    const html = renderToStaticMarkup(<WaveDescriptionLab example={example} />);
    const [phase, distance] = ["lq-01-predict-phase-shift", "lq-01-predict-inverse-square"].map(
      (id) => PREDICT_PROMPTS["lq-01"]?.find((p) => p.promptId === id),
    );
    expect(phase && distance).toBeTruthy();
    expect(html).toContain(`data-predict-prompt="${phase?.promptId}"`);
    expect(html).not.toContain(`data-predict-prompt="${distance?.promptId}"`);
    // The view choice, then the question, then the presets; the drawings follow the form.
    const view = html.indexOf("Two sources meeting on a screen");
    const panel = html.indexOf('data-predict-gate="awaiting"');
    const presets = html.indexOf("<legend>Try</legend>");
    const curve = html.indexOf('data-view-id="lq-01-interference-plot"');
    expect(view).toBeGreaterThan(-1);
    expect(view < panel && panel < presets && presets < curve).toBe(true);
    expect(html).toMatch(/data-view-id="lq-01-data-table"[^>]*data-predict-response="awaiting"/);
    expect(html).not.toContain('data-predict-response="shown"');
  });
});

describe("a drawing's name does not state what waits", () => {
  const interference = {
    screenIntensity: new Float64Array([0, 2, 4, 2, 0]),
    centerIntensity: 4,
    fringeVisibility: 1,
    fringeSpacing: 3.3,
    pathDifference: 0,
    selectedIntensity: 4,
    screenPosition: "center",
    readout: "time-average",
    delta: 0,
  } as const;

  test("the interference curve, the probe reading and the centre's numbers wait", () => {
    const html = renderToStaticMarkup(<InterferencePlot {...interference} response={waiting} />);
    expect(html).toContain('aria-label="Interference intensity profile across the screen"');
    expect(html).not.toContain("center intensity 4.00");
    expect(html).toMatch(/<polyline data-predict-response="awaiting"/);
    expect(html).toMatch(/<g data-predict-response="awaiting"><circle[^>]*><\/circle><text/);
    expect(html).toMatch(/<span data-predict-response="awaiting">At the centre/);
    // The frame stays: the axis title and the probe's position line.
    expect(html).toContain("Position on the screen, y");
  });

  test("once shown, the name states the centre's intensity and the visibility again", () => {
    const html = renderToStaticMarkup(<InterferencePlot {...interference} response={shown} />);
    expect(html).toContain("center intensity 4.00 and fringe visibility 1.00");
  });

  test("the spreading drawing is not named by its law, and its readouts wait", () => {
    const html = renderToStaticMarkup(
      <SpreadingPlot power={1} radius={2} intensity={0.0199} shellPower={1} response={waiting} />,
    );
    expect(html).not.toMatch(/inverse square/i);
    expect(html).toContain(
      'aria-label="Spherical shells around a source of power P = 1 W, with the shell at radius r = 2 m marked"',
    );
    expect(html).toMatch(/<span data-predict-response="awaiting"[^>]*>∫ I dA over the sphere/);
    expect(html).toMatch(/<p data-predict-response="awaiting"[^>]*><span[^>]*>I\(r\) = P/);
  });
});
