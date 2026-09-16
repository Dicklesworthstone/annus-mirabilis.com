import assert from "node:assert/strict";
import test from "node:test";
import { createLaneActions, LANES, laneByName } from "./lanes.ts";

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
