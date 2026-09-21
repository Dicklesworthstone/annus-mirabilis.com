import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { runAlignEditions } from "../../../scripts/align-editions.ts";
import { coverageReportIsHonest } from "../../content/editions/coverageReport.ts";
import { inspectLedgerPresence } from "../../content/editions/ledgerPresence.ts";
import {
  registerReviewStateCheck,
  resetReviewStateCheck,
} from "../../content/editions/reviewState.ts";
import type { RouteSlug } from "../../content/ids.ts";
import { PAPER_SLUGS } from "../../content/schemas/source.pure.ts";

/**
 * A paper with no ledger, DERIVED rather than named.
 *
 * Three tests here used "brownian-motion" as their absent-ledger example. It gained
 * public/papers/transcripts/ap-17-549-reviewed.txt on 2026-09-21 and they broke - a fixture keyed
 * on a specific id standing in for a property, which is the same substitution this repository keeps
 * finding in gates. The property is what the tests want, so the property is what they ask for.
 */
function aLedgerlessPaper(): RouteSlug {
  const found = PAPER_SLUGS.find((slug) => inspectLedgerPresence(slug).presence === "absent");
  if (!found) {
    // Not a pass. If every paper has a ledger, these tests have no subject and must say so.
    throw new Error(
      "No paper lacks a ledger, so the absent-ledger tests below have nothing to exercise. Rewrite them against a fixture root rather than deleting them.",
    );
  }
  return found;
}

