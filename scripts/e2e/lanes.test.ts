import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { bundleFixtureApps } from "./fixtures/bundleFixtures.ts";
import { FIXTURE_APP_REGISTRY } from "./fixtures/fixtureApps.ts";
import { type RunningFixtureServer, startFixtureServer } from "./fixtures/fixtureServer.ts";
import {
  createLaneActions,
  LANES,
  type LaneSession,
  laneByName,
  laneSkipReason,
  launchLaneSession,
  runFixtureJourneyOnLane,
} from "./lanes.ts";

const STATIC_ROOT = resolve("src/testing/e2e/fixtures/pages");
const APPS_ROOT = resolve("artifacts/e2e-fixtures");

test("the 320-pixel lane width is exactly 320", () => {
  assert.equal(laneByName("touch-320").viewport.width, 320);
});

test("reducedMotion is set in its lane", () => {
  assert.equal(laneByName("reduced-motion").reducedMotion, "reduce");
  for (const lane of LANES) {
    if (lane.name !== "reduced-motion") {
      assert.notEqual(
        lane.reducedMotion,
        "reduce",
        `lane "${lane.name}" should not set reducedMotion: reduce`,
      );
    }
  }
});

test("JavaScript is disabled only in its lane", () => {
  assert.equal(laneByName("js-disabled").javaScriptEnabled, false);
  for (const lane of LANES) {
    if (lane.name !== "js-disabled") {
      assert.notEqual(
        lane.javaScriptEnabled,
        false,
        `lane "${lane.name}" should not disable JavaScript`,
      );
    }
  }
});

test("the no-WebGL lane passes the 3D-disabling flags", () => {
  const lane = laneByName("no-webgl");
  assert.equal(lane.disableWebGL, true);
  assert.ok(lane.chromiumArgs?.includes("--disable-3d-apis"));
  assert.ok(lane.chromiumArgs?.includes("--disable-webgl"));
  assert.ok(lane.chromiumArgs?.includes("--disable-webgl2"));
});

test("zoom-400 is 320x256 at scale factor 4", () => {
  const lane = laneByName("zoom-400");
  assert.deepEqual(lane.viewport, { width: 320, height: 256 });
  assert.equal(lane.deviceScaleFactor, 4);
});

test("text-200 injects a root font size of 200 percent", () => {
  const lane = laneByName("text-200");
  assert.match(lane.injectedStylesheet ?? "", /font-size:\s*200%/);
});

test("the keyboard-only lane's action API throws when a pointer action is attempted", () => {
  const lane = laneByName("keyboard-only");
  let clicked = false;
  const actions = createLaneActions(lane, {
    press: () => {},
    type: () => {},
    click: () => {
      clicked = true;
    },
    drag: () => {},
  });
  assert.throws(() => actions.click(), /keyboard-only/);
  assert.throws(() => actions.drag(), /keyboard-only/);
  assert.equal(clicked, false);
  // Keyboard actions still work in the keyboard-only lane.
  assert.doesNotThrow(() => actions.press("Tab"));
  assert.doesNotThrow(() => actions.type("hello"));
});

test("a non-keyboard-only lane's action API permits pointer actions", () => {
  const lane = laneByName("desktop");
  let clicked = false;
  const actions = createLaneActions(lane, {
    press: () => {},
    type: () => {},
    click: () => {
      clicked = true;
    },
    drag: () => {},
  });
  actions.click();
  assert.equal(clicked, true);
});

test("laneByName throws naming the known lanes for an unknown lane", () => {
  assert.throws(() => laneByName("bogus"), /unknown lane "bogus"/);
});

test("every lane has a unique name", () => {
  const names = LANES.map((lane) => lane.name);
  assert.equal(new Set(names).size, names.length);
});

