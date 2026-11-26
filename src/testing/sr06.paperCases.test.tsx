import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import VelocityPaperCasePage, { generateStaticParams } from "../app/lab/sr-06/cases/[slug]/page.tsx";
import { SR06_PAPER_CASES, velocityCaseAt } from "../experiments/sr06/paperCases.ts";

test("each printed case opens with its own accepted calculation and a path back to the source", async () => {
  expect(generateStaticParams().map(p => p.slug).sort()).toEqual(["light-ray", "oblique", "transverse"]);
  expect(velocityCaseAt("toString")).toBeUndefined();
  const readings = {
    transverse: ["0.600000", "0.480000", "0.768375"],
    oblique: ["0.816434", "0.270542", "0.860092"],
    "light-ray": ["1.000000", "0.000000", "1.000000"],
  } as const;
  for (const [slug, example] of Object.entries(SR06_PAPER_CASES)) {
    const html = renderToStaticMarkup(await VelocityPaperCasePage({ params: Promise.resolve({ slug }) }));
    const expected = readings[slug as keyof typeof readings];
    for (const [i, id] of ["composedUxOverC", "composedUyOverC", "composedSpeedOverC"].entries()) {
      expect(html).toContain(`data-output="${id}">${expected[i]}</span>`);
    }
    expect(html).toContain(example.title);
    expect(example.link.href).toBe(`/lab/sr-06/cases/${slug}/`);
    for (const source of example.sources) expect(html).toContain(`/equations/special-relativity/${source.display}/`);
  }
});
