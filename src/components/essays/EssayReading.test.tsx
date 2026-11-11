import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import EssayPage, { generateStaticParams } from "../../app/essays/[essay]/page.tsx";
import EssaysPage from "../../app/essays/page.tsx";
import { loadEssays } from "../../content/essays/load.ts";
import { ESSAY_LABEL } from "../../content/schemas/essay.ts";
import { EssayReading } from "./EssayReading.tsx";

describe("static essay reading", () => {
  test("the index and static route parameters list only the authored essays", () => {
    const essays = loadEssays();
    const html = renderToStaticMarkup(<EssaysPage />);
    expect(generateStaticParams()).toEqual(essays.map((essay) => ({ essay: essay.slug })));
    for (const essay of essays) expect(html).toContain("/essays/" + essay.slug + "/");
    expect(html).not.toContain('href="/essays/make-two-routes-meet/"');
  });

  test("all content, model math and transfer deep links exist before hydration", () => {
    for (const essay of loadEssays()) {
      const html = renderToStaticMarkup(<EssayReading essay={essay} />);
      expect(html).toContain(essay.title.replaceAll("'", "&#x27;"));
      expect(html).toContain(ESSAY_LABEL.replaceAll("'", "&#x27;"));
      expect(html).toContain("Where this appears in the papers");
      expect(html).toContain("The same move elsewhere");
      expect(html).toContain("What this essay does not claim");
      expect(html).toContain("<math");
      expect(html).not.toContain("<script");
      for (const transfer of essay.transferExamples) {
        expect(html).toContain('id="transfer-' + transfer.id + '"');
        expect(html).toContain('href="#transfer-' + transfer.id + '"');
      }
      for (const link of essay.links.values()) {
        expect(html).toContain('href="' + link.href + '"');
        for (const block of link.usedAt) expect(html).toContain('href="#' + block + '"');
      }
    }
  });

  test("an unknown essay uses the App Router not-found path", async () => {
    await expect(EssayPage({ params: Promise.resolve({ essay: "not-an-essay" }) })).rejects.toThrow();
  });
});
