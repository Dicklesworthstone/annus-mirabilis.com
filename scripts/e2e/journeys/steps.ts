import type { Page } from "playwright";
import type { PaperE2EJourneyStepKind } from "../paper-e2e-contract.ts";

/*
 * THE MECHANICS EVERY PAPER'S JOURNEY SHARES, AND NOTHING A PAPER SHOULD NAME FOR ITSELF.
 *
 * Four papers with one parameterised scenario would assert only that the machinery exists. So what is
 * shared here is HOW a reader's affordance is driven - which selector holds the face chooser, that a
 * foundation opens in place rather than navigating, that the accepted status line spaces its
 * announcements by a deliberate second so a check must wait for a NEW one - and what each journey
 * names for itself is its own sentence, its own foundation, its own instrument and control, and its
 * own term chip. Every constant below was measured against the built site rather than assumed, and
 * the mistakes that produced each one are recorded beside it, because the next journey will meet them.
 */

export type JourneyStepOutcome = Readonly<{ expected: unknown; actual: unknown }>;
export type JourneyAction = (page: Page, baseUrl: string) => Promise<JourneyStepOutcome>;
export type JourneyActions = Readonly<Record<PaperE2EJourneyStepKind, JourneyAction>>;

/** Present in the DOM, which is what an anchor target must be; visibility is a separate question. */
export async function requirePresent(page: Page, selector: string, what: string): Promise<number> {
  const count = await page.locator(selector).count();
  if (count === 0) throw new Error(`${what}: no element matches ${selector}`);
  return count;
}

/**
 * The laboratory's accepted status line, read after a control has been operated.
 *
 * AcceptedStatus spaces its announcements by a deliberate second, so that a fast control cannot
 * produce a fast live region (AGENTS.md: a 60 Hz animation never produces a 60 Hz live-region
 * stream). Polling for STABILITY is therefore fooled - two reads 300ms apart both show the old text
 * and look settled - so this waits for the text to DIFFER from what stood before the click.
 */
export async function statusAfter(page: Page, previous: string): Promise<string> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const now = (
      await page
        .locator("p.status-line")
        .first()
        .innerText()
        .catch(() => "")
    ).replace(/\s+/gu, " ");
    if (now !== "" && now !== previous) return now;
    await page.waitForTimeout(250);
  }
  return (
    await page
      .locator("p.status-line")
      .first()
      .innerText()
      .catch(() => "")
  ).replace(/\s+/gu, " ");
}

/** Step 1: arrive on the parallel face at one named sentence, the way a deep link arrives. */
export function enterSourcePassage(paper: string, sentenceId: string): JourneyAction {
  return async (page, baseUrl) => {
    await page.goto(`${baseUrl}/papers/${paper}/view/parallel/#${sentenceId}`, {
      waitUntil: "load",
    });
    await requirePresent(page, `#${sentenceId}`, "entry sentence");
    const text = (await page.locator(`#${sentenceId}`).first().innerText()).trim();
    if (text.length === 0) throw new Error("the entry sentence rendered no text");
    return { expected: `#${sentenceId} carries its printed sentence`, actual: text.slice(0, 80) };
  };
}

/** Step 2: the face chooser's own link, not a hand-built URL, and the same sentence on arrival. */
export function switchFace(paper: string, sentenceId: string, face = "english"): JourneyAction {
  return async (page) => {
    const link = page.locator(`a[href="/papers/${paper}/view/${face}/"]`).first();
    if ((await link.count()) === 0)
      throw new Error(`the parallel face offers no link to the ${face} face`);
    await link.click();
    await page.waitForURL(new RegExp(`/view/${face}/`, "u"), { timeout: 15000 });
    await requirePresent(page, `#${sentenceId}`, `the same sentence on the ${face} face`);
    return { expected: `the ${face} face keeps the reader's place`, actual: page.url() };
  };
}

/**
 * Step 3: a foundation OPENS IN PLACE. It is a link with a real href for a reader without script,
 * and when hydrated the reader shell intercepts it, rewrites the address to ?open=foundation:<id>
 * and shows one panel. A first draft asserted [data-foundation-panel] existed after the click and
 * PASSED while proving nothing, because a paper page carries dozens of those panels.
 */
export function openFoundation(paper: string): JourneyAction {
  return async (page, baseUrl) => {
    await page.goto(`${baseUrl}/papers/${paper}/`, { waitUntil: "load" });
    const link = page.locator("a[data-foundation][data-return-caption]").first();
    if ((await link.count()) === 0)
      throw new Error("the explanation offers no foundation link carrying a return caption");
    const foundationId = (await link.getAttribute("data-foundation")) ?? "";
    await link.scrollIntoViewIfNeeded();
    await link.click({ timeout: 10000, noWaitAfter: true });
    await page
      .locator(`[data-foundation-panel="${foundationId}"]`)
      .waitFor({ state: "visible", timeout: 15000 });
    if (!page.url().includes(`open=foundation%3A${foundationId}`))
      throw new Error(`the panel opened but the address does not name it: ${page.url()}`);
    const open = await page.locator("[data-foundation-panel]:visible").count();
    if (open !== 1) throw new Error(`${open} foundation panels are open, not one`);
    return { expected: `the ${foundationId} lesson opens in place`, actual: page.url().slice(-48) };
  };
}

