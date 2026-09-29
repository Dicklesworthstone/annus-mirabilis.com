import type { Page } from "playwright";
import type { PaperE2EJourney, PaperE2EJourneyStepKind } from "../paper-e2e-contract.ts";

/*
 * ONE PAPER'S CONTINUOUS JOURNEY, AS SCENARIO SOURCE (am-test-e2e-harness-bqmh, dispatch 441).
 *
 * The harness carried the browser launch, the viewports, the evidence retention and the JSONL and no
 * scenario source; its own header says so, and that outside --self-test-failure it records a
 * configuration failure rather than pretending scenarios exist. This is the first real one.
 *
 * WHY MASS-ENERGY. Measured against the built site before choosing: all four papers afford all seven
 * steps (seven faces each, 19 to 34 foundation links, 3 to 13 laboratory links, term markup on every
 * one), so the choice is not forced by what exists. Mass-energy is the smallest corpus - 28 sentence
 * ids against relativity's 223 - so every step's target can be named exactly rather than found by
 * pattern, and its three laboratories are ones whose runtime this bead's author has already walked end
 * to end. The dispatch offered brownian-motion as either the most valuable or the wrong first choice
 * because it is served by a different shell: src/app/papers/[paper]/page.tsx does dispatch between
 * PaperReader and PaperPage, so that is real, and it is the reason to do this paper FIRST and
 * brownian-motion second, since a journey that cannot walk the common shell tells us nothing about
 * the uncommon one.
 *
 * EVERY STEP IS A FAILURE WHEN IT CANNOT BE PERFORMED. No step is skipped, no readiness is a sleep,
 * and the actions below throw rather than returning a soft verdict: a lane that quietly omitted
 * "return to the exact argument" would prove nothing, which is the requirement this file is written
 * against.
 */

/* Typed before freezing, so the literal is checked against the contract rather than widened. */
const MASS_ENERGY_JOURNEY_SHAPE: PaperE2EJourney = {
  sliceId: "mass-energy-continuous-journey",
  paperSlug: "mass-energy",
  route: "/papers/mass-energy/view/parallel/#s0-p1-s1",
  viewport: "desktop",
  retainedEvidenceOnFailure: ["screenshot", "trace", "dom", "console"],
  steps: [
    {
      kind: "enter-source-passage",
      description:
        "Enter on the parallel face at the paper's first sentence, the way a deep link arrives.",
      readiness: { description: "the sentence element exists", selector: "#s0-p1-s1" },
    },
    {
      kind: "switch-face",
      description: "Switch to the English face and find the same sentence there.",
      readiness: {
        description: "the English face carries the same sentence id",
        selector: "#s0-p1-s1",
      },
    },
    {
      kind: "open-foundation",
      description: "Open a foundation lesson from the explanation, without leaving the paper.",
      readiness: {
        description: "a foundation panel is present after its control is pressed",
        selector: "[data-foundation-panel]",
      },
    },
    {
      kind: "return-to-argument",
      description: "Return from the foundation to the exact argument it was opened from.",
      readiness: {
        description: "the argument the foundation was opened from is on screen",
        selector: "[data-argument-id]",
      },
    },
    {
      kind: "operate-instrument",
      description: "Operate one of the paper's instruments and accept a new state.",
      readiness: {
        description: "the laboratory's accepted status line states the new state",
        selector: "p.status-line",
      },
    },
    {
      kind: "select-linked-term",
      description: "Select a linked term in an equation and see what it names.",
      readiness: { description: "a term chip is pressed and marked", selector: "[data-term]" },
    },
    {
      kind: "return-to-source",
      description: "Return to the exact source sentence the journey entered on.",
      readiness: { description: "the entry sentence is present again", selector: "#s0-p1-s1" },
    },
  ],
};

export const MASS_ENERGY_JOURNEY: PaperE2EJourney = Object.freeze(MASS_ENERGY_JOURNEY_SHAPE);

export type JourneyStepOutcome = Readonly<{ expected: unknown; actual: unknown }>;
export type JourneyAction = (page: Page, baseUrl: string) => Promise<JourneyStepOutcome>;

const SENTENCE = "s0-p1-s1";
const PAPER = "/papers/mass-energy";

/** Present in the DOM, which is what an anchor target must be; visibility is a separate question. */
async function requirePresent(page: Page, selector: string, what: string): Promise<number> {
  const count = await page.locator(selector).count();
  if (count === 0) throw new Error(`${what}: no element matches ${selector}`);
  return count;
}

