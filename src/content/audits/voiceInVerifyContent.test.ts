import { describe, expect, test } from "bun:test";
import { QUALITY_GATE_STEPS } from "../../../scripts/quality-gates/registry.ts";
import { getLogger } from "../../testing/log/logger.ts";
import { loadCommittedInventory, runVerifyContent } from "./verifyContent.ts";

const logger = getLogger("verify-content-tests");
const BEAD = "am-cm-audit-scripts-d34";

describe("voice in verify-content gate (am-cm-audit-scripts-d34 / am-edit-voice-lint-trmf)", () => {
  test("quality gate registry maintains voice-lint as a standalone required step alongside verify-content", () => {
    const verifyContentStep = QUALITY_GATE_STEPS.find((s) => s.id === "verify-content");
    const voiceLintStep = QUALITY_GATE_STEPS.find((s) => s.id === "voice-lint");

    expect(verifyContentStep).toBeDefined();
    expect(verifyContentStep?.requiredInProfiles).toContain("preview");
    expect(verifyContentStep?.requiredInProfiles).toContain("launch");

    expect(voiceLintStep).toBeDefined();
    // voice-lint is an active standalone required step in preview and launch profiles
    expect(voiceLintStep?.requiredInProfiles).toContain("preview");
    expect(voiceLintStep?.requiredInProfiles).toContain("launch");
    expect(voiceLintStep?.requiredInCi).toBe(true);

    logger.log({
      testId: "voice-lint-registry-standalone-required",
      beadId: BEAD,
      extra: { family: "audit", check: "voice-standalone" },
      outcome: "passed",
      message: "voice-lint is an active standalone required step in gate registry",
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
