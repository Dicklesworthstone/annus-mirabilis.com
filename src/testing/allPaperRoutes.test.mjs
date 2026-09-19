import assert from "node:assert/strict";
import test from "node:test";
import { loadPaper } from "../content/server.ts";
import { passageActionsFromArgument } from "../reader/actions/fromArgument.ts";
import {
  FACE_FALLBACK_IDS, faceFallbackStaticParams, paperMetadata, paperStaticParams,
  readerSitemapEntries, resolvePaperRoute, sectionFaceFallbackStaticParams, sectionStaticParams,
} from "../reader/paperRoutes.ts";

// These checks consume the real digest-verified output of prepare:content. No
// test fixture replaces the index used by Next's generateStaticParams.
test("the generated index supplies reading routes for all four papers", async () => {
  assert.deepEqual((await paperStaticParams()).map(p => p.paper), [
    "brownian-motion", "light-quanta", "mass-energy", "special-relativity",
  ]);
});

for (const [paper, sectionCount, prefix, labCount] of [
  ["light-quanta", 10, "lq", 9], ["special-relativity", 11, "sr", 13],
]) {
  test(`${paper}: every new section has a resolvable canonical reader and sitemap entry`, async () => {
    const sections = (await sectionStaticParams()).filter(p => p.paper === paper);
    assert.deepEqual(sections.map(p => p.section), Array.from({ length: sectionCount }, (_, i) => `s${i}`));
    const sitemap = new Set((await readerSitemapEntries()).map(entry => entry.url));
    for (const { section } of sections) {
      assert.equal((await resolvePaperRoute({ paperId: paper, section })).ok, true);
      const metadata = await paperMetadata({ paperId: paper, section });
      const canonical = `https://annus-mirabilis.com/papers/${paper}/${section}/`;
      assert.equal(metadata.alternates.canonical, canonical);
      assert.ok(sitemap.has(canonical));
    }
    assert.deepEqual(await resolvePaperRoute({ paperId: paper, section: "s99" }), { ok: false, code: "unknown-section" });
  });

  test(`${paper}: generated source-face routes retain the in-preparation boundary`, async () => {
    const payload = await loadPaper(paper);
    assert.equal(payload.paper.sourceStatus, "in-preparation");
    assert.equal(payload.paper.status, "explanation-preview");
    assert.ok(payload.arguments.every(argument => argument.review === "draft"));
    const roots = (await faceFallbackStaticParams()).filter(row => row.paper === paper);
    assert.deepEqual(roots.map(row => row.face), [...FACE_FALLBACK_IDS]);
    const sections = (await sectionFaceFallbackStaticParams()).filter(row => row.paper === paper);
    assert.equal(sections.length, sectionCount * FACE_FALLBACK_IDS.length);
    for (const { face, section } of sections) {
      assert.equal((await resolvePaperRoute({ paperId: paper, section, face })).ok, true);
    }
  });

  test(`${paper}: the rendered Try it action reaches every laboratory, not just secondary references`, async () => {
    const payload = await loadPaper(paper);
    const targets = new Set();
    const foundations = new Set(payload.foundations.map(foundation => foundation.id));
    for (const argument of payload.arguments) {
      const actions = passageActionsFromArgument(argument);
      assert.equal(actions.tryIt.kind, "instrument");
      targets.add(actions.tryIt.instrumentId);
      for (const target of [actions.why, actions.missingStep, actions.example]) assert.ok(foundations.has(target));
    }
    assert.deepEqual([...targets].sort(), Array.from({ length: labCount }, (_, i) => `${prefix}-${String(i + 1).padStart(2, "0")}`));
  });
}

test("a bibliographic key remains a citation identity, not an accidental fifth paper route", async () => {
  assert.deepEqual(await resolvePaperRoute({ paperId: "ap-17-891" }), { ok: false, code: "bibliographic-key" });
  assert.deepEqual(await resolvePaperRoute({ paperId: "molecular-dimensions" }), { ok: false, code: "unknown-paper" });
});
