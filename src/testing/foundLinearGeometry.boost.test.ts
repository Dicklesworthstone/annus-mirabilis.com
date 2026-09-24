import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BoostTable } from "../components/foundations/BoostTable.tsx";
import { type BoostOutcome, boost, boostTyped } from "../foundations/boostMap.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * The event-table transformer of foundation:matrices-linear-maps (am-found-linear-geometry-7w15).
 * Units are light-seconds and seconds, so c = 1.
 */

type Mapped = Extract<BoostOutcome, { status: "mapped" }>["table"];
const mapped = (outcome: BoostOutcome): Mapped => {
  expect(outcome.status).toBe("mapped");
  return (outcome as Extract<BoostOutcome, { status: "mapped" }>).table;
};
const close = (actual: number, reference: number) =>
  expect(withinTolerance(actual, reference, { absolute: 1e-12, relative: 1e-12 }).ok).toBe(true);
const event = (t: Mapped, id: string) => {
  const found = t.transformed.find((e) => e.id === id);
  expect(found).toBeDefined();
  return found as Mapped["transformed"][number];
};

describe("the relativistic map at 0.6c", () => {
  const t = mapped(boost(0.6, "relativistic"));

  test("its table is (1.25, −0.75; −0.75, 1.25), with determinant 1", () => {
    close(t.p, 1.25);
    close(t.q, -0.75);
    close(t.r, -0.75);
    close(t.s, 1.25);
    close(t.determinant, 1);
  });

  test("it keeps the light lines, stretching them by 0.5 and 2", () => {
    expect(t.keepsForwardLight).toBe(true);
    close(t.stretch?.forward ?? Number.NaN, 0.5);
    close(t.stretch?.backward ?? Number.NaN, 2);
  });

  test("the four events: simultaneous ones split by 7.5 s, and the flash stays on its light line", () => {
    const far = event(t, "far");
    close(far.xPrime, 12.5);
    close(far.tPrime, -7.5);
    const later = event(t, "later");
    close(later.xPrime, -7.5);
    close(later.tPrime, 12.5);
    const flash = event(t, "flash");
    close(flash.xPrime, 5);
    close(flash.tPrime, 5);
  });

  test("the opposite speed swaps the two stretches", () => {
    const back = mapped(boost(-0.6, "relativistic"));
    close(back.stretch?.forward ?? Number.NaN, 2);
    close(back.stretch?.backward ?? Number.NaN, 0.5);
  });
});

describe("the Galilean map at 0.6c", () => {
  const g = mapped(boost(0.6, "galilean"));

  test("adversarial: its determinant is also 1, so the determinant alone cannot tell the rules apart", () => {
    close(g.determinant, 1);
  });

  test("it keeps simultaneous events simultaneous and slows the flash to 0.4", () => {
    close(event(g, "far").tPrime, 0);
    expect(g.keepsForwardLight).toBe(false);
    expect(g.stretch).toBeNull();
    const flash = event(g, "flash");
    close(flash.xPrime / flash.tPrime, 0.4);
  });
});

describe("what a reader types", () => {
  test("a decimal comma and a true minus sign read as the numbers they are", () => {
    close(mapped(boostTyped("0,6", "relativistic")).speedRatio, 0.6);
    close(mapped(boostTyped("−0.6", "relativistic")).speedRatio, -0.6);
    close(mapped(boostTyped("0.99", "relativistic")).factor, 1 / Math.sqrt(1 - 0.99 ** 2));
  });

  test("the speed of light, beyond it, and unreadable text are refused with a reason", () => {
    for (const text of ["1", "-1", "1.5", "abc", ""]) {
      const outcome = boostTyped(text, "relativistic");
      expect(outcome.status).toBe("refused");
    }
    const atLight = boostTyped("1", "relativistic");
    expect(atLight.status === "refused" && atLight.message).toContain(
      "No frame moves at the speed of light",
    );
  });
});

describe("the construction as served", () => {
  const html = renderToStaticMarkup(createElement(BoostTable));
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

  test("its first render, before any script runs, shows the 0.6c table and its readouts", () => {
    expect(html).toContain('data-foundation-construction="matrices-linear-maps"');
    expect(text).toContain("x′ = 1.25 x − 0.75 t");
    expect(text).toContain("t′ = −0.75 x + 1.25 t");
    expect(text).toContain("γ = 1.25. Determinant 1.");
    expect(text).toContain("stretched by 0.5 and 2");
    expect(text).toContain("(x′, t′) = (12.5, −7.5)");
    expect(text).toContain("happens 7.5 seconds earlier than the one at the origin");
  });

  test("it offers typed entry beside the slider", () => {
    expect(html).toContain('type="range"');
    expect(html).toContain('inputMode="decimal"');
  });
});
