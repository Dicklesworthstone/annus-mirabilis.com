import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  checkEquationPrintWidth,
  checkSectionStepCoverage,
  hasAuthoredMultiLineForm,
  MAX_PRINTABLE_EQUATION_WIDTH_CHARS,
  runPrintCoverageCheck,
} from "./printCoverage.ts";

describe("printCoverage: Equation Width & Multiline Forms", () => {
  it("detects authored multiline forms in LaTeX and properties", () => {
    assert.equal(hasAuthoredMultiLineForm({ latex: "a = b \\\\ c = d" }), true);
    assert.equal(
      hasAuthoredMultiLineForm({
        latex: "\\begin{aligned} x &= y \\\\ z &= w \\end{aligned}",
      }),
      true,
    );
    assert.equal(hasAuthoredMultiLineForm({ multiLineForm: "a = b \n c = d" }), true);
    assert.equal(hasAuthoredMultiLineForm({ hasMultiLineForm: true }), true);
    assert.equal(hasAuthoredMultiLineForm({ latex: "E = mc^2" }), false);
  });

  it("reports print-overflow when equation exceeds width limit without multiline form", () => {
    const longSingleLineLatex =
      "\\overline{\\Delta^2} = 2 D t = 2 \\cdot \\left( \\frac{R T}{N_A} \\frac{1}{6 \\pi \\eta P} \\right) t = \\frac{R T}{3 \\pi \\eta N_A P} t";
    assert.ok(longSingleLineLatex.length > MAX_PRINTABLE_EQUATION_WIDTH_CHARS);

    const overwideEq = {
      id: "eq-test-overwide",
      kind: "equation",
      latex: longSingleLineLatex,
    };

    const diagnostics = checkEquationPrintWidth(overwideEq);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0]?.rule, "print-overflow");
    assert.equal(diagnostics[0]?.severity, "flag");
    assert.equal(diagnostics[0]?.recordId, "eq-test-overwide");

    // Adding an authored multiline form resolves the overflow
    const multilineEq = {
      ...overwideEq,
      multiLineForm: "\\begin{aligned} ... \\end{aligned}",
    };
    assert.equal(checkEquationPrintWidth(multilineEq).length, 0);
  });

  it("passes short display equations", () => {
    const shortEq = {
      id: "eq-test-short",
      kind: "equation",
      latex: "D = \\frac{R T}{6 \\pi \\eta N r}",
    };
    assert.equal(checkEquationPrintWidth(shortEq).length, 0);
  });
});

describe("printCoverage: Step Coverage for Printed Sections", () => {
  it("fails a section when a referenced step is omitted in print", () => {
    const section = {
      id: "sec-04-observable",
      kind: "section",
      referencedStepIds: ["step-bm-04-1", "step-bm-04-side-door"],
    };

    // Only source-order route is expanded; side-door route is collapsed without essentialForPrint
    const derivationRoutes = [
      {
        id: "route-so",
        kind: "source-order",
        steps: [{ id: "step-bm-04-1" }],
      },
      {
        id: "route-disc",
        kind: "discovery",
        essentialForPrint: false,
        steps: [{ id: "step-bm-04-side-door" }],
      },
    ];

    const diagnostics = checkSectionStepCoverage(section, derivationRoutes);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0]?.rule, "print-step-coverage");
    assert.equal(diagnostics[0]?.severity, "error");
    assert.equal(diagnostics[0]?.recordId, "sec-04-observable");
    assert.ok(diagnostics[0]?.message.includes("step-bm-04-side-door"));
  });

  it("passes when all referenced steps are in expanded routes or have essentialForPrint: true", () => {
    const section = {
      id: "sec-04-observable",
      kind: "section",
      referencedStepIds: ["step-bm-04-1", "step-bm-04-side-door"],
    };

    const derivationRoutes = [
      {
        id: "route-so",
        kind: "source-order",
        steps: [{ id: "step-bm-04-1" }],
      },
      {
        id: "route-disc",
        kind: "discovery",
        essentialForPrint: true, // Marked essential for print!
        steps: [{ id: "step-bm-04-side-door" }],
      },
    ];

    const diagnostics = checkSectionStepCoverage(section, derivationRoutes);
    assert.equal(diagnostics.length, 0);
  });
});

describe("printCoverage: Compiler Check Runner", () => {
  it("runs print coverage check against compiler records map", () => {
    const reports: Array<{
      recordId?: string | undefined;
      rule?: string | undefined;
      message: string;
    }> = [];
    const records = new Map<string, unknown>([
      [
        "eq-long",
        {
          id: "eq-long",
          kind: "equation",
          latex: "A".repeat(120),
        },
      ],
      [
        "sec-missing-step",
        {
          id: "sec-missing-step",
          kind: "section",
          referencedStepIds: ["step-omitted"],
        },
      ],
    ]);

    const checkContext = {
      records,
      files: [],
      indexes: {},
      report: (item: {
        recordId?: string | undefined;
        rule?: string | undefined;
        message: string;
      }) => {
        reports.push(item);
      },
    };

    runPrintCoverageCheck(checkContext);
    assert.equal(reports.length, 2);
    const rules = reports.map((r) => r.rule);
    assert.ok(rules.includes("print-overflow"));
    assert.ok(rules.includes("print-step-coverage"));
  });
});
