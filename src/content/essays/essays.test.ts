import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkVoice } from "../checks/voice/index.ts";
import { ESSAY_LABEL, validateEssay } from "../schemas/essay.ts";
import { strictParse } from "../schemas/strictParse.ts";
import { loadEssays, resolveEssayAnchor, validateEssayProse } from "./load.ts";
import { parseEssayMarkdown } from "./markdown.ts";

const root = process.cwd();
function metadata(slug = "what-a-measurement-means"): Record<string, unknown> {
  return strictParse(readFileSync(join(root, "content/essays", slug + ".yaml"), "utf8"),
    "yaml") as Record<string, unknown>;
}

describe("methodological essay content", () => {
  test("two complete readings resolve their sources, instruments, equations, values and transfer IDs", () => {
    const essays = loadEssays(root);
    expect(essays.map((essay) => essay.slug)).toEqual(["what-a-measurement-means",
      "change-what-you-hold-fixed"]);
    const transferIds = essays.flatMap((essay) => essay.transferExamples.map((example) => example.id));
    expect(new Set(transferIds).size).toBe(6);
    for (const essay of essays) {
      expect(essay.label).toBe(ESSAY_LABEL);
      expect(essay.reviewRecordIds).toEqual([]);
      expect(essay.blocks.filter((block) => block.kind === "paragraph").length).toBeGreaterThan(8);
      expect(essay.bibliography.length).toBeGreaterThan(0);
      expect([...essay.links.values()].some((link) => link.kind === "instrument")).toBe(true);
      expect([...essay.links.values()].filter((link) => link.kind === "source").every((link) =>
        link.source?.id && link.href.includes("/view/german/#") && link.usedAt.length > 0))
          .toBe(true);
      expect([...essay.renderedEquations.values()].every((equation) =>
        equation.html.includes("katex") && equation.mathml.includes("<math"))).toBe(true);
    }
    expect(essays[1]?.values.get("band-energy")?.text).toBe("9.06 nJ");
    expect(essays[1]?.values.get("entropy-change")?.text).toBe("-2.18 × 10^-13 J/K");
    expect(essays[1]?.values.get("rms-ratio")?.text).toBe("0.7071");
  });

  test("informational independence vocabulary does not prevent an essay from loading", () => {
    const passage = "Successive motions are treated as independent.";
    const findings = checkVoice(passage, { context: "prose" });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe("independence-claim");
    expect(findings[0]?.severity).toBe("info");
    expect(() => validateEssayProse([passage], "voice-fixture")).not.toThrow();
  });

  for (const fixture of [
    {
      severity: "flag",
      rule: "unverified-count",
      text: "Independent observations guide six laboratories and a reading path.",
    },
    {
      severity: "error",
      rule: "hype-word",
      text: "Independent observations make this revolutionary.",
    },
  ] as const) {
    test(`a blocking ${fixture.severity} still rejects prose with informational findings`, () => {
      const findings = checkVoice(fixture.text, { context: "prose" });
      expect(findings.some((finding) => finding.severity === "info")).toBe(true);
      expect(findings.some((finding) =>
        finding.rule === fixture.rule && finding.severity === fixture.severity)).toBe(true);
      expect(() => validateEssayProse([
        "Successive motions are treated as independent.",
        fixture.text,
      ], "voice-fixture")).toThrow(
        `voice-fixture:prose-1: Shared voice check: ${fixture.rule}`,
      );
    });
  }

  test("required interpretation label, summary, limits and stable transfer identities cannot disappear", () => {
    const raw = metadata();
    expect(() => validateEssay({ ...raw, label: "Einstein's method" })).toThrow("label");
    expect(() => validateEssay({ ...raw, r0Summary: "Only one sentence." }))
      .toThrow("two or three");
    expect(() => validateEssay({ ...raw, limits: ["A limit.", "Another limit."] }))
      .toThrow("methodological limits");
    const transfers = raw.transferExamples as readonly Record<string, unknown>[];
    expect(() => validateEssay({ ...raw, transferExamples: [transfers[0], transfers[0]] }))
      .toThrow("unique");
    expect(() => validateEssay({ ...raw, body: "../other.md" })).toThrow("beside");
  });

  test("result anchors resolve aggregate result decks and the rendered card ID", () => {
    const anchor = resolveEssayAnchor(root, {
      anchorId: "mass-energy/me-light-energy-transformation", kind: "result",
      role: "Inspect the imported result.",
    }, new Map(), "result-reference");
    expect(anchor.title).toBe("The imported light-energy transformation");
    expect(anchor.href)
      .toBe("/papers/mass-energy/view/results/#result-me-light-energy-transformation");
    expect(() => resolveEssayAnchor(root, {
      anchorId: "mass-energy/missing-result", kind: "result", role: "Missing.",
    }, new Map(), "result-reference")).toThrow("Unresolved result");
  });

  test("transfer anchors survive a metadata reorder", () => {
    const raw = metadata();
    const original = validateEssay(raw);
    const reordered = validateEssay({ ...raw,
      transferExamples: [...original.transferExamples].reverse() });
    expect(new Set(reordered.transferExamples.map((example) => "transfer-" + example.id))).toEqual(
      new Set(original.transferExamples.map((example) => "transfer-" + example.id)),
    );
  });

  test("the constrained body rejects raw HTML, executable links, raw LaTeX and duplicate paragraph IDs", () => {
    const header = "## A comparison {#comparison}\n\n";
    for (const body of [
      "<script>alert(1)</script> {#bad}",
      "[open](javascript:alert) {#bad}",
      "[open](https://example.com/) {#bad}",
      "$E=mc^2$ {#bad}",
      String.raw`\(E=mc^2\) {#bad}`,
      "A sentence. {#comparison}",
    ]) expect(() => parseEssayMarkdown(header + body, "planted.md")).toThrow();
  });

  test("quotation syntax names a source anchor rather than retyping a quotation", () => {
    const blocks = parseEssayMarkdown(
      "## A passage {#passage}\n\nRead the source. {#read}\n\n> source:special-relativity/s1-p7 {#quote}",
      "quoted.md",
    );
    expect(blocks[2]).toEqual({ kind: "quotation", id: "quote",
      anchorId: "special-relativity/s1-p7" });
    expect(() => parseEssayMarkdown("## A passage {#passage}\n\n> Retyped words. {#quote}",
      "bad.md")).toThrow("retype");
  });
});