export const MASS_ENERGY_ACTIONS: Readonly<Record<PaperE2EJourneyStepKind, JourneyAction>> =
  Object.freeze({
    async "enter-source-passage"(page, baseUrl) {
      await page.goto(`${baseUrl}${PAPER}/view/parallel/#${SENTENCE}`, { waitUntil: "load" });
      await requirePresent(page, `#${SENTENCE}`, "entry sentence");
      const text = (await page.locator(`#${SENTENCE}`).first().innerText()).trim();
      if (text.length === 0) throw new Error("the entry sentence rendered no text");
      return {
        expected: `#${SENTENCE} carries the paper's first sentence`,
        actual: text.slice(0, 80),
      };
    },

    async "switch-face"(page, baseUrl) {
      // The face chooser's own link, not a hand-built URL: the reader's route is the thing under test.
      const link = page.locator(`a[href="${PAPER}/view/english/"]`).first();
      if ((await link.count()) === 0)
        throw new Error("the parallel face offers no link to English");
      await link.click();
      await page.waitForURL(/\/view\/english\//u, { timeout: 15000 });
      await requirePresent(page, `#${SENTENCE}`, "the same sentence on the English face");
      void baseUrl;
      return { expected: "the English face keeps the reader's place", actual: page.url() };
    },

    async "open-foundation"(page, baseUrl) {
      /*
       * A foundation OPENS IN PLACE rather than navigating, which took two wrong drafts to establish.
       * The markup is `<a href="/foundations/work-energy/" data-foundation="work-energy"
       * data-return-caption="...">`, so the first draft asserted `[data-foundation-panel]` existed
       * after the click and PASSED without the click meaning anything: the paper page already carries
       * eighteen such panels. The second waited for a navigation to /foundations/work-energy/ and
       * timed out. Measured: the click rewrites the URL to `?open=foundation%3Awork-energy` and makes
       * `[data-foundation-panel="work-energy"]` visible, one panel of the eighteen. So the assertion
       * names the panel and the parameter.
       */
      await page.goto(`${baseUrl}${PAPER}/`, { waitUntil: "load" });
      const link = page.locator("a[data-foundation][data-return-caption]").first();
      if ((await link.count()) === 0)
        throw new Error("the explanation offers no foundation link carrying a return caption");
      const foundationId = (await link.getAttribute("data-foundation")) ?? "";
      await link.scrollIntoViewIfNeeded();
      await link.click({ timeout: 10000, noWaitAfter: true });
      const panel = page.locator(`[data-foundation-panel="${foundationId}"]`);
      await panel.waitFor({ state: "visible", timeout: 15000 });
      if (!page.url().includes(`open=foundation%3A${foundationId}`))
        throw new Error(`the panel opened but the URL does not name it: ${page.url()}`);
      const open = await page.locator("[data-foundation-panel]:visible").count();
      if (open !== 1) throw new Error(`${open} foundation panels are open, not one`);
      return {
        expected: `the ${foundationId} lesson opens in place`,
        actual: page.url().slice(-48),
      };
    },

    async "return-to-argument"(page, baseUrl) {
      /*
       * THE STEP THIS JOURNEY CANNOT PERFORM, and it is not routed around.
       *
       * The way back is authored: every foundation link carries `data-return-caption`, and this one's
       * is "Return to comparing the two energy accounts." With the panel open, that sentence appears
       * in exactly one place in the document - inside a <script>, the hydration payload - and nothing
       * renders it. Measured on the built page with the panel open: no element whose own text is the
       * caption, no button or link in the panel whose name matches return, back or close, and zero
       * elements carrying `[data-return]` or `[data-return-to]` anywhere.
       *
       * The browser's own Back button would work, since the URL carries ?open=. That is the browser's
       * affordance and not the edition's, and AGENTS.md's journey asks for a return to the exact
       * interrupted argument. Using page.goBack() here would turn a missing control into a green
       * lane, so this asserts the control and fails while it is absent.
       */
      void baseUrl;
      const caption = await page
        .locator("a[data-foundation][data-return-caption]")
        .first()
        .getAttribute("data-return-caption");
      const rendered = await page.getByText(caption ?? "", { exact: false }).count();
      const controls = await page.locator("[data-return], [data-return-to]").count();
      const named = await page
        .locator("[data-foundation-panel]:visible")
        .locator("a, button")
        .evaluateAll(
          (els) =>
            els.filter((el) =>
              /return|back|close/iu.test(
                `${el.textContent ?? ""} ${el.getAttribute("aria-label") ?? ""}`,
              ),
            ).length,
        );
      if (rendered > 0 || controls > 0 || named > 0) {
        const back = page.locator("[data-return], [data-return-to]").first();
        if ((await back.count()) > 0) {
          await back.click({ timeout: 10000, noWaitAfter: true });
          await requirePresent(page, "[data-argument-id]", "the argument returned to");
          return { expected: "the reader is back at the argument", actual: "a return control" };
        }
      }
      throw new Error(
        `no reader-facing route back to the argument: the caption "${caption}" renders in ${rendered} element(s), ` +
          `${controls} element(s) carry data-return, and the open panel offers ${named} control(s) named return, back or close`,
      );
    },

    async "operate-instrument"(page, baseUrl) {
      await page.goto(`${baseUrl}/lab/me-01/`, { waitUntil: "load" });
      const skip = page.getByRole("button", { name: "Skip prediction" });
      if (await skip.isVisible().catch(() => false)) await skip.click();
      const statusBefore = (await page.locator("p.status-line").first().innerText()).replace(
        /\s+/gu,
        " ",
      );
      const control = page.getByRole("button", {
        name: "Stationary observer (v = 0)",
        exact: true,
      });
      if (!(await control.isVisible().catch(() => false)))
        throw new Error("the instrument offers no control to operate");
      await control.click();
      // The accepted status line spaces its announcements by a second on purpose, so wait for a new
      // one rather than for the old one to hold still.
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const now = (await page.locator("p.status-line").first().innerText()).replace(/\s+/gu, " ");
        if (now !== statusBefore && now.length > 0)
          return {
            expected: "operating the instrument accepts a new state",
            actual: now.slice(0, 90),
          };
        await page.waitForTimeout(250);
      }
      throw new Error("the instrument accepted no new state after its control was operated");
    },

    async "select-linked-term"(page, baseUrl) {
      /*
       * A selectable term is `button.term-chip[data-quantity-id]`, and the served HTML marks it
       * `disabled` until hydration, which is the repository's own no-script pattern. My first draft
       * looked for `[data-term]` and found 135 of them: those are the highlighted spans in the
       * mathematics, not the control. So this waits for the chip to become enabled, which is also the
       * only honest way to know the page hydrated.
       */
      await page.goto(`${baseUrl}${PAPER}/`, { waitUntil: "load" });
      const chip = page.locator("button.term-chip[data-quantity-id]").first();
      if ((await chip.count()) === 0) throw new Error("the paper offers no term chip to select");
      const quantityId = await chip.getAttribute("data-quantity-id");
      await chip.scrollIntoViewIfNeeded();
      let enabled = false;
      for (let attempt = 0; attempt < 24 && !enabled; attempt += 1) {
        enabled = await chip.isEnabled().catch(() => false);
        if (!enabled) await page.waitForTimeout(250);
      }
      if (!enabled)
        throw new Error(`the ${quantityId} chip never became enabled, so it never hydrated`);
      await chip.click({ timeout: 10000 });
      const pressed = await chip.getAttribute("aria-pressed");
      if (pressed !== "true")
        throw new Error(`selecting ${quantityId} left aria-pressed=${pressed}`);
      return { expected: "a selected term is marked pressed", actual: quantityId };
    },

    async "return-to-source"(page, baseUrl) {
      await page.goto(`${baseUrl}${PAPER}/view/parallel/#${SENTENCE}`, { waitUntil: "load" });
      await requirePresent(page, `#${SENTENCE}`, "the entry sentence on return");
      const text = (await page.locator(`#${SENTENCE}`).first().innerText()).trim();
      if (text.length === 0) throw new Error("the entry sentence rendered no text on return");
      return { expected: "the journey ends where it began", actual: `#${SENTENCE}` };
    },
  });

export const PAPER_JOURNEYS: readonly Readonly<{
  journey: PaperE2EJourney;
  actions: Readonly<Record<PaperE2EJourneyStepKind, JourneyAction>>;
}>[] = Object.freeze([
  Object.freeze({ journey: MASS_ENERGY_JOURNEY, actions: MASS_ENERGY_ACTIONS }),
]);
