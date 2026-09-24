import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TurnedAxes } from "../components/foundations/TurnedAxes.tsx";
import {
  ALIGNED_ANGLE,
  ARROW,
  type AxesOutcome,
  turnAxes,
  turnAxesTyped,
} from "../foundations/vectorAxes.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * The turnable-axes construction of foundation:vectors-components (am-found-linear-geometry-7w15):
 * turning the axes changes the components and never the length, and it is not the same operation
 * as turning the arrow.
 */

type Turned = Extract<AxesOutcome, { status: "turned" }>["axes"];
const turned = (outcome: AxesOutcome): Turned => {
  expect(outcome.status).toBe("turned");
  return (outcome as Extract<AxesOutcome, { status: "turned" }>).axes;
};
const close = (actual: number, reference: number, absolute = 1e-9) =>
  expect(withinTolerance(actual, reference, { absolute, relative: absolute }).ok).toBe(true);

describe("components in turned axes", () => {
  test("0°: 3 along x and 4 along y", () => {
    const a = turned(turnAxes(0));
    close(a.along, 3);
    close(a.across, 4);
  });

  test("36.87°, where cos θ = 0.8: 4.8 and 1.4", () => {
    const a = turned(turnAxes(36.87));
    close(a.along, 4.8, 1e-4);
    close(a.across, 1.4, 1e-4);
  });

  test("90°: 4 along x′ and −3 along y′", () => {
    const a = turned(turnAxes(90));
    close(a.along, 4);
    close(a.across, -3);
  });

  test("about 53.13°: the new x axis lies along the arrow, and only there in (0°, 90°)", () => {
    close(ALIGNED_ANGLE, (Math.atan2(4, 3) * 180) / Math.PI);
    expect(turned(turnAxes(ALIGNED_ANGLE)).aligned).toBe(true);
    expect(turned(turnAxes(53.13)).aligned).toBe(true);
    expect(turned(turnAxes(50)).aligned).toBe(false);
    expect(turned(turnAxes(ALIGNED_ANGLE + 180)).aligned).toBe(false);
  });

  test("the length is 5 at every angle from −360° to 360°", () => {
    let checked = 0;
    for (let angle = -360; angle <= 360; angle += 15) {
      close(turned(turnAxes(angle)).length, 5);
      checked += 1;
    }
    expect(checked).toBe(49);
  });

  test("adversarial: turning the axes is not turning the arrow", () => {
    // Turning the arrow itself by +θ gives (3 cos θ − 4 sin θ, 3 sin θ + 4 cos θ): (0, 5) at 36.87°.
    const a = turned(turnAxes(36.87));
    const radians = (36.87 * Math.PI) / 180;
    const arrowTurned = {
      x: ARROW.x * Math.cos(radians) - ARROW.y * Math.sin(radians),
      y: ARROW.x * Math.sin(radians) + ARROW.y * Math.cos(radians),
    };
    expect(withinTolerance(a.along, arrowTurned.x, { absolute: 0.1 }).ok).toBe(false);
    expect(withinTolerance(a.across, arrowTurned.y, { absolute: 0.1 }).ok).toBe(false);
  });
});

describe("what a reader types", () => {
  test("a decimal comma, a true minus sign and a degree sign read as the angle they are", () => {
    close(turned(turnAxesTyped("36,87")).angle, 36.87);
    close(turned(turnAxesTyped("−45°")).angle, -45);
  });

  test("an empty field, text and an angle beyond a full turn are refused", () => {
    for (const text of ["", "abc", "400", "-400"])
      expect(turnAxesTyped(text).status).toBe("refused");
  });
});

describe("the construction as served", () => {
  const html = renderToStaticMarkup(createElement(TurnedAxes));
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

  test("its first render, before any script runs, shows the 36.87° components and the kept length", () => {
    expect(html).toContain('data-foundation-construction="vectors-components"');
    expect(text).toContain("In axes turned by 36.87°, the arrow is 4.8 along x′ and 1.4 along y′.");
    expect(text).toContain("= 5, the same 5 as in the original axes");
  });

  test("the figure is a labelled image whose arrowhead reference is a plain id", () => {
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-label="The arrow/);
    const marker = html.match(/marker-end="url\(#([^)]+)\)"/);
    expect(marker).not.toBeNull();
    expect(marker?.[1]).toMatch(/^[a-zA-Z0-9-]+$/);
    expect(html).toContain(`id="${marker?.[1]}"`);
  });
});
