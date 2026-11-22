import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  brownianKernelAssumptions,
  brownianKernelCheckRows,
  brownianKernelInput,
  kernelNumber,
} from "../equations/derivations/brownianKernel.ts";
import { verifyBrownianKernel } from "../equations/derivations/brownianKernelProof.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { BrownianKernelCheck } from "./BrownianKernelCheck.tsx";
import { PaperReader } from "./PaperReader.tsx";

const clean = (html: string) => html.replaceAll("<!-- -->", "").replace(/\s+/g, " ");
const report = verifyBrownianKernel();

test("the actual Brownian section supplies its conditional jump-law check before hydration", async () => {
  const html = clean(await exportMarkup(await PaperReader({ section: "s4" })));
  assert.ok(html.includes('id="bm-kernel-checked-calculus"'));
  assert.ok(html.includes('data-kernel-calculus="checked"'));
  assert.ok(html.includes("What has an exact check, and what is assumed?"));
  assert.ok(html.includes("must also converge"));
  assert.ok(html.includes("Why finite variance alone is insufficient"));
});

test("the native source supplement separates exact finite-interval algebra from the conditional limit", () => {
  const html = clean(renderToStaticMarkup(<BrownianKernelCheck report={report} />));
  assert.equal(report.passed, true, report.reason);
  assert.ok(html.includes('id="bm-kernel-checked-calculus"'));
  assert.ok(html.includes('data-kernel-calculus="checked"'));
  assert.ok(html.includes("What has an exact check, and what is assumed?"));
  assert.ok(html.includes("does not verify convergence of an arbitrary"));
  assert.ok(html.includes("At a finite interval the earlier approximation sign remains"));
  assert.ok(html.includes("must also converge"));
  assert.ok(html.includes("No remainder has been set to zero"));
  assert.ok(html.includes("third-order Taylor remainder evaluated at an intermediate position"));
  assert.ok(html.includes("Symmetry alone cannot cancel that remainder"));
  assert.ok(html.includes("zero-spread degenerate law"));
  for (const assumption of brownianKernelAssumptions)
    assert.ok(html.includes('id="' + assumption.id + '"'), assumption.id);
  for (const row of brownianKernelCheckRows) assert.ok(html.includes(row.label), row.id);
  assert.ok(html.includes("<math"));
  assert.ok(!html.includes("katex-error"));
  assert.ok(!html.includes("<input"));
  assert.ok(!html.includes("<button"));
});

test("the rare fixed-jump counterexample and every source/foundation link remain available without script", () => {
  const html = clean(renderToStaticMarkup(<BrownianKernelCheck report={report} />));
  assert.ok(html.includes("Why finite variance alone is insufficient"));
  assert.ok(html.includes("probability masses at three points"));
  assert.ok(html.includes("does not shrink"));
  assert.ok(html.includes("without a finite second moment"));
  assert.ok(html.includes('href="/lab/bm-05/"'));
  assert.ok(html.includes('href="#bm-gaussian-derivation"'));
  const registry = readFileSync("content/foundations/registry.yaml", "utf8");
  for (const match of html.matchAll(/href="\/foundations\/([^"]+)\/"/g))
    assert.ok(registry.includes("foundation:" + match[1]), match[1]);
  for (const match of html.matchAll(/href="\/papers\/brownian-motion\/view\/german\/#([^"]+)"/g)) {
    const id = match[1];
    assert.ok(id);
    const source = readFileSync("content/source-blocks/brownian-motion/" + id + ".yaml", "utf8");
    assert.ok(source.includes('id: "' + id + '"'), id);
  }
  for (const match of html.matchAll(/aria-label="([^"]*)"/g)) {
    assert.ok(!match[1]?.includes("\\"), match[1]);
    assert.ok(!match[1]?.includes("eq-model-"), match[1]);
  }
});

test("a failed remainder coefficient names the actual failure and retains the readable derivation", () => {
  const wrong = verifyBrownianKernel({
    ...brownianKernelInput,
    timeErrorCoefficient: kernelNumber("0"),
  });
  assert.equal(wrong.passed, false);
  const html = clean(renderToStaticMarkup(<BrownianKernelCheck report={wrong} />));
  assert.ok(html.includes('data-kernel-calculus="unavailable"'));
  assert.ok(html.includes('data-kernel-check-failure="remainder-coefficients"'));
  assert.ok(html.includes("Why the exact coefficient check is unavailable"));
  assert.ok(html.includes('id="bm-kernel-check-remainders"'));
  assert.ok(!html.includes("What has an exact check, and what is assumed?"));
});

test("an incomplete or absent report invents neither checked support nor failed rows", () => {
  const refused = verifyBrownianKernel({
    ...brownianKernelInput,
    chain: { ...brownianKernelInput.chain, steps: [] },
  });
  const html = clean(renderToStaticMarkup(<BrownianKernelCheck report={refused} />));
  assert.ok(html.includes("every named transformation in order"));
  assert.ok(!html.includes("data-kernel-check-failure"));
  const absent = renderToStaticMarkup(<BrownianKernelCheck />);
  assert.ok(absent.includes('data-kernel-calculus="unavailable"'));
  assert.ok(!absent.includes("What has an exact check, and what is assumed?"));
});
