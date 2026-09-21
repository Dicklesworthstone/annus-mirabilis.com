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

  test("a non-integer printedPage is refused, naming printedPage (facsimileSourceSchema.ts:528)", () => {
    const { code, errors } = anchorRefusal({
      ...ANCHOR_OK,
      verifiedAnchor: { ...ANCHOR_OK.verifiedAnchor, printedPage: 549.5 },
    });
    expect(code).toBe("invalid-config");
    expect(errors.join(" ")).toContain("verifiedAnchor.printedPage must be a positive integer");
    expect(errors.join(" ")).toContain("549.5");
  });

  test("an unnamed verifier is refused, naming verifiedBy (facsimileSourceSchema.ts:536)", () => {
    const { code, errors } = anchorRefusal({
      ...ANCHOR_OK,
      verifiedAnchor: { ...ANCHOR_OK.verifiedAnchor, verifiedBy: "   " },
    });
    expect(code).toBe("invalid-config");
    expect(errors.join(" ")).toContain("verifiedAnchor.verifiedBy must be a non-empty string");
  });

  test("a config with an anchor but no articlePages is refused, naming articlePages (facsimileSourceSchema.ts:554)", () => {
    const { key, verifiedAnchor } = ANCHOR_OK;
    const { code, errors } = anchorRefusal({ key, verifiedAnchor });
    expect(code).toBe("invalid-config");
    expect(errors.join(" ")).toContain("is missing articlePages section");
  });

  test("printedLast before printedFirst is refused, naming the ordering (facsimileSourceSchema.ts:573)", () => {
    const { code, errors } = anchorRefusal({
      ...ANCHOR_OK,
      articlePages: { ...ANCHOR_OK.articlePages, printedFirst: 550, printedLast: 549 },
    });
    expect(code).toBe("invalid-config");
    expect(errors.join(" ")).toContain("printedLast >= printedFirst");
  });

  test("a non-integer page index is refused, naming its position (facsimileSourceSchema.ts:598)", () => {
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

  test("cloudProcessing without a basis is refused as rights-vocabulary-invalid (facsimileSourceSchema.ts:299)", () => {
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

  test("a candidate URL over http is refused as http-not-https, naming the protocol (facsimileSourceSchema.ts:364)", () => {
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

/**
 * am-r3qt. Five more sites in this module had no test at all.
 *
 * Ten others in the same file DID have tests and were still reported as untested, because
 * they were cited as "(line 554)" - a reference a reader understands and the refusal
 * scanner cannot read. Those are now cited as (facsimileSourceSchema.ts:554) and needed no
 * new assertions. Only the five below were genuinely undriven; each was established by
 * planting, not by reading, because this module returns nine separate refusals under one
 * invalid-config code and the code alone says nothing about which fired.
 */
describe("the five schema refusals nothing reached (am-r3qt)", () => {
  test("a configuration root that is not an object (facsimileSourceSchema.ts:228)", () => {
    // The outermost guard. Everything after it indexes into the config, so without this
    // a malformed file would fail as a missing field rather than as a malformed file.
    for (const notAnObject of [null, undefined, "ap-17-549", 42, true]) {
      const result = validateConfig(notAnObject);
      expect(result.valid).toBe(false);
      expect(result.refusalCode).toBe("invalid-config");
      expect((result.errors ?? []).join(" ")).toContain("Configuration root must be an object");
    }
  });

  test("an anchor root that is not an object (facsimileSourceSchema.ts:478)", () => {
    // The same guard on the other entry point, and a separate site. validateConfig's copy
    // cannot stand in for it: --check-config and the pin gate call different functions,
    // which is the am-xgf9 asymmetry.
    const result = validateFacsimileAnchor(null);
    expect(result.valid).toBe(false);
    expect(result.refusalCode).toBe("invalid-config");
    expect((result.errors ?? []).join(" ")).toContain("Configuration root must be an object");
  });

  test("pin-local-only with no reason given (facsimileSourceSchema.ts:285)", () => {
    // Deciding not to publish a scan is a rights decision and has to carry its reason,
    // or the receipt records a restriction nobody can account for later.
    const cfg = realConfig();
    const rights = { ...(cfg.rights as Record<string, unknown>) };
    rights.publicationDecision = "pin-local-only";
    rights.publicationReason = "   ";
    const result = validateConfig({ ...cfg, rights });
    expect(result.refusalCode).toBe("rights-vocabulary-invalid");
    expect((result.errors ?? []).join(" ")).toContain("requires a non-empty publicationReason");
  });

  test("accumulated field errors are returned together, not one at a time (facsimileSourceSchema.ts:447)", () => {
    // Distinct from every other invalid-config site above: those return the moment they
    // fire, so a reader fixes one fault per run. This site is the one that reports the
    // whole set, and an author repairing a config depends on that. Two faults are planted
    // so a single-error return would fail the length assertion rather than pass quietly.
    const cfg = realConfig();
    const result = validateConfig({ ...cfg, configVersion: 7, key: "not-a-bib-key" });
    expect(result.valid).toBe(false);
    expect(result.refusalCode).toBe("invalid-config");
    const errors = result.errors ?? [];
    expect(errors.length).toBeGreaterThan(1);
    expect(errors.join(" ")).toContain("configVersion must be 1");
    expect(errors.join(" ")).toContain("Invalid key format");
  });

  test("the LAST-index offset arm is unreachable, and the three checks that make it so", () => {
    // NOT A TEST OF THE SITE. facsimileSourceSchema.ts:657 cannot fire, and I found that
    // by trying to drive it: a window ending in the wrong place is caught as
    // non-contiguous-parent-pages long before the arithmetic runs.
    //
    // The proof is short. By the time the last-index check is reached, three earlier
    // checks have already passed: the list length equals printedLast - printedFirst + 1,
    // the list is contiguous so indices[i] = indices[0] + i, and indices[0] equals
    // printedFirst + offset. Those three together fix
    //   indices[last] = indices[0] + (length - 1) = printedLast + offset
    // which is exactly what the last-index check compares against. It can only ever be
    // equal. A fourth dead refusal, and a different cause from the three on am-okw3:
    // those are guards duplicated below a validating loader, this is a guard whose
    // condition is implied by its predecessors.
    //
    // Asserted rather than asserted-in-prose: all three predecessors must still run, in
    // order, ahead of the last-index check. Remove or reorder any one of them and the
    // site becomes reachable, this goes red, and someone has to write the test.
    const source = readFileSync(
      join(process.cwd(), "scripts", "sources", "facsimileSourceSchema.ts"),
      "utf8",
    );
    const at = (needle: string): number => {
      const index = source.indexOf(needle);
      expect(index).toBeGreaterThan(-1);
      return index;
    };
    const lengthCheck = at("parentPageIndices.length !== expectedPageCount");
    const contiguity = at("curr !== prev + 1");
    const firstCheck = at("actualFirstParent !== expectedFirstParent");
    const lastCheck = at("actualLastParent !== expectedLastParent");
    expect(lengthCheck).toBeLessThan(contiguity);
    expect(contiguity).toBeLessThan(firstCheck);
    expect(firstCheck).toBeLessThan(lastCheck);

    // And the behaviour that proof predicts: a window that ends in the wrong place is
    // refused by contiguity, never by the arithmetic.
    const result = validateFacsimileAnchor({
      key: "ap-99-657",
      verifiedAnchor: { parentPageIndex: 12, printedPage: 549, verifiedBy: "jemanuel" },
      articlePages: { printedFirst: 549, printedLast: 551, parentPageIndices: [12, 13, 99] },
    });
    expect(result.valid).toBe(false);
    expect(result.refusalCode).toBe("non-contiguous-parent-pages");
  });
});
