import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import generated from "../../generated/missing-steps.json";
import type { CompiledMissingStepLesson } from "./compiled.ts";
import { MissingStepDisclosure, MissingStepPanel } from "./MissingStepPanel.tsx";

const lesson = generated.lessons[0] as CompiledMissingStepLesson | undefined;
if (!lesson)
  throw new Error(
    "Prepare the scaffold's missing-step content before running these rendering tests.",
  );
const example = lesson;
describe("missing-step reader content", () => {
  test("each step links the lesson its reason relies on, and that lesson exists", () => {
    // am-ep-equations-y76: "no step silently ships without the tool its reason relies on".
    expect(example.steps.length).toBeGreaterThan(0);
    for (const step of example.steps) {
      expect(step.tool, step.id).not.toBeNull();
      const tool = step.tool as string;
      expect(existsSync(join(process.cwd(), "content/foundations", `${tool}.json`)), tool).toBe(
        true,
      );
      const html = renderToStaticMarkup(<MissingStepPanel lesson={example} step={step} />);
      expect(html).toContain(`href="/foundations/${tool}/" data-foundation="${tool}"`);
      expect(html).toContain("Open the mathematical tool behind this step →");
      // One closing mark: "vanish?" keeps its question mark and gains no full stop.
      expect(html).toMatch(/data-return-caption="Return to [^"]+: [^"]+[.?!]"/);
      expect(html).not.toMatch(/data-return-caption="[^"]*[.?!]\."/);
      // Named by lesson and step: the visible text is the same on every step.
      expect(step.toolTitle, step.id).not.toBeNull();
      expect(html).toContain(
        `aria-label="Open the mathematical tool behind this step: ${step.toolTitle}, for ${step.title}"`,
      );
    }
  });
  test("a step with no tool renders no tool link", () => {
    const step = example.steps[0];
    if (!step) throw new Error("Expansion absent.");
    const html = renderToStaticMarkup(
      <MissingStepPanel lesson={example} step={{ ...step, tool: null, toolTitle: null }} />,
    );
    expect(html).not.toContain("Open the mathematical tool behind this step");
    expect(html).not.toContain("data-foundation=");
  });
  test("renders four keyboard links and four complete native disclosures", () => {
    const html = renderToStaticMarkup(<MissingStepDisclosure lesson={example} />);
    expect(html.match(/data-clarification-open=/g)?.length).toBe(4);
    for (const step of example.steps) expect(html).toContain(`id="static-${step.id}"`);
    expect(html).toContain("also works without JavaScript");
    expect(html).toContain("not the paper’s printed calculation");
  });
  test("both sides mark the precise cross subtree without color dependence", () => {
    const step = example.steps.find((s) => s.id === "bm-variance-cross");
    if (!step) throw new Error("Cross step absent.");
    const html = renderToStaticMarkup(<MissingStepPanel lesson={example} step={step} />);
    expect(html.match(/data-expression-id="crossTerm"/g)?.length).toBe(2);
    expect(html.match(/<math /g)?.length).toBe(2);
    expect(html).toContain("the cross-term average");
    expect(html).toContain("The increments A and B are independent.");
    expect(html).toContain("Each increment has mean zero.");
  });
  test("enumerated alternatives have headed, named tables, and nothing that fits is a tab stop", () => {
    const step = example.steps[0];
    if (!step) throw new Error("Expansion absent.");
    const html = renderToStaticMarkup(<MissingStepPanel lesson={example} step={step} />);
    expect(html.match(/<table>/g)?.length).toBe(3);
    expect(html.match(/scope="col"/g)?.length).toBe(18);
    expect(html.match(/aria-label="[^"]*: outcome table"/g)?.length).toBe(3);
    expect(html).toContain("Always the same direction");
    expect(html).toContain("Always opposite directions");
    expect(html).toContain("not observations or simulated Brownian paths");
    // Until am-14at this line read toContain('tabindex="0"'), and the tables never carried one:
    // it was met by the Before and After math regions, which fit (254/254 at 320px, 308/308 at
    // 1280px, 16 of 16 on live) and so were tab stops with nothing to scroll. The tables fit too
    // (24 of 24). A region that ever overflows gets a named tab stop from formulaOverflow.inline.ts.
    expect(html).not.toContain('tabindex="0"');
  });
  test("author prose is escaped and never evaluated as HTML", () => {
    const step = example.steps[0];
    if (!step) throw new Error("Expansion absent.");
    const html = renderToStaticMarkup(
      <MissingStepPanel
        lesson={{ ...example, sourceNotice: "<script>bad()</script>" }}
        step={step}
      />,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("the step panel's headings sit under their container (dispatch 215)", () => {
  const levels = (html: string) => [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));

  test("in the clarification drawer, a dialog of its own, the step title is an h2 and its sections h3", () => {
    const step = example.steps[0];
    if (!step) throw new Error("the lesson has no steps");
    const found = levels(renderToStaticMarkup(<MissingStepPanel lesson={example} step={step} />));
    expect(found[0]).toBe(2);
    expect(new Set(found.slice(1))).toEqual(new Set([3]));
  });

  test("inline, under the lesson's h4, each step title is an h5 and its sections h6, never an h2", () => {
    // "Expand the square" rendered as an h2 inside §4's passage, at the level of the paper's
    // sections, with "Before" and "After" as h3.
    const found = levels(renderToStaticMarkup(<MissingStepDisclosure lesson={example} />));
    expect(found[0]).toBe(4);
    const rest = found.slice(1);
    expect(rest.length).toBeGreaterThan(example.steps.length);
    expect(rest.filter((l) => l === 5).length).toBe(example.steps.length);
    for (const level of rest) expect([5, 6]).toContain(level);
  });
});
