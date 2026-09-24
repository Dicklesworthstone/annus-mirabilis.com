import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { refusalSentence } from "../experiments/results/refusalSentence.ts";

/**
 * Every lab validator, probed with each numeric field set to NaN and to −10³⁰, the way a reader's
 * mistyped or cleared field or a hand-edited link reaches it. On 2026-09-24 this sweep found
 * sentences built from code: field ids ("Enter a finite number for ionizationEnergyEv."),
 * e-notation ("between 1e11 Hz and 1e16 Hz"), interval brackets ("must be in [0, 1]"), comparison
 * operators ("(Np >= 1)"), and sentences that never said which input ("One of the inputs is not a
 * finite number.", "Use finite numbers in the stated units."). All were rewritten; this keeps them
 * out.
 */
const EXPERIMENTS = fileURLToPath(new URL("../experiments/", import.meta.url));
const LAB_DIR = /^(bm|lq|sr|me)\d\d$/;
// A code identifier needs two lowercase letters before its capital, so units such as mPa, fN, nJ,
// mW and eV are not taken for one.
const IDENTIFIER = /\b[a-z]{2,}[A-Z][A-Za-z]*\b/;
const CODE_NOTATION = /<=|>=|\|[a-z]+\||\b\d+(\.\d+)?e[+-]?\d+\b|\[[^\]]*,[^\]]*\]|safe integer/;
const UNSPECIFIC = /One of the inputs|stated units|representable|These inputs do not meet/;

type Validator = (input: unknown) => {
  kind: string;
  refusal?: Parameters<typeof refusalSentence>[0];
};

async function sweep(): Promise<{ labs: number; probed: number; bad: string[] }> {
  const bad: string[] = [];
  let labs = 0;
  let probed = 0;
  for (const dir of readdirSync(EXPERIMENTS)
    .filter((d) => LAB_DIR.test(d))
    .sort()) {
    const params = `${EXPERIMENTS}${dir}/parameters.ts`;
    const defs = `${EXPERIMENTS}${dir}/definition.ts`;
    if (!existsSync(params) || !existsSync(defs)) continue;
    const p = (await import(params)) as Record<string, unknown>;
    const d = (await import(defs)) as Record<string, unknown>;
    const validate = Object.entries(p).find(
      ([k, v]) => /^validate\w*Parameters$/.test(k) && typeof v === "function",
    )?.[1] as Validator | undefined;
    const defaults = Object.entries(d).find(([k]) => /_DEFAULTS$/.test(k))?.[1] as
      | Record<string, unknown>
      | undefined;
    if (!validate || !defaults) continue;
    labs += 1;
    for (const [key, value] of Object.entries(defaults)) {
      if (typeof value !== "number") continue;
      for (const probe of [Number.NaN, -1e30]) {
        const result = validate({ ...defaults, [key]: probe });
        if (result.kind !== "refused" || !result.refusal) continue;
        probed += 1;
        const sentence = refusalSentence(result.refusal);
        const why = [
          IDENTIFIER.test(sentence) && "identifier",
          CODE_NOTATION.test(sentence) && "code notation",
          UNSPECIFIC.test(sentence) && "unspecific",
        ].filter(Boolean);
        if (why.length) bad.push(`${dir} ${key}=${probe} [${why.join(", ")}]: ${sentence}`);
      }
    }
  }
  return { labs, probed, bad };
}

describe("every lab's refusal sentence says what to enter, in words", () => {
  test("the patterns catch the sentences the sweep found (positive control)", () => {
    expect(IDENTIFIER.test("Enter a finite number for ionizationEnergyEv.")).toBe(true);
    expect(IDENTIFIER.test("Enter a viscosity greater than zero, in mPa·s.")).toBe(false);
    expect(IDENTIFIER.test("Enter the work function Φ, in eV, as a number.")).toBe(false);
    expect(CODE_NOTATION.test("Band edges must be between 1e11 Hz and 1e16 Hz.")).toBe(true);
    expect(CODE_NOTATION.test("Quantum efficiency must be in [0, 1].")).toBe(true);
    expect(
      CODE_NOTATION.test("Particle count Np must be a whole positive integer (Np >= 1)."),
    ).toBe(true);
    expect(CODE_NOTATION.test('"speed" must satisfy |speed| <= 0.95.')).toBe(true);
    expect(CODE_NOTATION.test("Enter band edges from 10^{11} to 10^{16} Hz.")).toBe(false);
    expect(UNSPECIFIC.test("One of the inputs is not a finite number.")).toBe(true);
  });

  test("no lab validator refuses with an id, code notation or an unspecific sentence", async () => {
    const { labs, probed, bad } = await sweep();
    console.log(`[refusal sweep] ${labs} labs, ${probed} refusals probed, ${bad.length} flagged`);
    for (const b of bad) console.log(`  ${b}`);
    // Not vacuous: the sweep reached most labs and many refusals.
    expect(labs).toBeGreaterThan(20);
    expect(probed).toBeGreaterThan(200);
    expect(bad).toEqual([]);
  });
});
