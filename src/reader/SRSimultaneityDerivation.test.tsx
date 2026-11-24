import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderExpressionMarkup } from "../equations/derivations/mathRenderer.ts";
import {
  presentSRSimultaneityExpression,
  srSimultaneityChain,
  srSimultaneitySourceLinks,
} from "../equations/derivations/srSimultaneity.ts";
import { verifySRSimultaneity } from "../equations/derivations/srSimultaneityProof.ts";
import { decodeSr03Settings } from "../experiments/sr03/permalink.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { evaluateSr03 } from "../workers/operations/sr03.ts";
import { PaperPage } from "./PaperPage.tsx";
import { SRSimultaneityDerivation } from "./SRSimultaneityDerivation.tsx";

test("the complete conditional teaching route and its sources are readable without JavaScript", () => {
  const html = renderToStaticMarkup(
    <SRSimultaneityDerivation activeDetail="2" report={verifySRSimultaneity()} />,
  );
  expect(html).toContain('id="sr-simultaneity-derivation"');
  expect(html).toContain('data-simultaneity-proof="checked"');
  expect(html).toContain('data-route-kind="pedagogical-reconstruction"');
  expect(html).toContain("<math");
  expect(html).toContain("<details");
  expect(html).not.toContain("katex-error");
  expect([...html.matchAll(/data-step-id=/g)]).toHaveLength(srSimultaneityChain.steps.length);
  expect([...html.matchAll(/data-is-move="true"/g)]).toHaveLength(1);
  for (const step of srSimultaneityChain.steps) expect(html).toContain('id="' + step.id + '"');
  for (const source of srSimultaneitySourceLinks) {
    expect(html).toContain('id="' + source.id + '"');
    expect(html).toContain('href="/papers/special-relativity/view/german/#' + source.anchor + '"');
  }
  expect(html).toContain("earlier §2 argument");
  expect(html).toContain("does not derive that map from its own");
  expect(html).toContain("zero separation along the motion");
  expect(html).toContain("not a simultaneous rod length");
  expect(html).toContain("conditional on the stated premises");
  expect(html).toContain("A time coordinate in k is not");
});

test("absent, incomplete or unrelated reports never claim the displayed steps passed", () => {
  const valid = verifySRSimultaneity();
  const reports = [
    undefined,
    { ...valid, passed: false },
    { ...valid, target: "another-equation" },
    { ...valid, stepReports: valid.stepReports.slice(1) },
    {
      ...valid,
      stepReports: valid.stepReports.map((step, index) =>
        index === 0 ? { ...step, stepId: "unrelated-step" } : step,
      ),
    },
    { ...valid, graphIssues: ["unresolved prerequisite"] },
  ];
  for (const report of reports) {
    const html = renderToStaticMarkup(<SRSimultaneityDerivation {...(report ? { report } : {})} />);
    expect(html).toContain('data-simultaneity-proof="not-checked"');
    expect(html).not.toContain("passes an exact algebra check");
    expect(html).toContain('id="sr-simultaneity-read-offset"');
  }
});

test("event indexes and moving-frame primes remain on the same spoken and rendered symbols", () => {
  for (const index of ["1", "2"]) {
    const tree = presentSRSimultaneityExpression({
      kind: "symbol",
      termId: "coordinateTimeMoving.event" + index,
      quantityId: "coordinateTimeMoving",
      index,
    });
    const mathml = renderExpressionMarkup(tree).html.match(/<math[\s\S]*?<\/math>/)?.[0];
    expect(mathml).toContain(`<msubsup><mi>t</mi><mn>${index}</mn><mo`);
    expect(mathml).toContain(">′</mo></msubsup>");
  }
});

test("the worked pair opens the real laboratory with the same signed time and space offsets", async () => {
  const html = renderToStaticMarkup(<SRSimultaneityDerivation />);
  const href = html.match(/href="(\/lab\/sr-03\/\?[^"]+)"/)?.[1]?.replaceAll("&amp;", "&");
  expect(href).toBeDefined();
  const decoded = decodeSr03Settings(new URL(href!, "https://annus-mirabilis.com").search);
  expect(decoded.kind).toBe("settings");
  if (decoded.kind !== "settings")
    throw new Error("The worked example must restore exact lab settings.");
  const result = await evaluateSr03(decoded.parameters);
  expect(result.kind).toBe("accepted");
  if (result.kind !== "accepted")
    throw new Error("The real experiment refused the worked example.");
  for (const [id, expected] of [
    ["temporalSeparationK", 0],
    ["spatialSeparationK", 10],
    ["temporalSeparationKPrime", -7.5],
    ["spatialSeparationKPrime", 12.5],
  ] as const) {
    const output = result.data.outputs.find((item) => item.quantityId === id);
    expect(output?.status).toBe("value");
    if (output?.status !== "value" || typeof output.value !== "number")
      throw new Error("Missing the event-pair output.");
    expect(output.value).toBeCloseTo(expected, 12);
  }
});

test("the actual section mounts the checked route and the complete paper links to it", async () => {
  const section = await exportMarkup(
    await PaperPage({ paperId: "special-relativity", section: "s2" }),
  );
  expect(section).toContain('id="sr-simultaneity-derivation"');
  expect(section).toContain('data-simultaneity-proof="checked"');
  expect(section).toContain('id="sr-simultaneity-choose-equal-times"');
  const paper = await exportMarkup(await PaperPage({ paperId: "special-relativity" }));
  expect(paper).toContain('href="/papers/special-relativity/s2/#sr-simultaneity-derivation"');
});
