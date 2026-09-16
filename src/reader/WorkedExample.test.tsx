import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { WorkedExample as WorkedExampleRecord } from "../content/schemas/argument";
import { WorkedExample } from "./WorkedExample";

const EXAMPLE: WorkedExampleRecord = {
  question: "Do four observations summing to zero show no movement?",
  given: "Signed displacements -3, -1, +1, +3 units, authored and not measured.",
  plausibleFirstThought:
    "Add them up, which gives zero, so nothing moved — reasonable because a sum of zero is the ordinary sign of no net change.",
  decisiveStep:
    "Mean absolute displacement is 2; mean square is 5. Doubling the count gives 4 and 20.",
  limitation:
    "Four entries are an arithmetic illustration, not a distribution; the real growth law needs many independent steps.",
};

function partOrder(html: string): string[] {
  const matches = [...html.matchAll(/data-example-part="([a-zA-Z]+)"/g)];
  return matches.map((m) => {
    const part = m[1];
    if (part === undefined) throw new Error("regex group 1 is always present when it matches");
    return part;
  });
}

function detailsIsOpen(html: string): boolean {
  const tag = html.match(/<details[^>]*>/)?.[0];
  if (!tag) throw new Error("no <details> tag found");
  return / open(="")?[ >]/.test(tag);
}

describe("WorkedExample rendering", () => {
  test("renders all five parts in order", () => {
    const html = renderToStaticMarkup(<WorkedExample example={EXAMPLE} detail={1} />);
    expect(partOrder(html)).toEqual([
      "question",
      "given",
      "plausibleFirstThought",
      "decisiveStep",
      "limitation",
    ]);
  });

  test("includes the literal text of every part", () => {
    const html = renderToStaticMarkup(<WorkedExample example={EXAMPLE} detail={1} />);
    expect(html).toContain(EXAMPLE.question);
    expect(html).toContain(EXAMPLE.given);
    expect(html).toContain(EXAMPLE.plausibleFirstThought);
    expect(html).toContain(EXAMPLE.decisiveStep);
    expect(html).toContain(EXAMPLE.limitation);
  });

  test("the decisive step is a native <details>, closed at Detail 0 (Overview)", () => {
    const html = renderToStaticMarkup(<WorkedExample example={EXAMPLE} detail={0} />);
    expect(html).toContain("<details");
    expect(detailsIsOpen(html)).toBe(false);
  });

  test("the decisive step is closed at Detail 1 (Full explanation)", () => {
    const html = renderToStaticMarkup(<WorkedExample example={EXAMPLE} detail={1} />);
    expect(detailsIsOpen(html)).toBe(false);
  });

  test("the decisive step is open by default at Detail 2 (Show every step)", () => {
    const html = renderToStaticMarkup(<WorkedExample example={EXAMPLE} detail={2} />);
    expect(detailsIsOpen(html)).toBe(true);
  });

  test("renders as real, static HTML with no script tags: works without JavaScript", () => {
    const html = renderToStaticMarkup(<WorkedExample example={EXAMPLE} detail={2} />);
    expect(html).not.toContain("<script");
  });

  test("the component is a pure function of its props: identical props render identical HTML", () => {
    const first = renderToStaticMarkup(<WorkedExample example={EXAMPLE} detail={2} />);
    const second = renderToStaticMarkup(<WorkedExample example={EXAMPLE} detail={2} />);
    expect(first).toBe(second);
  });
});
