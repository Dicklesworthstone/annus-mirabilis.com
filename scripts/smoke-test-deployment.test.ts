/**
 * Unit tests for scripts/smoke-test-deployment.ts.
 *
 * Fixed fixtures only; creates and deletes no temporary files (AGENTS.md
 * Rule 1), strictly mocking network fetches and log writes in-memory.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  BASE_URL,
  type LogWriter,
  __resetLogWriterForTesting,
  __setLogWriterForTesting,
  checkUrl,
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
    expect(loggedEvents[0]).toEqual({
      step: "test:step",
      outcome: "pass",
      message: "all systems operational",
    });
  });

  test("logged events never declare or assign a field literally named runId", () => {
    logEvent("check:/", "pass", "ok");
    const jsonStr = JSON.stringify(loggedEvents[0]);
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
    const mockBody = "<html>".padEnd(1200, " ") + "</html>";
    const mockFetch: typeof fetch = async () =>
      new Response(mockBody, { status: 200, headers: { "content-type": "text/html" } });

    const ok = await checkUrl("/", "https://annus-mirabilis.com", mockFetch);
    expect(ok).toBe(true);
    expect(loggedEvents).toHaveLength(1);
    expect(loggedEvents[0].outcome).toBe("pass");
    expect(loggedEvents[0].step).toBe("check:/");
  });

  test("returns true for /robots.txt with content length exceeding 20 bytes", async () => {
    const mockRobots = "User-agent: *\nDisallow: /private\n";
    const mockFetch: typeof fetch = async () =>
      new Response(mockRobots, { status: 200, headers: { "content-type": "text/plain" } });

    const ok = await checkUrl("/robots.txt", "https://annus-mirabilis.com", mockFetch);
    expect(ok).toBe(true);
    expect(loggedEvents).toHaveLength(1);
    expect(loggedEvents[0].outcome).toBe("pass");
  });

  test("returns false when response status is non-200 (HTTP 404)", async () => {
    const mockFetch: typeof fetch = async () =>
      new Response("Not Found", { status: 404, headers: { "content-type": "text/plain" } });

    const ok = await checkUrl("/non-existent", "https://annus-mirabilis.com", mockFetch);
    expect(ok).toBe(false);
    expect(loggedEvents).toHaveLength(1);
    expect(loggedEvents[0].outcome).toBe("fail");
    expect(loggedEvents[0].message).toContain("404");
  });

  test("returns false when content is suspiciously short (< 1000 bytes for HTML)", async () => {
    const shortBody = "<html><body>Too short</body></html>";
    const mockFetch: typeof fetch = async () =>
      new Response(shortBody, { status: 200, headers: { "content-type": "text/html" } });

    const ok = await checkUrl("/", "https://annus-mirabilis.com", mockFetch);
    expect(ok).toBe(false);
    expect(loggedEvents).toHaveLength(1);
    expect(loggedEvents[0].outcome).toBe("fail");
    expect(loggedEvents[0].message).toContain("suspiciously short content");
  });

  test("returns false on network / fetch rejection", async () => {
    const mockFetch: typeof fetch = async () => {
      throw new Error("Connection refused (ECONNREFUSED)");
    };

    const ok = await checkUrl("/", "https://annus-mirabilis.com", mockFetch);
    expect(ok).toBe(false);
    expect(loggedEvents).toHaveLength(1);
    expect(loggedEvents[0].outcome).toBe("fail");
    expect(loggedEvents[0].message).toContain("Connection refused");
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
    const mockBody = "<html>".padEnd(1200, " ") + "</html>";
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
      return new Response("<html>".padEnd(1200, " ") + "</html>", { status: 200 });
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
