import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { closingQuantaSteps } from "../equations/derivations/lightQuantaClosing.ts";
import { LightQuantaClosingDerivation } from "./LightQuantaClosingDerivation.tsx";

test("both closing source arguments provide complete mathematical steps and working source returns without scripts", () => {
  const foundations = readFileSync("content/foundations/registry.yaml", "utf8");
  for (const section of ["s7", "s9"] as const) {
    for (const activeDetail of ["0", "1", "2"] as const) {
      const html = renderToStaticMarkup(<LightQuantaClosingDerivation section={section} activeDetail={activeDetail} />);
      assert.ok(html.includes("<math"));
      assert.ok(!html.includes("katex-error"));
      assert.ok(html.includes("<details"));
      for (const detail of ["0", "1", "2"]) {
        assert.ok(html.includes('data-reading="' + detail + '" data-detail="' + detail + '"'));
      }
      assert.ok(!html.includes("data-checked-proof"));
      for (const step of closingQuantaSteps[section]) {
        assert.ok(html.includes('id="' + step.id + '"'));
        assert.ok(html.includes("/papers/light-quanta/view/german/#" + step.source.anchor));
        const blockId = step.source.anchor.replace(/-s\d+$/, "");
        const source = readFileSync("content/source-blocks/light-quanta/" + blockId + ".yaml", "utf8");
        assert.ok(source.includes('id: "' + step.source.anchor + '"'));
        const tool = step.tool.replace("foundation:", "");
        assert.ok(foundations.includes(tool));
        assert.ok(html.includes("/foundations/" + tool + "/"));
      }
    }
  }
});

test("the fluorescence reading keeps the bound, independent rates and printed exceptions distinct", () => {
  const html = renderToStaticMarkup(<LightQuantaClosingDerivation section="s7" />);
  for (const phrase of [
    "additional emitted quanta", "h &gt; 0", "not a prediction of the emitted spectrum",
    "fixed yield", "does not guarantee a detected photon", "pooled multi-quantum",
    "no bound", "modern model", "not a universal",
  ]) assert.ok(html.includes(phrase), phrase);
  assert.ok(html.includes('href="/lab/lq-07/"'));
  assert.ok(html.includes("/view/german/#s7-p3-s1"));
});

test("the ionization reading distinguishes per-molecule work, absorbed energy, an unknown count and full yield", () => {
  const html = renderToStaticMarkup(<LightQuantaClosingDerivation section="s9" />);
  for (const phrase of [
    "gram-equivalent", "necessary, not sufficient", "not applicable, not as a measured zero",
    "not incident power", "unknown", "secondary ionization cascades",
    "additional premise", "proposed experimental test", "modern SI constants",
  ]) assert.ok(html.includes(phrase), phrase);
  assert.ok(html.includes('href="/lab/lq-09/"'));
  assert.ok(html.includes("/view/german/#s9-p3-s6"));
});
