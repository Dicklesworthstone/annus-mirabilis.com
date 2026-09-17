import { describe, expect, test } from "bun:test";
import {
  classifyPaperParam,
  FACE_FALLBACK_IDS,
  faceFallbackPath,
  faceLinkHref,
  isFaceFallbackId,
  listReadablePapers,
  paperPath,
  resolvePaperRoute,
  sectionStaticParams,
} from "./paperRoutes.ts";

describe("classifyPaperParam", () => {
  test("accepts the closed paper-slug set", () => {
    expect(classifyPaperParam("brownian-motion")).toBe("slug");
    expect(classifyPaperParam("light-quanta")).toBe("slug");
    expect(classifyPaperParam("molecular-dimensions")).toBe("slug");
  });

  test("planted negative: bibliographic keys never become URL slugs", () => {
    expect(classifyPaperParam("ap-17-549")).toBe("bibliographic-key");
    expect(classifyPaperParam("ap-17-132")).toBe("bibliographic-key");
  });

  test("planted negative: unknown tokens are invalid", () => {
    expect(classifyPaperParam("not-a-paper")).toBe("invalid");
    expect(classifyPaperParam("view")).toBe("invalid");
  });
});

describe("resolvePaperRoute", () => {
  test("the compiled brownian-motion paper and its sections resolve", async () => {
    const paper = await resolvePaperRoute({ paperId: "brownian-motion" });
    expect(paper).toEqual({
      ok: true,
      paperId: "brownian-motion",
      section: undefined,
      face: "reading",
    });
    const section = await resolvePaperRoute({ paperId: "brownian-motion", section: "s4" });
    expect(section.ok).toBe(true);
    if (section.ok) expect(section.section).toBe("s4");
  });

  test("face fallback ids resolve; reading is not a fallback page", async () => {
    const german = await resolvePaperRoute({ paperId: "brownian-motion", face: "german" });
    expect(german.ok).toBe(true);
    if (german.ok) expect(german.face).toBe("german");
    const readingPage = await resolvePaperRoute({ paperId: "brownian-motion", face: "reading" });
    expect(readingPage).toEqual({ ok: false, code: "unknown-face" });
  });

  test("planted negative: unknown paper, section, and face refuse", async () => {
    expect(await resolvePaperRoute({ paperId: "not-a-paper" })).toEqual({
      ok: false,
      code: "unknown-paper",
    });
    expect(await resolvePaperRoute({ paperId: "ap-17-549" })).toEqual({
      ok: false,
      code: "bibliographic-key",
    });
    expect(await resolvePaperRoute({ paperId: "light-quanta" })).toEqual({
      ok: false,
      code: "unknown-paper",
    });
    expect(await resolvePaperRoute({ paperId: "brownian-motion", section: "s99" })).toEqual({
      ok: false,
      code: "unknown-section",
    });
    expect(await resolvePaperRoute({ paperId: "brownian-motion", section: "view" })).toEqual({
      ok: false,
      code: "unknown-section",
    });
    expect(await resolvePaperRoute({ paperId: "brownian-motion", face: "bogus" })).toEqual({
      ok: false,
      code: "unknown-face",
    });
  });

  test("compiled papers never include a bibliographic key", async () => {
    const papers = await listReadablePapers();
    expect(papers).toContain("brownian-motion");
    expect(papers).not.toContain("ap-17-549");
    expect(papers.every((id) => classifyPaperParam(id) === "slug")).toBe(true);
  });

  test("section params are paper-agnostic and include brownian s4 and s5", async () => {
    const sections = await sectionStaticParams();
    expect(sections).toContainEqual({ paper: "brownian-motion", section: "s4" });
    expect(sections).toContainEqual({ paper: "brownian-motion", section: "s5" });
  });
});

describe("face fallback hrefs", () => {
  test("reading stays on the paper or section route; other faces use /view/[face]/", () => {
    expect(faceLinkHref("brownian-motion", "reading")).toBe("/papers/brownian-motion/");
    expect(faceLinkHref("brownian-motion", "german")).toBe(
      "/papers/brownian-motion/view/german/",
    );
    expect(faceLinkHref("brownian-motion", "results", "s4")).toBe(
      "/papers/brownian-motion/s4/view/results/",
    );
    expect(paperPath("brownian-motion", "s5")).toBe("/papers/brownian-motion/s5/");
  });

  test("every fallback id is a closed face and never reading", () => {
    expect(isFaceFallbackId("reading")).toBe(false);
    expect(FACE_FALLBACK_IDS).not.toContain("reading");
    for (const id of FACE_FALLBACK_IDS) {
      expect(isFaceFallbackId(id)).toBe(true);
      expect(faceFallbackPath("brownian-motion", id)).toBe(
        `/papers/brownian-motion/view/${id}/`,
      );
    }
  });
});
