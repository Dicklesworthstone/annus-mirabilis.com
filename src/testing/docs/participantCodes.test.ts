import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";
import {
  formatParticipantCode,
  parseParticipantCode,
  VALID_PAPERS,
  VALID_ROUTES,
} from "./participantCodes.ts";

describe("participantCodes parser and formatter", () => {
  it("brownian-motion-nonvisual-20270412-03 parses correctly", () => {
    const res = parseParticipantCode("brownian-motion-nonvisual-20270412-03");
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.paper, "brownian-motion");
      assert.equal(res.route, "nonvisual");
      assert.equal(res.date, "2027-04-12");
      assert.equal(res.index, 3);
    }
  });

  it("brownian-motion-full-derivation-20270412-01 parses correctly (hyphenated route + hyphenated paper)", () => {
    const res = parseParticipantCode("brownian-motion-full-derivation-20270412-01");
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.paper, "brownian-motion");
      assert.equal(res.route, "full-derivation");
      assert.equal(res.date, "2027-04-12");
      assert.equal(res.index, 1);
    }
  });

  it("brownian-motion-slice-low-cost-phone-20270412-11 parses to slice paper and low-cost-phone route", () => {
    const res = parseParticipantCode("brownian-motion-slice-low-cost-phone-20270412-11");
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.paper, "brownian-motion-slice");
      assert.equal(res.route, "low-cost-phone");
      assert.equal(res.date, "2027-04-12");
      assert.equal(res.index, 11);
    }
  });

  it("mass-energy-no-algebra-20270412-7 fails because index is not two digits", () => {
    const res = parseParticipantCode("mass-energy-no-algebra-20270412-7");
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.error, /two digits/i);
    }
  });

  it("brownian-motion-nonvisual-2027-04-12-3 fails on hyphenated date form naming expected form", () => {
    const res = parseParticipantCode("brownian-motion-nonvisual-2027-04-12-3");
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.error, /YYYYMMDD/);
    }
  });

  it("unknown route brownian-motion-skimming-20270412-03 fails naming the closed list", () => {
    const res = parseParticipantCode("brownian-motion-skimming-20270412-03");
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.error, /Unknown route/);
      for (const route of VALID_ROUTES) {
        assert.ok(res.error.includes(route), `error should name route ${route}`);
      }
    }
  });

  it("unknown paper browian-motion-nonvisual-20270412-03 fails naming the closed list", () => {
    const res = parseParticipantCode("browian-motion-nonvisual-20270412-03");
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.error, /Unknown paper/);
      for (const paper of VALID_PAPERS) {
        assert.ok(res.error.includes(paper), `error should name paper ${paper}`);
      }
    }
  });

  it("impossible calendar date 20270230 fails", () => {
    const res = parseParticipantCode("brownian-motion-nonvisual-20270230-03");
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.error, /Impossible calendar date/);
    }
  });

  it("formatParticipantCode(parseParticipantCode(code)) returns original string for valid fixtures", () => {
    const validFixtures = [
      "brownian-motion-nonvisual-20270412-03",
      "brownian-motion-full-derivation-20270412-01",
      "brownian-motion-slice-low-cost-phone-20270412-11",
      "light-quanta-no-algebra-20260916-01",
      "special-relativity-full-derivation-20270101-99",
      "mass-energy-no-algebra-20271231-05",
      "molecular-dimensions-low-cost-phone-20270615-42",
    ];

    for (const fixture of validFixtures) {
      const parsed = parseParticipantCode(fixture);
      assert.equal(parsed.ok, true, `fixture ${fixture} should parse`);
      const formatted = formatParticipantCode(parsed);
      assert.equal(formatted, fixture);
    }
  });

  it("static scan confirms parseParticipantCode is the only participant-code regex parser in the repository", () => {
    const rootDir = process.cwd();
    const scannedDirs = ["src", "scripts"];
    const suspiciousRegexPatterns = [
      /\/(?:[^\/\n\\]|\\.)*(?:no-algebra|nonvisual|full-derivation|low-cost-phone)(?:[^\/\n\\]|\\.)*\\d\{8\}(?:[^\/\n\\]|\\.)*\//,
      /RegExp\([^)]*(?:no-algebra|nonvisual|full-derivation|low-cost-phone)[^)]*8[^)]*\)/,
    ];

    function walkDir(dir: string): string[] {
      const files: string[] = [];
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...walkDir(fullPath));
        } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const allFiles = scannedDirs.flatMap((d) => walkDir(join(rootDir, d)));
    const thisFilePath = join(rootDir, "src/testing/docs/participantCodes.ts");
    const testFilePath = join(rootDir, "src/testing/docs/participantCodes.test.ts");

    for (const filePath of allFiles) {
      if (filePath === thisFilePath || filePath === testFilePath) continue;
      const content = readFileSync(filePath, "utf8");
      for (const pattern of suspiciousRegexPatterns) {
        assert.equal(
          pattern.test(content),
          false,
          `File ${relative(rootDir, filePath)} contains parallel regex matching participant codes: ${pattern}`,
        );
      }
    }
  });
});
