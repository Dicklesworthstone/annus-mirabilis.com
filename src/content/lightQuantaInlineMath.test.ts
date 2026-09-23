import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { splitInlineMath } from "./inlineMath.ts";

/*
  Light quanta's explanation prose writes its mathematics as `\( … \)`, so a reader meets
  "\(k_B T\)" typeset, not "k_B T" typed. This holds that for every reading (overview, full
  explanation, every step, modern margin) of every light-quanta argument record: outside inline
  mathematics, no word is an ASCII subscript like `k_B` or `hν_in`.

  The papers whose prose has been converted are held to it: light quanta first (06b9b154), then
  special relativity (5a5faf73). The others' prose still types some mathematics in ASCII.
  Premises, limitations and recaps are separate fields with their own renderers and are not
  converted yet. The file keeps its first paper's name.
*/
const CONVERTED = [
  { paper: "light-quanta", prefix: "arg-lq-" },
  { paper: "special-relativity", prefix: "arg-sr-" },
] as const;
const ASCII_SUBSCRIPT = /[A-Za-zνρ]_(?:[A-Za-z]|\{)/;

type Block = { kind: string; text?: string; items?: string[] };

function proseOf(record: { readings: Record<string, Block[]> }): string[] {
  return Object.values(record.readings).flatMap((blocks) =>
    blocks.flatMap((block) =>
      block.kind === "paragraph"
        ? [block.text ?? ""]
        : block.kind === "steps"
          ? (block.items ?? [])
          : [],
    ),
  );
}

for (const { paper, prefix } of CONVERTED)
  describe(`${paper}'s prose typesets its mathematics`, () => {
    const dir = new URL(`../../content/arguments/${paper}/`, import.meta.url);
    const files = readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".json"));
    const records = files.map((f) => ({
      f,
      record: JSON.parse(readFileSync(new URL(f, dir), "utf8")),
    }));

    test("every argument record is read, and some of them carry inline mathematics", () => {
      // Non-vacuity: an empty directory or a record set with no inline mathematics would pass the
      // property below while proving nothing.
      expect(files.length).toBeGreaterThan(0);
      const pieces = records.flatMap(({ record }) =>
        proseOf(record).flatMap((text) => splitInlineMath(text).filter((s) => s.kind === "math")),
      );
      expect(pieces.length).toBeGreaterThan(0);
    });

    test("no reading text carries an ASCII subscript outside \\( \\)", () => {
      const offenders = records.flatMap(({ f, record }) =>
        proseOf(record).flatMap((text) =>
          splitInlineMath(text)
            .filter((s) => s.kind === "text" && ASCII_SUBSCRIPT.test(s.value))
            .map((s) => `${f}: "${s.value.trim().slice(0, 60)}"`),
        ),
      );
      expect(offenders).toEqual([]);
    });

    test("the check itself sees an ASCII subscript when one is there (positive control)", () => {
      const planted = {
        readings: { full: [{ kind: "paragraph", text: "the classical mean energy k_B T" }] },
      };
      const hits = proseOf(planted).flatMap((text) =>
        splitInlineMath(text).filter((s) => s.kind === "text" && ASCII_SUBSCRIPT.test(s.value)),
      );
      expect(hits.length).toBe(1);
    });
  });