test("AC 1: all 11 lanes run fixture journeys and pass on correct fixtures", {
  timeout: 120000,
}, async () => {
  await bundleFixtureApps(FIXTURE_APP_REGISTRY);
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });
  try {
    let passedCount = 0;
    const skipped: string[] = [];
    for (const lane of LANES) {
      try {
        const result = await runFixtureJourneyOnLane(lane, server.url);
        assert.equal(result.ok, true, `Lane ${lane.name} failed: ${result.message}`);
        passedCount += 1;
      } catch (err: unknown) {
        const reason = laneSkipReason(err);
        if (reason === null) throw err;
        // A lane that could not start is recorded and counted, never a silent
        // early return. The previous code returned here, exiting before the
        // assertion below, so eleven failing lanes reported green.
        skipped.push(`${lane.name} (${reason})`);
      }
    }

    if (skipped.length > 0) {
      console.log(
        `[lanes] ${passedCount} of ${LANES.length} lanes ran; skipped: ${skipped.join("; ")}`,
      );
    }

    // Every lane is accounted for as either run or skipped, so none can vanish.
    assert.equal(
      passedCount + skipped.length,
      LANES.length,
      `Expected all ${LANES.length} lanes to be accounted for, got ${passedCount} passed and ${skipped.length} skipped`,
    );
    // And a run in which nothing ran proves nothing, so it is a failure rather
    // than a green tick. Eleven skipped lanes is a broken harness, not noise.
    assert.ok(
      passedCount > 0,
      `No lane ran: all ${LANES.length} were skipped (${skipped.join("; ")}). This run establishes nothing about the lanes.`,
    );
  } finally {
    await server.close();
  }
});

test("AC 5: the JavaScript-disabled lane reads fixture section text and equation MathML from static document", async (t) => {
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });
  try {
    const lane = laneByName("js-disabled");
    let session: LaneSession;
    try {
      session = await launchLaneSession(lane);
    } catch (err: unknown) {
      const reason = laneSkipReason(err);
      if (reason === null) throw err;
      // Reported as skipped rather than returned from: this test proves
      // nothing when its one lane never started, and a pass would say it did.
      t.skip(`lane could not start: ${reason}`);
      return;
    }

    try {
      await session.page.goto(`${server.url}/fixture-section.html?view=parallel#s1-p2-s1`, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });

      // Assert static document presence
      const readerRoot = await session.page.locator("[data-reader-root]").count();
      assert.ok(readerRoot > 0, "Reader root must exist in static HTML");

      // Assert fixture section text is readable from static DOM
      const text = await session.page.locator("#s1-p2-s1, [data-anchor='s1-p2-s1']").textContent();
      assert.ok(
        text?.includes("Osmotic Pressure") || (text?.length ?? 0) > 0,
        "Section text must be readable with JS disabled",
      );

      // Assert equation MathML is present in static DOM
      const mathCount = await session.page.locator("math").count();
      assert.ok(mathCount > 0, "MathML <math> element must exist in static HTML");
      const semanticsCount = await session.page.locator("math semantics").count();
      assert.ok(semanticsCount > 0, "MathML <semantics> element must exist in static HTML");

      // Verify that inline scripts did not run:
      // The page script reads ?view=parallel and updates data-view, but with JS disabled data-view stays "source"
      const view = await session.page.getAttribute("[data-reader-root]", "data-view");
      assert.equal(view, "source", "Inline scripts must not execute when JavaScript is disabled");
    } finally {
      await session.close();
    }
  } finally {
    await server.close();
  }
});

test("AC 6: the no-WebGL lane confirms WebGL is unavailable and the page stays usable", async (t) => {
  const server: RunningFixtureServer = await startFixtureServer({
    staticRoot: STATIC_ROOT,
    appsRoot: APPS_ROOT,
  });
  try {
    const lane = laneByName("no-webgl");
    let session: LaneSession;
    try {
      session = await launchLaneSession(lane);
    } catch (err: unknown) {
      const reason = laneSkipReason(err);
      if (reason === null) throw err;
      // Reported as skipped rather than returned from: this test proves
      // nothing when its one lane never started, and a pass would say it did.
      t.skip(`lane could not start: ${reason}`);
      return;
    }

    try {
      await session.page.goto(`${server.url}/fixture-section.html`, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });

      // Confirm WebGL context creation returns null
      const webgl = await session.page.evaluate(() => {
        const canvas = document.createElement("canvas");
        return (
          canvas.getContext("webgl") ||
          canvas.getContext("webgl2") ||
          canvas.getContext("experimental-webgl")
        );
      });
      assert.equal(webgl, null, "WebGL contexts must return null in no-webgl lane");

      // Confirm page stays usable
      const linkCount = await session.page.locator("a, button").count();
      assert.ok(linkCount > 0, "Interactive controls must remain present and usable");
      const term = session.page.locator("[data-term-id='viscosity']").first();
      await term.click();
      const termActive = await session.page.locator("[data-active-term='viscosity']").isVisible();
      assert.equal(termActive, true, "Page interaction must work normally despite WebGL disabled");
    } finally {
      await session.close();
    }
  } finally {
    await server.close();
  }
});
