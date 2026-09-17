/**
 * Third-Party Request and Donor Identity Scan (am-scaf-extract-ui-components-c31).
 *
 * Invariant:
 * 1. ZERO third-party requests: No external scripts (<script src>), external stylesheets
 *    (<link rel="stylesheet" href> or @import url), remote fetches (fetch("https://...")),
 *    remote font loaders (next/font/google), or analytics packages.
 * 2. Plain anchor hyperlinks (<a href="https://...">) are not requests and are permitted.
 * 3. No forbidden donor identity string appears outside of attribution comment headers.
 */

import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { appendUiExtractionLog, newUiExtractionLogRunId } from "./uiExtractionLogging.ts";

export const FORBIDDEN_DONOR_IDENTITIES = [
  "classic-patents.com",
  "www.classic-patents.com",
  "classic-patents.vercel.app",
  "prj_eeVw8BqcY9iO2e0VEQyS5i6rZkE0",
  "classic-patents",
  "team_F5Q3EH8Qxu3nDEOyEZLcQPe6",
  "45_267",
  "45267",
  "/patents/us-821393-wright-flyer",
  "/patents/us-4063220-metcalfe-ethernet",
  "/patents/",
  "https://github.com/Dicklesworthstone/classic-patents.com",
  "https://github.com/Dicklesworthstone",
  "https://schema.org",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "patents.google.com",
  "https://patents.google.com",
  "https://openapi.vercel.sh",
  "https://solidmechanics.org",
] as const;

export interface ScanViolation {
  readonly path: string;
  readonly line: number;
  readonly rule: string;
  readonly excerpt: string;
  readonly origin?: string | undefined;
}

