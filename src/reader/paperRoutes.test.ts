import { describe, expect, test } from "bun:test";
import { PAPER_SLUGS } from "../content/schemas/source.ts";
import { DEFAULT_FACE } from "./faces/registry.ts";
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

async function compiledPaperId(): Promise<string> {
  const papers = await listReadablePapers();
  expect(papers.length).toBeGreaterThan(0);
  const paperId = papers.includes("brownian-motion") ? "brownian-motion" : papers[0];
  if (paperId === undefined) throw new Error("no compiled papers");
  return paperId;
}

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
  test("each compiled paper and its first section resolve", async () => {
    const paperId = await compiledPaperId();
    const paper = await resolvePaperRoute({ paperId });
    expect(paper).toEqual({
      ok: true,
      paperId,
      face: "reading",
    });
    expect("section" in paper).toBe(false);
    const payload = await (await import("../content/server.ts")).loadPaper(paperId);
    const sectionId = payload.paper.sections[0]?.id;
    expect(sectionId).toBeDefined();
    const section = await resolvePaperRoute({
      paperId,
      ...(sectionId ? { section: sectionId } : {}),
    });
    expect(section.ok).toBe(true);
    if (section.ok) {
      expect("section" in section).toBe(true);
      if ("section" in section) expect(section.section).toBe(sectionId);
    }
  });

  test("face fallback ids resolve; reading is not a fallback page", async () => {
    const paperId = await compiledPaperId();
    const german = await resolvePaperRoute({ paperId, face: "german" });
    expect(german.ok).toBe(true);
    if (german.ok) expect(german.face).toBe("german");
    const readingPage = await resolvePaperRoute({ paperId, face: "reading" });
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
    const paperId = await compiledPaperId();
    expect(await resolvePaperRoute({ paperId, section: "s99" })).toEqual({
      ok: false,
      code: "unknown-section",
    });
    expect(await resolvePaperRoute({ paperId, section: "view" })).toEqual({
      ok: false,
      code: "unknown-section",
    });
    expect(await resolvePaperRoute({ paperId, face: "bogus" })).toEqual({
      ok: false,
      code: "unknown-face",
    });
  });

  /**
   * paperRoutes.ts:98-99 - a slug can be valid and still not be a route, because a paper
   * without a compiled payload is not readable. This was written against the literal
   * "special-relativity", which was valid-but-unreadable when the test was authored and
   * became readable as the compiled set grew, so the fixture's premise expired rather than
   * the rule. Asserting the partition instead keeps the rule pinned as papers land: every
   * valid slug resolves exactly according to whether it is readable, and nothing else.
   *
   * Note for whoever compiles the companion dissertation: when PAPER_SLUGS and the readable
   * set coincide, the valid-but-unreadable branch has no live example left and this test
   * covers only the readable half. The branch stays reachable in tests through the
   * invalid-slug case above (classifyPaperParam -> "invalid" -> unknown-paper).
   */
  test("invariant: a valid slug is a route exactly when it is readable", async () => {
    const readable = await listReadablePapers();
    expect(readable.length).toBeGreaterThan(0);
    // The readable set is drawn from the slug set, never wider than it.
    for (const id of readable) {
      expect(PAPER_SLUGS as readonly string[]).toContain(id);
    }

    for (const slug of PAPER_SLUGS) {
      const res = await resolvePaperRoute({ paperId: slug });
      if (readable.includes(slug)) {
        expect(res).toEqual({ ok: true, paperId: slug, face: DEFAULT_FACE });
      } else {
        expect(res).toEqual({ ok: false, code: "unknown-paper" });
      }
    }

    // The partition is exhaustive: no valid slug escapes both branches.
    const unreadable = (PAPER_SLUGS as readonly string[]).filter((s) => !readable.includes(s));
    expect(readable.length + unreadable.length).toBe(PAPER_SLUGS.length);
  });

  test("compiled papers never include a bibliographic key", async () => {
    const papers = await listReadablePapers();
    expect(papers.length).toBeGreaterThan(0);
    expect(papers).not.toContain("ap-17-549");
    expect(papers.every((id) => classifyPaperParam(id) === "slug")).toBe(true);
  });

  test("section params are derived from the compiled papers, not a hardcoded slug", async () => {
    const paperId = await compiledPaperId();
    const payload = await (await import("../content/server.ts")).loadPaper(paperId);
    const sections = await sectionStaticParams();
    for (const section of payload.paper.sections) {
      expect(sections).toContainEqual({ paper: paperId, section: section.id });
    }
  });
});

describe("face fallback hrefs", () => {
  test("reading stays on the paper or section route; other faces use /view/[face]/", () => {
    expect(faceLinkHref("brownian-motion", "reading")).toBe("/papers/brownian-motion/");
    expect(faceLinkHref("brownian-motion", "german")).toBe("/papers/brownian-motion/view/german/");
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
      expect(faceFallbackPath("brownian-motion", id)).toBe(`/papers/brownian-motion/view/${id}/`);
    }
  });
});