/**
 * Step 4: the way back.
 *
 * A CORRECTION LIVES HERE. This step once failed and the report said no reader-facing route back
 * existed. It did: the dialog carries "Back one step", "Return to the exact step" and an X, and
 * pressing one closes the lesson, drops ?open= from the address and restores focus to the trigger.
 * The mistake was searching for [data-return] attributes that do not exist and for return-like
 * controls INSIDE the panel, when they live in the dialog's chrome beside it. What was really
 * missing was the authored caption, which the reader now renders, and which this asserts when it is
 * there while accepting the generic control when it is not.
 */
export const returnToArgument: JourneyAction = async (page) => {
  const trigger = await page
    .locator("a[data-foundation][data-return-caption]")
    .first()
    .getAttribute("id");
  const authored = await page
    .locator("a[data-foundation][data-return-caption]")
    .first()
    .getAttribute("data-return-caption");
  const authoredRoute = page.locator(
    "[data-return-caption-line]:visible [data-return-caption-link]",
  );
  const generic = page.locator("button[data-reader-close]");
  let used: string;
  if ((await authoredRoute.count()) > 0) {
    const shown = (await authoredRoute.first().innerText()).trim();
    if (shown !== (authored ?? "").trim())
      throw new Error(`the way back reads "${shown}" where the link authored "${authored}"`);
    used = `the authored route: ${shown}`;
    await authoredRoute.first().click({ timeout: 10000, noWaitAfter: true });
  } else if ((await generic.count()) > 0) {
    used = `the generic route: ${(await generic.first().innerText()).trim()}`;
    await generic.first().click({ timeout: 10000, noWaitAfter: true });
  } else {
    throw new Error("the open lesson offers no route back to the argument");
  }
  await page.waitForFunction(
    () => document.querySelectorAll("[data-foundation-panel]:not([hidden])").length === 0,
    undefined,
    { timeout: 15000 },
  );
  if (page.url().includes("open=foundation"))
    throw new Error(`the lesson closed but the address still names it: ${page.url()}`);
  const focused = await page.evaluate(() => document.activeElement?.id ?? "");
  if (trigger && focused !== trigger)
    throw new Error(`focus landed on "${focused}" rather than the trigger "${trigger}"`);
  return { expected: "the reader is back at the interrupted argument, focused", actual: used };
};

/** Step 5: operate one named control of one named laboratory and accept a new state. */
export function operateInstrument(lab: string, controlName: string): JourneyAction {
  return async (page, baseUrl) => {
    await page.goto(`${baseUrl}/lab/${lab}/`, { waitUntil: "load" });
    // Predict mode hides the result until the reader answers, so answer it as a reader would.
    const skip = page.getByRole("button", { name: "Skip prediction" });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    const before = (
      await page
        .locator("p.status-line")
        .first()
        .innerText()
        .catch(() => "")
    ).replace(/\s+/gu, " ");
    const control = page.getByRole("button", { name: controlName, exact: true });
    if (!(await control.isVisible().catch(() => false)))
      throw new Error(`${lab} offers no control named "${controlName}"`);
    await control.click();
    const now = await statusAfter(page, before);
    if (now === before || now === "")
      throw new Error(`${lab} accepted no new state after "${controlName}" was operated`);
    return { expected: `${lab} accepts a new state`, actual: now.slice(0, 90) };
  };
}

/**
 * Step 6: select a linked term.
 *
 * The control is `button.term-chip[data-quantity-id]`, disabled in the served HTML until hydration,
 * which is this repository's own no-script pattern. A first draft looked for [data-term] and matched
 * 135 highlighted spans in the mathematics, none of them clickable.
 */
export function selectLinkedTerm(paper: string): JourneyAction {
  return async (page, baseUrl) => {
    await page.goto(`${baseUrl}/papers/${paper}/`, { waitUntil: "load" });
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
    if (pressed !== "true") throw new Error(`selecting ${quantityId} left aria-pressed=${pressed}`);
    return { expected: "a selected term is marked pressed", actual: quantityId };
  };
}

/** Step 7: back to the exact sentence the journey entered on. */
export function returnToSource(paper: string, sentenceId: string): JourneyAction {
  return async (page, baseUrl) => {
    await page.goto(`${baseUrl}/papers/${paper}/view/parallel/#${sentenceId}`, {
      waitUntil: "load",
    });
    await requirePresent(page, `#${sentenceId}`, "the entry sentence on return");
    const text = (await page.locator(`#${sentenceId}`).first().innerText()).trim();
    if (text.length === 0) throw new Error("the entry sentence rendered no text on return");
    return { expected: "the journey ends where it began", actual: `#${sentenceId}` };
  };
}
