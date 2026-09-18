import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadPaper } from "../content/server.ts";
import { PaperReader } from "./PaperReader.tsx";

describe("PaperReader", () => {
  test("main brownian reader root emits all three readiness contract attributes", async () => {
    const html = renderToStaticMarkup(await PaperReader());
    expect(html).toContain("data-reader-root");
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="reading"');
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
  });

  test("section-scoped brownian reader preserves all three readiness contract attributes", async () => {
    const payload = await loadPaper("brownian-motion");
    const section = payload.paper.sections[0]?.id;
    if (section === undefined) throw new Error("compiled paper has no sections");
    const html = renderToStaticMarkup(await PaperReader({ section }));
    expect(html).toContain("data-reader-root");
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="reading"');
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
  });

  test("companion-scoped brownian reader preserves all three readiness contract attributes", async () => {
    const html = renderToStaticMarkup(await PaperReader({ companion: "derivation" }));
    expect(html).toContain("data-reader-root");
    expect(html).toContain('data-ready="true"');
    expect(html).toContain('data-view="reading"');
    expect((html.match(/data-reader-root/g) ?? []).length).toBe(1);
  });
});
