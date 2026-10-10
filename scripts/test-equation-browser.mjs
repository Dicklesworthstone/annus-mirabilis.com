import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

/** Only real exported pages, rendered equation payloads and dedicated numerical owners. */
export async function checkEquationBrowser(browser, url, check) {
  const eqId = (name) => `eq-model-bm-${name}`;
  /**
   * THE SECOND PLACEMENT'S CARDS ANSWER TO ANOTHER SPELLING, and this check waited thirty seconds
   * for the first one.
   *
   * `equationScope="compare"` on the comparison ensemble makes SemanticEquation render
   * `data-equation-id="${eqId("rms")}-compare"` (SemanticEquation.tsx:201,
   * `effectiveScope ? `${equation.id}-${effectiveScope}` : equation.id`). That scoping landed in
   * 15ad291f4 on 2026-09-17, to disambiguate the reading and lab renders and their nav landmarks
   * (am-txy3); this check's locators were written in 0c734315e the DAY BEFORE and were never
   * updated, so the comparison assertions below have been unreachable since, and the lane has been
   * 8 of 9 with a 30-second timeout rather than a diagnosis.
   *
   * Measured in Chromium on the built page before repairing it: two roots, the first carrying
   * eq-model-bm-apparent-speed / -diffusivity / -rms and the second carrying each of those with
   * `-compare`, three `details.equation-parts` in each. So the product is right and the locator was
   * stale, which is the opposite of what a 30-second wait for a missing explorer suggests.
   *
   * `data-term-value` is NOT suffixed -- the same probe read `eq-model-bm-rms.t.diffusion` inside
   * the `-compare` card -- so `value()` needs the unscoped key and gets it by being scoped to the
   * card it was found in.
   */
  const COMPARE = "-compare";
  const card = (scope, name, placement = "") =>
    scope.locator(`[data-equation-id="${eqId(name)}${placement}"]`);
  const value = (scope, name, term, placement = "") =>
    card(scope, name, placement).locator(`[data-term-value="${eqId(name)}.t.${term}"]`);
  /**
   * Opens a card's term-and-operation explorer, which is a CLOSED `<details class="equation-parts">`
   * holding the chips in a `<nav class="equation-chips">`.
   *
   * This is why `getByRole("button", { name: "Why a square root? operation" })` found nothing and
   * waited 30 seconds: a closed disclosure keeps its contents out of the ACCESSIBILITY TREE, and
   * role locators query that tree, while `locator("button")` queries the DOM and found all 13. The
   * chips were never removed and their aria-labels never changed -- measured on the built page, the
   * label is exactly "Why a square root? operation" -- so the failure read like a missing control
   * and was a closed drawer. AGENTS.md describes the design: a formula "reads as a whole, with an
   * optional term-and-operation explorer and a clear way out".
   *
   * Idempotent, because a click on an open disclosure would close it again.
   */
  const openParts = async (cardLocator) => {
    const parts = cardLocator.locator("details.equation-parts").first();
    if ((await parts.getAttribute("open")) === null)
      await parts.locator(":scope > summary").click();
  };
  const staticContext = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await staticContext.newPage();
    await page.goto(`${url}/lab/bm-01/`);
    // A CENSUS THAT BROKE ON CORRECT WORK, and the first repair of it was wrong too, which is worth
    // recording. `.equation-mathml math` was frozen at 3 and is 6, so the obvious fix was to pair it
    // with the card count -- but the cards are still 3. Measured on the built page: 3 cards, 9
    // `.equation-mathml` wrappers, 10 `<math>` elements, because a card renders several notation
    // forms. Equality against the card count would have been a new frozen census wearing the shape
    // of a property.
    //
    // The claim worth asserting is PER CARD, which is also the accessibility requirement AGENTS.md
    // states ("KaTeX HTML plus MathML"): no equation card is served without a MathML form, and no
    // MathML wrapper is empty. Both hold at any number of cards or forms.
    const perCard = await page.locator("[data-equation-id]").evaluateAll((nodes) =>
      nodes.map((n) => ({
        id: n.getAttribute("data-equation-id"),
        math: n.querySelectorAll("math").length,
      })),
    );
    // A LIVE REGION SHARES THIS CLASS AND IS CORRECTLY EMPTY ON ARRIVAL. Three of the nine
    // `.equation-mathml` elements are `<p role="status" aria-live="polite">`, one per card, holding
    // nothing until there is something to announce. Demanding MathML inside them would be demanding
    // an announcement before any interaction, so they are excluded by role rather than by counting
    // around them.
    const emptyWrappers = await page
      .locator('.equation-mathml:not([role="status"])')
      .evaluateAll((nodes) => nodes.filter((n) => n.querySelectorAll("math").length === 0).length);
    const liveRegions = await page.locator('.equation-mathml[role="status"]').count();
    console.log(
      JSON.stringify({
        check: "bm-01 equation cards",
        cards: perCard.length,
        perCard,
        emptyWrappers,
        liveRegions,
      }),
    );
    assert.ok(perCard.length >= 3, `bm-01 renders ${perCard.length} equation cards, fewer than 3`);
    assert.deepEqual(
      perCard.filter((c) => c.math === 0),
      [],
    );
    assert.equal(emptyWrappers, 0);
    // One announcement region per card, so the exclusion above is scoped rather than open-ended.
    assert.equal(liveRegions, perCard.length);
    assert.ok(
      (
        await page
          .locator("[data-equation-values]")
          .evaluateAll((nodes) => nodes.map((n) => n.dataset.executionLabel))
      ).every((x) => x === "static"),
    );
    assert.match(await value(page, "rms", "diffusion").innerText(), /0\.42944/);
    assert.match(await value(page, "diffusivity", "viscosity").innerText(), /^1 mPa·s$/);
    const rms = card(page, "rms");
    await rms.getByText("Model assumptions and every term’s meaning", { exact: true }).click();
    // THE SAME CLAIM, REWRITTEN. The card said "This is a unit check, not a proof" and now says
    // "Every term's units were checked when this page was built. That checks the units, not the
    // model." The substance is what this assertion is for -- the card must not let a passing unit
    // check read as a proof of the model -- so it is asserted on the sentence that carries it.
    assert.match(await rms.innerText(), /checks the units, not the model/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await rms.screenshot({ path: "artifacts/browser/equations-no-js-320.png" });
    check(
      "equations: three worked equations, meanings, accepted values and MathML remain readable without JavaScript",
    );
  } finally {
    await staticContext.close();
  }

  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } }),
    page = await context.newPage();
  const errors = [];
  let workers = 0;
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("worker", () => workers++);
  try {
    await page.goto(`${url}/lab/bm-01/`);
    const lab = page.locator('[data-instrument-id="bm-01"]').first();
    const rms = card(lab, "rms"),
      diffusion = card(lab, "diffusivity"),
      _speed = card(lab, "apparent-speed");
    const apply = lab.getByRole("button", { name: "Apply trial settings", exact: true });
    await page.waitForFunction(
      () => !document.querySelector('[data-instrument-id="bm-01"] button[type="submit"]').disabled,
    );
    await openParts(rms);
    await rms.getByRole("button", { name: "Why a square root? operation", exact: true }).waitFor();
    // Since ad178896 the trial form sits in the closed "Experiment settings" drawer.
    await lab.locator("details.experiment-settings > summary").click();
    assert.equal(workers, 0);
    assert.equal(await lab.getAttribute("data-execution-label"), "static");
    const identity = async (target) =>
      target.evaluate((el) => ({
        run: el.dataset.runId,
        version: el.dataset.snapshotVersion,
        draws: el.dataset.recordingDraws,
      }));
    const original = await identity(lab);
    const formula = rms.locator(".equation-formula");
    await formula.focus();
    await formula.press("Enter");
    assert.equal(await rms.getAttribute("data-selected-node-id"), `${eqId("rms")}.op.equality`);
    await formula.press("ArrowDown");
    assert.equal(await rms.getAttribute("data-selected-node-id"), `${eqId("rms")}.t.rms`);
    await formula.press("ArrowRight");
    assert.equal(await rms.getAttribute("data-selected-node-id"), `${eqId("rms")}.op.squareRoot`);
    assert.match(
      await rms.locator(".equation-inspector").innerText(),
      /positive square root has units of length/,
    );
    await formula.press("ArrowDown");
    assert.equal(await rms.getAttribute("data-selected-node-id"), `${eqId("rms")}.op.meanSquare`);
    await formula.press("ArrowUp");
    assert.equal(await rms.getAttribute("data-selected-node-id"), `${eqId("rms")}.op.squareRoot`);
    await formula.press("Escape");
    assert.equal(await rms.getAttribute("data-selected-node-id"), null);
    await formula.press("Tab");
    assert.notEqual(
      await page.evaluate(() => document.activeElement.className),
      "equation-formula",
    );
    assert.deepEqual(await identity(lab), original);
    assert.equal(workers, 0);
    check(
      "equations: keyboard traversal selects actual expression operations without creating or mutating a trial",
    );

    assert.ok(
      (
        await rms
          .locator(".equation-visual svg")
          .evaluateAll((nodes) => nodes.map((el) => getComputedStyle(el).pointerEvents))
      ).every((value) => value === "none"),
    );
    // ONE CLICK SELECTS, EVEN WITH FOCUS STILL INSIDE THE WIDGET. This needed a workaround until
    // am-gbys was fixed: the traversal above ends with `Tab`, which leaves focus on
    // `.equation-quantity.term-phrase` INSIDE the widget, and the first pointer press then selected
    // nothing. The cause was `pointed` being React state, so the focus change on mousedown
    // re-rendered and re-set the equation's `dangerouslySetInnerHTML`, destroying the very span the
    // press had landed on; a click is only synthesised when mousedown and mouseup share a node.
    // `pointed` is a ref now (SemanticEquation.tsx), the span survives, and the click arrives.
    //
    // The workaround was a click on the card's heading to move focus out first. It is gone, which is
    // the point: this line is now the assertion that the seam works rather than a step around it.
    await rms.locator('.equation-visual [data-term="eq-model-bm-rms.t.diffusion"]').click();
    assert.equal(await rms.getAttribute("data-selected-node-id"), `${eqId("rms")}.t.diffusion`);
    await page.waitForFunction(
      () =>
        document.querySelector(
          '[data-equation-id="eq-model-bm-diffusivity"] .equation-visual [data-term="eq-model-bm-diffusivity.t.diffusion"]',
        ).dataset.selected === "true",
    );
    assert.equal(
      await lab
        .locator('[data-output="diffusionCoefficient"]')
        .evaluate((el) => getComputedStyle(el).outlineStyle),
      "solid",
    );
    await rms.getByRole("button", { name: "Patterns instead of colour", exact: true }).click();
    assert.equal(await rms.getAttribute("data-pattern"), "true");
    /*
      PATTERN MODE DISTINGUISHES QUANTITIES, NOT EQUATION ROLES, and this assertion used to say the
      opposite: `.every((style) => style === "double")` over every `.am-role-result`. It had never
      been evaluated, because the `data-pattern` assertion above always failed first (am-fheb, the
      focus-reflow that swallowed the press, repaired 2026-10-08). Reaching it for the first time
      showed it cannot hold.

      Measured in chromium on the built page, with pattern mode on:

        .am-role-result inside rmsDisplacement1d   --qd: underline double  -> double
        .am-role-result inside diffusionCoefficient --qd: underline solid   -> solid

      `--qd` is assigned PER QUANTITY by src/generated/quantity-colours-by-paper.css, from that
      quantity's semantic cue (`identityCues.ts`: space-geometry dotted, material double,
      statistical wavy, and so on). `am-role-result` is an EQUATION-role class, orthogonal to it:
      two elements can both be the result of their expression and be different quantities. So
      "every result is double" conflated the two, and would have been false for any card whose
      result terms are not all one cue.

      What the design actually promises is that a reader who cannot use colour can still tell the
      quantities apart, so that is what this asserts: the mechanism applies to every one, the
      styles DIFFER across quantities, and each element's computed style is the one its own
      quantity declares.
    */
    const patterned = await rms.locator(".equation-visual .am-role-result").evaluateAll((nodes) =>
      nodes.map((el) => {
        const cs = getComputedStyle(el);
        return {
          line: cs.textDecorationLine,
          style: cs.textDecorationStyle,
          declared: cs.getPropertyValue("--qd").trim(),
        };
      }),
    );
    // Non-vacuity, named: `.every` over an empty list is true, and one element cannot show that
    // anything is distinguishable from anything.
    assert.ok(
      patterned.length >= 2,
      `only ${patterned.length} result terms carry a pattern, so distinguishability cannot be tested`,
    );
    assert.ok(
      patterned.every((p) => p.line === "underline"),
      `pattern mode left a result term undecorated: ${JSON.stringify(patterned)}`,
    );
    assert.ok(
      new Set(patterned.map((p) => p.style)).size >= 2,
      `every result term drew the same pattern, so monochrome does not distinguish them: ${JSON.stringify(patterned)}`,
    );
    assert.ok(
      patterned.every((p) => p.declared.includes(p.style)),
      `a term's drawn pattern is not the one its quantity declares: ${JSON.stringify(patterned)}`,
    );
    await openParts(diffusion);
    await diffusion.getByRole("button", { name: "Dynamic viscosity term", exact: true }).click();
    await diffusion
      .getByRole("button", { name: "Edit this input in the laboratory", exact: true })
      .click();
    assert.equal(await page.evaluate(() => document.activeElement.name), "eta");
    assert.deepEqual(await identity(lab), original);
    assert.equal(workers, 0);
    check(
      "equations: pointer inspection, shared quantity highlighting, monochrome patterns and input focus preserve accepted science",
    );

    async function accepted(action, target = lab) {
      const before = await identity(target),
        instance = await target.getAttribute("data-instance-id");
      await action();
      await page.waitForFunction(
        ({ instance, version }) => {
          const el = [...document.querySelectorAll('[data-instrument-id="bm-01"]')].find(
            (el) => el.dataset.instanceId === instance,
          );
          return (
            el?.dataset.pending === "false" && Number(el.dataset.snapshotVersion) > Number(version)
          );
        },
        { instance, version: before.version },
        { timeout: 15000 },
      );
    }
    await lab.locator('[name="M"]').fill("40");
    await lab.locator('[name="H"]').fill("4");
    await lab.locator('[name="eta"]').fill("2");
    assert.match(await value(lab, "diffusivity", "viscosity").innerText(), /^1 mPa·s$/);
    assert.match(await value(lab, "rms", "diffusion").innerText(), /0\.42944/);
    await accepted(() => apply.click());
    assert.equal(workers, 1);
    assert.match(await value(lab, "diffusivity", "viscosity").innerText(), /^2 mPa·s$/);
    assert.match(await value(lab, "rms", "diffusion").innerText(), /0\.21472/);
    assert.equal(await lab.getAttribute("data-execution-label"), "host");
    const acceptedIdentity = await identity(lab),
      instance = await lab.getAttribute("data-instance-id");
    for (const snapshot of await lab.locator("[data-equation-values]").evaluateAll((nodes) =>
      nodes.map((el) => ({
        run: el.dataset.runId,
        version: el.dataset.snapshotVersion,
        instance: el.dataset.instanceId,
        label: el.dataset.executionLabel,
      })),
    ))
      assert.deepEqual(snapshot, {
        run: acceptedIdentity.run,
        version: acceptedIdentity.version,
        instance,
        label: "host",
      });
    check(
      "equations: actual worker outputs update all equations with one accepted identity, never draft settings",
    );

    const oldRms = await value(lab, "rms", "rms").innerText();
    await lab.locator('[name="interval"]').fill("0.015");
    await apply.click();
    // The refusal surfaces twice by design: the execution-currency chrome marks the
    // accepted readouts stale, and the notice explains it. Naming each surface is
    // stronger than an attribute selector that matched either one and, under
    // Playwright strict mode, neither.
    await lab.locator('.notice[data-refusal-code="off-replay-grid"]').waitFor();
    await lab
      .locator('[data-currency-state="refused"][data-refusal-code="off-replay-grid"]')
      .waitFor();
    assert.equal(await value(lab, "rms", "rms").innerText(), oldRms);
    assert.deepEqual(await identity(lab), acceptedIdentity);
    assert.match(
      await rms.locator("[data-retained-state]").innerText(),
      /Previous accepted settings.*request refused/,
    );
    await accepted(() =>
      lab
        .getByRole("button", { name: "Observe the recorded time 0.02 seconds.", exact: true })
        .click(),
    );
    assert.equal((await identity(lab)).run, acceptedIdentity.run);
    await lab.locator('[name="interval"]').fill("0");
    await accepted(() => apply.click());
    assert.equal(
      await value(lab, "apparent-speed", "apparentSpeed").getAttribute("data-value-kind"),
      "status",
    );
    assert.match(
      await value(lab, "apparent-speed", "apparentSpeed").innerText(),
      /positive observation interval/,
    );
    assert.equal(await value(lab, "rms", "rms").innerText(), "0 μm");
    check(
      "equations: refused observations retain their original values and zero-time apparent speed stays explicitly undefined",
    );

    await lab.locator('[name="interval"]').fill("1");
    await lab.locator('[name="d"]').selectOption("3");
    await accepted(() => apply.click());
    assert.equal(await value(lab, "rms", "rms").innerText(), oldRms);
    const resultCell = await lab
      .locator('[data-output="sampleRms"] [data-quantity-id="rmsDisplacement1d"]')
      .innerText();
    assert.equal(await value(lab, "rms", "rms").innerText(), resultCell);
    const unchanged = await identity(lab);
    await page
      .getByRole("button", { name: "Open a second separate ensemble", exact: true })
      .click();
    const second = page.locator('[data-instrument-id="bm-01"]').nth(1);
    // The card count is asserted before anything is clicked, so a future renaming of the scope
    // suffix fails by name here instead of by a timeout on the control inside it.
    assert.equal(await card(second, "rms", COMPARE).count(), 1);
    assert.equal(await card(second, "rms").count(), 0);
    await openParts(card(second, "rms", COMPARE));
    await card(second, "rms", COMPARE)
      .getByRole("button", { name: "Diffusion coefficient term", exact: true })
      .click();
    assert.equal(await rms.getAttribute("data-selected-node-id"), null);
    assert.match(await value(second, "rms", "diffusion", COMPARE).innerText(), /0\.42944/);
    assert.match(await value(lab, "rms", "diffusion").innerText(), /0\.21472/);
    assert.deepEqual(await identity(lab), unchanged);
    assert.equal(workers, 1);
    await page
      .getByRole("button", { name: "Close the second tracer ensemble", exact: true })
      .click();
    check(
      "equations: canonical coordinate RMS is not replaced by a vector or sample statistic, and separate placements stay isolated",
    );

    await openParts(rms);
    await rms.getByRole("button", { name: "Why a square root? operation", exact: true }).click();
    const audit = await new AxeBuilder({ page })
      .include('[data-instrument-id="bm-01"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      audit.violations.filter((v) => ["serious", "critical"].includes(v.impact)).map((v) => v.id),
      [],
    );
    await rms.screenshot({ path: "artifacts/browser/equations-desktop.png" });
    await page.setViewportSize({ width: 320, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await rms.screenshot({ path: "artifacts/browser/equations-interactive-320.png" });
    check(
      "equations: selected operations and live values remain accessible and reflow at 320 pixels",
      { violations: audit.violations.map((v) => v.id), manualScreenReaderReview: "not performed" },
    );

    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto(`${url}/papers/brownian-motion/?detail=1`);
    await page.locator('[data-reader-root][data-enhanced="true"]').waitFor();
    /*
      THE READER'S CARDS ARE BEHIND A DISCLOSURE AND ANSWER TO A THIRD SPELLING, and this group has
      been unreachable since the day after it was written.

      Two deliberate designs stand between this page and the cards, and neither was here on
      2026-09-16 when these locators were written:

        LazyArgumentEquations loads a step's equation payload ON FIRST OPENING of
        `details[data-argument-equations]`, because the whole-paper page carried every argument's
        cards in a closed disclosure -- measured at 464,754 bytes of markup, 45% of
        /papers/special-relativity/, with the page 264,373 B gzipped against a 250,000 budget.
        Before it is opened a no-script reader gets a real link to the section's own page instead.

        It then mounts them in `EquationScope scope={`reader-${argumentId}`}`, so the card's id is
        `eq-model-bm-rms-reader-arg-bm-observable`, not `eq-model-bm-rms`.

      Measured in Chromium on the built page: with the disclosure closed the passage holds ZERO
      `[data-equation-id]` and the whole page holds zero, with no page errors, at 1.5 s, 3 s and
      6 s and after scrolling it into view. Opened, it holds two, with
      `data-equations-loaded="true"` and `[data-equation-values]` reading "Symbolic here." -- which
      is what the assertion below wanted all along.

      The closed state is asserted FIRST, because it is the budget mechanism this check would
      otherwise silently stop protecting: a change that mounted the cards eagerly would make every
      assertion below pass and put the page back over budget.
    */
    const passage = page.locator("#arg-bm-observable"),
      drawer = passage.locator("details[data-argument-equations]");
    assert.equal(await drawer.getAttribute("data-equations-loaded"), "false");
    assert.equal(await passage.locator("[data-equation-id]").count(), 0);
    // A DOM LOCATOR, NOT getByRole, AND THIS FILE ALREADY SAYS WHY TEN LINES ABOVE. A closed
    // `<details>` keeps its contents out of the ACCESSIBILITY TREE, so `getByRole("link")` found
    // 0 of the link that is plainly in the DOM -- the same mechanism recorded in openParts, met
    // again from the other direction while writing this assertion.
    assert.equal(
      await drawer.locator(`[data-equations-fragment="arg-bm-observable"] a`).count(),
      1,
      "a reader without JavaScript must have a real link to the section page",
    );
    await drawer.locator(":scope > summary").click();
    await drawer.locator('[data-equations-loaded="true"]').or(drawer).first().waitFor();
    const READER = "-reader-arg-bm-observable";
    const readerRms = card(passage, "rms", READER);
    assert.match(await readerRms.locator("[data-equation-values]").innerText(), /Symbolic here/);
    const workersBefore = workers;
    await openParts(readerRms);
    await readerRms
      .getByRole("button", { name: "Why a square root? operation", exact: true })
      .click();
    const help = readerRms.locator(".equation-inspector [data-foundation]");
    await help.click();
    await page.locator("dialog[open]").waitFor();
    await page.waitForFunction(
      () => document.activeElement.id === "clarification-bridge-squaring-square-roots",
    );
    const triggerId = await help.getAttribute("id");
    assert.ok(triggerId);
    await page.keyboard.press("Escape");
    await page.locator("[data-clarification-dialog]").waitFor({ state: "hidden" });
    await page.waitForFunction((id) => document.activeElement.id === id, triggerId);
    assert.equal(
      await readerRms.getAttribute("data-selected-node-id"),
      `${eqId("rms")}.op.squareRoot`,
    );
    assert.equal(workers, workersBefore);
    assert.deepEqual(errors, []);
    check(
      "equations: operation prerequisites use the real return stack without assuming a live trial or losing the selected equation",
    );
  } catch (error) {
    await page
      .screenshot({ path: "artifacts/browser/equations-failure.png", fullPage: true })
      .catch(() => {});
    await writeFile(
      "artifacts/browser/equations-failure.json",
      JSON.stringify({ url: page.url(), errors, message: String(error) }, null, 2),
    );
    throw error;
  } finally {
    await context.close();
  }
}
