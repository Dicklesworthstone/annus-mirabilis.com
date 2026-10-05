import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { cameraComparisonOutput } from "../../../../experiments/bm08/comparison.ts";
import { BM08_OUTPUTS } from "../../../../experiments/bm08/definition.ts";
import { ExperimentRuntimeError } from "../../../../experiments/refusal.ts";

// A route-admission unit test, not a replacement for React rendering or worker integration.
// Compile the actual route and inject its dependencies in a private VM; no process-wide module
// mocks can leak into another test. The numerical validator is a port: its own tests establish
// domain admission, while these prove this route obeys the verdict and forwards its checked data.
const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  fileName: "page.tsx",
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.React,
  },
}).outputText;

function route(verdict) {
  const example = { sourceDigest: "fixture", parameters: { raw: "fixture" }, results: [] };
  const calls = [];
  const component = Symbol("CameraControlledComparison");
  const imports = [];
  const React = {
    Fragment: Symbol("Fragment"),
    createElement: (type, props, ...children) => ({ type, props, children }),
  };
  const require = (specifier) => {
    imports.push(specifier);
    if (specifier.endsWith("/CameraControlledComparison.tsx"))
      return { CameraControlledComparison: component };
    if (specifier.endsWith("/bm08/parameters.ts"))
      return { validateBm08Parameters: (input) => { calls.push(input); return verdict; } };
    if (specifier.endsWith("/experiments/refusal.ts")) return { ExperimentRuntimeError };
    if (specifier.endsWith("/bm08-example.json")) return { default: example };
    if (specifier.endsWith(".css")) return {};
    assert.fail(`Unaccounted route dependency: ${specifier}`);
  };
  const exports = {};
  runInNewContext(compiled, { exports, require, React }, { timeout: 1000 });
  return { ...exports, example, calls, component, imports };
}
function nodes(element) {
  return !element || typeof element !== "object" ? []
    : [element, ...(element.children ?? []).flatMap(nodes)];
}

test("missing camera evidence throws camera-comparison-evidence, while identified evidence is read", () => {
  // The code is in the assertion itself so the existing refusal scanner can credit the guard.
  // This executes src/experiments/bm08/comparison.ts, not the error constructor alone.
  assert.throws(() => cameraComparisonOutput({ outputs: [] }, "times"), {
    code: "camera-comparison-evidence",
  });
  const { statuses, ...identity } = BM08_OUTPUTS.times;
  const value = { quantityId: "times", ...identity, status: "value", value: new Float64Array([0, 1]) };
  assert.equal(cameraComparisonOutput({ outputs: [value] }, "times"), value);
});

test("the route refuses rejected prepared parameters with parameters-rejected", () => {
  const page = route({ kind: "refused", refusal: { message: "fixture domain refusal" } });
  assert.throws(() => page.default(), { code: "parameters-rejected", experimentId: "bm-08" });
  assert.equal(page.calls.length, 1);
  assert.equal(page.calls[0], page.example.parameters);
});

test("an execution outcome is not accepted prepared data", () => {
  const page = route({ kind: "outcome", outcome: { message: "fixture unavailable" } });
  assert.throws(() => page.default(), { code: "parameters-rejected", experimentId: "bm-08" });
});

test("an accepted route forwards checked parameters, not the unvalidated JSON object", () => {
  const checked = Object.freeze({ checked: "fixture canonical parameters" });
  const page = route({ kind: "accepted", data: checked });
  const rendered = nodes(page.default());
  const instrument = rendered.find((node) => node.type === page.component);
  assert.ok(instrument, "the checked example must reach the controlled camera component");
  assert.equal(instrument.props.example.parameters, checked);
  assert.notEqual(instrument.props.example.parameters, page.example.parameters);
  assert.equal(instrument.props.example.sourceDigest, page.example.sourceDigest);
  assert.equal(instrument.props.example.results, page.example.results);
  assert.equal(page.calls.length, 1);
});

test("the route keeps its canonical address and onward links to the full scientific context", () => {
  const page = route({ kind: "accepted", data: {} });
  assert.equal(page.metadata.alternates.canonical, "/lab/bm-08/compare/");
  const links = new Set(nodes(page.default()).filter((node) => node.type === "a").map((node) => node.props.href));
  for (const href of ["/lab/bm-08/", "/lab/bm-01/compare/", "/lab/bm-07/", "/papers/brownian-motion/#arg-bm-inference"])
    assert.ok(links.has(href), href);
});

test("the full camera page exposes the controlled comparison without removing its existing lab", () => {
  const original = readFileSync(new URL("../page.tsx", import.meta.url), "utf8");
  assert.match(original, /href="\/lab\/bm-08\/compare\/"/);
  assert.match(original, /<CameraComparison\s+example=/);
});
