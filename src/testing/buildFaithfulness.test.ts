import { describe, expect, test } from "bun:test";
import { classifyDirtySources, uncitableReason } from "./buildFaithfulness.ts";

/**
 * These run in the BUN lane. Their only consumer, scripts/e2e/phoneOverflow.e2e.test.ts, runs in
 * the NODE lane, because bunfig ignores `scripts/e2e` and `**\/*.e2e.test.ts`. That separation is
 * deliberate: a gate proved only inside the lane it controls stops being proved at the moment the
 * gate fails open.
 *
 * The numbers below are the real instance, not invented. Build p-5K-kni9NtxcH8hzo0pB ran
 * 06:52:12-06:54:34 on 2026-09-22; a peer saved globals.css and HeldFixedToggle.tsx at 06:53:33,
 * 81 seconds in, and committed neither.
 */
const OUT_MTIME = Date.parse("2026-09-22T06:54:34-04:00");
const SAVED_DURING = Date.parse("2026-09-22T06:53:33-04:00");
const SAVED_AFTER = Date.parse("2026-09-22T06:56:00-04:00");

const GLOBALS = "src/app/globals.css";
const TOGGLE = "src/components/foundations/HeldFixedToggle.tsx";

const mtimes = (m: Record<string, number>) => (p: string) => m[p];

describe("classifyDirtySources", () => {
  test("RED: a file saved DURING the build makes the run uncitable", () => {
    const c = classifyDirtySources(
      [GLOBALS, TOGGLE],
      OUT_MTIME,
      mtimes({
        [GLOBALS]: SAVED_DURING,
        [TOGGLE]: SAVED_DURING,
      }),
    );
    expect(c.citable).toBe(false);
    expect(c.buildMayHaveRead).toEqual([GLOBALS, TOGGLE]);
    expect(c.writtenAfterBuild).toEqual([]);
  });

  /**
   * The negative a naive implementation fails. "Any dirty file means uncitable" is the obvious
   * wrong rule, it would pass every other test in this file, and it would turn the gate red on
   * every peer's in-flight work. The distinction this module exists to draw is WHEN the save
   * landed, so this case must come back citable.
   */
  test("GREEN: a file saved AFTER the build leaves the run citable", () => {
    const c = classifyDirtySources([GLOBALS], OUT_MTIME, mtimes({ [GLOBALS]: SAVED_AFTER }));
    expect(c.citable).toBe(true);
    expect(c.writtenAfterBuild).toEqual([GLOBALS]);
    expect(c.buildMayHaveRead).toEqual([]);
  });

  test("a mixed set is uncitable, and each file lands in the right bucket", () => {
    const c = classifyDirtySources(
      [GLOBALS, TOGGLE],
      OUT_MTIME,
      mtimes({
        [GLOBALS]: SAVED_DURING,
        [TOGGLE]: SAVED_AFTER,
      }),
    );
    expect(c.citable).toBe(false);
    expect(c.buildMayHaveRead).toEqual([GLOBALS]);
    expect(c.writtenAfterBuild).toEqual([TOGGLE]);
  });

  test("the boundary mtime === out/ mtime resolves against citing", () => {
    const c = classifyDirtySources([GLOBALS], OUT_MTIME, mtimes({ [GLOBALS]: OUT_MTIME }));
    expect(c.citable).toBe(false);
  });

  test("an unreadable mtime resolves against citing, not for it", () => {
    const c = classifyDirtySources([GLOBALS], OUT_MTIME, () => undefined);
    expect(c.citable).toBe(false);
    expect(c.buildMayHaveRead).toEqual([GLOBALS]);
  });

  /**
   * Non-vacuity, stated on purpose. A clean tree must come back citable with BOTH buckets empty;
   * asserting only `citable` would pass for an implementation that silently dropped every file.
   */
  test("a clean tree is citable and classifies nothing", () => {
    const c = classifyDirtySources([], OUT_MTIME, () => {
      throw new Error("must not stat anything when the dirty set is empty");
    });
    expect(c.citable).toBe(true);
    expect(c.buildMayHaveRead).toEqual([]);
    expect(c.writtenAfterBuild).toEqual([]);
  });
});

describe("uncitableReason", () => {
  /**
   * The defect this fixes was a COUNT. The gate printed "N uncommitted static source(s)" and the
   * author ran `git status` separately to discover that one of the two was globals.css, which
   * every route loads. So the text must carry the names.
   */
  test("names every offending file rather than counting them", () => {
    const c = classifyDirtySources(
      [GLOBALS, TOGGLE],
      OUT_MTIME,
      mtimes({
        [GLOBALS]: SAVED_DURING,
        [TOGGLE]: SAVED_AFTER,
      }),
    );
    const reason = uncitableReason(c, "p-5K-kni9NtxcH8hzo0pB");
    expect(reason).toContain(GLOBALS);
    expect(reason).toContain(TOGGLE);
    expect(reason).toContain("p-5K-kni9NtxcH8hzo0pB");
    expect(reason).toContain("NOT CITABLE");
    // The benign bucket is labelled as benign, so a reader does not chase the wrong file.
    expect(reason).toContain("not the problem");
  });

  test("omits the after-the-build section entirely when that bucket is empty", () => {
    const c = classifyDirtySources([GLOBALS], OUT_MTIME, mtimes({ [GLOBALS]: SAVED_DURING }));
    expect(uncitableReason(c, "b")).not.toContain("not the problem");
  });
});
