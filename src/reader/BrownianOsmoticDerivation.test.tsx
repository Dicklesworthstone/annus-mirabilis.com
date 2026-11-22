import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { load } from "js-yaml";
import { renderToStaticMarkup } from "react-dom/server";
import { brownianOsmoticSteps } from "../equations/derivations/brownianOsmotic.ts";
import { verifyBrownianOsmotic } from "../equations/derivations/brownianOsmoticProof.ts";
import { BrownianOsmoticDerivation } from "./BrownianOsmoticDerivation.tsx";

test("the complete source argument and limitations are rendered before JavaScript", () => {
  for (const perspective of ["historical", "modern"] as const) {
    const html = renderToStaticMarkup(
      <BrownianOsmoticDerivation perspective={perspective} report={verifyBrownianOsmotic()} />,
    );
    expect(html).toContain('id="bm-osmotic-derivation"');
    expect(html).toContain('data-argument-id="arg-bm-kinetic-justification"');
    expect(html).toContain('data-osmotic-check="pass"');
    expect(html).not.toContain("katex-error");
    expect(html).toContain("independence of position at one fixed volume does not");
    expect(html).toContain("one translational position");
    expect(html).toContain("not zero pressure");
    expect(html).toContain("It checks no experimental data");
    for (const step of brownianOsmoticSteps) {
      expect(html).toContain(`data-osmotic-step="${step.id}"`);
      expect(html).toContain(`/view/german/#${step.source.anchor}`);
    }
    for (const detail of ["0", "1", "2"])
      expect(html).toContain(`data-reading="${detail}" data-detail="${detail}"`);
  }
});

test("every source link and prerequisite names an actual local source unit", () => {
  for (const step of brownianOsmoticSteps) {
    const anchor = step.source.anchor;
    const block = anchor.startsWith("eq-") ? anchor : anchor.replace(/-s\d+$/, "");
    const path = new URL(
      `../../content/source-blocks/brownian-motion/${block}.yaml`,
      import.meta.url,
    );
    expect(existsSync(path)).toBe(true);
    if (!anchor.startsWith("eq-")) {
      const source = load(readFileSync(path, "utf8")) as { sentenceSpans: { id: string }[] };
      expect(source.sentenceSpans.some((span) => span.id === anchor)).toBe(true);
    }
    expect(
      existsSync(
        new URL(
          `../../content/foundations/${step.tool.replace("foundation:", "")}.json`,
          import.meta.url,
        ),
      ),
    ).toBe(true);
  }
});

test("the source argument stays available without claiming a computed report", () => {
  const html = renderToStaticMarkup(<BrownianOsmoticDerivation />);
  expect(html).not.toContain("data-osmotic-check=");
  expect(html).toContain("Get the pressure without solving the molecular motion");
  expect(html).toContain("/lab/bm-03/");
});
