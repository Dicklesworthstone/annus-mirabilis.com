/**
 * am-cm-compiler-core-oa7. Real watch-mode behavior against a real, isolated corpus directory
 * this test creates and owns (mkdtemp) -- never against content/ or the shared fixture corpus
 * under src/content/compiler/__fixtures__/corpus, which other tests' golden files depend on.
 */
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { runContentCompileOnce, watchContentCompile } from "../../scripts/build-content.ts";

let tempCorpus: string;

beforeEach(() => {
  tempCorpus = mkdtempSync(join(tmpdir(), "am-content-watch-"));
});

afterEach(() => {
  rmSync(tempCorpus, { recursive: true, force: true });
});

/** Polls until `predicate()` is true or `deadlineMs` elapses. fs.watch delivery is a real
 * filesystem event, not a mock, so its timing is environment-sensitive; every wait in this file
 * polls toward a condition instead of racing one fixed sleep. */
async function waitUntil(predicate: () => boolean, deadlineMs = 5000, pollMs = 50): Promise<void> {
  const deadline = Date.now() + deadlineMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

describe("runContentCompileOnce: the empty corpus compiles with the build green", () => {
  test("an empty corpus directory compiles ok with zero papers and zero foundations", async () => {
    const ok = await runContentCompileOnce(tempCorpus, { shouldEmit: false });
    expect(ok).toBe(true);
  });
});

describe("watchContentCompile: real fs.watch against an isolated temp corpus", () => {
  test("a filesystem change triggers a recompile, reported through onCompile", async () => {
    const results: boolean[] = [];
    const watcher = watchContentCompile(tempCorpus, {
      debounceMs: 20,
      shouldEmit: false,
      onCompile: (ok) => results.push(ok),
    });
    try {
      // Give fs.watch's OS backend a moment to arm before writing (see the note in the
      // debounce test below for why an immediate write can race that arm-up).
      await new Promise((resolve) => setTimeout(resolve, 50));
      // A bare subdirectory matches no content route by itself (routes match files, not
      // directories), so this is a real filesystem change that should still compile clean.
      mkdirSync(join(tempCorpus, "scratch"));
      await waitUntil(() => results.length >= 1);
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every((ok) => ok === true)).toBe(true);
    } finally {
      watcher.close();
    }
  });

  test("rapid successive changes are debounced into fewer recompiles than raw events", async () => {
    const results: boolean[] = [];
    const watcher = watchContentCompile(tempCorpus, {
      debounceMs: 100,
      shouldEmit: false,
      onCompile: (ok) => results.push(ok),
    });
    try {
      // fs.watch's underlying OS backend (FSEvents on macOS) needs a brief moment to arm after
      // watch() returns; firing events immediately can race that arm-up and drop them outright
      // rather than merely delay them, so give it a short settle before writing.
      await new Promise((resolve) => setTimeout(resolve, 50));
      for (let i = 0; i < 5; i++) {
        mkdirSync(join(tempCorpus, `scratch-${i}`));
      }
      await waitUntil(() => results.length >= 1);
      // Five rapid directory creations inside the debounce window must not produce five
      // separate compiles; the exact count depends on OS event coalescing, but it must be
      // strictly fewer than the five raw filesystem events. Settle a little longer to let any
      // queued rerun (scheduled while a compile was already running) land before counting.
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.length).toBeLessThan(5);
    } finally {
      watcher.close();
    }
  });

  test("close() stops further compiles from later filesystem changes", async () => {
    const results: boolean[] = [];
    const watcher = watchContentCompile(tempCorpus, {
      debounceMs: 20,
      shouldEmit: false,
      onCompile: (ok) => results.push(ok),
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    mkdirSync(join(tempCorpus, "before-close"));
    await waitUntil(() => results.length >= 1);
    const countBeforeClose = results.length;
    watcher.close();
    mkdirSync(join(tempCorpus, "after-close"));
    // No waitUntil target here on purpose: we are proving absence, so hold for a fixed window
    // comfortably longer than the debounce and assert the count never moved.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(results.length).toBe(countBeforeClose);
  });
});
