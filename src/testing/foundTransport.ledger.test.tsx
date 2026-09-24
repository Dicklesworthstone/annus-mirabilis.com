import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EnergyLedger } from "../components/foundations/EnergyLedger.tsx";
import { checkVoice } from "../content/checks/voice/index.ts";
import {
  amount,
  DISTANCES,
  FORCES,
  ledger,
  MASSES,
  START_SPEEDS,
  ZEROS,
} from "../foundations/energyLedger.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * am-found-transport-thermo-smv3: the work-energy lesson's construction, "a before-and-after
 * energy ledger", whose entry point is force through distance and whose lesson is that energy is
 * counted from a chosen zero, so only differences are fixed.
 */

const close = (a: number, b: number) =>
  withinTolerance(a, b, { relative: 1e-12, absolute: 1e-12 }).ok;
const every = MASSES.flatMap((mass) =>
  START_SPEEDS.flatMap((startSpeed) =>
    FORCES.flatMap((force) =>
      DISTANCES.flatMap((distance) =>
        ZEROS.map((zero) => ({ mass, startSpeed, force, distance, zero })),
      ),
    ),
  ),
);

describe("the ledger", () => {
  test("its default is the lesson's worked example read the other way: 6 J, a 3 kg body at 2 m/s", () => {
    const row = ledger({ mass: 3, startSpeed: 0, force: 3, distance: 2, zero: 0 });
    expect(row.work).toBe(6);
    expect(row.after).toBe(6);
    expect(row.speedAfter).toBe(2);
    // And the lesson's numbers directly: a 3 kg body at 2 m/s has 6 J, a 2 kg body 4 J.
    expect(ledger({ mass: 3, startSpeed: 2, force: 1, distance: 1, zero: 0 }).before).toBe(6);
    expect(ledger({ mass: 2, startSpeed: 2, force: 1, distance: 1, zero: 0 }).before).toBe(4);
  });

  test(`over all ${every.length} choices: the energy of motion rises by exactly the work`, () => {
    expect(every.length).toBeGreaterThan(100);
    for (const input of every) {
      const row = ledger(input);
      expect(close(row.after - row.before, row.work)).toBe(true);
      expect(close(row.countedAfter - row.countedBefore, row.work)).toBe(true);
      expect(close(0.5 * input.mass * row.speedAfter ** 2, row.after)).toBe(true);
    }
  });

  test("the chosen zero moves both totals and changes no difference, and no speed", () => {
    for (const input of every) {
      const reference = ledger({ ...input, zero: 0 });
      const row = ledger(input);
      expect(close(row.countedBefore - reference.countedBefore, input.zero)).toBe(true);
      expect(close(row.countedAfter - reference.countedAfter, input.zero)).toBe(true);
      expect(row.work).toBe(reference.work);
      expect(row.speedAfter).toBe(reference.speedAfter);
    }
  });

  test("from rest, twice the distance gives twice the work and √2 times the speed", () => {
    const one = ledger({ mass: 3, startSpeed: 0, force: 3, distance: 2, zero: 0 });
    const two = ledger({ mass: 3, startSpeed: 0, force: 3, distance: 4, zero: 0 });
    expect(two.work).toBe(2 * one.work);
    expect(close(two.speedAfter / one.speedAfter, Math.SQRT2)).toBe(true);
    expect(amount(Math.SQRT2)).toBe("1.41");
  });

  test("amounts print as the lessons print them", () => {
    expect(amount(1_000_006)).toBe("1 000 006");
    expect(amount(Math.sqrt(12))).toBe("3.46");
    expect(amount(6)).toBe("6");
  });
});

describe("the rendered construction", () => {
  const html = renderToStaticMarkup(<EnergyLedger />);
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  test("the default state, announced, and the ledger's three rows", () => {
    expect(html).toContain('data-foundation-construction="work-energy"');
    expect(html).toContain('role="status"');
    expect(text).toContain(
      "The push does 3 N × 2 m = 6 J of work, and the 3 kg body goes from 0 to 2 m/s.",
    );
    expect(html.match(/<th scope="row">/g)?.length).toBe(3);
  });

  test("every choice is a pressed-state button", () => {
    const choices =
      MASSES.length + START_SPEEDS.length + FORCES.length + DISTANCES.length + ZEROS.length;
    expect(html.match(/aria-pressed=/g)?.length).toBe(choices);
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(5);
  });

  test("the words say what the default shows, and pass the voice lint", () => {
    expect(text).toContain("A push of 3 N through 2 m does 6 J of work");
    expect(text).toContain("a speed of 2 m/s");
    const errors = checkVoice(text, { context: "prose" }).filter((f) => f.severity === "error");
    expect(errors.map((f) => `${f.rule}: ${f.matchedText}`)).toEqual([]);
  });
});
