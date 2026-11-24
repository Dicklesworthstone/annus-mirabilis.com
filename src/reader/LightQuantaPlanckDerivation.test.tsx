import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { auditReadings } from "../content/audits/readings.ts";
import { loadLiveReadingsInput } from "../content/audits/readingsLive.ts";
import { buildLqPlanckDerivationPayload } from "../content/results/lightQuantaPlanckSupport.ts";
import {
  lqPlanckMetadata,
  lqPlanckReadingSet,
  lqPlanckSteps,
} from "../equations/derivations/lightQuantaPlanck.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { LightQuantaPlanckDerivation } from "./LightQuantaPlanckDerivation.tsx";
import { PaperPage } from "./PaperPage.tsx";

const payload = buildLqPlanckDerivationPayload();
test("the static Planck derivation includes every step, mathematical tool, source and reading", () => {
  const foundations = readFileSync("content/foundations/registry.yaml", "utf8");
  for (const activeDetail of ["0", "1", "2"] as const) {
    const html = renderToStaticMarkup(
      <LightQuantaPlanckDerivation payload={payload} activeDetail={activeDetail} />,
    );
    expect(html).toContain('id="lq-planck-constants-derivation"');
    expect(html).toContain("<math");
    expect(html).not.toContain("katex-error");
    expect(html).toContain('data-is-move="true"');
    for (const detail of ["0", "1", "2", "3"])
      expect(html).toContain(`data-reading="${detail}" data-detail="${detail}"`);
    for (const step of lqPlanckSteps) {
      expect(html).toContain(`id="${step.id}"`);
      expect(
        readFileSync(`content/source-blocks/light-quanta/${step.source}.yaml`, "utf8"),
      ).toContain(`id: "${step.source}"`);
      expect(html).toContain(`/papers/light-quanta/view/german/#${step.source}`);
      expect(foundations).toContain(`- id: "${step.tool}"`);
      expect(html).toContain(`/foundations/${step.tool.replace("foundation:", "")}/`);
    }
    expect(html).toContain(lqPlanckMetadata.citation);
  }
});

test("premises and limit qualifications remain complete in the print-expanded disclosures", () => {
  const html = renderToStaticMarkup(<LightQuantaPlanckDerivation payload={payload} />);
  expect(html).not.toContain('class="step-local-steps"');
  for (const opening of html.match(/<details\b[^>]*>/g) ?? [])
    expect(opening).toContain('class="local-steps"');
  expect(html).toContain("Which premises remain assumptions?");
  expect(html).toContain("quotient at exactly zero remains undefined");
  expect(html).toContain("no error bound at an arbitrary finite frequency");
  expect(html).toContain("not at every finite frequency");
  expect(html).toContain('href="/lab/lq-03/"');
});

test("the worked example displays the printed exponent, editorial inputs and separate modern comparison", () => {
  const html = renderToStaticMarkup(<LightQuantaPlanckDerivation payload={payload} />);
  expect(html).toContain("A worked calculation with historical inputs");
  expect(html).toContain("α = 6,10 · 10^-56");
  expect(html).toContain("uses exponent −57");
  expect(html).toContain("§2 does not print a number for R");
  expect(html).toContain("§2 does not print a number for L");
  expect(html).toContain('aria-label="6.170486 times ten to the 23"');
  expect(html).toContain('aria-label="6.170486 times ten to the 22"');
  expect(html).toContain('aria-label="6.17 times ten to the 23"');
  expect(html).toContain('aria-label="6.02214076 times ten to the 23"');
  expect(html).toContain("Separate modern comparison.");
  expect(html).toContain("It is not an input to the historical calculation above");
  expect(html).toContain("rather than independently measure a molecular number");
  expect(html).toContain('href="/papers/light-quanta/view/german/#eq-s2-d2"');
  expect(html).toContain('href="/lab/lq-02/"');
});

test("the five displayed steps have synchronized owned R0–R3 readings and a clean live audit", () => {
  const live = loadLiveReadingsInput(process.cwd(), {
    ownerBeadIds: [lqPlanckMetadata.ownerBeadId],
  });
  expect(live.unparseable).toEqual([]);
  expect(auditReadings(live.input).findings).toEqual([]);
  expect(lqPlanckSteps).toHaveLength(5);
  for (const step of lqPlanckSteps) {
    const matches = live.input.targets.filter((target) => target.targetId === step.id);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.readings).toEqual(lqPlanckReadingSet(step));
  }
});

test("the actual section route mounts the complete Planck derivation", async () => {
  const section = await exportMarkup(await PaperPage({ paperId: "light-quanta", section: "s2" }));
  expect(section).toContain('id="lq-planck-constants-derivation"');
  for (const step of lqPlanckSteps) expect(section).toContain(`id="${step.id}"`);
  expect(section).toContain("A worked calculation with historical inputs");
  expect(section).not.toContain("katex-error");
  expect(section).not.toContain('<div hidden id="S:');
});

test("the whole-paper route links to the Planck derivation without repeating its mathematics", async () => {
  const whole = await exportMarkup(await PaperPage({ paperId: "light-quanta" }));
  expect(whole).toContain('href="/papers/light-quanta/s2/#lq-planck-constants-derivation"');
  expect(whole).not.toContain('id="lq-planck-constants-derivation"');
});
