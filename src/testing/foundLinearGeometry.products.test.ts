import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductsView } from "../components/foundations/ProductsView.tsx";
import {
  A,
  type ProductsOutcome,
  showProducts,
  showProductsTyped,
} from "../foundations/productsView.ts";
import { withinTolerance } from "../units/tolerance.ts";

/**
 * The projection and oriented-area view of foundation:dot-cross-products
 * (am-found-linear-geometry-7w15): a fixed along x, b of length 3 at a chosen angle.
 */

type View = Extract<ProductsOutcome, { status: "shown" }>["view"];
const shown = (outcome: ProductsOutcome): View => {
  expect(outcome.status).toBe("shown");
  return (outcome as Extract<ProductsOutcome, { status: "shown" }>).view;
};
const close = (actual: number, reference: number) =>
  expect(withinTolerance(actual, reference, { absolute: 1e-9, relative: 1e-9 }).ok).toBe(true);

describe("the two products", () => {
  test("60°: a·b = 6, projection 1.5, area 12 sin 60° = 10.392, out of the page", () => {
    const v = shown(showProducts(60));
    close(v.dot, 6);
    close(v.projection, 1.5);
    close(v.cross, 12 * Math.sin(Math.PI / 3));
    expect(v.crossDirection).toBe("out of the page");
  });

  test("90°: no dot product, the largest area; 180°: a·b = −12 and no area", () => {
    const right = shown(showProducts(90));
    expect(withinTolerance(right.dot, 0, { absolute: 1e-9 }).ok).toBe(true);
    close(right.cross, 12);
    const back = shown(showProducts(180));
    close(back.dot, -12);
    expect(back.crossDirection).toBe("none");
  });

  test("clockwise turns point the cross product into the page", () => {
    expect(shown(showProducts(-60)).crossDirection).toBe("into the page");
  });

  test("(a·b)² + (a × b)² = |a|²|b|² = 144 at every angle from −360° to 360°", () => {
    let checked = 0;
    for (let angle = -360; angle <= 360; angle += 15) {
      const v = shown(showProducts(angle));
      close(v.dot ** 2 + v.cross ** 2, 144);
      checked += 1;
    }
    expect(checked).toBe(49);
  });

  test("adversarial: swapping the order flips the cross product and leaves the dot product", () => {
    const v = shown(showProducts(60));
    const swappedCross = v.b.x * A.y - v.b.y * A.x;
    const swappedDot = v.b.x * A.x + v.b.y * A.y;
    close(swappedCross, -v.cross);
    close(swappedDot, v.dot);
  });
});

describe("what a reader types", () => {
  test("typed forms read, and an empty field, text or more than a full turn are refused", () => {
    close(shown(showProductsTyped("22,5")).angle, 22.5);
    close(shown(showProductsTyped("−45°")).angle, -45);
    for (const text of ["", "abc", "400"]) expect(showProductsTyped(text).status).toBe("refused");
  });
});

describe("the construction as served", () => {
  const html = renderToStaticMarkup(createElement(ProductsView));
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ");

  test("its first render, before any script runs, shows the 60° products", () => {
    expect(html).toContain('data-foundation-construction="dot-cross-products"');
    expect(text).toContain("a·b = 4 × 3 × cos 60° = 6.");
    expect(text).toContain("b's projection on a is 1.5");
    expect(text).toContain(
      "a × b has size 10.392, the area of the parallelogram , and points out of the page.",
    );
  });

  test("the figure is a labelled image with a plain marker id", () => {
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-label="Arrow a along x/);
    const marker = html.match(/marker-end="url\(#([^)]+)\)"/);
    expect(marker?.[1]).toMatch(/^[a-zA-Z0-9-]+$/);
  });
});
