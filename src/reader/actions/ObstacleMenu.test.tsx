import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ObstacleMenu } from "./ObstacleMenu.tsx";
import type { ObstacleResponses } from "./passageActions.schema.ts";

describe("ObstacleMenu", () => {
  test("renders nothing when no obstacle response exists", () => {
    const html = renderToStaticMarkup(
      <ObstacleMenu responses={undefined} passageLabel="section 4, paragraph 2, sentence 1" />,
    );
    expect(html).toBe("");
  });

  test("renders only the choices with an authored response, never all six", () => {
    const responses: ObstacleResponses = {
      tooMuchAtOnce: { explanation: "Break it into three smaller claims." },
      physicalReason: { explanation: "Viscosity resists the tracer's motion." },
    };
    const html = renderToStaticMarkup(
      <ObstacleMenu responses={responses} passageLabel="section 4, paragraph 2" />,
    );
    expect(html).toContain("Simply too much at once");
    expect(html).toContain("The physical reason for a step");
    expect(html).not.toContain("An unfamiliar word or symbol");
    expect(html).not.toContain("An algebraic move");
  });

  test("the response explanation text is present inside its own disclosure", () => {
    const responses: ObstacleResponses = {
      algebraicMove: { explanation: "Multiply both sides by the same factor." },
    };
    const html = renderToStaticMarkup(
      <ObstacleMenu responses={responses} passageLabel="section 3, paragraph 1" />,
    );
    expect(html).toContain("Multiply both sides by the same factor.");
  });

  test("each choice's accessible name names both the obstacle and the passage", () => {
    const responses: ObstacleResponses = {
      connectionToPicture: { explanation: "The arrows in the diagram are the same displacements." },
    };
    const html = renderToStaticMarkup(
      <ObstacleMenu responses={responses} passageLabel="section 4, paragraph 2, sentence 1" />,
    );
    expect(html).toMatch(
      /aria-label="The connection to the picture: section 4, paragraph 2, sentence 1"/,
    );
  });

  test("the menu itself is a labeled disclosure, not a set of pre-expanded panels", () => {
    const responses: ObstacleResponses = { tooMuchAtOnce: { explanation: "test" } };
    const html = renderToStaticMarkup(
      <ObstacleMenu responses={responses} passageLabel="section 1" />,
    );
    expect(html).toContain("What is getting in the way?");
    expect(html).toMatch(/<details[^>]*data-obstacle-menu/);
  });
});
