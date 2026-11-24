import { afterEach, beforeAll, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { createBrownianLabSession } from "../../reader/brownianLabSession.ts";
import {
  type Bm01ReplayFixture,
  bm01Laboratory,
  bm01ReplayFixture,
} from "../../testing/bm01ReplayHarness.ts";

describe("one Brownian owner across the reader's responsive laboratory views", () => {
  let fixture: Bm01ReplayFixture;
  const cleanup: (() => void)[] = [];
  beforeAll(async () => {
    fixture = await bm01ReplayFixture();
  });
  afterEach(() => {
    for (const dispose of cleanup.splice(0)) dispose();
  });

  function laboratory(hold = false) {
    const lab = bm01Laboratory(fixture, { hold: () => hold });
    const shared = createBrownianLabSession(lab.session, fixture.example);
    cleanup.push(() => shared.dispose());
    return { lab, shared };
  }

  async function until(check: () => boolean) {
    for (let attempt = 0; attempt < 200 && !check(); attempt++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    expect(check()).toBe(true);
  }

  test("hidden slots cannot pause a visible slot; the final hidden slot pauses dispatch", () => {
    const { lab, shared } = laboratory();
    const column = shared.view("column");
    const sheet = shared.view("sheet");
    const inline = shared.view("inline");
    expect(shared.view("column")).toBe(column);
    expect(column.getSnapshot()).toBe(lab.session.getSnapshot());
    expect(sheet.getServerSnapshot()).toBe(lab.session.getServerSnapshot());

    column.setSchedulingPaused(false);
    sheet.setSchedulingPaused(true);
    inline.setSchedulingPaused(true);
    expect(lab.session.getSchedulingPaused()).toBe(false);
    column.setSchedulingPaused(true);
    expect(lab.session.getSchedulingPaused()).toBe(true);
    sheet.setSchedulingPaused(false);
    expect(lab.session.getSchedulingPaused()).toBe(false);
    inline.setSchedulingPaused(false);
    sheet.disconnect();
    expect(lab.session.getSchedulingPaused()).toBe(false);
    inline.disconnect();
    expect(lab.session.getSchedulingPaused()).toBe(true);
    expect(lab.channels).toHaveLength(0);
  });

  test("an effect cleanup can reconnect the same facade without losing its accepted trial", () => {
    const { lab, shared } = laboratory();
    const view = shared.view("strict-mode-column");
    const accepted = lab.session.getSnapshot().accepted;
    view.setSchedulingPaused(false);
    view.disconnect();
    view.disconnect();
    expect(lab.session.getSchedulingPaused()).toBe(true);
    view.setSchedulingPaused(false);
    expect(lab.session.getSchedulingPaused()).toBe(false);
    expect(view.getSnapshot().accepted).toBe(accepted);
    expect(view.acceptedParameters()).toBe(lab.session.acceptedParameters());
    expect(lab.channels).toHaveLength(0);
  });

  test("both views publish the same real result and closing one cannot dispose the other's worker", async () => {
    const { lab, shared } = laboratory(true);
    const column = shared.view("column");
    const inline = shared.view("inline");
    column.setSchedulingPaused(false);
    inline.setSchedulingPaused(false);
    const baseline = column.getSnapshot().accepted;
    assert.ok(baseline);
    expect(column.apply({ ...column.acceptedParameters(), a: 1e-6 }).kind).toBe("accepted");
    await until(() => (lab.channels[0]?.results.length ?? 0) > 0);
    expect(column.getSnapshot()).toBe(inline.getSnapshot());
    expect(inline.getSnapshot().accepted).toBe(baseline);
    expect(inline.getSnapshot().pending).toBe(true);

    column.disconnect();
    expect(lab.channels[0]?.disposed).toBe(false);
    expect(lab.session.getSchedulingPaused()).toBe(false);
    lab.channels[0]?.release();
    await until(() => !inline.getSnapshot().pending);
    const accepted = inline.getSnapshot().accepted;
    assert.ok(accepted);
    expect(accepted).not.toBe(baseline);
    expect(accepted.instanceId).toBe(baseline.instanceId);
    expect(accepted.parameters.a).toBe(1e-6);
    expect(column.getSnapshot().accepted).toBe(accepted);
    expect(lab.channels).toHaveLength(1);

    shared.dispose();
    shared.dispose();
    expect(lab.channels[0]?.disposed).toBe(true);
  }, 20_000);
});
