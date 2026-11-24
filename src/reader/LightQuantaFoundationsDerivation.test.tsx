import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { auditReadings } from "../content/audits/readings.ts";
import { loadLiveReadingsInput } from "../content/audits/readingsLive.ts";
import {
  lqFoundationReadingSet,
  lqFoundationSteps,
  lqFoundationsMetadata,
} from "../equations/derivations/lightQuantaFoundations.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { LightQuantaFoundationsDerivation } from "./LightQuantaFoundationsDerivation.tsx";
import { PaperPage } from "./PaperPage.tsx";

test("the two foundational derivations render complete mathematics, reasons and real source links without scripts", () => {
  const foundations = readFileSync("content/foundations/registry.yaml", "utf8");
  for (const section of ["s1", "s5"] as const) {
    for (const activeDetail of ["0", "1", "2"] as const) {
      const html = renderToStaticMarkup(
        <LightQuantaFoundationsDerivation section={section} activeDetail={activeDetail} />,
      );
      expect(html).toContain("<math");
      expect(html).not.toContain("katex-error");
      expect(html).toMatch(/<details\b[^>]*\bopen=""/);
      expect(html).toContain('data-is-move="true"');
      expect(html).not.toContain("data-checked-proof");
      for (const detail of ["0", "1", "2"])
        expect(html).toContain(`data-reading="${detail}" data-detail="${detail}"`);
      expect(html).toContain('data-reading="3" data-detail="3"');
      expect(html).toContain(lqFoundationsMetadata[section].citation);
      for (const step of lqFoundationSteps[section]) {
        expect(html).toContain(`id="${step.id}"`);
        expect(html).toContain(`/papers/light-quanta/view/german/#${step.source.anchor}`);
        const source = readFileSync(
          `content/source-blocks/light-quanta/${step.source.anchor}.yaml`,
          "utf8",
        );
        expect(source).toContain(`id: "${step.source.anchor}"`);
        expect(foundations).toContain(`- id: "${step.tool}"`);
        expect(html).toContain(`/foundations/${step.tool.replace("foundation:", "")}/`);
      }
    }
  }
});

test("every new displayed step has the same owned R0–R3 readings and passes the live audit", () => {
  const live = loadLiveReadingsInput(process.cwd(), {
    ownerBeadIds: Object.values(lqFoundationsMetadata).map((entry) => entry.ownerBeadId),
  });
  expect(live.unparseable).toEqual([]);
  expect(auditReadings(live.input).findings).toEqual([]);
  const ids = Object.values(lqFoundationSteps).flatMap((steps) => steps.map((step) => step.id));
  expect(ids).toHaveLength(7);
  expect(live.input.targets.filter((target) => ids.includes(target.targetId))).toHaveLength(7);
  for (const section of ["s1", "s5"] as const)
    for (const step of lqFoundationSteps[section]) {
      const target = live.input.targets.find((candidate) => candidate.targetId === step.id);
      expect(target?.readings).toEqual(lqFoundationReadingSet(step, section));
    }
});

for (const [section, anchor] of [
  ["s1", "lq-classical-cutoff-derivation"],
  ["s5", "lq-independent-entropy-derivation"],
] as const) {
  test(`the real ${section} explanation route includes its complete foundation derivation`, async () => {
    const html = await exportMarkup(await PaperPage({ paperId: "light-quanta", section }));
    expect(html).toContain(`id="${anchor}"`);
    for (const step of lqFoundationSteps[section]) expect(html).toContain(`id="${step.id}"`);
    expect(html).not.toContain("katex-error");
    expect(html).not.toContain('<div hidden id="S:');
  });
}

test("the whole-paper route links to both foundational derivations without repeating their mathematics", async () => {
  const html = await exportMarkup(await PaperPage({ paperId: "light-quanta" }));
  for (const [section, anchor] of [
    ["s1", "lq-classical-cutoff-derivation"],
    ["s5", "lq-independent-entropy-derivation"],
  ]) {
    expect(html).toContain(`href="/papers/light-quanta/${section}/#${anchor}"`);
    expect(html).not.toContain(`id="${anchor}"`);
  }
});

test("the classical reading distinguishes a cutoff, positive-temperature divergence and evidence", () => {
  const html = renderToStaticMarkup(
    <LightQuantaFoundationsDerivation section="s1" activeDetail="2" />,
  );
  expect(html).toContain('id="lq-classical-cutoff-derivation"');
  for (const phrase of [
    "source obtains it by combining",
    "for every positive cutoff",
    "every finite cutoff gives a finite result",
    "At zero temperature",
    "wave description",
    "does not derive",
  ])
    expect(html).toContain(phrase);
  expect(html).toContain('href="/lab/lq-02/"');
});

test("the independent-point reading keeps the reference domain and correlated alternative visible", () => {
  const html = renderToStaticMarkup(
    <LightQuantaFoundationsDerivation section="s5" activeDetail="2" />,
  );
  expect(html).toContain('id="lq-independent-entropy-derivation"');
  for (const phrase of [
    "remain assumptions",
    "correlated points",
    "Boltzmann",
    "locked to one common position",
    "Zero points",
    "logarithm is undefined",
  ])
    expect(html).toContain(phrase);
  expect(html).toContain('href="/lab/lq-05/"');
  expect(html).toContain('href="/papers/light-quanta/s6/#lq-entropy-correspondence-derivation"');
});
