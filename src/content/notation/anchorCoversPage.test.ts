/**
 * Every concordance entry's anchor covers the page it names (anchorCoversPage.ts), checked on the
 * real concordances for each paper whose German face renders text, and proved on fixtures in both
 * directions.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { loadFirstUseTargets, resolveFirstUse } from "../../app/notation/firstUseTargets.ts";
import { aliasTargets, anchorPageFindings, bareAnchor, manifestPages } from "./anchorCoversPage.ts";
import { loadConcordanceForPaper } from "./loader.ts";

const ROOT = process.cwd();
const papers = readdirSync(join(ROOT, "content", "notation"))
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => f.replace(/\.yaml$/, ""))
  .sort();

describe("a concordance entry's anchor covers its page", () => {
  test("on every paper with a German face; 0 checked is a failure", async () => {
    const targets = await loadFirstUseTargets();
    const checked: string[] = [];
    const notChecked: string[] = [];
    const findings: string[] = [];
    const awaiting: string[] = [];
    let total = 0;
    for (const paper of papers) {
      const face = targets.german.get(paper);
      const pages = manifestPages(ROOT, paper);
      if (!face || !pages) {
        notChecked.push(
          `${paper} (${!pages ? "no source manifest" : "its German face has no text"})`,
        );
        continue;
      }
      const r = anchorPageFindings(
        loadConcordanceForPaper(paper).entries,
        face,
        pages,
        aliasTargets(ROOT, paper),
      );
      total += r.checked;
      checked.push(`${paper} ${r.checked}`);
      // A German face built a section at a time (5dd47456) publishes only the sections it has. An
      // anchor in a section it lacks is awaiting its German, not broken, provided two things hold:
      // the reader is never sent to it (resolveFirstUse falls back to the section page), and the
      // anchor still covers its page in the manifest. An anchor in a section the face HAS must be
      // on the face, as before.
      const faceSections = new Set([...face].map((a) => /^(s\d+)(-|$)/.exec(a)?.[1]));
      for (const f of r.findings) {
        const section = /^(s\d+)-/.exec(bareAnchor(f.anchor))?.[1];
        const pending = f.reason === "not-on-face" && section && !faceSections.has(section);
        const href = resolveFirstUse(paper, f.anchor, targets) ?? "";
        if (pending && !href.includes("/view/german/") && f.covers.includes(f.page)) {
          awaiting.push(f.anchor);
          continue;
        }
        findings.push(
          `${f.entry}: ${f.anchor} ${f.reason} (page ${f.page}; the block covers ${f.covers.join(", ") || "none"})`,
        );
      }
    }
    console.log(
      `[anchor covers page] checked ${total} entries with a German-face anchor (${checked.join(", ")}); not checked: ${notChecked.join(", ") || "none"}; awaiting their section's German: ${awaiting.length}`,
    );
    expect(total).toBeGreaterThan(0);
    expect(findings).toEqual([]);
  });
});

describe("the comparison, on fixtures", () => {
  const pages = new Map<string, readonly number[]>([
    ["s1-p1", [133, 134]],
    ["s2-p1", [136]],
    ["s2-p2", [136, 137]],
  ]);
  const face = new Set(["s1-p1", "s2-p1", "s2-p2", "s2-p3"]);
  const aliases = new Map([["s2-p3", ["s2-p2"]]]);
  const entry = (anchor: string, page: number) => ({
    id: `lq.x.${anchor}`,
    sources: { anchor, facsimilePage: page },
  });
  const reasons = (...entries: ReturnType<typeof entry>[]) =>
    anchorPageFindings(entries, face, pages, aliases).findings.map((f) => f.reason);

  test("a page the paragraph covers passes, including the second page of one that runs over", () => {
    expect(reasons(entry("lq-s1-p1", 133), entry("lq-s1-p1", 134))).toEqual([]);
  });

  test("the defect c1e80b4b shipped: page 134 with the anchor left on §2's first paragraph", () => {
    const r = anchorPageFindings([entry("lq-s2-p1", 134)], face, pages, aliases);
    expect(r.findings).toEqual([
      {
        entry: "lq.x.lq-s2-p1",
        anchor: "lq-s2-p1",
        page: 134,
        reason: "page-not-covered",
        covers: [136],
      },
    ]);
  });

  test("a retired anchor covers the pages of the id that replaced it", () => {
    expect(reasons(entry("lq-s2-p3", 137))).toEqual([]);
    expect(reasons(entry("lq-s2-p3", 134))).toEqual(["page-not-covered"]);
  });

  test("an anchor the German face does not publish, or the manifest does not have, is reported", () => {
    expect(reasons(entry("lq-s9-p9", 147))).toEqual(["not-on-face"]);
    const withGhost = new Set([...face, "s7-p1"]);
    expect(
      anchorPageFindings([entry("lq-s7-p1", 144)], withGhost, pages, aliases).findings.map(
        (f) => f.reason,
      ),
    ).toEqual(["not-in-manifest"]);
  });

  test("an entry without an anchor or a page is not counted as checked", () => {
    const r = anchorPageFindings(
      [
        { id: "a", sources: { anchor: "lq-s1-p1" } },
        { id: "b", sources: {} },
      ],
      face,
      pages,
      aliases,
    );
    expect(r.checked).toBe(0);
    expect(bareAnchor("sr-s3-p14")).toBe("s3-p14");
  });
});
