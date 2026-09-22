/**
 * Who is an extracted donor file? Derived from the header, not from three hand-drawn lists.
 *
 * am-75t2. Three gates enforce the section 9.2 attribution and hygiene rule, and each carried
 * its own hard-coded population:
 *
 *   src/testing/extractionHygiene.test.ts     EXTRACTED_FILES         "runtime"
 *   scripts/extractedScriptsHygiene.test.ts   EXTRACTED_SOURCE_FILES  "scripts"
 *   src/testing/extractedUiHygiene.test.ts    EXTRACTED_UI_FILES      "UI components"
 *
 * The three are drawn by KIND. The population is defined by the HEADER. Those are different
 * sets, and the gap between them was silent: five carriers - two ambient `.d.ts` shims and
 * three co-located test files - were in none of the three and were scanned by nothing at all,
 * because a test of an extracted module is not a runtime module, not a script and not a UI
 * component. Somebody corrected the lists by hand (e4fa09b1). Nothing stopped the next new
 * carrier from landing in the same gap.
 *
 * MEASURED, 2026-09-22, over the whole tree:
 *
 *   carriers of the header                      40
 *   A 17   B 11   C 12   pairwise overlap 0      union 40
 *   covered by no list                           0     (hand-repaired, not derived)
 *
 * THE OTHER HALF, WHICH THE COVERAGE NUMBER HIDES. The three gates do not enforce one rule
 * set. Their forbidden-token vocabularies, measured as sets:
 *
 *   B (read from docs/DONOR_AUDIT.md section 10.1)   20 tokens
 *   C (FORBIDDEN_DONOR_IDENTITIES)                   20 tokens, identical to B
 *   A (FORBIDDEN_STRINGS + FORBIDDEN_DONOR_CONSTANTS) 35 tokens: those same 20, plus 15
 *     donor constants and kernels, plus the DONOR_VOCABULARY word rule that only A runs
 *
 * So A is a strict superset and B and C are the same set twice. Which standard an extracted
 * file is held to was decided by which list it happened to land in - a decision nobody made.
 * The lists are disjoint in LOCATION, not in content.
 *
 * This module answers the membership question once, from the bytes, so no list defines the
 * population and a new carrier cannot be unowned. The gate beside it holds every derived
 * carrier to the STRONGEST of the three rule sets, so list membership no longer decides the
 * standard either.
 *
 * MEMBERSHIP USES THE SAME PREDICATE AS VALIDITY, deliberately. am-ftgq found two
 * implementations of "where does the header end" that disagreed on real bytes: an exact
 * `startsWith` and a `^\s*` block match, which differ when a file gains a leading blank line.
 * If membership were the exact prefix while validation were the block, a reformatted carrier
 * would drop out of the population SILENTLY and be scanned by nothing - the same failure this
 * module exists to end, arriving by a different door. Both now go through
 * `attributionHeaderOpensWith`.
 */

import { execFileSync } from "node:child_process";
import { closeSync, openSync, readFileSync, readSync } from "node:fs";
import { join } from "node:path";
import { attributionHeaderOpensWith } from "./attributionHeader.ts";

/**
 * Assembled from parts rather than written out, following the precedent in
 * extractedUiHygiene.test.ts: a file that states the donor's identity literally reads as a
 * forbidden-token match to any sweep that later looks at this directory.
 */
const DONOR_SLUG = ["classic", "patents"].join("-");
const DONOR_DOMAIN = `${DONOR_SLUG}.com`;

/** The exact opening line every extracted file's notice begins with. */
export const EXTRACTION_HEADER_OPENING = `/**\n * Extracted from ${DONOR_DOMAIN}\n`;

/**
 * How much of a file is read before deciding. The longest real header measured 4458 bytes
 * (scripts/e2e-paper-vertical-slices.ts), so 8 KiB clears every one of them today. It is a
 * parameter and not a constant because a window that is too small does not fail loudly: it
 * returns FEWER carriers, which reads exactly like a clean population. A 4096-byte window was
 * tried first and silently lost that one file. The gate calls this with a deliberately tiny
 * window as a positive control.
 */
