/**
 * "Explore the equations in this step" loads one argument's payload, not its paper's
 * (LazyArgumentEquations, build-equations.ts). Two things must hold for that to be safe:
 *
 *   - each per-argument payload is exactly its paper payload filtered to that argument, in the
 *     same order, so a step shows the same cards it showed when it loaded the whole paper;
 *   - the mounted disclosure renders that step's cards and nothing else, and an id outside the
 *     argument grammar is refused before any import is attempted.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createContainer, installDom, removeContainer, uninstallDom } from "../testing/reactDom.ts";
import { LazyArgumentEquations } from "./LazyArgumentEquations.tsx";

const GENERATED = join(dirname(fileURLToPath(import.meta.url)), "..", "generated");
const PAPER_PAYLOADS = [
  "brownian-equations",
  "light-quanta-equations",
  "mass-energy-equations",
  "special-relativity-equations",
] as const;

type Equation = { id: string; argument?: string };
type Payload = { equations: Equation[]; foundationTitles?: Record<string, string> };
const read = (file: string): Payload =>
  JSON.parse(readFileSync(join(GENERATED, `${file}.json`), "utf8")) as Payload;

describe("per-argument equation payloads", () => {
  test("each argument's payload is its paper's payload filtered to it, in order", () => {
    let argumentsChecked = 0;
    for (const paper of PAPER_PAYLOADS) {
      const whole = read(paper);
      const byArgument = new Map<string, Equation[]>();
      for (const equation of whole.equations) {
        if (!equation.argument) continue;
        byArgument.set(equation.argument, [...(byArgument.get(equation.argument) ?? []), equation]);
      }
      for (const [argument, own] of byArgument) {
        const part = read(`argument-equations/${argument}`);
        expect(part.equations).toEqual(own);
        // Every lesson title the step's notes cite is the one the paper payload gives it.
        for (const [id, title] of Object.entries(part.foundationTitles ?? {}))
          expect(whole.foundationTitles?.[id]).toBe(title);
        argumentsChecked += 1;
      }
    }
    // Non-vacuity: 39 arguments carried equations when this was written; any fall to zero
    // would mean the loop compared nothing.
    expect(argumentsChecked).toBeGreaterThan(30);
  });
});

describe("LazyArgumentEquations", () => {
  beforeEach(installDom);
  afterEach(uninstallDom);

  async function openFor(argumentId: string) {
    const container = createContainer();
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(LazyArgumentEquations, {
          argumentId,
          sectionHref: "/papers/special-relativity/s5/",
          title: "The denominator changes as well",
        }),
      );
    });
    const details = container.querySelector("details");
    if (!details) throw new Error("no disclosure rendered");
    await act(async () => {
      details.open = true;
      details.dispatchEvent(new Event("toggle"));
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    return { container, root };
  }

  test("opening a step renders that step's cards and only those", async () => {
    const argumentId = "arg-sr-velocity-composition";
    const expected = read("special-relativity-equations")
      .equations.filter((equation) => equation.argument === argumentId)
      // A card's rendered id carries the scope it is shown in (EquationScope `reader-<argument>`).
      .map((equation) => `${equation.id}-reader-${argumentId}`);
    expect(expected.length).toBeGreaterThan(0);
    const { container, root } = await openFor(argumentId);
    const shown = [...container.querySelectorAll("[data-equation-id]")].map((e) =>
      e.getAttribute("data-equation-id"),
    );
    expect(shown).toEqual(expected);
    expect(container.querySelector("details")?.getAttribute("data-equations-loaded")).toBe("true");
    await act(async () => root.unmount());
    removeContainer(container);
  });

  test("an id outside the argument grammar is refused, and the section link stays", async () => {
    const { container, root } = await openFor("../special-relativity-equations");
    expect(container.querySelectorAll("[data-equation-id]").length).toBe(0);
    expect(container.textContent).toContain("The equations did not load here.");
    expect(container.querySelector('a[href="/papers/special-relativity/s5/"]')).not.toBeNull();
    await act(async () => root.unmount());
    removeContainer(container);
  });
});
