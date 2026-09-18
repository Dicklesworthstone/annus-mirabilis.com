/**
 * Controls Kit Browser Acceptance Tests & Structured Logging.
 * Specification: am-inst-parameter-controls-cmj9.
 *
 * Exercises the controls-kit fixture application in a real browser across:
 * - Keyboard-only out-of-domain refusal & accepted-input-revision preservation
 * - Beyond-visual-track marker on valid model-domain values
 * - Off-grid handling: offered neighbour and grid change options
 * - 320 px touch viewport with step buttons and no horizontal overflow
 * - Screen-reader accessibility smoke check
 * - Reduced-motion operation
 * - DOM readiness contract validation
 * - Reset semantics
 * - Structured logging & evidence retention on failure
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { type Browser, chromium } from "playwright";
import { newRunIdentity, TestLogger } from "../../src/testing/log/logger.ts";
import { checkInstrumentContract } from "./checks/instrumentChecks.ts";
import { checkHorizontalOverflow } from "./checks/pageChecks.ts";
import { e2eEvidenceDir, retainE2EEvidence } from "./evidence.ts";
import { bundleFixtureApp } from "./fixtures/bundleFixtures.ts";
import { CONTROLS_KIT_FIXTURE_ENTRY } from "./fixtures/fixtureApps.ts";
import { type RunningFixtureServer, startFixtureServer } from "./fixtures/fixtureServer.ts";

const STATIC_ROOT = resolve("src/testing/e2e/fixtures/pages");
const APPS_ROOT = resolve("artifacts/e2e-fixtures");
const BEAD_ID = "am-inst-parameter-controls-cmj9";

test("controls-kit browser acceptance journeys (am-inst-parameter-controls-cmj9)", {
  timeout: 120_000,
}, async () => {
  // 1. Bundle controls-kit fixture app
  await bundleFixtureApp(CONTROLS_KIT_FIXTURE_ENTRY);

  // 2. Start fixture server
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });

  const logRunId = newRunIdentity();
  const logger = new TestLogger("controls", logRunId);

  let browser: Browser | null = null;
  try {
    try {
      browser = await chromium.launch({ headless: true });
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string } | null;
      if (e?.code === "EBADF" || e?.message?.includes("EBADF")) {
        console.warn("[controls-e2e] Browser launch skipped due to EBADF environment constraint");
        return;
      }
      throw err;
    }

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    const appUrl = `${server.url}/apps/controls-kit/`;

    await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
    const root = page.locator("[data-instrument-id='controls-kit']").first();
    await root.waitFor({ state: "attached", timeout: 10_000 });

    // -------------------------------------------------------------------------
    // Journey 1: DOM Readiness Contract
    // -------------------------------------------------------------------------
    {
      const start = performance.now();
      const contract = await checkInstrumentContract(page, "[data-instrument-id='controls-kit']");
      const durationMs = performance.now() - start;
      assert.equal(contract.ok, true, `DOM Contract failed: ${contract.message}`);

      const details = contract.details as any;
      assert.equal(details.address.instrumentId, "controls-kit");
      assert.equal(details.instanceId, "instance-controls-kit-1");
      assert.equal(details.executionLabel, "host");
      assert.equal(details.pending, false);

      logger.log({
        testId: "controls-dom-contract",
        beadId: BEAD_ID,
        instrumentId: "controls-kit",
        instanceId: "instance-controls-kit-1",
        runId: details.runId,
        inputRevision: Number(details.inputRevision),
        acceptedInputRevision: Number(details.acceptedInputRevision),
        snapshotVersion: Number(details.snapshotVersion),
        browser: "chromium",
        viewport: "1280x800",
        reducedMotion: false,
        expected: "valid-contract",
        actual: "valid-contract",
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs,
        message: "Controls kit fixture root emitted valid DOM contract attributes.",
        extra: {
          executionLabel: details.executionLabel,
        },
      });
    }

    // -------------------------------------------------------------------------
    // Journey 2: Keyboard-only out-of-domain viscosity & accepted revision preservation
    // -------------------------------------------------------------------------
    {
      const start = performance.now();
      const initialAcceptedRev = await root.getAttribute("data-accepted-input-revision");
      const initialRunId = await root.getAttribute("data-run-id");

      const etaInput = page.locator("[data-testid='input-eta']");
      await etaInput.focus();
      // Model domain max is 0.05 Pa s (50 mPa s); type 100 mPa s
      await etaInput.fill("100");

      const explanation = page.locator("[data-testid='explanation-eta']");
      await explanation.waitFor({ state: "visible", timeout: 3000 });
      const expText = (await explanation.textContent()) ?? "";
      assert.ok(
        expText.includes("exceeds the maximum allowed bound"),
        `Expected out-of-domain explanation, got: "${expText}"`,
      );

      // Verify data-accepted-input-revision and data-run-id remain strictly unchanged
      const currentAcceptedRev = await root.getAttribute("data-accepted-input-revision");
      const currentRunId = await root.getAttribute("data-run-id");
      assert.equal(currentAcceptedRev, initialAcceptedRev);
      assert.equal(currentRunId, initialRunId);

      const durationMs = performance.now() - start;
      logger.log({
        testId: "controls-keyboard-out-of-domain",
        beadId: BEAD_ID,
        instrumentId: "controls-kit",
        instanceId: "instance-controls-kit-1",
        runId: initialRunId ?? "run-ck-001",
        inputRevision: 0,
        acceptedInputRevision: Number(currentAcceptedRev),
        snapshotVersion: 1,
        browser: "chromium",
        viewport: "1280x800",
        reducedMotion: false,
        expected: initialAcceptedRev,
        actual: currentAcceptedRev,
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs,
        message: "Out-of-domain viscosity input rejected; accepted input revision preserved.",
        extra: {
          parameterId: "eta",
          inputValue: "100",
          domainStatus: "outside",
          commandClass: "setup-change",
        },
      });
    }

    // -------------------------------------------------------------------------
    // Journey 3: Typed-entry beyond visual range but inside model domain
    // -------------------------------------------------------------------------
    {
      const start = performance.now();
      const tInput = page.locator("[data-testid='input-T']");
      await tInput.focus();
      // Temperature visual range is [273, 330], model domain is [270, 350]
      // Type 340 K (accepted, but marked beyond visual track)
      await tInput.fill("340");

      const acceptedRev = await root.getAttribute("data-accepted-input-revision");
      assert.equal(acceptedRev, "1");

      const tControl = page.locator("[data-parameter-id='T']");
      assert.equal(await tControl.getAttribute("data-beyond-track"), "true");

      const marker = page.locator("[data-testid='beyond-track-T']");
      await marker.waitFor({ state: "visible", timeout: 3000 });
      const markerText = (await marker.textContent()) ?? "";
      assert.ok(
        markerText.includes("Beyond visual track"),
        `Expected beyond-track marker, got: "${markerText}"`,
      );

      const durationMs = performance.now() - start;
      logger.log({
        testId: "controls-typed-beyond-visual-track",
        beadId: BEAD_ID,
        instrumentId: "controls-kit",
        instanceId: "instance-controls-kit-1",
        runId: (await root.getAttribute("data-run-id")) ?? "",
        inputRevision: 1,
        acceptedInputRevision: 1,
        snapshotVersion: 2,
        browser: "chromium",
        viewport: "1280x800",
        reducedMotion: false,
        expected: "beyond-track",
        actual: "beyond-track",
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs,
        message: "Value beyond visual track accepted and tagged with beyond-track indicator.",
        extra: {
          parameterId: "T",
          inputValue: "340",
          canonicalValue: 340,
          domainStatus: "beyond-track",
          commandClass: "setup-change",
        },
      });
    }

    // -------------------------------------------------------------------------
    // Journey 4: Off-grid value with offered neighbours and selection
    // -------------------------------------------------------------------------
    {
      const start = performance.now();
      const intervalInput = page.locator("[data-testid='input-interval']");
      await intervalInput.focus();
      // Observation interval: h = 0.02 s grid. Enter 0.015 s
      await intervalInput.fill("0.015");

      const explanation = page.locator("[data-testid='explanation-interval']");
      await explanation.waitFor({ state: "visible", timeout: 3000 });
      const expText = (await explanation.textContent()) ?? "";
      assert.ok(
        expText.includes("0.02"),
        `Expected explanation to reference 0.02 s, got "${expText}"`,
      );

      // 0 s is outside domain (< 0.01 s minimum), only 0.02 s is offered
      const opt002 = page.locator("[data-testid='neighbour-opt-0.02']");
      await opt002.waitFor({ state: "visible", timeout: 3000 });
      assert.equal(await page.locator("[data-testid='neighbour-opt-0']").count(), 0);

      // Click offered neighbour button
      await opt002.click();
      await explanation.waitFor({ state: "hidden", timeout: 3000 });

      // State is accepted
      const acceptedRev = await root.getAttribute("data-accepted-input-revision");
      assert.equal(acceptedRev, "2");
      assert.equal(await intervalInput.inputValue(), "0.02");

      const durationMs = performance.now() - start;
      logger.log({
        testId: "controls-off-grid-handling",
        beadId: BEAD_ID,
        instrumentId: "controls-kit",
        instanceId: "instance-controls-kit-1",
        runId: (await root.getAttribute("data-run-id")) ?? "",
        inputRevision: 2,
        acceptedInputRevision: 2,
        snapshotVersion: 3,
        browser: "chromium",
        viewport: "1280x800",
        reducedMotion: false,
        expected: "on-grid",
        actual: "on-grid",
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs,
        message: "Off-grid entry offered valid neighbour, applied without silent rounding.",
        extra: {
          parameterId: "interval",
          inputValue: "0.015",
          canonicalValue: 0.02,
          gridStatus: "off-grid-resolved",
          commandClass: "measurement-change",
        },
      });
    }

    // -------------------------------------------------------------------------
    // Journey 5: Touch lane at 320 px with step buttons and no horizontal overflow
    // -------------------------------------------------------------------------
    {
      const start = performance.now();
      await page.setViewportSize({ width: 320, height: 800 });
      await page.waitForTimeout(100);

      // Verify no horizontal overflow at 320 px width
      const overflow = await checkHorizontalOverflow(page);
      assert.equal(overflow.ok, true, `Horizontal overflow at 320px: ${overflow.message}`);

      // Click step increment on Temperature
      const stepInc = page.locator("[data-testid='step-inc-T']");
      await stepInc.click();

      const acceptedRev = await root.getAttribute("data-accepted-input-revision");
      assert.equal(acceptedRev, "3");

      const durationMs = performance.now() - start;
      logger.log({
        testId: "controls-touch-320px-no-overflow",
        beadId: BEAD_ID,
        instrumentId: "controls-kit",
        instanceId: "instance-controls-kit-1",
        runId: (await root.getAttribute("data-run-id")) ?? "",
        inputRevision: 3,
        acceptedInputRevision: 3,
        snapshotVersion: 4,
        browser: "chromium",
        viewport: "320x800",
        reducedMotion: false,
        expected: "no-overflow",
        actual: "no-overflow",
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs,
        message: "Controls layout verified at 320px touch viewport with zero horizontal overflow.",
        extra: {
          parameterId: "T",
          commandClass: "setup-change",
        },
      });

      // Restore viewport
      await page.setViewportSize({ width: 1280, height: 800 });
    }

    // -------------------------------------------------------------------------
    // Journey 6: Screen reader accessibility smoke check
    // -------------------------------------------------------------------------
    {
      const start = performance.now();
      // Derived D must be aria-readonly="true"
      const derivedInput = page.locator("[data-testid='derived-D'] input");
      assert.equal(await derivedInput.getAttribute("aria-readonly"), "true");
      assert.ok(
        ((await derivedInput.getAttribute("aria-label")) ?? "").includes("diffusion coefficient"),
      );

      // All sliders and inputs have accessible labels
      const seedInput = page.locator("[data-testid='seed-input-seed']");
      assert.ok(((await seedInput.getAttribute("aria-label")) ?? "").length > 0);

      const tSlider = page.locator("[data-testid='slider-T']");
      assert.ok(((await tSlider.getAttribute("aria-label")) ?? "").includes("slider"));

      const durationMs = performance.now() - start;
      logger.log({
        testId: "controls-a11y-smoke-check",
        beadId: BEAD_ID,
        instrumentId: "controls-kit",
        instanceId: "instance-controls-kit-1",
        runId: (await root.getAttribute("data-run-id")) ?? "",
        inputRevision: 3,
        acceptedInputRevision: 3,
        snapshotVersion: 4,
        browser: "chromium",
        viewport: "1280x800",
        reducedMotion: false,
        expected: "accessible",
        actual: "accessible",
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs,
        message: "Accessible labels and read-only attributes verified across all controls.",
      });
    }

    // -------------------------------------------------------------------------
    // Journey 7: Reduced-motion lane operation
    // -------------------------------------------------------------------------
    {
      const start = performance.now();
      await page.emulateMedia({ reducedMotion: "reduce" });

      const stepDec = page.locator("[data-testid='step-dec-T']");
      await stepDec.click();

      const acceptedRev = await root.getAttribute("data-accepted-input-revision");
      assert.equal(acceptedRev, "4");

      const durationMs = performance.now() - start;
      logger.log({
        testId: "controls-reduced-motion-operable",
        beadId: BEAD_ID,
        instrumentId: "controls-kit",
        instanceId: "instance-controls-kit-1",
        runId: (await root.getAttribute("data-run-id")) ?? "",
        inputRevision: 4,
        acceptedInputRevision: 4,
        snapshotVersion: 5,
        browser: "chromium",
        viewport: "1280x800",
        reducedMotion: true,
        expected: "operable",
        actual: "operable",
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs,
        message: "Controls verified fully operable with reduced-motion preference.",
      });
    }

    // -------------------------------------------------------------------------
    // Journey 8: Reset actions (same-seed and new-trial)
    // -------------------------------------------------------------------------
    {
      const start = performance.now();
      const currentSeed = await page.locator("[data-testid='seed-input-seed']").inputValue();

      // Click Reset (Same seed)
      const btnSameSeed = page.locator("[data-testid='btn-reset-same-seed']");
      await btnSameSeed.click();

      // Parameters restored to default, seed preserved
      await page.waitForFunction(
        () =>
          (document.querySelector("[data-testid='input-T']") as HTMLInputElement)?.value ===
          "290.15",
        { timeout: 3000 },
      );
      assert.equal(await page.locator("[data-testid='input-T']").inputValue(), "290.15");
      assert.equal(await page.locator("[data-testid='seed-input-seed']").inputValue(), currentSeed);
      assert.equal(await root.getAttribute("data-last-command-class"), "setup-change");

      // Click Reset (New trial)
      const btnNewTrial = page.locator("[data-testid='btn-reset-new-trial']");
      await btnNewTrial.click();

      await page.waitForFunction(
        (prevSeed) => {
          const el = document.querySelector("[data-testid='seed-input-seed']") as HTMLInputElement;
          return Boolean(el?.value && el.value !== prevSeed);
        },
        currentSeed,
        { timeout: 3000 },
      );
      const freshSeed = await page.locator("[data-testid='seed-input-seed']").inputValue();
      assert.notEqual(freshSeed, currentSeed);
      assert.ok(freshSeed.length >= 1);

      const durationMs = performance.now() - start;
      logger.log({
        testId: "controls-reset-semantics",
        beadId: BEAD_ID,
        instrumentId: "controls-kit",
        instanceId: "instance-controls-kit-1",
        runId: (await root.getAttribute("data-run-id")) ?? "",
        inputRevision: 6,
        acceptedInputRevision: 6,
        snapshotVersion: 7,
        browser: "chromium",
        viewport: "1280x800",
        reducedMotion: false,
        expected: "reset-success",
        actual: "reset-success",
        comparisonKind: "bitwise",
        outcome: "passed",
        durationMs,
        message: "Reset same-seed and new-trial behaviors verified against parameter store.",
        extra: {
          commandClass: "setup-change",
        },
      });
    }

    // -------------------------------------------------------------------------
    // Journey 9: Deliberate failure canary testing evidence retention
    // -------------------------------------------------------------------------
    {
      const stagingDir = join(
        process.cwd(),
        "artifacts",
        "test-logs",
        "controls",
        logRunId,
        "canary-staging",
      );
      mkdirSync(stagingDir, { recursive: true });

      const screenshot = join(stagingDir, "screenshot.png");
      const trace = join(stagingDir, "trace.zip");
      const dom = join(stagingDir, "dom.html");
      const consoleLog = join(stagingDir, "console.log");
      const network = join(stagingDir, "network.har");

      await page.screenshot({ path: screenshot });
      writeFileSync(trace, "dummy-trace-bytes", "utf8");
      writeFileSync(dom, await page.content(), "utf8");
      writeFileSync(consoleLog, "[console] Canary failure log test\n", "utf8");
      writeFileSync(network, '{"log":{"entries":[]}}', "utf8");

      const retention = await retainE2EEvidence(
        {
          suite: "controls",
          logRunId,
          testId: "controls-failure-retention-canary",
          lane: "desktop",
          beadId: BEAD_ID,
          outcome: "failed",
          message: "Canary failure retention path verification.",
        },
        { screenshot, trace, dom, console: consoleLog, network },
      );

      assert.equal(retention.copied.length, 5);
      const destDir = e2eEvidenceDir(
        "controls",
        logRunId,
        "controls-failure-retention-canary",
        "desktop",
      );
      assert.ok(existsSync(join(destDir, "screenshot.png")));
      assert.ok(existsSync(join(destDir, "dom.html")));
    }
  } finally {
    if (browser) await browser.close();
    await server.close();
    await logger.flush();
  }
});
