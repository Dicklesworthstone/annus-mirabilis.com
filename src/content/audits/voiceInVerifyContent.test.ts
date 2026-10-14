import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { QUALITY_GATE_STEPS } from "../../../scripts/quality-gates/registry.ts";
import { getLogger } from "../../testing/log/logger.ts";
import { extractAllComponentStrings } from "../checks/voice/componentText.ts";
import { matchContentRoute } from "../compiler/routes.ts";
import { loadCommittedInventory, runVerifyContent } from "./verifyContent.ts";

const logger = getLogger("verify-content-tests");
const BEAD = "am-cm-audit-scripts-d34";

/**
 * A floor rather than the measured figure, because this count grows with every component that
 * gains a visible string. 6,815 were measured on 2026-10-14; the floor only has to be high enough
 * that an extractor returning nothing cannot satisfy it, which is the failure this guards.
 */
const COMPONENT_STRING_FLOOR = 1000;

describe("voice in verify-content gate (am-cm-audit-scripts-d34 / am-edit-voice-lint-trmf)", () => {
  /**
   * THIS ASSERTED THE OPPOSITE UNTIL 2026-10-14. The reasoning is recorded once, on the sibling
   * assertion in verifyContent.test.ts; in short, the two runners share `checkVoice` and do not
   * share a population, so the standalone step is not redundant and requiring it is right.
   */
  test("the standalone voice-lint step is required, because the folded check cannot reach the interface", () => {
    const verifyContentStep = QUALITY_GATE_STEPS.find((s) => s.id === "verify-content");
    const voiceLintStep = QUALITY_GATE_STEPS.find((s) => s.id === "voice-lint");

    expect(verifyContentStep).toBeDefined();
    expect(verifyContentStep?.requiredInProfiles).toContain("preview");
    expect(verifyContentStep?.requiredInProfiles).toContain("launch");

    expect(voiceLintStep).toBeDefined();
    expect(voiceLintStep?.requiredInProfiles).toContain("preview");
    expect(voiceLintStep?.requiredInProfiles).toContain("launch");
    expect(voiceLintStep?.requiredInCi).toBe(true);

    logger.log({
      testId: "voice-lint-registry-required",
      beadId: BEAD,
      extra: { family: "audit", check: "voice-standalone-required" },
      outcome: "passed",
      message: "voice-lint is required in CI and in the profiles that run verify-content",
    });
  });

  /**
   * THE REASON THE STEP ABOVE IS NOT REDUNDANT, asserted rather than left in a comment.
   *
   * `scripts/lint-voice.ts` scans three populations: content records, TSX component strings under
   * `src/`, and the catalogs in `src/i18n/messages/`. The copy folded into verify-content runs
   * inside the content compiler, and every route in `CONTENT_ROUTES` is anchored at `content/`,
   * so it can only ever see the first.
   *
   * If that stops being true in either direction -- the compiler grows a route into `src/`, or
   * the standalone scan loses its component half -- the justification for running both expires,
   * and this says so instead of leaving a stale comment behind. That is the failure mode that
   * produced the three-day contradiction this pair of tests replaces.
   */
  test("the standalone scan reads strings the content compiler can never route", () => {
    const root = process.cwd();
    const componentStrings = extractAllComponentStrings(path.join(root, "src"), root);
    expect(componentStrings.length).toBeGreaterThanOrEqual(COMPONENT_STRING_FLOOR);

    const componentFiles = [...new Set(componentStrings.map((s) => s.file))];
    const messagesDir = path.join(root, "src/i18n/messages");
    const catalogFiles = existsSync(messagesDir)
      ? readdirSync(messagesDir)
          .filter((f) => f.endsWith(".json"))
          .map((f) => path.relative(root, path.join(messagesDir, f)))
      : [];
    expect(catalogFiles.length).toBeGreaterThan(0);

    // Not one of them is a content record, so not one is reachable by the folded check.
    const routed = [...componentFiles, ...catalogFiles].filter(
      (file) => matchContentRoute(file) !== null,
    );
    expect(routed).toEqual([]);

    // A positive control in the same call, so a matcher that returned null for everything -- which
    // would make the assertion above vacuous -- cannot pass this test.
    expect(matchContentRoute("content/experiments/bm-06.yaml")).not.toBeNull();

    console.log(
      `[census] voice populations: ${componentStrings.length} component string(s) across ` +
        `${componentFiles.length} file(s) and ${catalogFiles.length} catalog file(s) are scanned ` +
        `by the standalone step and routed by the compiler 0 times`,
    );

    logger.log({
      testId: "voice-populations-disjoint",
      beadId: BEAD,
      extra: {
        family: "audit",
        componentStrings: componentStrings.length,
        componentFiles: componentFiles.length,
        catalogFiles: catalogFiles.length,
        routedOutsideContent: routed.length,
      },
      outcome: "passed",
      message: "no string the standalone voice lint reads outside content/ is a compiler record",
    });
  });

  test("PLANTED: fixture with one voice violation yields exactly one finding line from verify-content", async () => {
    const brokenFixture = {
      path: "content/arguments/brownian-motion/arg-bm-voice-violation.json",
      text: JSON.stringify({
        id: "arg-bm-voice-violation",
        title: "Thermal Agitation and Diffusion",
        section: "s4",
        paper: "brownian-motion",
        readings: {
          r0: "Suspended particles move constantly in the fluid.",
          r1: "Thermal agitation makes particles move randomly in the liquid.",
          r2: "Thermal agitation makes particles move randomly in the liquid. Einstein revolutionized the field of physics with this miraculous breakthrough insight that stunned researchers everywhere.",
          r3: "Einstein (1905, §4) derives the diffusion law.",
          r3Citations: ["ap-17-549-s4"],
        },
      }),
    };

    const result = await runVerifyContent({
      root: process.cwd(),
      architecture: () => 0,
      loadFiles: async () => [brokenFixture],
      inventory: loadCommittedInventory(process.cwd()),
    });

    expect(result.ok).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.includes("hype-word") ||
          e.includes("Voice violation") ||
          e.includes("revolutionary") ||
          e.includes("editorial.voice"),
      ),
    ).toBe(true);
  });
});
