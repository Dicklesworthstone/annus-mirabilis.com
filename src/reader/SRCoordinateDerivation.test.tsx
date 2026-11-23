import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  srCoordinateChains,
  srCoordinateCrossRouteLinks,
  srCoordinateSourceLinks,
} from "../equations/derivations/srCoordinates.ts";
import {
  srSphericalWavePremises,
  verifySRSphericalWave,
} from "../equations/derivations/srSphericalWaveProof.ts";
import { SRCoordinateDerivation } from "./SRCoordinateDerivation.tsx";

test("SR §3 renders both complete routes and their native disclosures before hydration", () => {
  const html = renderToStaticMarkup(<SRCoordinateDerivation />);
  assert.ok(html.includes('id="sr-coordinate-derivation"'));
  assert.ok(html.includes('data-argument-id="arg-sr-lorentz-map"'));
  assert.ok(html.includes('data-review="draft"'));
  assert.ok(html.includes('data-historical-status="source-order-reconstruction"'));
  assert.ok(html.includes('data-historical-status="pedagogical-reconstruction"'));
  assert.ok(html.includes("A route you could take: the source synchronization argument"));
  assert.ok(html.includes("A route you could take: a modern linear reconstruction"));
  assert.ok(html.includes("<details"));
  assert.ok(html.includes("<math"));
  assert.ok(!html.includes("katex-error"));
  for (const chain of srCoordinateChains) {
    assert.ok(html.includes(`data-coordinate-stage="${chain.id}"`));
    assert.ok(html.includes(`data-derivation-chain="${chain.id}"`));
    for (const step of chain.steps) {
      assert.ok(html.includes(`data-step-id="${step.id}"`), step.id);
      assert.ok(html.includes(`id="${step.sourceAnchor}"`), step.id);
    }
  }
  const expectedMoves = srCoordinateChains.flatMap((chain) =>
    chain.steps.filter((step) => step.isMove),
  );
  assert.equal([...html.matchAll(/data-is-move="true"/g)].length, expectedMoves.length);
  assert.equal(
    [...html.matchAll(/data-step-id=/g)].length,
    srCoordinateChains.flatMap((chain) => chain.steps).length,
  );
});

test("cross-route and printed-source links have unique real targets, with foundation tools resolved", () => {
  const html = renderToStaticMarkup(<SRCoordinateDerivation activeDetail="2" />);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(
    new Set(ids).size,
    ids.length,
    "duplicate ids would make exact step returns ambiguous",
  );
  for (const link of srCoordinateCrossRouteLinks) {
    for (const target of [link.source, link.modern]) {
      assert.ok(html.includes(`href="#${target}"`));
      assert.ok(ids.includes(target), target);
    }
  }
  for (const link of srCoordinateSourceLinks) {
    assert.ok(html.includes(`href="/papers/special-relativity/view/german/#${link.anchor}"`));
    assert.ok(
      readFileSync(`content/source-blocks/special-relativity/${link.anchor}.yaml`, "utf8").includes(
        `id: "${link.anchor}"`,
      ),
    );
  }
  const registry = readFileSync("content/foundations/registry.yaml", "utf8");
  for (const step of srCoordinateChains.flatMap((chain) => chain.steps)) {
    assert.ok(step.tool && registry.includes(step.tool), step.id);
    assert.ok(html.includes(`/foundations/${step.tool.replace("foundation:", "")}/`), step.id);
  }
  assert.ok(html.includes('href="/lab/sr-04/"'));
  assert.ok(html.includes('data-detail="1" hidden=""'));
  assert.ok(!/data-detail="2" hidden=""/.test(html));
});

test("the source route can use modern notation without confusing the auxiliary with the moving coordinate", () => {
  const html = renderToStaticMarkup(
    <SRCoordinateDerivation notation="modern" perspective="modern" />,
  );
  assert.ok(html.includes("x̃"));
  assert.ok(html.includes("γ"));
  assert.ok(html.includes("Two different coordinates:"));
  assert.ok(html.includes("a perpendicular"));
  for (const match of html.matchAll(/aria-label="([^"]*)"/g)) {
    assert.ok(!match[1]?.includes("\\"), match[1]);
    assert.ok(!match[1]?.includes("eq-model-"), match[1]);
    assert.ok(!match[1]?.includes("coordinatePosition"), match[1]);
    assert.ok(
      !/ansatz(?:SpatialScale|TimeScale|TimeSpaceCoefficient|TransverseScale)/.test(match[1] ?? ""),
      match[1],
    );
  }
  assert.ok(!html.includes("katex-error"));
});

test("the reader keeps the assumptions, unresolved intermediate scale and historical limits visible", () => {
  const html = renderToStaticMarkup(<SRCoordinateDerivation activeDetail="0" />);
  for (const text of [
    "linearity",
    "Reciprocity",
    "Spatial isotropy",
    "positive branch",
    "future-increasing",
    "unknown scale",
    "spherical-wave check",
    "Historical context and notation",
    "private thought process",
    "agent comparisons",
    "review remains draft",
  ])
    assert.ok(html.includes(text), text);
  assert.ok(html.includes('data-detail="1" hidden=""'));
  assert.ok(!/data-detail="0" hidden=""/.test(html));
  assert.ok(html.includes('aria-label="Symbols in the source-route equations"'));
  assert.ok(html.includes('value="source"'));
  assert.ok(html.includes('value="modern"'));
});

test("the server's exact sphere report reaches native reader disclosures and all four real steps", () => {
  const report = verifySRSphericalWave();
  assert.equal(report.passed, true, JSON.stringify(report));
  const html = renderToStaticMarkup(
    <SRCoordinateDerivation sphericalWaveProof={{ report, premises: srSphericalWavePremises }} />,
  );
  assert.ok(html.includes('id="sr-spherical-wave-check"'));
  assert.ok(html.includes('data-spherical-wave-proof="verified"'));
  assert.ok(html.includes("All four substitutions and cancellations pass their exact checks."));
  assert.ok(html.includes("leaves the common scale φ arbitrary"));
  assert.ok(html.includes("does not select phi = 1"));
  for (const step of report.stepReports) {
    assert.ok(html.includes(`href="#${step.stepId}"`), step.stepId);
    assert.ok(html.includes(`data-step-id="${step.stepId}"`), step.stepId);
  }
  assert.ok(html.includes('data-review="draft"'));
});

test("an absent, failed or incomplete proof receipt never appears as an exact sphere check", () => {
  const report = verifySRSphericalWave();
  assert.ok(
    !renderToStaticMarkup(<SRCoordinateDerivation />).includes(
      'data-spherical-wave-proof="verified"',
    ),
  );
  for (const changed of [
    { ...report, passed: false, isPublicationReady: false },
    { ...report, stepReports: report.stepReports.slice(0, 3) },
  ]) {
    const html = renderToStaticMarkup(
      <SRCoordinateDerivation
        sphericalWaveProof={{ report: changed, premises: srSphericalWavePremises }}
      />,
    );
    assert.ok(html.includes('data-spherical-wave-proof="failed"'));
    assert.ok(!html.includes("All four substitutions and cancellations pass their exact checks."));
    assert.ok(html.includes('id="sr-coordinate-source-spherical-cancellation"'));
  }
});