export function scanSourceText(filePath: string, content: string): ScanViolation[] {
  const violations: ScanViolation[] = [];

  // Strip leading attribution header comment block: /** ... */
  let body = content;
  const headerMatch = content.match(/^\s*\/\*\*[\s\S]*?\*\//);
  const headerOffsetLines = headerMatch ? (headerMatch[0]?.split("\n").length ?? 1) - 1 : 0;
  if (headerMatch) {
    body = content.slice(headerMatch[0]?.length ?? 0);
  }

  const lines = body.split("\n");
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx] ?? "";
    const lineNum = idx + 1 + headerOffsetLines;

    // 1. Check for request-initiating references
    // a. External script tag
    const scriptMatch = line.match(/<script\b[^>]*\bsrc\s*=\s*["'](https?:\/\/[^"']+)["']/i);
    if (scriptMatch) {
      violations.push({
        path: filePath,
        line: lineNum,
        rule: "external-script",
        origin: scriptMatch[1] ?? "",
        excerpt: line.trim(),
      });
    }

    // b. External stylesheet link tag
    const linkMatch =
      line.match(
        /<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*\bhref\s*=\s*["'](https?:\/\/[^"']+)["']/i,
      ) ||
      line.match(
        /<link\b[^>]*\bhref\s*=\s*["'](https?:\/\/[^"']+)["'][^>]*\brel\s*=\s*["']stylesheet["']/i,
      );
    if (linkMatch) {
      violations.push({
        path: filePath,
        line: lineNum,
        rule: "external-stylesheet",
        origin: linkMatch[1] ?? "",
        excerpt: line.trim(),
      });
    }

    // c. Remote CSS @import
    const importMatch = line.match(/@import\s+(?:url\()?["']?(https?:\/\/[^"')\s]+)/i);
    if (importMatch) {
      violations.push({
        path: filePath,
        line: lineNum,
        rule: "remote-css-import",
        origin: importMatch[1] ?? "",
        excerpt: line.trim(),
      });
    }

    // d. Remote font loader
    if (/from\s+["']next\/font\/google["']/.test(line)) {
      violations.push({
        path: filePath,
        line: lineNum,
        rule: "remote-font-loader",
        origin: "next/font/google",
        excerpt: line.trim(),
      });
    }

    // e. Analytics package import
    if (/from\s+["'](?:@vercel\/analytics|posthog-js|mixpanel-browser)["']/.test(line)) {
      violations.push({
        path: filePath,
        line: lineNum,
        rule: "analytics-package",
        excerpt: line.trim(),
      });
    }

    // f. Remote fetch with absolute external URL
    const fetchMatch = line.match(/fetch\(\s*["'](https?:\/\/[^"']+)["']/i);
    if (fetchMatch) {
      violations.push({
        path: filePath,
        line: lineNum,
        rule: "remote-fetch",
        origin: fetchMatch[1] ?? "",
        excerpt: line.trim(),
      });
    }

    // 2. Check for forbidden donor identity strings outside attribution header
    for (const forbidden of FORBIDDEN_DONOR_IDENTITIES) {
      if (forbidden === "45267" || forbidden === "45_267") {
        const portRegex = new RegExp(`\\b${forbidden}\\b`);
        if (portRegex.test(line)) {
          violations.push({
            path: filePath,
            line: lineNum,
            rule: `forbidden-donor-identity: ${forbidden}`,
            excerpt: line.trim(),
          });
        }
      } else if (forbidden === "https://github.com/Dicklesworthstone") {
        // Allowed if part of the Annus Mirabilis repository link: https://github.com/Dicklesworthstone/annus-mirabilis.com
        const lineWithoutProjectRepo = line.replaceAll(
          "https://github.com/Dicklesworthstone/annus-mirabilis.com",
          "",
        );
        if (lineWithoutProjectRepo.includes("https://github.com/Dicklesworthstone")) {
          violations.push({
            path: filePath,
            line: lineNum,
            rule: `forbidden-donor-identity: ${forbidden}`,
            excerpt: line.trim(),
          });
        }
      } else if (forbidden === "https://schema.org") {
        // Exempt in machine-readable content export schemas (src/content/exports/),
        // forbidden in layout/chrome or client presentation components.
        if (!filePath.includes("src/content/exports/") && line.includes(forbidden)) {
          violations.push({
            path: filePath,
            line: lineNum,
            rule: `forbidden-donor-identity: ${forbidden}`,
            excerpt: line.trim(),
          });
        }
      } else if (line.includes(forbidden)) {
        violations.push({
          path: filePath,
          line: lineNum,
          rule: `forbidden-donor-identity: ${forbidden}`,
          excerpt: line.trim(),
        });
      }
    }
  }

  return violations;
}

function findScannableFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry === "node_modules" || entry === ".next" || entry === "artifacts") continue;
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        files.push(...findScannableFiles(fullPath));
      } else if (/\.(ts|tsx|js|mjs|jsx|html|css)$/.test(entry)) {
        // Exclude the hygiene test files themselves from scanning their own fixture strings.
        // src/platform/offline/chapter.test.mjs joins them for the same reason: its
        // "styles cannot load external resources or escape their element" case feeds
        // '@import "https://example.org/x.css";', "a{background:url(/remote.png)}" and
        // "</style><script>bad()</script>" to build() and asserts each one THROWS. The
        // forbidden strings are the planted negatives that prove the offline builder
        // rejects remote assets; scanning them would flag the guard's own proof.
        if (
          !fullPath.endsWith("thirdPartyRequests.test.ts") &&
          !fullPath.endsWith("extractionHygiene.test.ts") &&
          !fullPath.endsWith("src/platform/offline/chapter.test.mjs")
        ) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // Directory not found
  }
  return files;
}

describe("Third-Party Request & Forbidden Identity Scan", () => {
  const logRunId = newUiExtractionLogRunId();

  it("passes scan on all src/ and public/ source files", () => {
    const startTime = performance.now();
    const scannable = [
      ...findScannableFiles(join(process.cwd(), "src")),
      ...findScannableFiles(join(process.cwd(), "public")),
    ];

    const allViolations: ScanViolation[] = [];
    for (const file of scannable) {
      const content = readFileSync(file, "utf8");
      const violations = scanSourceText(file, content);
      allViolations.push(...violations);
    }

    const durationMs = Math.round(performance.now() - startTime);

    if (allViolations.length > 0) {
      for (const v of allViolations) {
        appendUiExtractionLog({
          logRunId,
          testId: "third-party-requests-scan",
          outcome: "fail",
          durationMs,
          message: `Violation: ${v.rule} at ${v.path}:${v.line}`,
          path: v.path,
          line: v.line,
          origin: v.origin,
        });
      }
      throw new Error(
        `Third-party request scan failed with ${allViolations.length} violations:\n` +
          allViolations.map((v) => `  ${v.path}:${v.line} [${v.rule}] -> ${v.excerpt}`).join("\n"),
      );
    }

    appendUiExtractionLog({
      logRunId,
      testId: "third-party-requests-scan",
      outcome: "pass",
      durationMs,
      message: `Scanned ${scannable.length} files cleanly with 0 violations.`,
    });

    expect(allViolations).toHaveLength(0);
  });

  it("planted negative test: detects external analytics script tag", () => {
    const fixture = `<script src="https://analytics.example.com/tracker.js" async></script>`;
    const violations = scanSourceText("test-fixture.html", fixture);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0]?.rule).toBe("external-script");
    expect(violations[0]?.origin).toBe("https://analytics.example.com/tracker.js");
  });

  it("planted negative test: detects remote CSS @import", () => {
    const fixture = `@import url("https://fonts.googleapis.com/css?family=Roboto");`;
    const violations = scanSourceText("test-fixture.css", fixture);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations.some((v) => v.rule === "remote-css-import")).toBe(true);
  });

  it("planted negative test: detects remote font loader from next/font/google", () => {
    const fixture = `import { Newsreader } from "next/font/google";`;
    const violations = scanSourceText("test-fixture.ts", fixture);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0]?.rule).toBe("remote-font-loader");
  });

  it("planted negative test: detects forbidden donor identity outside attribution header", () => {
    const fixture = `const url = "https://classic-patents.com/about";`;
    const violations = scanSourceText("test-fixture.ts", fixture);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations.some((v) => v.rule.includes("forbidden-donor-identity"))).toBe(true);
  });

  it("passes for plain hyperlinks (<a href>) and valid attribution headers", () => {
    const fixtureWithAnchor = `
      <a href="https://github.com/example/repo" target="_blank" rel="noopener noreferrer">
        Source Code
      </a>
    `;
    const violationsAnchor = scanSourceText("test-fixture.tsx", fixtureWithAnchor);
    expect(violationsAnchor).toHaveLength(0);

    const fixtureWithAttribution = `/**
 * Extracted from classic-patents.com
 * Source repository: https://github.com/Dicklesworthstone/classic-patents.com
 * Pinned commit: da11ff475902728fd8dd1d9db9f3af37c16ec8a5
 * License: MIT License (with OpenAI/Anthropic Rider)
 * Preserved license text: /LICENSE
 */

export const localConstant = 42;
`;
    const violationsAttribution = scanSourceText("test-fixture.ts", fixtureWithAttribution);
    expect(violationsAttribution).toHaveLength(0);
  });
});