describe("scripts/align-editions.ts runner and CLI guards", () => {
  test("a paper with no ledger reports not-available, not a pass, and still exits 0", () => {
    // This was named "happy path: absent ledger paper validates with exit code 0" and asserted
    // ok === true. THAT WAS THE DRIFT. With no ledger there is nothing to align, so there are no
    // issues and ok is true - the runner reported success about a paper it could not judge, while
    // editionContract.ts reported not-available for the same paper and the report JSON this runner
    // writes said "No ledger present. This is not completeness." Three layers, one fact, two truths.
    const result = runAlignEditions({ slug: aLedgerlessPaper() });
    expect(result.outcome).toBe("not-available");
    expect(result.issues).toHaveLength(0);
    // the exit code is unchanged: an absent ledger is a known state here, not a failure
    expect(result.exitCode).toBe(0);
    // and a paper WITH a ledger is judged rather than excused, so not-available is not universal
    const withLedger = PAPER_SLUGS.find(
      (slug) => inspectLedgerPresence(slug).presence === "present",
    );
    if (withLedger)
      expect(runAlignEditions({ slug: withLedger }).outcome).not.toBe("not-available");
  });

  test("PLANTED: --require-reviewed refuses with unit-not-reviewed when no reviewed units exist", () => {
    const result = runAlignEditions({
      slug: "brownian-motion",
      requireReviewed: true,
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    const issue = result.issues.find((i) => i.code === "unit-not-reviewed");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("--require-reviewed specified, but no reviewed units exist");
  });

  test("PLANTED: --require-reviewed refuses unreviewed unit state with unit-not-reviewed", () => {
    const result = runAlignEditions({
      slug: "brownian-motion",
      requireReviewed: true,
      reviewUnits: [
        {
          id: "s1-p1-s1",
          reviewState: "drafted",
          translator: { id: "alice", kind: "human" },
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    const issue = result.issues.find((i) => i.code === "unit-not-reviewed");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain('is in state "drafted", required "reviewed"');
  });

  test("PLANTED: unit with reviewed state under default registration refuses review-records-not-available", () => {
    resetReviewStateCheck();
    const result = runAlignEditions({
      slug: "brownian-motion",
      requireReviewed: true,
      reviewUnits: [
        {
          id: "s1-p1-s1",
          reviewState: "reviewed",
          translator: { id: "alice", kind: "human" },
          editor: { id: "bob", kind: "human" },
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    const issue = result.issues.find((i) => i.code === "review-records-not-available");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("Review records are not available");
  });

  test("a registered review check accepting reviewed units passes when --require-reviewed is set", () => {
    registerReviewStateCheck((req) => {
      if (req.unitId === "s1-p1-s1") return { ok: true };
      return { ok: false, code: "review-records-not-available", message: "denied" };
    });
    const result = runAlignEditions({
      slug: aLedgerlessPaper(),
      requireReviewed: true,
      reviewUnits: [
        {
          id: "s1-p1-s1",
          reviewState: "reviewed",
          translator: { id: "alice", kind: "human" },
          editor: { id: "bob", kind: "human" },
        },
      ],
    });
    resetReviewStateCheck();
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.issues).toHaveLength(0);
  });

  test("alignment issues propagate into result issues and exitCode 1", () => {
    const result = runAlignEditions({
      slug: "brownian-motion",
      germanIds: ["s1-p1-s1"],
      englishIds: ["s1-p1-s1"],
      edges: [], // empty alignment edge list with alignables present
    });
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.issues.some((i) => i.code === "empty-alignment")).toBe(true);
  });

  test("section filtering isolates validation to in-scope section prefixes", () => {
    const result = runAlignEditions({
      slug: "brownian-motion",
      sections: ["s4"],
      germanIds: ["s4-p1-s1", "s5-p1-s1"],
      englishIds: ["s4-p1-s1", "s5-p1-s1"],
      edges: [{ sourceId: "s4-p1-s1", targetId: "s4-p1-s1" }], // only s4 aligned; s5 not aligned
    });
    // With sections: ["s4"], s5 is filtered out, so s4 has complete coverage!
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.issues).toHaveLength(0);
  });

  test("--report writes honest coverage JSON and Markdown files to artifacts", () => {
    const result = runAlignEditions({
      slug: aLedgerlessPaper(),
      report: true,
    });
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.reportFiles).toBeDefined();
    expect(result.toolRunId).toBeDefined();

    const jsonPath = result.reportFiles?.json ?? "";
    const mdPath = result.reportFiles?.markdown ?? "";
    expect(existsSync(jsonPath)).toBe(true);
    expect(existsSync(mdPath)).toBe(true);

    const md = readFileSync(mdPath, "utf8");
    const json = readFileSync(jsonPath, "utf8");

    expect(coverageReportIsHonest(md, json)).toBe(true);
    expect(md.includes("%")).toBe(false);
    expect(json).not.toMatch(/"score"/i);
    expect(json).not.toMatch(/"percent"/i);

    // THE CLAIM IN THE NAME. Everything above is a NEGATIVE: no percent sign, no score key, no
    // percent key. A report over an empty collection satisfies every one of them and this test
    // would pass having written a file with nothing in it - the pass-on-an-empty-set shape, in a
    // test whose name asserts honesty. So the report is also required to contain something.
    const parsed = JSON.parse(json) as { layers?: readonly { layer: string; note?: string }[] };
    expect(parsed.layers?.length ?? 0).toBeGreaterThan(0);
    const ledgerLayer = parsed.layers?.find((l) => l.layer === "ledger");
    expect(ledgerLayer).toBeDefined();
    // and for the ledgerless paper this test runs on, the layer SAYS SO rather than reporting zero
    expect(ledgerLayer?.note).toContain("not completeness");
    expect(md.trim().length).toBeGreaterThan(0);
  });
});

describe("scripts/align-editions.ts CLI process execution", () => {
  test("CLI happy path exits 0 with JSON output", () => {
    const proc = spawnSync(
      process.execPath,
      ["scripts/align-editions.ts", "--paper", "brownian-motion"],
      {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      },
    );
    if (proc.error && (proc.error as any).code === "EBADF") return;
    expect(proc.status).toBe(0);
    const parsed = JSON.parse(proc.stdout);
    expect(parsed.ok).toBe(true);
    expect(parsed.slug).toBe("brownian-motion");
  });

  test("CLI --require-reviewed exits 1 when unreviewed", () => {
    const proc = spawnSync(
      process.execPath,
      ["scripts/align-editions.ts", "--paper", "brownian-motion", "--require-reviewed"],
      { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
    );
    if (proc.error && (proc.error as any).code === "EBADF") return;
    expect(proc.status).toBe(1);
    const parsed = JSON.parse(proc.stdout);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues.some((i: any) => i.code === "unit-not-reviewed")).toBe(true);
  });

  test("CLI invalid paper slug exits 2", () => {
    const proc = spawnSync(
      process.execPath,
      ["scripts/align-editions.ts", "--paper", "unknown-paper"],
      {
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
      },
    );
    if (proc.error && (proc.error as any).code === "EBADF") return;
    expect(proc.status).toBe(2);
  });

  test("CLI --report writes files and exits 0", () => {
    const proc = spawnSync(
      process.execPath,
      ["scripts/align-editions.ts", "--paper", "brownian-motion", "--report"],
      { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
    );
    if (proc.error && (proc.error as any).code === "EBADF") return;
    expect(proc.status).toBe(0);
    const parsed = JSON.parse(proc.stdout);
    expect(parsed.reportFiles).toBeDefined();
    expect(existsSync(parsed.reportFiles.json)).toBe(true);
    expect(existsSync(parsed.reportFiles.markdown)).toBe(true);
  });
});
