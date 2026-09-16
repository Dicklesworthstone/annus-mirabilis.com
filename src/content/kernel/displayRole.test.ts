import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ShowTheCode } from "../../components/lab/ShowTheCode.tsx";
import { getLogger } from "../../testing/log/logger.ts";
import { validateDisplayRole } from "./bindings.ts";
import type { ExtractedKernelSource } from "./types.ts";
import { KERNEL_BEAD_ID, KERNEL_DISPLAY_ROLE_LABELS } from "./types.ts";

const logger = getLogger("show-the-code");

const extracted: ExtractedKernelSource = {
  language: "ts",
  exportName: "evaluateStokesEinstein",
  filePath: "src/content/kernel/__fixtures__/ts/target.ts",
  lineStart: 1,
  lineEnd: 8,
  source: "export function evaluateStokesEinstein() {}",
  sourceHash: "sha256:abc",
  revision: "fixture",
  identifiers: ["evaluateStokesEinstein"],
};

describe("kernel displayRole", () => {
  test("each of the four roles validates in its legal shape", () => {
    expect(
      validateDisplayRole("bm-01", {
        displayRole: "pseudocode",
      }),
    ).toEqual([]);
    expect(
      validateDisplayRole("bm-01", {
        displayRole: "derivation",
      }),
    ).toEqual([]);
    expect(
      validateDisplayRole(
        "bm-01",
        {
          displayRole: "reference-implementation",
          language: "ts",
          module: "src/physics/reference/diffusion.ts",
          exportName: "stokesEinsteinD",
        },
        extracted,
      ),
    ).toEqual([]);
    expect(
      validateDisplayRole(
        "bm-01",
        {
          displayRole: "executing-source",
          language: "rust",
          crate: "fs-wasm",
          path: "crates/fs-wasm/src/brownian.rs",
          fnName: "brownian_frames",
          revision: "fixture",
        },
        { ...extracted, language: "rust", exportName: "brownian_frames" },
      ),
    ).toEqual([]);
    logger.log({
      testId: "display-role-legal-shapes",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "Four display roles validate in legal shapes",
    });
  });

  test("a pseudocode entry with a source hash fails", () => {
    const issues = validateDisplayRole("bm-01", { displayRole: "pseudocode" }, extracted);
    expect(issues.some((i) => i.code === "pseudocode-with-exec-fields")).toBe(true);
    logger.log({
      testId: "pseudocode-with-hash",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "Pseudocode with source hash failed",
    });
  });

  test("an executing-source entry without a revision fails", () => {
    const issues = validateDisplayRole(
      "bm-01",
      {
        displayRole: "executing-source",
        language: "ts",
        module: "src/x.ts",
        exportName: "fn",
      },
      { ...extracted, revision: "" },
    );
    expect(issues.some((i) => i.code === "missing-kernel-revision")).toBe(true);
    logger.log({
      testId: "executing-source-missing-revision",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "Executing-source without revision failed",
    });
  });

  test("rendered label text for each role matches the fixture copy", () => {
    for (const [role, label] of Object.entries(KERNEL_DISPLAY_ROLE_LABELS)) {
      const html = renderToStaticMarkup(
        ShowTheCode({
          listings: [
            {
              displayRole: role as keyof typeof KERNEL_DISPLAY_ROLE_LABELS,
              exportName: "demo",
              words: "Take the inputs and compute the output.",
              independentReferences: [],
              identifierBindings: [],
            },
          ],
        }),
      );
      expect(html).toContain(label);
      expect(html).toContain(`data-display-role="${role}"`);
    }
    logger.log({
      testId: "display-role-labels",
      beadId: KERNEL_BEAD_ID,
      outcome: "passed",
      message: "Rendered role labels match fixture copy",
    });
  });
});
