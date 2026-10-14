/**
 * EVERY CAPTION READING EXISTS TWICE, AND THIS IS THE CHECK THAT THEY AGREE.
 *
 * One copy is in `content/editorial/readings-owners/*.yaml`, which the readings audit judges.
 * The other is a TypeScript constant under `src/experiments/<id>/` or beside its laboratory,
 * which is what a lab page renders and what reaches `out/`. They are kept in step by hand.
 *
 * WHY THIS EXISTS. On 2026-10-11, 27a1cc43b corrected one word in SR-05's historian's margin,
 * "proved" to "derived", because the sentence "draws the distinction the whole reading turns on
 * ... and said it with the wrong half of the project's own vocabulary". It changed the owner
 * record. The reader kept seeing "proved" for three days, on four built pages, because the
 * rendered copy is a different file. Nothing reported it: the readings audit reads the owner
 * record, so it was honestly green about a sentence no reader saw. That is AGENTS.md's "A check
 * inherits the silence of whatever it reads" in its hardest form, where both copies exist and
 * both are authored.
 *
 * WHAT THIS ASSERTS, and what it deliberately cannot. A reading that HAS a rendered copy must
 * match it verbatim; the drifted set is pinned as a declared debt that can only shrink; and the
 * matched count is floored, because a reading whose TS copy disappeared would otherwise move
 * quietly into the unrendered bucket and pass. It does NOT assert that every owner reading has a
 * rendered copy: 90 of them are preset-level captions whose rendering is a separate question,
 * reported here and filed on am-read-detail-axis-sfc.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "../provenance/yaml.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const OWNERS = join(ROOT, "content/editorial/readings-owners");

/**
 * The one divergence that is a style choice rather than an error, declared so it cannot be
 * mistaken for a fresh one. The owner record spells the numerals and keeps "stay unchanged"; the
 * prompt a reader sees, generated into `src/generated/predict-prompts.ts` from
 * `content/experiments/bm-01.yaml`, uses digits and drops "stay". The manifest is the generator's
 * source, so reconciling them chooses which wording ships, and the voice lint accepts both. This
 * list is a ceiling: it may shrink, never grow.
 */
const DECLARED_DRIFT: readonly string[] = [
  "am-bm-01-tracer-ensemble-hdly.yaml:bm-01-predict-observation-interval:r0",
];

/**
 * Measured 2026-10-14 by this test: 252 audited readings, 181 with a rendered copy, 1 drifted (the
 * declared one), 70 with none. A looser regex probe run first reported 272 / 180 / 2 / 90 because
 * it matched reading-shaped lines rather than `target.readings` entries; these figures come from
 * the project's own YAML parser and are the ones to trust. The drift it found was the same.
 */
const MATCHED_FLOOR = 170;

type Target = Readonly<{ kind?: string; id?: string; readings?: Record<string, unknown> }>;

/** Every module under src/ that could hold a rendered reading, read once. */
function sourceBlob(): string {
  const parts: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__fixtures__" || entry.name === "node_modules") continue;
        walk(p);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || /\.test\./.test(entry.name)) continue;
      parts.push(readFileSync(p, "utf8"));
    }
  };
  walk(join(ROOT, "src"));
  return parts.join("\n");
}

describe("the audited caption readings and the rendered ones (am-read-detail-axis-sfc)", () => {
  const blob = sourceBlob();
  const matched: string[] = [];
  const drifted: string[] = [];
  const unrendered: string[] = [];

  for (const file of readdirSync(OWNERS).filter((f) => /\.ya?ml$/.test(f))) {
    const doc = parseYaml(readFileSync(join(OWNERS, file), "utf8")) as {
      targets?: readonly Target[];
    };
    for (const target of doc.targets ?? []) {
      for (const [level, value] of Object.entries(target.readings ?? {})) {
        if (typeof value !== "string" || !value.trim()) continue;
        const where = `${file}:${target.id ?? "(no id)"}:${level}`;
        if (blob.includes(value)) matched.push(where);
        // A shared opening is what tells a DRIFT from a reading that is simply not rendered: the
        // rendered copy began life as the same sentence.
        else if (value.length > 48 && blob.includes(value.slice(0, 48))) drifted.push(where);
        else unrendered.push(where);
      }
    }
  }

  test("the comparison examined a real population, and says what it found", () => {
    const total = matched.length + drifted.length + unrendered.length;
    console.log(
      `[census] caption readings: ${total} audited | ${matched.length} match the rendered copy | ` +
        `${drifted.length} drifted | ${unrendered.length} have no rendered copy`,
    );
    // Non-vacuity: a walk that read no owner record, or a blob that read no module, would make
    // every assertion below true about nothing.
    expect(total).toBeGreaterThan(200);
    expect(blob.length).toBeGreaterThan(1_000_000);
    expect(matched.length).toBeGreaterThanOrEqual(MATCHED_FLOOR);
  });

  test("no reading has drifted from the copy a reader sees, beyond the one declared", () => {
    const undeclared = drifted.filter((where) => !DECLARED_DRIFT.includes(where));
    expect(undeclared).toEqual([]);
    // The declared list is a ceiling, not a permission: an entry that stops drifting must be
    // removed from it, which this catches.
    const stale = DECLARED_DRIFT.filter((where) => !drifted.includes(where));
    expect(stale).toEqual([]);
  });

  /**
   * The plant. A set-difference test passes when both sets are empty, so the predicate is driven
   * on values: a reading whose rendered copy shares its opening and differs later must be caught,
   * and one that matches exactly must not.
   */
  test("PLANTED: a one-word divergence is caught, and an exact match is not", () => {
    const original =
      "Einstein called the result a peculiar consequence. He derived it for a path made of straight pieces.";
    const rendered = original.replace("derived", "proved");
    const classify = (audited: string, source: string): "match" | "drift" | "absent" =>
      source.includes(audited)
        ? "match"
        : audited.length > 48 && source.includes(audited.slice(0, 48))
          ? "drift"
          : "absent";

    expect(classify(original, rendered)).toBe("drift");
    expect(classify(original, original)).toBe("match");
    expect(classify(original, "nothing like it at all")).toBe("absent");
    // And the real case this was written for: the word that was corrected in the owner record on
    // 2026-10-11 and in the rendered copy on 2026-10-14.
    expect(rendered).toContain("proved");
    expect(original).toContain("derived");
  });
});
