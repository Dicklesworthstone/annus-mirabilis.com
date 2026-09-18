import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";
import { renderToString } from "react-dom/server";
import { validateEntranceRecord } from "../../content/entrances/entranceRecord.ts";
import { BrownianFirstEncounter } from "../../reader/entrances/BrownianFirstEncounter.tsx";
import { newRunIdentity, TestLogger } from "../log/logger.ts";
import { installDom, uninstallDom } from "../reactDom.ts";

const BEAD_ID = "am-bm-first-encounter-fjvh";

describe("Entrance Bridge Rendering Tests (am-bm-first-encounter-fjvh)", () => {
  const logger = new TestLogger("brownian-first-encounter", newRunIdentity());

  afterAll(async () => {
    await logger.flush();
  });

  beforeEach(async () => {
    await installDom();
  });

  afterEach(async () => {
    await uninstallDom();
  });

  const validRecord = validateEntranceRecord({
    id: "entrance-brownian-motion",
    paper: "brownian-motion",
    question: "Do particles that wander in all directions ever get anywhere?",
    story: "Four trial particles wander three steps left, one left, one right, and three right.",
    sourceAnchor: "#entry-brownian-motion",
    helpEntries: [
      {
        obstacle: "Why not calculate speed directly?",
        clarification: "Because the trajectory is jagged and changes direction constantly.",
      },
    ],
    authoredEntries: [-3, -1, 1, 3],
    bridge: {
      id: "bridge-brownian-entrance",
      kind: "bridge",
      title: "From Random Steps to the Diffusion Law",
      concreteOperation: "Track signed displacements and compare absolute sum with sum of squares.",
      compactExplanation: "Squaring keeps opposite displacements from cancelling.",
      textualEquivalent: "Tracking net spread over time by squaring displacement.",
      stoppingPoint: "Transition to the mean-square displacement formula in Section 5.",
      readinessSign: "Can explain why squaring retains movement.",
      returnCaptions: [
        { callingAnchor: "entry-brownian-motion", caption: "Back to Brownian entrance" },
      ],
      newSkill:
        "keeping track of how far things went by squaring, so opposite directions stop cancelling.",
      whyUsefulHere:
        "Section 5 says how far a particle typically wanders after a given time, and that statement is about the squared spread, not about a speed.",
      continueWith: [
        { route: "more-guidance", targetId: "foundation:mean-variance-rms" },
        { route: "less-guidance", targetId: "instrument:bm-01" },
      ],
      authorship: { draftedBy: [{ id: "jemanuel", kind: "human" }] },
      reviewState: "draft",
    },
  });

  it("renders all three bridge parts in sequential order in static markup", () => {
    const start = performance.now();
    const html = renderToString(<BrownianFirstEncounter record={validRecord} />);

    // 1. Check container identity and anchor
    expect(html).toContain('id="entry-brownian-motion"');
    expect(html).toContain('data-encounter-id="entrance-brownian-motion"');

    // 2. Part 1: newSkill
    expect(html).toContain("New Skill");
    expect(html).toContain(
      "keeping track of how far things went by squaring, so opposite directions stop cancelling.",
    );

    // 3. Part 2: whyUsefulHere
    expect(html).toContain("Why Useful in the Paper");
    expect(html).toContain(
      "Section 5 says how far a particle typically wanders after a given time, and that statement is about the squared spread, not about a speed.",
    );

    // 4. Part 3: continueWith routes
    expect(html).toContain("Continue With Your Choice of Guidance");
    expect(html).toContain("More Guidance · Foundations");
    expect(html).toContain("Less Guidance · Laboratory &amp; Paper");
    expect(html).toContain('href="/foundations/mean-variance-rms"');
    expect(html).toContain('href="/lab/bm-01"');
    expect(html).toContain('data-instrument-id="bm-01"');

    // Verify ordering in output string
    const skillIndex = html.indexOf("New Skill");
    const whyIndex = html.indexOf("Why Useful in the Paper");
    const routesIndex = html.indexOf("Continue With Your Choice of Guidance");

    expect(skillIndex).toBeGreaterThan(-1);
    expect(whyIndex).toBeGreaterThan(skillIndex);
    expect(routesIndex).toBeGreaterThan(whyIndex);

    logger.log({
      testId: "bridge-render-three-parts-order",
      beadId: BEAD_ID,
      expected: "in-order rendering of newSkill, whyUsefulHere, continueWith",
      actual: { skillIndex, whyIndex, routesIndex },
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "bitwise",
      extra: {
        jsEnabled: false,
        bridgePartsPresent: true,
      },
    });
  });

  it("renders complete static links and worked numbers in noscript fallback", () => {
    const html = renderToString(<BrownianFirstEncounter record={validRecord} />);
    expect(html).toContain("<noscript>");
    expect(html).toContain('href="/foundations/mean-variance-rms"');
    expect(html).toContain('href="/lab/bm-01"');
    expect(html).toContain('href="/papers/brownian-motion/s5/#s5-p1-s1"');

    // Complete worked example numbers for authored case (-3, -1, +1, +3)
    expect(html).toContain("Authored Example (−3, −1, +1, +3 units):");
    expect(html).toContain("Signed sum = (−3) + (−1) + (+1) + (+3) = 0 units.");
    expect(html).toContain("Mean absolute displacement = (3 + 1 + 1 + 3) / 4 = 2 units.");
    expect(html).toContain("Mean square displacement = (9 + 1 + 1 + 9) / 4 = 5 sq units.");
    expect(html).toContain("Root-mean-square displacement (RMS) = √5 ≈ 2.236 units.");

    // Complete worked example numbers for doubled case (-6, -2, +2, +6)
    expect(html).toContain("Doubled Example (−6, −2, +2, +6 units):");
    expect(html).toContain("Signed sum = (−6) + (−2) + (+2) + (+6) = 0 units.");
    expect(html).toContain("Mean absolute displacement = (6 + 2 + 2 + 6) / 4 = 4 units.");
    expect(html).toContain("Mean square displacement = (36 + 4 + 4 + 36) / 4 = 20 sq units.");
    expect(html).toContain("Root-mean-square displacement (RMS) = √20 ≈ 4.472 units.");
  });
});

