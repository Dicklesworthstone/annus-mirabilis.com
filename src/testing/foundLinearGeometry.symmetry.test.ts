import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DescriptionOrWorld } from "../components/foundations/DescriptionOrWorld.tsx";
import {
  CHANGE_CASES,
  COMMAND_CLASSES,
  kindOf,
  MOVING_PULSES,
} from "../foundations/descriptionOrWorld.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * The "change the description, keep the world" comparison of foundation:conservation-symmetry
 * (am-found-linear-geometry-7w15), classified in the runtime's own command-class vocabulary.
 */

describe("the classification", () => {
  test("every change uses one of the runtime's six command classes, and all six appear", () => {
    for (const c of CHANGE_CASES) expect(COMMAND_CLASSES).toContain(c.commandClass);
    expect(new Set(CHANGE_CASES.map((c) => c.commandClass))).toEqual(new Set(COMMAND_CLASSES));
  });

  test("only setup changes and physical interventions change the world", () => {
    for (const cls of COMMAND_CLASSES) {
      const world = cls === "setup-change" || cls === "physical-intervention";
      expect(kindOf(cls)).toBe(world ? "world" : "description");
    }
  });

  test("a change of description never changes the outcome", () => {
    const description = CHANGE_CASES.filter((c) => kindOf(c.commandClass) === "description");
    expect(description.length).toBeGreaterThan(0);
    for (const c of description) expect(c.outcomeChanges).toBe(false);
  });

  test("there is a symmetry (a world change with the same outcome) and a real change", () => {
    const world = CHANGE_CASES.filter((c) => kindOf(c.commandClass) === "world");
    expect(world.some((c) => !c.outcomeChanges)).toBe(true);
    expect(world.some((c) => c.outcomeChanges)).toBe(true);
  });
});

describe("the moving observer's numbers are the lesson's", () => {
  test("pulses of 0.25L and L at 0.6c, 1.25L in all", () => {
    expect(withinTolerance(MOVING_PULSES.forward, 0.25, { relative: 1e-12 }).ok).toBe(true);
    expect(withinTolerance(MOVING_PULSES.backward, 1, { relative: 1e-12 }).ok).toBe(true);
    const moving = CHANGE_CASES.find((c) => c.id === "moving-observer");
    expect(moving?.changes).toContain("0.25L and L instead of 0.5L each, 1.25L in all");
  });
});

describe("the construction as served", () => {
  const html = renderToStaticMarkup(createElement(DescriptionOrWorld));
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

  test("its first render, before any script runs, reads out the moving observer", () => {
    expect(html).toContain('data-foundation-construction="conservation-symmetry"');
    expect(text).toContain("This is an observer change: a change of description.");
    expect(text).toContain(
      "Nothing in the experiment changes, only how it is described or recorded.",
    );
  });

  test("every change is a radio in one group, with the first checked", () => {
    const radios = html.match(/type="radio"/g) ?? [];
    expect(radios.length).toBe(CHANGE_CASES.length);
    const names = new Set([...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1]));
    expect(names.size).toBe(1);
    expect((html.match(/checked=""/g) ?? []).length).toBe(1);
  });
});
