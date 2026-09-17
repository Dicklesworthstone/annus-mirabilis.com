import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkJourney } from "./checks/journeyChecks.ts";
import { FIXTURE_JOURNEY_BROWNIAN } from "./testing/fixtureJourney.ts";

describe("copyGuards: voice lint and phrase checks", () => {
  test("shipped fixture copy produces zero voice lint errors in journey-branch context", () => {
    const findings = checkJourney(FIXTURE_JOURNEY_BROWNIAN);
    const voiceErrors = findings.filter(
      (f) => f.rule.startsWith("voice-") && f.severity === "error",
    );
    expect(voiceErrors.length).toBe(0);
  });

  test("a branch calling a proponent 'naive' triggers a mockery error", () => {
    const fork0 = FIXTURE_JOURNEY_BROWNIAN.forks[0];
    const fork1 = FIXTURE_JOURNEY_BROWNIAN.forks[1];
    if (!fork0 || !fork1) {
      throw new Error("Fixture journey must have at least two forks");
    }
    const branch0 = fork0.branches[0];
    const branch1 = fork0.branches[1];
    if (!branch0 || !branch1) {
      throw new Error("Fixture fork must have at least two branches");
    }
    const withMockery = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      forks: [
        {
          ...fork0,
          branches: [
            {
              ...branch0,
              hypothesis: "A naive proponent might think particles move in straight lines.",
            },
            branch1,
          ],
        },
        fork1,
      ],
    };
    const findings = checkJourney(withMockery);
    expect(findings.some((f) => f.rule === "voice-mockery")).toBe(true);
  });

  test("the statistical phrase 'naive estimate' is allowlisted and produces zero errors", () => {
    const fork0 = FIXTURE_JOURNEY_BROWNIAN.forks[0];
    const fork1 = FIXTURE_JOURNEY_BROWNIAN.forks[1];
    if (!fork0 || !fork1) {
      throw new Error("Fixture journey must have at least two forks");
    }
    const branch0 = fork0.branches[0];
    const branch1 = fork0.branches[1];
    if (!branch0 || !branch1) {
      throw new Error("Fixture fork must have at least two branches");
    }
    const withAllowlisted = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      forks: [
        {
          ...fork0,
          branches: [
            {
              ...branch0,
              hypothesis: "A naive estimate of the displacement neglects molecular collisions.",
            },
            branch1,
          ],
        },
        fork1,
      ],
    };
    const findings = checkJourney(withAllowlisted);
    const mockeryErrors = findings.filter(
      (f) => f.rule === "voice-mockery" && f.severity === "error",
    );
    expect(mockeryErrors.length).toBe(0);
  });

  test("forbidden psychological phrases fail wherever they appear", () => {
    const withThought = {
      ...FIXTURE_JOURNEY_BROWNIAN,
      naggingFact: "What Einstein thought about particles was revolutionary.",
    };
    const findings = checkJourney(withThought);
    expect(findings.some((f) => f.rule === "journey-forbidden-phrase")).toBe(true);
  });

  test("noParallelDenyLists: this bead defines no vocabulary list of its own", () => {
    const thisDir = join(process.cwd(), "src/discovery");
    const files: string[] = [];

    function walk(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry.name) && full !== fileURLToPath(import.meta.url)) {
          files.push(full);
        }
      }
    }
    walk(thisDir);

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      // Must not define private mocking word lists (like ['foolish', 'stupid', ...])
      expect(content).not.toContain("const MOCKING_WORDS");
      expect(content).not.toContain("const DENY_LIST");
      expect(content).not.toContain("const FORBIDDEN_WORDS");
    }
  });
});
