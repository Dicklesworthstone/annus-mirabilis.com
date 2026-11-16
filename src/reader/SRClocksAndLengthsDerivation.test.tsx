import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  srClockLengthChains,
  srClockLengthSourceLinks,
} from "../equations/derivations/srClocksAndLengths.ts";
import { exportMarkup } from "../testing/exportMarkup.ts";
import { PaperPage } from "./PaperPage.tsx";
import { SRClocksAndLengthsDerivation } from "./SRClocksAndLengthsDerivation.tsx";

test("both full measurement chains, event choices and source returns are present without JavaScript", () => {
  const html = renderToStaticMarkup(<SRClocksAndLengthsDerivation activeDetail="2" />);
  for (const chain of srClockLengthChains) {
    expect(html).toContain(chain.id);
    for (const step of chain.steps) expect(html).toContain(step.id);
  }
  for (const source of srClockLengthSourceLinks) {
    expect(html).toContain('id="' + source.id + '"');
    expect(html).toContain("/papers/special-relativity/view/german/#" + source.anchor);
  }
  expect(html).toContain("<math");
  expect(html).toContain("<details");
  expect(html).toContain("The two positions in k");
  expect(html).toContain("The two times in K");
  expect(html).toContain("No starting reading or endpoint position");
  expect(html).toContain("/lab/sr-05/");
  expect(html).toContain("/lab/sr-03/");
  expect(html).toContain("accelerating clock");
  expect(html).toContain("longitudinal length");
});

test("the actual section route mounts the chains and the paper route returns to that section", async () => {
  const section = await exportMarkup(
    await PaperPage({ paperId: "special-relativity", section: "s4" }),
  );
  expect(section).toContain('id="sr-clock-length-derivation"');
  expect(section).toContain('id="sr-clock-length-clock"');
  expect(section).toContain('id="sr-clock-length-rod"');
  for (const chain of srClockLengthChains) expect(section).toContain(chain.id);
  const paper = await exportMarkup(await PaperPage({ paperId: "special-relativity" }));
  expect(paper).toContain('href="/papers/special-relativity/s4/#sr-clock-length-derivation"');
});
