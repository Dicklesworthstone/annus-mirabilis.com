import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act } from "react";
import type { createRoot as createReactRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import brownianEntrance from "../../../content/arguments/brownian-motion/entrance-brownian-motion.json";
import { validateEntranceRecord } from "../../content/entrances/entranceRecord.ts";
import { loadPaper } from "../../content/server";
import { BrownianFirstEncounter } from "../../reader/entrances/BrownianFirstEncounter.tsx";
import { newRunIdentity, TestLogger } from "../log/logger.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../reactDom.ts";

/**
 * Heading lookups below are case-insensitive (am-edit-voice-lint-trmf). They used a heading's
 * exact capitalisation as a position marker, to assert that the three bridge parts render IN
 * ORDER - a real structural property - and so they broke when the de-slop pass normalised this
 * entrance from Title Case to the site's sentence case, although the ordering was untouched.
 *
 * Same ceiling as cca97b8e, stated rather than implied: this survives a case change and would
 * not survive a rewording. The durable form is a per-part anchor in the component, which does
 * not exist; the ordering assertion is the reason a bare "does it appear" check is not enough.
 */
const lower = (h: string) => h.toLowerCase();

const BEAD_ID = "am-bm-first-encounter-fjvh";

describe("Brownian First Encounter Interactive UI Component (am-bm-first-encounter-fjvh)", () => {
  const logger = new TestLogger("brownian-first-encounter", newRunIdentity());
  let container: HTMLElement;
  let createRoot: typeof createReactRoot;

  afterAll(async () => {
    await logger.flush();
  });

  beforeEach(async () => {
    await installDom();
    ({ createRoot } = await import("react-dom/client"));
    container = createContainer();
  });

  afterEach(async () => {
    removeContainer(container);
    await uninstallDom();
  });

  const record = validateEntranceRecord({
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

  it("renders all 10 pedagogical steps and labels examples as authored, not measured", () => {
    const start = performance.now();
    const html = renderToString(<BrownianFirstEncounter record={record} />);

    // Authored label
    expect(html).toContain("Authored arithmetic examples");
    expect(html).toContain("not a measured dataset");

    // Step 1: 4 authored displacements
    expect(html).toContain("Step 1");
    expect(html).toContain("−3, −1, +1, and +3 units");

    // Step 2 & 3: What a signed sum tells us (average endpoint has not shifted)
    expect(html).toContain("What a signed sum tells us");
    expect(html).toContain("average endpoint");

    // Step 4 & 5: Both proposals accepted
    expect(html).toContain("Proposal A (ignore the direction)");
    expect(html).toContain("Proposal B (square each displacement)");
    expect(html).toContain("Both of these proposals are reasonable");

    // Step 6 & 7: Mean absolute (2), mean square (5), RMS (2.236) and doubled case (4, 20, 4.472)
    expect(html).toContain("What happens when every displacement doubles?");
    expect(html).toContain("Mean absolute displacement:");
    expect(html).toContain("4 units");
    expect(html).toContain("20 squared units");

    // Step 8: Why the mean square has a simple additive rule (independent steps, cross terms vanish)
    expect(html).toContain("Why the mean square has a simple additive rule");
    expect(html).toContain("independent");
    expect(html).toContain("cross terms");

    // Step 9: Mean absolute is not wrong
    expect(html).toContain("Mean absolute displacement is not a wrong answer");

    // Step 10: The Bridge
    expect(html).toContain("The bridge to the argument");
    expect(html).toContain("New skill");
    expect(lower(html)).toContain(lower("Why Useful in the Paper"));
    expect(lower(html)).toContain(lower("Continue With Your Choice of Guidance"));

    logger.log({
      testId: "ui-ten-steps-rendered",
      beadId: BEAD_ID,
      expected: "10-step pedagogical flow with authored label",
      actual: "all 10 steps verified in DOM",
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "formatted",
    });
  });

  it("serves each authored obstacle and its clarification before JavaScript", () => {
    const entrance = validateEntranceRecord(brownianEntrance);
    const helpEntries = [
      ...(entrance.helpEntries ?? []),
      { obstacle: "A second question", clarification: "A second explanation." },
    ];
    container.innerHTML = renderToString(
      <BrownianFirstEncounter record={{ ...entrance, helpEntries }} />,
    );
    const disclosures = [...container.querySelectorAll("details[data-entrance-help]")];
    expect(disclosures.map((details) => ({
      obstacle: details.querySelector("summary")?.textContent,
      clarification: details.querySelector("p")?.textContent,
    }))).toEqual(helpEntries.map(({ obstacle, clarification }) => ({ obstacle, clarification })));

    const pathHelp = disclosures.find((details) => details.textContent?.includes("path length"));
    expect(pathHelp?.textContent).toContain("2 + 1 = 3 units");
    expect(pathHelp?.textContent).toContain("0.5 units per second");
  });

  it("updates totals when user interacts with sliders via keyboard and restores with restore button", async () => {
    const start = performance.now();
    const root = createRoot(container);
    await act(async () => {
      root.render(<BrownianFirstEncounter record={record} />);
    });

    // Check initial totals
    const sumEl = container.querySelector('[data-testid="totals-signed-sum"]');
    const absEl = container.querySelector('[data-testid="totals-mean-absolute"]');
    const sqEl = container.querySelector('[data-testid="totals-mean-square"]');
    const rmsEl = container.querySelector('[data-testid="totals-rms"]');

    expect(sumEl?.textContent).toContain("0");
    expect(absEl?.textContent).toContain("2.00");
    expect(sqEl?.textContent).toContain("5.00");
    expect(rmsEl?.textContent).toContain("2.236");

    // Find slider 1 (initial value -3) and press ArrowRight twice -> moves to -1
    const slider1 = container.querySelector(
      'div[role="slider"][aria-valuenow="-3"]',
    ) as HTMLElement;
    expect(slider1).not.toBeNull();

    await act(async () => {
      slider1.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    await act(async () => {
      slider1.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });

    // Entries are now [-1, -1, +1, +3] -> sum: 2, meanAbs: 1.5, meanSq: 3, rms: sqrt(3) ~= 1.732
    expect(sumEl?.textContent).toContain("+2");
    expect(absEl?.textContent).toContain("1.50");
    expect(sqEl?.textContent).toContain("3.00");

    // Click 'Back to authored example' restore button
    const restoreBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Back to authored example"),
    );
    expect(restoreBtn).toBeDefined();

    await act(async () => {
      restoreBtn?.click();
    });

    // Verify restored totals
    expect(sumEl?.textContent).toContain("0");
    expect(absEl?.textContent).toContain("2.00");
    expect(sqEl?.textContent).toContain("5.00");
    expect(rmsEl?.textContent).toContain("2.236");

    logger.log({
      testId: "ui-keyboard-slider-interaction",
      beadId: BEAD_ID,
      expected: { signedSum: 0, meanAbsolute: 2, meanSquare: 5, rootMeanSquare: Math.sqrt(5) },
      actual: { restored: true },
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "tolerance",
      tolerance: { absolute: 1e-4 },
      extra: {
        interface: "keyboard",
        paper: "brownian-motion",
        anchor: "#entry-brownian-motion",
        recordId: "entrance-brownian-motion",
        returnedTotalsMatch: true,
      },
    });
  });

  it("switches to table mode and edits inputs", async () => {
    const start = performance.now();
    const root = createRoot(container);
    await act(async () => {
      root.render(<BrownianFirstEncounter record={record} />);
    });

    // Switch to table mode
    const tableBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Table and typed values"),
    );
    expect(tableBtn).toBeDefined();

    await act(async () => {
      tableBtn?.click();
    });

    const table = container.querySelector("table");
    expect(table).not.toBeNull();

    // Verify 4 rows
    const rows = table?.querySelectorAll("tbody tr");
    expect(rows?.length).toBe(4);

    // Increase Particle 4 from +3 to +4
    const increaseBtn4 = container.querySelector(
      'button[aria-label="Increase Particle 4 displacement"]',
    ) as HTMLElement;
    expect(increaseBtn4).not.toBeNull();

    await act(async () => {
      increaseBtn4.click();
    });

    // [-3, -1, 1, 4] -> sum: 1, meanAbs: 2.25, meanSq: 6.75
    const sumEl = container.querySelector('[data-testid="totals-signed-sum"]');
    expect(sumEl?.textContent).toContain("+1");

    logger.log({
      testId: "ui-table-interaction",
      beadId: BEAD_ID,
      expected: { sum: 1 },
      actual: { sum: 1 },
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "bitwise",
      extra: {
        interface: "table",
        paper: "brownian-motion",
        anchor: "#entry-brownian-motion",
        recordId: "entrance-brownian-motion",
      },
    });
  });

  it("keeps typed drafts editable and gives the table and keyboard the same endpoints", async () => {
    const root = createRoot(container);
    await act(async () => { root.render(<BrownianFirstEncounter record={record} />); });
    const switchView = async (label: string) => {
      const button = [...container.querySelectorAll("button")].find((b) => b.textContent === label);
      if (!button) throw new Error(`Missing view control: ${label}`);
      await act(async () => button.click());
    };
    await switchView("Table and typed values");
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Particle 1 displacement value"]');
    if (!input) throw new Error("Missing particle input");
    const edit = async (text: string) => {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (!setter) throw new Error("Missing input value setter");
        setter.call(input, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    const meanSquare = () => container.querySelector('[data-testid="totals-mean-square"]')?.textContent;
    for (const text of ["", "-", "2.5", "11", "1e400"]) {
      await edit(text);
      expect(input.value).toBe(text);
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(meanSquare()).toContain("5.00");
    }
    await edit("-10");
    expect(input.hasAttribute("aria-invalid")).toBe(false);
    expect(meanSquare()).toContain("27.75");
    await edit("1e1");
    expect(input.closest("tr")?.textContent).toContain("10 steps right");
    expect(meanSquare()).toContain("27.75");
    await switchView("Number line");
    const slider = container.querySelector<HTMLElement>('[role="slider"]');
    if (!slider) throw new Error("Missing particle on the number line");
    expect(slider.getAttribute("aria-valuemin")).toBe("-10");
    expect(slider.getAttribute("aria-valuemax")).toBe("10");
    expect(slider.getAttribute("aria-valuenow")).toBe("10");
    expect(slider.style.left).toBe("100%");
    for (const [key, value] of [["Home", "-10"], ["ArrowLeft", "-10"], ["ArrowUp", "-9"], ["End", "10"]] as const) {
      await act(async () => {
        slider.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      });
      expect(slider.getAttribute("aria-valuenow")).toBe(value);
    }
    await switchView("Table and typed values");
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("10");
    await act(async () => root.unmount());
  });

  it("triggers navigation callbacks and preserves custom entries returned via initialEntries", async () => {
    const start = performance.now();
    let navigatedFoundation: string | null = null;
    let navigatedInstrument: string | null = null;

    const root = createRoot(container);
    await act(async () => {
      root.render(
        <BrownianFirstEncounter
          record={record}
          onNavigateFoundation={(id) => {
            navigatedFoundation = id;
          }}
          onNavigateInstrument={(id) => {
            navigatedInstrument = id;
          }}
        />,
      );
    });

    // Selected by HREF, not by label text. The label was "Open Mean, Variance & RMS Drawer" and
    // the de-slop pass changed both its case and its wording ("&" to "and"), which a
    // case-insensitive match would not have survived either. The href is what makes this link
    // that link, so it is the handle that cannot go stale under a copy edit.
    const foundationLink = Array.from(container.querySelectorAll("a")).find(
      (a) => a.getAttribute("href") === "/foundations/mean-variance-rms/",
    );
    expect(foundationLink).toBeDefined();

    await act(async () => {
      foundationLink?.click();
    });
    expect(navigatedFoundation).toBe("mean-variance-rms");

    // By href for the same reason as the foundation link above. Two anchors share this href -
    // the interactive route and the static fallback - and find() takes the first, which is the
    // interactive one. That choice is self-checking rather than assumed: the assertion below
    // requires the click to fire onNavigateInstrument, which the static fallback would not do.
    const instrumentLink = Array.from(container.querySelectorAll("a")).find(
      (a) => a.getAttribute("href") === "/lab/bm-01/",
    );
    expect(instrumentLink).toBeDefined();

    await act(async () => {
      instrumentLink?.click();
    });
    expect(navigatedInstrument).toBe("bm-01");

    // Simulate return from drawer via the return stack with edited entries [-2, 0, 1, 5]
    await act(async () => {
      root.unmount();
    });

    const returnContainer = document.createElement("div");
    document.body.appendChild(returnContainer);
    const returnRoot = createRoot(returnContainer);

    await act(async () => {
      returnRoot.render(<BrownianFirstEncounter record={record} initialEntries={[-2, 0, 1, 5]} />);
    });

    const sumEl = returnContainer.querySelector('[data-testid="totals-signed-sum"]');
    const absEl = returnContainer.querySelector('[data-testid="totals-mean-absolute"]');
    const sqEl = returnContainer.querySelector('[data-testid="totals-mean-square"]');

    // For [-2, 0, 1, 5]: sum = 4, meanAbs = 2.00, meanSq = 7.50
    expect(sumEl?.textContent).toContain("+4");
    expect(absEl?.textContent).toContain("2.00");
    expect(sqEl?.textContent).toContain("7.50");

    logger.log({
      testId: "ui-navigation-return-stack",
      beadId: BEAD_ID,
      expected: { navigatedFoundation: "mean-variance-rms", navigatedInstrument: "bm-01", sum: 4 },
      actual: { navigatedFoundation, navigatedInstrument, sum: 4 },
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "bitwise",
      extra: {
        routeTaken: "more-guidance",
        returnedTotalsMatch: true,
      },
    });

    await act(async () => {
      returnRoot.unmount();
    });
    returnContainer.remove();
  });

  it("updates totals when dragging markers via pointer and matches keyboard and table totals, and restores to authored", async () => {
    const start = performance.now();
    const root = createRoot(container);
    await act(async () => {
      root.render(<BrownianFirstEncounter record={record} />);
    });

    const sumEl = container.querySelector('[data-testid="totals-signed-sum"]');
    const absEl = container.querySelector('[data-testid="totals-mean-absolute"]');
    const sqEl = container.querySelector('[data-testid="totals-mean-square"]');
    const rmsEl = container.querySelector('[data-testid="totals-rms"]');

    // Initial authored totals (-3, -1, 1, 3)
    expect(sumEl?.textContent).toContain("0");
    expect(absEl?.textContent).toContain("2.00");
    expect(sqEl?.textContent).toContain("5.00");
    expect(rmsEl?.textContent).toContain("2.236");

    // Find slider 1 (initial pos -3)
    const slider1 = container.querySelector(
      'div[role="slider"][aria-valuenow="-3"]',
    ) as HTMLElement;
    expect(slider1).not.toBeNull();

    const track = slider1.parentElement;
    if (!track) throw new Error("The marker must sit on the measured track.");
    track.getBoundingClientRect = () => new DOMRect(20, 0, 200, 40);
    const captured = new Set<number>();
    slider1.setPointerCapture = (id) => { captured.add(id); };
    slider1.hasPointerCapture = (id) => captured.has(id);
    slider1.releasePointerCapture = (id) => { captured.delete(id); };
    async function pointer(type: string, clientX: number, pointerId = 7) {
      const event = new MouseEvent(type, { clientX, bubbles: true, button: 0 });
      Object.assign(event, { pointerId, isPrimary: true });
      await act(async () => { slider1.dispatchEvent(event); });
    }

    await pointer("pointerdown", 110);
    // −1, −1, +1, +3 matches the keyboard test after two moves to the right.
    expect(sumEl?.textContent).toContain("+2");
    expect(absEl?.textContent).toContain("1.50");
    expect(sqEl?.textContent).toContain("3.00");
    await pointer("pointermove", 220, 8);
    expect(slider1.getAttribute("aria-valuenow")).toBe("-1");
    await pointer("pointermove", 120);
    expect(sumEl?.textContent).toContain("+3");
    await pointer("pointerup", 220);
    expect(slider1.getAttribute("aria-valuenow")).toBe("10");
    expect(slider1.style.left).toBe("100%");
    expect(captured.size).toBe(0);
    await pointer("pointerdown", 20);
    expect(slider1.getAttribute("aria-valuenow")).toBe("-10");
    expect(slider1.style.left).toBe("0%");
    await pointer("pointercancel", 20);
    await pointer("pointermove", 220);
    expect(captured.size).toBe(0);
    expect(slider1.getAttribute("aria-valuenow")).toBe("-10");

    // Restore to authored example
    const restoreBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Back to authored example"),
    );
    expect(restoreBtn).toBeDefined();

    await act(async () => {
      restoreBtn?.click();
    });

    expect(sumEl?.textContent).toContain("0");
    expect(absEl?.textContent).toContain("2.00");
    expect(sqEl?.textContent).toContain("5.00");
    expect(rmsEl?.textContent).toContain("2.236");

    logger.log({
      testId: "ui-pointer-drag-slider-interaction",
      beadId: BEAD_ID,
      expected: { signedSum: 0, meanAbsolute: 2, meanSquare: 5, rootMeanSquare: Math.sqrt(5) },
      actual: { restored: true },
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "tolerance",
      tolerance: { absolute: 1e-4 },
      extra: {
        interface: "pointer",
        paper: "brownian-motion",
        anchor: "#entry-brownian-motion",
        recordId: "entrance-brownian-motion",
        returnedTotalsMatch: true,
      },
    });
  });

  it("reaches BM-01 by catalogue id and the §5 passage at an id the §5 page renders", async () => {
    const start = performance.now();
    const root = createRoot(container);
    await act(async () => {
      root.render(<BrownianFirstEncounter record={record} />);
    });

    const instrumentLink = container.querySelector(
      'a[data-instrument-id="bm-01"]',
    ) as HTMLAnchorElement | null;
    expect(instrumentLink).not.toBeNull();
    expect(instrumentLink?.getAttribute("href")).toBe("/lab/bm-01/");
    expect(instrumentLink?.getAttribute("data-instrument-id")).toBe("bm-01");

    // The §5 page renders no sentence anchors, so "#s5-p1-s1" landed at the top of the page (found
    // by a fragment crawl of live 211e9af4). The link now opens §5 at its heading, an id the page
    // does render; that the paper really has a section s5 is checked below.
    const sentenceLink = Array.from(container.querySelectorAll("a")).find((a) =>
      a.getAttribute("href")?.includes("/papers/brownian-motion/s5/#s5"),
    );
    expect(sentenceLink).toBeDefined();
    expect(sentenceLink?.getAttribute("href")).toBe("/papers/brownian-motion/s5/#s5");
    const brownian = await loadPaper("brownian-motion");
    expect(brownian.paper.sections.map((s) => s.id)).toContain("s5");

    logger.log({
      testId: "ui-less-guidance-catalogue-and-sentence-id",
      beadId: BEAD_ID,
      expected: { instrumentId: "bm-01", passageAnchor: "s5" },
      actual: {
        instrumentId: instrumentLink?.getAttribute("data-instrument-id"),
        passageHref: sentenceLink?.getAttribute("href"),
      },
      outcome: "passed",
      durationMs: performance.now() - start,
      comparisonKind: "bitwise",
      extra: {
        interface: "pointer",
        paper: "brownian-motion",
        anchor: "#entry-brownian-motion",
        recordId: "entrance-brownian-motion",
      },
    });
  });
});
