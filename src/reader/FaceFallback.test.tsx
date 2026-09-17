import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FaceFallback } from "./FaceFallback.tsx";
import { listReadablePapers } from "./paperRoutes.ts";

async function compiledPaperId(): Promise<string> {
  const papers = await listReadablePapers();
  expect(papers.length).toBeGreaterThan(0);
  return papers[0]!;
}

describe("FaceFallback", () => {
  test("german fallback is a ready reader root with that face and a real explanation link", async () => {
    const paperId = await compiledPaperId();
    const html = renderToStaticMarkup(await FaceFallback({ paperId, face: "german" }));
    expect(html).toContain("data-reader-root");
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="german"');
    expect(html).toContain(`/papers/${paperId}/`);
    expect(html).toContain("not yet available");
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
  });

  test("results fallback is a ready reader root for that face", async () => {
    const paperId = await compiledPaperId();
    const payload = await (await import("../content/server.ts")).loadPaper(paperId);
    const section = payload.paper.sections[0]?.id;
    const html = renderToStaticMarkup(
      await FaceFallback({ paperId, section, face: "results" }),
    );
    expect(html).toContain('data-view="results"');
    expect(html).toContain(`/papers/${paperId}/${section}/view/german/`);
  });

  test("split fallback keeps both panes and narrow-tier tabs in the document", async () => {
    const paperId = await compiledPaperId();
    const html = renderToStaticMarkup(await FaceFallback({ paperId, face: "split" }));
    expect(html).toContain('data-view="split"');
    expect(html).toContain("data-split-tabs");
    expect(html).toContain('data-split-pane="parallel"');
    expect(html).toContain('data-split-pane="reading"');
  });
});
