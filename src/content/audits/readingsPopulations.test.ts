/**
 * WHAT THE READINGS AUDIT READS, AND THE FIVE POPULATIONS IT DOES NOT (pcjk.14).
 *
 * AGENTS.md's "The four readings" binds every paragraph, every equation and every instrument
 * caption. The audit `verify-content` runs reads ONE of those: content/editorial/readings-owners,
 * which is 63 instrument captions, and all 63 already carry four readings. So the gate is green on
 * the population with no shortfall and silent on the ones with all of it.
 *
 * Measured 2026-10-09, and this is the census the bead's first item asks for:
 *
 *   captions     63   all four                      AUDITED
 *   paragraphs  210   all carry r0                  not audited
 *   passages     48   all four                      not audited
 *   displays    200   r0/r1/r2 complete, r3 at 71   not audited   <- the shortfall
 *   headings     26   none carry readings           not audited
 *   closings      9   none carry readings           not audited
 *
 * 63 of 556 reading-bearing targets, or 11 per cent, and the 11 per cent is the part that was
 * already finished. That is the shape AGENTS.md calls a check inheriting the silence of what it
 * reads, one level up: the audit is not wrong about captions, it simply never meets anything else.
 *
 * TWO OF THE BEAD'S FIGURES MOVED, and the direction is worth keeping: display r3 is still 71 of
 * 200 exactly, and "r2 no longer than r1" has come down from 122 of 199 to 96 of 200. Neither is
 * asserted as an equality here, because both are live editorial work; the r3 count is a FLOOR that
 * may only rise and the r2 count a CEILING that may only fall.
 *
 * This file measures and does not extend the audit. Wiring the other five populations into
 * `auditReadings` is the bead's item 1 and needs its CLI and `verify-content` to share one
 * implementation first, which is am-unwired-audits-uwot's half.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const PAPERS = ["mass-energy", "light-quanta", "brownian-motion", "special-relativity"] as const;

/** R2 is an ARRAY of steps on a display record, so length comparisons join it first. */
function readingText(value: unknown): string {
  if (Array.isArray(value))
    return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" ");
  return typeof value === "string" ? value : "";
}

function filesUnder(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) filesUnder(path, out);
    else if (/\.(yaml|json)$/.test(entry)) out.push(path);
  }
  return out;
}

const read = (f: string): Record<string, unknown> =>
  f.endsWith(".json")
    ? (JSON.parse(readFileSync(f, "utf8")) as Record<string, unknown>)
    : (loadYaml(readFileSync(f, "utf8")) as Record<string, unknown>);

describe("the readings audit reads one population of six", () => {
  test("the census, with every population named", () => {
    const captions = filesUnder(join(ROOT, "content/editorial/readings-owners")).reduce(
      (n, f) => n + ((read(f).targets as unknown[] | undefined)?.length ?? 0),
      0,
    );

    let paragraphs = 0;
    for (const paper of PAPERS) {
      const file = join(ROOT, "content/bindings", `${paper}.yaml`);
      if (!existsSync(file)) continue;
      for (const section of Object.values(read(file))) {
        if (!Array.isArray(section)) continue;
        for (const unit of section)
          if (
            unit &&
            typeof unit === "object" &&
            "unit" in unit &&
            readingText((unit as { r0?: unknown }).r0)
          )
            paragraphs += 1;
      }
    }

    const passages = filesUnder(join(ROOT, "content/arguments"))
      .map(read)
      .filter((r) => r.kind === "argument");

    const displays = filesUnder(join(ROOT, "content/equation-explanations")).map(read);
    const displayR3 = displays.filter((d) => readingText(d.r3)).length;
    const r2NoLonger = displays.filter((d) => {
      const r1 = readingText(d.r1);
      const r2 = readingText(d.r2);
      return r1 !== "" && r2 !== "" && r2.length <= r1.length;
    }).length;

    let headings = 0;
    let closings = 0;
    for (const paper of PAPERS) {
      for (const f of filesUnder(join(ROOT, "content/source-blocks", paper))) {
        const kind = read(f).kind;
        if (kind === "heading" || kind === "part-heading") headings += 1;
        if (kind === "closing") closings += 1;
      }
    }

    const total = captions + paragraphs + passages.length + displays.length + headings + closings;
    console.log(
      `[census] readings populations: ${total} reading-bearing targets; the audit reads ` +
        `${captions} captions and none of the other ${total - captions}`,
    );
    console.log(
      `[census]   captions ${captions} | paragraphs ${paragraphs} | passages ${passages.length} | ` +
        `displays ${displays.length} | headings ${headings} | closings ${closings}`,
    );
    console.log(
      `[census]   display r3 ${displayR3} of ${displays.length}; r2 no longer than r1 ${r2NoLonger}`,
    );

    expect(total).toBeGreaterThanOrEqual(550);
    // The audited population is the one with no shortfall, which is the finding.
    expect(captions).toBe(63);
    // Floors on what exists, so a population cannot vanish unnoticed.
    expect(paragraphs).toBeGreaterThanOrEqual(210);
    expect(passages.length).toBeGreaterThanOrEqual(48);
    expect(displays.length).toBeGreaterThanOrEqual(200);
    expect(headings + closings).toBeGreaterThanOrEqual(35);
  });

  test("the display shortfall: r3 is a floor that may only rise", () => {
    const displays = filesUnder(join(ROOT, "content/equation-explanations")).map(read);
    const withR3 = displays.filter((d) => readingText(d.r3)).length;
    // 71 of 200 on 2026-10-09, unchanged from the bead's 2026-10-01 figure. Raise this as the
    // margin is authored; never lower it.
    expect(withR3).toBeGreaterThanOrEqual(71);
    // Non-vacuity in the other direction: r0, r1 and r2 are complete, so a reader meets a full
    // explanation everywhere and only the historian's margin is short.
    for (const key of ["r0", "r1", "r2"] as const)
      expect(displays.filter((d) => readingText(d[key])).length, key).toBe(displays.length);
  });

  test("headings and closings carry no readings at all, which is a population not a gap of one", () => {
    // 35 blocks. Stated as its own test because a count folded into the census above would read
    // as a shortfall of degree, and this is a shortfall of kind: nothing has been authored.
    let withReadings = 0;
    for (const paper of PAPERS)
      for (const f of filesUnder(join(ROOT, "content/source-blocks", paper))) {
        const record = read(f);
        if (
          record.kind !== "heading" &&
          record.kind !== "part-heading" &&
          record.kind !== "closing"
        )
          continue;
        if (record.readings !== undefined || readingText(record.r0)) withReadings += 1;
      }
    expect(withReadings).toBe(0);
  });
});
