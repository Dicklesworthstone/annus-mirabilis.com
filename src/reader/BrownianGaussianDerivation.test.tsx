import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  brownianGaussianAssumptions,
  brownianGaussianCheckRows,
  brownianGaussianInput,
  gaussianNumber,
} from "../equations/derivations/brownianGaussian.ts";
import { verifyBrownianGaussian } from "../equations/derivations/brownianGaussianProof.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { BrownianGaussianDerivation } from "./BrownianGaussianDerivation.tsx";
import { PaperReader } from "./PaperReader.tsx";

const report = verifyBrownianGaussian();
const text = (html: string) => html.replaceAll("<!-- -->", "").replace(/\s+/g, " ");

test("the actual Brownian section supplies the exact Gaussian report before hydration", async () => {
  const html = text(await exportMarkup(await PaperReader({ section: "s4" })));
  assert.ok(html.includes('id="bm-gaussian-derivation"'));
  assert.ok(html.includes('data-gaussian-proof="checked"'));
  assert.ok(html.includes("What the exact calculation checks"));
  assert.ok(html.includes("Find the second Gaussian integral by parts"));
  assert.ok(html.includes("The Gaussian area and tail properties remain"));
  assert.ok(html.includes("does not prove uniqueness"));
  assert.ok(html.includes("point distribution"));
});

test("the source calculation exposes its premises, mathematics and real onward links without controls", () => {
  const html = text(renderToStaticMarkup(<BrownianGaussianDerivation report={report} />));
  const registry = readFileSync("content/foundations/registry.yaml", "utf8");
  for (const assumption of brownianGaussianAssumptions)
    assert.ok(html.includes('id="' + assumption.id + '"'), assumption.id);
  for (const row of brownianGaussianCheckRows) assert.ok(html.includes(row.label), row.id);
  for (const match of html.matchAll(/href="\/foundations\/([^"]+)\/"/g))
    assert.ok(registry.includes("foundation:" + match[1]), match[1]);
  for (const id of ["eq-s4-d11", "eq-s4-d12"]) {
    assert.ok(html.includes('href="/papers/brownian-motion/view/german/#' + id + '"'));
    const source = readFileSync("content/source-blocks/brownian-motion/" + id + ".yaml", "utf8");
    assert.ok(source.includes('id: "' + id + '"'), id);
  }
  assert.ok(html.includes("<math"));
  assert.ok(html.includes("fixed positive count"));
  assert.ok(html.includes("elapsed interval since their common point start"));
  assert.ok(html.includes("Its value is admitted here"));
  assert.ok(html.includes("mean square also includes the square of that mean displacement"));
  assert.ok(html.includes('href="/lab/bm-06/"'));
  assert.ok(!html.includes("katex-error"));
  assert.ok(!html.includes("<button"));
  assert.ok(!html.includes("<input"));
  for (const match of html.matchAll(/aria-label="([^"]*)"/g)) {
    assert.ok(!match[1]?.includes("\\"), match[1]);
    assert.ok(!match[1]?.includes("eq-model-"), match[1]);
  }
});

test("a failed derivative names its failed check while preserving the authored calculation", () => {
  const wrong = verifyBrownianGaussian({
    ...brownianGaussianInput,
    secondWeight: gaussianNumber("0"),
  });
  assert.equal(wrong.passed, false);
  const html = text(renderToStaticMarkup(<BrownianGaussianDerivation report={wrong} />));
  assert.ok(html.includes('data-gaussian-proof="unavailable"'));
  assert.ok(html.includes('data-gaussian-check-failure="profile-derivatives"'));
  assert.ok(html.includes('data-gaussian-check-failure="diffusion-equation"'));
  assert.ok(html.includes("The authored steps remain readable"));
  assert.ok(html.includes('id="bm-gaussian-second-moment"'));
  assert.ok(!html.includes("What the exact calculation checks"));
});

test("an unavailable report never invents checked support or failed rows", () => {
  const refused = verifyBrownianGaussian({
    ...brownianGaussianInput,
    widthSquared: gaussianNumber("0"),
  });
  assert.equal(refused.passed, false);
  const html = text(renderToStaticMarkup(<BrownianGaussianDerivation report={refused} />));
  assert.ok(html.includes("Why the exact Gaussian check is unavailable"));
  assert.ok(html.includes("The Gaussian width squared must be"));
  assert.ok(!html.includes("data-gaussian-check-failure"));
  const absent = renderToStaticMarkup(<BrownianGaussianDerivation />);
  assert.ok(absent.includes('data-gaussian-proof="unavailable"'));
  assert.ok(!absent.includes("What the exact calculation checks"));
});
