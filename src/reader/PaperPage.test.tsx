import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PaperPage } from "./PaperPage.tsx";
import { listReadablePapers } from "./paperRoutes.ts";

async function compiledPaperId(): Promise<string> {
  const papers = await listReadablePapers();
  expect(papers.length).toBeGreaterThan(0);
  const paperId = papers[0];
  if (paperId === undefined) throw new Error("no compiled papers");
  return paperId;
}

describe("PaperPage", () => {
  test("main reading shell is a ready reader root for the reading face", async () => {
    const paperId = await compiledPaperId();
    const html = renderToStaticMarkup(await PaperPage({ paperId }));
    expect(html).toContain("data-reader-root");
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="reading"');
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
  });

  test("section-scoped reading shell preserves all three readiness contract attributes", async () => {
    const paperId = await compiledPaperId();
    const payload = await (await import("../content/server.ts")).loadPaper(paperId);
    const section = payload.paper.sections[0]?.id;
    if (section === undefined) throw new Error("compiled paper has no sections");
    const html = renderToStaticMarkup(await PaperPage({ paperId, section }));
    expect(html).toContain("data-reader-root");
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="reading"');
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
  });
});
