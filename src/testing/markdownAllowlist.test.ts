import { describe, it, expect } from "bun:test";
import { validateConstrainedMarkdown, ContentError } from "../content/compiler/loaders.ts";
import { getLogger } from "./log/logger.ts";

describe("Markdown Allowlist & Constrained Dialect (am-cm-compiler-core-oa7)", () => {
  const logger = getLogger("content-compiler-tests");

  function logTest(testId: string, outcome: "passed" | "failed", message: string) {
    logger.log({
      testId,
      beadId: "am-cm-compiler-core-oa7",
      outcome,
      message,
    });
  }

  it("admits valid prose, headings, lists, quotes, inline code, and links", () => {
    const valid = [
      "# Section 1",
      "",
      "This is a *valid* paragraph with **strong** emphasis and `inline code`.",
      "",
      "- Item one",
      "- Item two with [internal link](#section-2)",
      "",
      "1. First step",
      "2. Second step",
      "",
      "> A historical quotation from 1905.",
      "",
      "See [Foundation: bridge-sum-average](/foundations/bridge-sum-average/) for details.",
      "",
      "$$\\langle x^2 \\rangle = 2Dt$$",
    ].join("\n");

    const result = validateConstrainedMarkdown(valid, "valid.md");
    expect(result.ok).toBe(true);
    expect(result.issues.length).toBe(0);
    logTest("markdown-valid-prose", "passed", "Admitted valid constrained markdown prose");
  });

  it("admits images with admitted figure IDs", () => {
    const md = "![Diagram of Brownian Motion](fig-bm-01)";
    const admitted = new Set(["fig-bm-01"]);
    const result = validateConstrainedMarkdown(md, "figures.md", { admittedFigureIds: admitted });
    expect(result.ok).toBe(true);
    expect(result.issues.length).toBe(0);
    logTest("markdown-admitted-image", "passed", "Admitted image with approved figure ID");
  });

  it("rejects raw HTML tags with line number", () => {
    const md = "Line 1: clean\nLine 2: <div class=\"warning\">Caution</div>\nLine 3: clean";
    const result = validateConstrainedMarkdown(md, "html.md");
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "markdown-raw-html" && i.line === 2)).toBe(true);

    expect(() =>
      validateConstrainedMarkdown(md, "html.md", { throwOnError: true }),
    ).toThrow(ContentError);
    logTest("markdown-reject-raw-html", "passed", "Rejected raw HTML <div> tag with line number");
  });

  it("rejects <script> tags specifically with script-tag-forbidden code", () => {
    const md = "# Title\n\n<script>alert(document.cookie)</script>\n";
    const result = validateConstrainedMarkdown(md, "xss.md");
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "script-tag-forbidden" && i.line === 3)).toBe(true);
    logTest("markdown-reject-script", "passed", "Rejected <script> tag with line number");
  });

  it("rejects MDX import and export statements", () => {
    const mdImport = "import { InteractiveChart } from './Chart.tsx';\n\n# Chart page";
    const r1 = validateConstrainedMarkdown(mdImport, "import.md");
    expect(r1.ok).toBe(false);
    expect(r1.issues.some((i) => i.code === "mdx-syntax-forbidden" && i.line === 1)).toBe(true);

    const mdExport = "# Page\n\nexport const meta = { title: 'Test' };";
    const r2 = validateConstrainedMarkdown(mdExport, "export.md");
    expect(r2.ok).toBe(false);
    expect(r2.issues.some((i) => i.code === "mdx-syntax-forbidden" && i.line === 3)).toBe(true);
    logTest("markdown-reject-mdx-imports", "passed", "Rejected MDX import and export statements");
  });

  it("rejects JSX / MDX component syntax", () => {
    const md = "# Interactive\n\n<SimulationCanvas width={800} height={600} />\n";
    const result = validateConstrainedMarkdown(md, "jsx.md");
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "mdx-syntax-forbidden" && i.line === 3)).toBe(true);
    logTest("markdown-reject-jsx", "passed", "Rejected JSX component syntax");
  });

  it("rejects unadmitted image URLs", () => {
    const md = "![External graphic](https://untrusted.org/evil.png)";
    const result = validateConstrainedMarkdown(md, "unadmitted.md");
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "image-forbidden" && i.line === 1)).toBe(true);
    logTest("markdown-reject-unadmitted-image", "passed", "Rejected unadmitted external image");
  });
});
