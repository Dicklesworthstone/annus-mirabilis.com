/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Source path: scripts/smoke-test-deployment.ts
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 *
 * Modifications:
 * - Removed the "Curated Sample of Historic Patent Routes" check and its
 *   ten hard-coded patent ids; targets only the home page until paper
 *   content ships, per this bead's scope table.
 * - Removed "/about", "/timeline", "/robots.txt", "/sitemap.xml" from the
 *   checked routes; none of those routes exist in this repository yet
 *   (robots/sitemap are am-scaf-extract-ui-components-c31's extraction, and
 *   there is no "/about" or "/timeline" route planned by that name here).
 * - Default `BASE_URL` changed from the donor's own production hostname to
 *   this project's own annus-mirabilis.com.
 * - Added structured JSONL logging under a `<tool-run-id>` artifact
 *   directory (AGENTS.md "Structured logs": a smoke test is a tool run, and
 *   its events carry `toolRunId`, never `runId`).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { newToolRunId } from "./runIds";

const BASE_URL = process.env.BASE_URL || "https://annus-mirabilis.com";

const toolRunId = newToolRunId();
const artifactDirectory = path.join(process.cwd(), "artifacts", "smoke-test-deployment", toolRunId);
const logPath = path.join(artifactDirectory, "events.jsonl");

function logEvent(step: string, outcome: "pass" | "fail", message: string): void {
  fs.mkdirSync(artifactDirectory, { recursive: true });
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    suite: "smoke-test-deployment",
    toolRunId,
    step,
    outcome,
    message,
  });
  fs.appendFileSync(logPath, `${line}\n`, "utf8");
}

async function checkUrl(routePath: string): Promise<boolean> {
  const url = `${BASE_URL}${routePath}`;
  try {
    const res = await fetch(url, { method: "GET" });
    if (res.status !== 200) {
      const message = `${url} returned HTTP ${res.status}`;
      console.error(`❌ FAILED: ${message}`);
      logEvent(`check:${routePath}`, "fail", message);
      return false;
    }
    const html = await res.text();
    const minLength = routePath === "/robots.txt" ? 20 : 1000;
    if (!html || html.length < minLength) {
      const message = `${url} returned suspiciously short content (${html.length} bytes)`;
      console.error(`❌ FAILED: ${message}`);
      logEvent(`check:${routePath}`, "fail", message);
      return false;
    }
    const message = `${routePath} (HTTP 200, ${(html.length / 1024).toFixed(1)} KB)`;
    console.log(`✓ OK: ${message}`);
    logEvent(`check:${routePath}`, "pass", message);
    return true;
  } catch (err: any) {
    const message = `${url} - ${err.message}`;
    console.error(`❌ NETWORK ERROR: ${message}`);
    logEvent(`check:${routePath}`, "fail", message);
    return false;
  }
}

async function runSmokeTests() {
  console.log("=== Annus Mirabilis Production Smoke Test Gate ===");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Tool run: ${toolRunId}\n`);

  let allPassed = true;

  // Core top-level routes. Grows as content ships; the home page is the only
  // route guaranteed to exist until then.
  const coreRoutes = ["/"];
  for (const route of coreRoutes) {
    const ok = await checkUrl(route);
    if (!ok) allPassed = false;
  }

  if (!allPassed) {
    console.error("\n🚨 PRODUCTION SMOKE TEST FAILED! One or more routes did not return HTTP 200.");
    logEvent("summary", "fail", "one or more routes did not return HTTP 200");
    process.exit(1);
  }

  console.log("\n🎉 ALL PRODUCTION ROUTES VERIFIED HEALTHY (HTTP 200 OK across all tested routes)");
  logEvent("summary", "pass", "all tested routes returned HTTP 200");
}

runSmokeTests().catch((err) => {
  console.error("Fatal smoke test error:", err);
  logEvent("summary", "fail", `fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
