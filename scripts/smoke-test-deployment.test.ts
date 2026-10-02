/**
 * Unit tests for scripts/smoke-test-deployment.ts.
 *
 * Fixed fixtures only; creates and deletes no temporary files (AGENTS.md
 * Rule 1), strictly mocking network fetches and log writes in-memory.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import {
  __resetLogWriterForTesting,
  __setLogWriterForTesting,
  BASE_URL,
  checkReleaseIdentity,
  checkUrl,
  DEFAULT_ROUTES,
  type LogWriter,
  logEvent,
  runSmokeTests,
  toolRunId,
} from "./smoke-test-deployment";

describe("smoke-test-deployment configuration and identities", () => {
  test("BASE_URL defaults to annus-mirabilis.com or matches environment", () => {
    expect(BASE_URL).toMatch(/https:\/\/(www\.)?annus-mirabilis\.com/);
  });

  test("toolRunId is defined and non-empty", () => {
    expect(typeof toolRunId).toBe("string");
    expect(toolRunId.length).toBeGreaterThan(0);
  });
});

describe("smoke-test-deployment logging and runId discipline", () => {
  const loggedEvents: Array<{ step: string; outcome: "pass" | "fail"; message: string }> = [];

  beforeEach(() => {
    loggedEvents.length = 0;
    const testWriter: LogWriter = (step, outcome, message) => {
      loggedEvents.push({ step, outcome, message });
    };
    __setLogWriterForTesting(testWriter);
  });

  afterEach(() => {
    __resetLogWriterForTesting();
    loggedEvents.length = 0;
  });

  test("logEvent dispatches to activeLogWriter without filesystem writes", () => {
    logEvent("test:step", "pass", "all systems operational");
    expect(loggedEvents).toHaveLength(1);
    const [event] = loggedEvents;
    assert.ok(event);
    expect(event).toEqual({
      step: "test:step",
      outcome: "pass",
      message: "all systems operational",
    });
  });

  test("logged events never declare or assign a field literally named runId", () => {
    logEvent("check:/", "pass", "ok");
    const [event] = loggedEvents;
    assert.ok(event);
    const jsonStr = JSON.stringify(event);
    expect(/\brunId\b/.test(jsonStr)).toBe(false);
  });
});

describe("checkUrl route verification logic", () => {
  const loggedEvents: Array<{ step: string; outcome: "pass" | "fail"; message: string }> = [];

  beforeEach(() => {
    loggedEvents.length = 0;
    __setLogWriterForTesting((step, outcome, message) => {
      loggedEvents.push({ step, outcome, message });
    });
  });

  afterEach(() => {
    __resetLogWriterForTesting();
    loggedEvents.length = 0;
  });

  test("returns true for HTTP 200 with content length exceeding threshold", async () => {
    const mockBody = `${"<html>".padEnd(1200, " ")}</html>`;
    const mockFetch: typeof fetch = async () =>
      new Response(mockBody, { status: 200, headers: { "content-type": "text/html" } });

    const ok = await checkUrl("/", "https://annus-mirabilis.com", mockFetch);
    expect(ok).toBe(true);
    expect(loggedEvents).toHaveLength(1);
    const [event] = loggedEvents;
    assert.ok(event);
    expect(event.outcome).toBe("pass");
    expect(event.step).toBe("check:/");
  });

  test("returns true for /robots.txt with content length exceeding 20 bytes", async () => {
    const mockRobots = "User-agent: *\nDisallow: /private\n";
    const mockFetch: typeof fetch = async () =>
      new Response(mockRobots, { status: 200, headers: { "content-type": "text/plain" } });

    const ok = await checkUrl("/robots.txt", "https://annus-mirabilis.com", mockFetch);
    expect(ok).toBe(true);
    expect(loggedEvents).toHaveLength(1);
    const [event] = loggedEvents;
    assert.ok(event);
    expect(event.outcome).toBe("pass");
  });

  test("returns false when response status is non-200 (HTTP 404)", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response("Not Found", { status: 404, headers: { "content-type": "text/plain" } });

    const ok = await checkUrl("/non-existent", "https://annus-mirabilis.com", mockFetch);
    expect(ok).toBe(false);
    expect(loggedEvents).toHaveLength(1);
    const [event] = loggedEvents;
    assert.ok(event);
    expect(event.outcome).toBe("fail");
    expect(event.message).toContain("404");
  });

  test("returns false when content is suspiciously short (< 1000 bytes for HTML)", async () => {
    const shortBody = "<html><body>Too short</body></html>";
    const mockFetch: typeof fetch = async () =>
      new Response(shortBody, { status: 200, headers: { "content-type": "text/html" } });

    const ok = await checkUrl("/", "https://annus-mirabilis.com", mockFetch);
    expect(ok).toBe(false);
    expect(loggedEvents).toHaveLength(1);
    const [event] = loggedEvents;
    assert.ok(event);
    expect(event.outcome).toBe("fail");
    expect(event.message).toContain("suspiciously short content");
  });

  test("returns false on network / fetch rejection", async () => {
    const mockFetch: typeof fetch = async () => {
      throw new Error("Connection refused (ECONNREFUSED)");
    };

    const ok = await checkUrl("/", "https://annus-mirabilis.com", mockFetch);
    expect(ok).toBe(false);
    expect(loggedEvents).toHaveLength(1);
    const [event] = loggedEvents;
    assert.ok(event);
    expect(event.outcome).toBe("fail");
    expect(event.message).toContain("Connection refused");
  });
});

describe("runSmokeTests multi-route execution", () => {
  const loggedEvents: Array<{ step: string; outcome: "pass" | "fail"; message: string }> = [];

  beforeEach(() => {
    loggedEvents.length = 0;
    __setLogWriterForTesting((step, outcome, message) => {
      loggedEvents.push({ step, outcome, message });
    });
  });

  afterEach(() => {
    __resetLogWriterForTesting();
    loggedEvents.length = 0;
  });

  test("returns true and logs summary pass when all routes return 200 OK", async () => {
    const mockBody = `${"<html>".padEnd(1200, " ")}</html>`;
    const mockFetch: typeof fetch = async () =>
      new Response(mockBody, { status: 200, headers: { "content-type": "text/html" } });

    const passed = await runSmokeTests(
      ["/"],
      "https://annus-mirabilis.com",
      mockFetch,
      false, // do not exit process on failure
    );

    expect(passed).toBe(true);
    const summaryEvent = loggedEvents.find((e) => e.step === "summary");
    expect(summaryEvent).toBeDefined();
    expect(summaryEvent?.outcome).toBe("pass");
  });

  test("returns false and logs summary fail when any route fails", async () => {
    const mockFetch: typeof fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.endsWith("/broken")) {
        return new Response("Server Error", { status: 500 });
      }
      return new Response(`${"<html>".padEnd(1200, " ")}</html>`, { status: 200 });
    };

    const passed = await runSmokeTests(
      ["/", "/broken"],
      "https://annus-mirabilis.com",
      mockFetch,
      false, // do not exit process on failure
    );

    expect(passed).toBe(false);
    const summaryEvent = loggedEvents.find((e) => e.step === "summary");
    expect(summaryEvent).toBeDefined();
    expect(summaryEvent?.outcome).toBe("fail");
  });
});

describe("the release identity and the plan's smoke routes (am-rc1001-bridge-plan-pcjk.3)", () => {
  const loggedEvents: Array<{ step: string; outcome: "pass" | "fail"; message: string }> = [];
  const COMMIT = "0123456789abcdef0123456789abcdef01234567";
  const page = `${"<html>".padEnd(1200, " ")}</html>`;

  beforeEach(() => {
    loggedEvents.length = 0;
    __setLogWriterForTesting((step, outcome, message) => {
      loggedEvents.push({ step, outcome, message });
    });
  });

  afterEach(() => {
    __resetLogWriterForTesting();
  });

  const serving = (identity: unknown, identityStatus = 200): typeof fetch =>
    (async (url: RequestInfo | URL) =>
      String(url).endsWith("/release.json")
        ? new Response(JSON.stringify(identity), { status: identityStatus })
        : new Response(page, { status: 200 })) as typeof fetch;

  test("the default routes are the home page and plan §18.3's mass-energy paper and German endpoint", () => {
    expect(DEFAULT_ROUTES).toEqual([
      "/",
      "/papers/mass-energy/",
      "/papers/mass-energy/view/german/",
    ]);
  });

  test("the live build naming the promoted commit passes", async () => {
    expect(
      await checkReleaseIdentity(COMMIT, "https://x.invalid", serving({ commit: COMMIT })),
    ).toBe(true);
  });

  test("an alias still on another build fails, naming both commits", async () => {
    const other = "fedcba9876543210fedcba9876543210fedcba98";
    expect(
      await checkReleaseIdentity(COMMIT, "https://x.invalid", serving({ commit: other })),
    ).toBe(false);
    const event = loggedEvents.find((e) => e.step === "check:release-identity");
    expect(event?.outcome).toBe("fail");
    expect(event?.message).toContain(other);
    expect(event?.message).toContain(COMMIT);
  });

  test("a build with no /release.json fails rather than passing silently", async () => {
    expect(await checkReleaseIdentity(COMMIT, "https://x.invalid", serving({}, 404))).toBe(false);
  });

  test("runSmokeTests applies the identity check when given a commit, and fails the run on a mismatch", async () => {
    const ok = await runSmokeTests(
      DEFAULT_ROUTES,
      "https://x.invalid",
      serving({ commit: COMMIT }),
      false,
      COMMIT,
    );
    expect(ok).toBe(true);
    const bad = await runSmokeTests(
      DEFAULT_ROUTES,
      "https://x.invalid",
      serving({ commit: "nope" }),
      false,
      COMMIT,
    );
    expect(bad).toBe(false);
  });
});
