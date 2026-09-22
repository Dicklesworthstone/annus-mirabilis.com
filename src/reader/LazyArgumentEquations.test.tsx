import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { installDom, uninstallDom } from "../testing/reactDom.ts";
import { ArgumentEquations } from "./ArgumentEquations.tsx";

/*
  The whole-paper page sends the explorer cards on first opening, not in its HTML (relativity was
  264,373 bytes gzipped against a 250,000 budget, 45% of it these cards). What must hold: the
  disclosure is still there; without JavaScript it is a real link to the section page, which
  renders the cards inline; with it, opening the disclosure mounts the same cards.
*/
const ARGUMENT = "arg-sr-lorentz-map";
const SECTION = `/papers/special-relativity/s3/#${ARGUMENT}`;

describe("the explorer on a whole-paper page", () => {
  test("carries the disclosure and a real link to the section page, and no card", () => {
    const html = renderToStaticMarkup(
      <ArgumentEquations
        paperId="special-relativity"
        argumentId={ARGUMENT}
        lazy
        sectionHref={SECTION}
      />,
    );
    expect(html).toContain(`data-argument-equations="${ARGUMENT}"`);
    expect(html).toContain(`<a href="${SECTION}">`);
    expect(html).not.toContain("data-equation-id=");
  });

  test("the section page's form keeps every card inline, the no-script route", () => {
    const html = renderToStaticMarkup(
      <ArgumentEquations paperId="special-relativity" argumentId={ARGUMENT} />,
    );
    expect((html.match(/data-equation-id="/g) ?? []).length).toBeGreaterThan(0);
    expect(html).not.toContain("data-equations-fragment");
  });

  test("the coefficient laboratory link belongs to mass-energy's equations alone", () => {
    const sr = renderToStaticMarkup(
      <ArgumentEquations paperId="special-relativity" argumentId={ARGUMENT} />,
    );
    expect(sr).not.toContain("/lab/me-02/");
    const me = renderToStaticMarkup(
      <ArgumentEquations
        paperId="mass-energy"
        argumentId="arg-me-constant-premise"
        lazy
        sectionHref="/papers/mass-energy/s0/"
      />,
    );
    expect(me).toContain("/lab/me-02/");
  });
});

describe("opening it", () => {
  beforeEach(installDom);
  afterEach(uninstallDom);

  test("mounts the argument's cards from the paper's payload", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <ArgumentEquations
          paperId="special-relativity"
          argumentId={ARGUMENT}
          lazy
          sectionHref={SECTION}
        />,
      );
    });
    const details = container.querySelector<HTMLDetailsElement>("details");
    expect(container.querySelectorAll("[data-equation-id]").length).toBe(0);
    await act(async () => {
      if (details) details.open = true;
      details?.dispatchEvent(new window.Event("toggle"));
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(container.querySelectorAll("[data-equation-id]").length).toBeGreaterThan(0);
    expect(container.querySelector("[data-equations-fragment]")).toBeNull();
    act(() => root.unmount());
  });
});
