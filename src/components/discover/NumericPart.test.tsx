import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { type NumericExercisePart, NumericPart } from "./NumericPart.tsx";

/** NumericPart's static rendering (am-disc-exercise-checker-i4h2): what a reader gets before, or without, JavaScript. */

const PART: NumericExercisePart = {
  id: "demo-numeric",
  prompt: "How far along one axis in one second?",
  workedExplanation: "The root of 2·D·t.",
  family: "length",
  units: ["um", "nm", "m"],
  reference: {
    value: 7.947832833416785e-7,
    resultStatus: "value",
    quantityId: "rmsDisplacement1d",
    constantSetId: "einstein-1905-brownian-printed",
    owner: "diffusion.rmsDisplacement",
    executionLabel: "Ideal model, host calculation",
  },
  tolerance: { absolute: 0, relative: 0.01 },
  toleranceReason: "Within 1 percent is the same answer.",
};

const html = renderToStaticMarkup(<NumericPart part={PART} />);

describe("NumericPart: static rendering", () => {
  test("the prompt, a labelled value box, and a unit menu with an accessible name", () => {
    expect(html).toContain("How far along one axis in one second?");
    expect(html).toMatch(/<label for="[^"]+-value">Your answer<\/label>/);
    expect(html).toContain('aria-label="Unit"');
  });

  test("the unit menu offers the part's units as a reader writes them, μm first", () => {
    const options = [...html.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map(
      (m) => `${m[1]}=${m[2]}`,
    );
    expect(options).toEqual(["um=μm", "nm=nm", "m=m"]);
  });

  test("without JavaScript it says checking needs it, and the worked explanation still opens", () => {
    expect(html).toContain("Checking your answer needs JavaScript.");
    expect(html).toContain("<summary>Show a worked explanation</summary>");
    expect(html).toContain("The root of 2·D·t.");
    expect(html).toContain("Within 1 percent is the same answer.");
  });

  test("invalid settings say the exercise is unavailable", () => {
    const markup = renderToStaticMarkup(<NumericPart part={{ ...PART, units: ["kg"] }} />);
    expect(markup).toContain("This exercise is unavailable because its settings are invalid.");
  });
});
