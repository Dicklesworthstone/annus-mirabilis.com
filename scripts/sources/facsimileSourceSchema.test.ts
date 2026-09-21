import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { validateConfig, validateFacsimileAnchor } from "./facsimileSourceSchema.ts";

/**
 * am-muyh. Seven refusal sites in this module were credited to nobody. Five of them return
 * `invalid-config`, which is the code they all share, so naming the code proves only that SOME
 * refusal fired. Each test below therefore asserts the code AND the sentence that distinguishes
 * that site from the other four - the discriminating question being whether the test would still
 * pass with the refusal deleted. With the message asserted, it would not.
 *
 * Every negative here is ONE FIELD away from the control above it, so a refusal that fired for a
 * different reason fails the message assertion rather than quietly satisfying the test.
 */

/** A verified anchor that passes, so each negative below differs from it in exactly one place. */
const ANCHOR_OK = {
  key: "ap-99-001",
  verifiedAnchor: { parentPageIndex: 12, printedPage: 549, verifiedBy: "jemanuel" },
  articlePages: { printedFirst: 549, printedLast: 550, parentPageIndices: [12, 13] },
};

function anchorRefusal(config: unknown): { code: string; errors: readonly string[] } {
  const result = validateFacsimileAnchor(config);
  return { code: result.refusalCode ?? "no-refusal", errors: result.errors ?? [] };
}

describe("validateFacsimileAnchor refuses each malformed anchor for its own reason", () => {
  test("THE CONTROL: the well-formed anchor is accepted, so the negatives are not vacuous", () => {
    const result = validateFacsimileAnchor(ANCHOR_OK);
    expect(result.valid).toBe(true);
    expect(result.refusalCode).toBeUndefined();
  });

  test("a non-integer printedPage is refused, naming printedPage (line 528)", () => {
    const { code, errors } = anchorRefusal({
      ...ANCHOR_OK,
      verifiedAnchor: { ...ANCHOR_OK.verifiedAnchor, printedPage: 549.5 },
    });
    expect(code).toBe("invalid-config");
    expect(errors.join(" ")).toContain("verifiedAnchor.printedPage must be a positive integer");
    expect(errors.join(" ")).toContain("549.5");
  });

  test("an unnamed verifier is refused, naming verifiedBy (line 536)", () => {
    const { code, errors } = anchorRefusal({
      ...ANCHOR_OK,
      verifiedAnchor: { ...ANCHOR_OK.verifiedAnchor, verifiedBy: "   " },
    });
    expect(code).toBe("invalid-config");
    expect(errors.join(" ")).toContain("verifiedAnchor.verifiedBy must be a non-empty string");
  });

  test("a config with an anchor but no articlePages is refused, naming articlePages (line 554)", () => {
    const { key, verifiedAnchor } = ANCHOR_OK;
    const { code, errors } = anchorRefusal({ key, verifiedAnchor });
    expect(code).toBe("invalid-config");
    expect(errors.join(" ")).toContain("is missing articlePages section");
  });

  test("printedLast before printedFirst is refused, naming the ordering (line 573)", () => {
    const { code, errors } = anchorRefusal({
      ...ANCHOR_OK,
      articlePages: { ...ANCHOR_OK.articlePages, printedFirst: 550, printedLast: 549 },
    });
    expect(code).toBe("invalid-config");
    expect(errors.join(" ")).toContain("printedLast >= printedFirst");
  });

  test("a non-integer page index is refused, naming its position (line 598)", () => {
    const { code, errors } = anchorRefusal({
      ...ANCHOR_OK,
      articlePages: { ...ANCHOR_OK.articlePages, parentPageIndices: [12, "13"] },
    });
    expect(code).toBe("invalid-config");
    expect(errors.join(" ")).toContain("parentPageIndices[1] must be a positive integer");
    // the index is named, which is what separates this from the four other invalid-config sites
    expect(errors.join(" ")).toContain("13");
  });
});

/**
 * The two validateConfig sites, driven against a REAL pinned config rather than a hand-built one.
 *
 * ap-17-549.yaml is a config this repository actually ships and validates clean, so each negative
 * below is one field away from something known good. A fixture assembled in the test would only
 * prove the validator rejects a shape I invented.
 */
const REAL_CONFIG_PATH = join(
  process.cwd(),
  "scripts",
  "sources",
  "facsimile-sources",
  "ap-17-549.yaml",
);

function realConfig(): Record<string, unknown> {
  return yaml.load(readFileSync(REAL_CONFIG_PATH, "utf8")) as Record<string, unknown>;
}

describe("validateConfig refuses a rights gap and an insecure URL, each by name", () => {
  test("THE CONTROL: the shipped ap-17-549 config validates, so the mutations below mean something", () => {
    const result = validateConfig(realConfig());
    expect(result.valid).toBe(true);
    expect(result.errors ?? []).toEqual([]);
  });

  test("cloudProcessing without a basis is refused as rights-vocabulary-invalid (line 299)", () => {
    const cfg = realConfig();
    const rights = { ...(cfg.rights as Record<string, unknown>) };
    expect(rights.cloudProcessing).toBe("permitted"); // the mutation is reachable only while this holds
    rights.cloudProcessingBasis = "   ";
    const result = validateConfig({ ...cfg, rights });
    expect(result.refusalCode).toBe("rights-vocabulary-invalid");
    expect((result.errors ?? []).join(" ")).toContain(
      "cloudProcessing requires a non-empty cloudProcessingBasis",
    );
  });

  test("a candidate URL over http is refused as http-not-https, naming the protocol (line 364)", () => {
    const cfg = realConfig();
    const candidates = (cfg.candidates as Record<string, unknown>[]).map((c, i) =>
      i === 0 ? { ...c, url: "http://archive.org/download/annalen/ap-17-549.pdf" } : c,
    );
    const result = validateConfig({ ...cfg, candidates });
    expect(result.refusalCode).toBe("http-not-https");
    const joined = (result.errors ?? []).join(" ");
    expect(joined).toContain("must use HTTPS protocol");
    // the protocol it actually found, which is what separates this from a missing-url refusal
    expect(joined).toContain("http:");
  });
});