export const HEADER_PROBE_BYTES = 8192;

/** Does this content carry the extraction notice as its first block? */
export function contentIsExtractionCarrier(content: string): boolean {
  return attributionHeaderOpensWith(content, EXTRACTION_HEADER_OPENING);
}

/** Every path git tracks, in one call. */
export function gitTrackedFiles(root: string): string[] {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })
    .split("\0")
    .filter((line) => line.length > 0);
}

/**
 * Every git-tracked file whose first block is the extraction notice, sorted.
 *
 * Reads a prefix rather than whole files because the tracked corpus is 59 MB and most of it is
 * facsimile PDFs. A file whose prefix holds the opening line but whose header does not close
 * inside the window escalates to a full read, so the window can only cost time, never
 * membership.
 */
export function extractionCarriers(root: string, probeBytes = HEADER_PROBE_BYTES): string[] {
  const opening = EXTRACTION_HEADER_OPENING;
  const buffer = Buffer.alloc(probeBytes);
  const carriers: string[] = [];

  for (const relativePath of gitTrackedFiles(root)) {
    const absolutePath = join(root, relativePath);
    let bytesRead = 0;
    let handle: number;
    try {
      handle = openSync(absolutePath, "r");
    } catch {
      continue; // tracked but not on disk right now; not this gate's question
    }
    try {
      bytesRead = readSync(handle, buffer, 0, probeBytes, 0);
    } finally {
      closeSync(handle);
    }

    const prefix = buffer.subarray(0, bytesRead).toString("utf8");
    if (contentIsExtractionCarrier(prefix)) {
      carriers.push(relativePath);
      continue;
    }
    // The opening is present but the block did not close inside the window.
    if (bytesRead === probeBytes && prefix.includes(opening)) {
      const whole = readFileSync(absolutePath, "utf8");
      if (contentIsExtractionCarrier(whole)) carriers.push(relativePath);
    }
  }

  return carriers.sort();
}

/**
 * Each gate's hand-drawn population, by the file and the const that declares it.
 *
 * Read rather than imported: two of the three declare their list inside a `bun:test` file, and
 * the derived half of this gate runs under `node --experimental-strip-types`, which cannot load
 * `bun:test`. It lives here rather than in either test file so the two lanes parse the lists
 * the same way instead of keeping a copy each - which is the defect this whole module is about.
 */
export const GATE_LISTS = [
  { path: "src/testing/extractionHygiene.test.ts", name: "EXTRACTED_FILES" },
  { path: "scripts/extractedScriptsHygiene.test.ts", name: "EXTRACTED_SOURCE_FILES" },
  { path: "src/testing/extractedUiHygiene.test.ts", name: "EXTRACTED_UI_FILES" },
] as const;

/**
 * A gate's list could not be read.
 *
 * Typed rather than a bare `throw new Error`, because the repository's refusal ratchet is right
 * that an untyped refusal cannot be caught by code or counted by a gate. This one matters more
 * than most: the failure it names is a parse returning nothing, and a silent empty list would
 * make every ownership check below it pass over an empty set.
 */
export class GateListParseError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(`${message} (${code})`);
    this.name = "GateListParseError";
    this.code = code;
  }
}

/**
 * Reads a list literal out of a gate's source.
 *
 * A parse can go wrong quietly, and a list that came back empty would make an ownership check
 * pass over nothing at all. So this throws on a list it cannot find, and its callers assert a
 * plausible size rather than trusting the parse.
 */
export function readGateList(root: string, relativePath: string, constName: string): string[] {
  const source = readFileSync(join(root, relativePath), "utf8");
  const declaration = new RegExp(`\\b${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]`).exec(source);
  if (declaration?.[1] === undefined) {
    throw new GateListParseError(
      "gate-list-declaration-missing",
      `${relativePath} no longer declares ${constName} as an array literal, so the ownership check would compare against nothing`,
    );
  }
  const withoutComments = declaration[1]
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
  return [...withoutComments.matchAll(/"([^"]+)"/g)].map((match) => match[1] as string);
}
