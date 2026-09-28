import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readTypedNumber } from "./typedNumber.ts";

/**
 * A READER WHO TYPED DIGITS IS NOT TOLD TO TYPE A NUMBER
 * (am-lab-domains-silently-clamped-pzj5, dispatch 327).
 *
 * This is the reachable half of the defect labDomainSentences.test.ts guards at the model layer.
 * That sweep hands a validator a stored value; this one hands the shared field reader the TEXT a
 * reader types, which is the only way most of these sentences are ever seen.
 *
 * The defect: the finiteness test ran on the parsed number BEFORE the unit conversion, so a typed
 * "1e400" - digits and an exponent, plainly a number - was answered "Enter the boost speed as a
 * number", and the tooLarge sentence every converting caller supplies for exactly this case could
 * not be reached by it. Number("1e400") is Infinity, so the two failures shared one branch.
 *
 * The distinction the fix draws, and what this file pins: NaN means the reader did not type a
 * number, and "enter it as a number" is the right answer. An infinity means they typed one too
 * large to represent, which is a statement about the MAGNITUDE and takes the magnitude's sentence.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const C_SI = 299792458;
const BOOST_TOO_LARGE =
  "Enter a frame speed below the speed of light: no inertial observer moves at or beyond c.";

/** Says nothing about the value: the sentence this bead exists to remove. */
const SAYS_NOT_A_NUMBER = /as an? numbers?\./i;

const boost = (text: string) =>
  readTypedNumber(text, "the boost speed", (v) => v * C_SI, BOOST_TOO_LARGE);
/** The 21 call sites that store what is typed and pass no sentence of their own. */
const plain = (text: string) => readTypedNumber(text, "the electric field Ey");

const said = (r: ReturnType<typeof readTypedNumber>) =>
  r.kind === "refused" ? r.requirement : `ACCEPTED ${r.value}`;

describe("a field tells a reader what is wrong with the value they typed", () => {
  test("a field that is not a number is told so, and that is correct", () => {
    // The probes dispatch 327 names. Neither is a number, so naming the value would be wrong: these
    // two must keep the sentence the defect misapplied, which is why the fix turns on NaN and not
    // on finiteness.
    for (const text of ["abc", "", "   ", "1e400x"]) {
      const r = boost(text);
      expect(r.kind).toBe("refused");
      expect(said(r)).toMatch(SAYS_NOT_A_NUMBER);
    }
  });

  test("a number too large to represent is answered by magnitude, not by typing", () => {
    // The defect. Before the fix both of these read "Enter the boost speed as a number."
    for (const text of ["1e400", "-1e400", "2e308"]) {
      const r = boost(text);
      expect(r.kind).toBe("refused");
      expect(said(r)).not.toMatch(SAYS_NOT_A_NUMBER);
      expect(said(r)).toBe(BOOST_TOO_LARGE);
    }
  });

  test("a caller with no sentence of its own still names the magnitude", () => {
    // The 21 sites that pass two arguments take the default. "As a smaller number" is a claim about
    // the value; "as a number" was a claim about the reader.
    const r = plain("1e400");
    expect(said(r)).toBe("Enter the electric field Ey as a smaller number.");
    expect(said(r)).not.toMatch(SAYS_NOT_A_NUMBER);
  });

  test("a finite number that overflows only once converted keeps its sentence", () => {
    // 1e300 c is finite as typed and infinite in m/s: the case tooLarge was written for, unchanged.
    expect(said(boost("1e300"))).toBe(BOOST_TOO_LARGE);
    expect(said(boost("-1e300"))).toBe(BOOST_TOO_LARGE);
  });

  test("an ordinary number is still read, in the stored unit", () => {
    // The negative control. Every assertion above is about a refusal, and a reader that refused
    // everything would satisfy all of them.
    const r = boost("0.6");
    expect(r.kind).toBe("number");
    expect(r.kind === "number" ? r.value : 0).toBeCloseTo(0.6 * C_SI, 3);
    expect(plain("-1e300").kind).toBe("number");
  });

  test("every converting call site supplies the sentence, and the reach is named", () => {
    // The denominator. One reader serves every typed field in the laboratories, so the fix above is
    // worth what this census says it is worth and no more.
    const sites: { file: string; args: number }[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(entry) && !entry.includes(".test.") && entry !== "typedNumber.ts")
          for (const call of callsIn(readFileSync(p, "utf8")))
            sites.push({ file: p.slice(root.length + 1), args: call });
      }
    };
    walk(resolve(root, "src/components/lab"));
    walk(resolve(root, "src/experiments"));
    const converting = sites.filter((s) => s.args >= 3);
    console.log(
      `[typed fields] ${sites.length} readTypedNumber call sites; ` +
        `${converting.length} convert before storing, ${sites.filter((s) => s.args >= 4).length} of those name the limit`,
    );
    expect(sites.length).toBeGreaterThan(15);
    // A site that converts can overflow, so it owns a sentence for the overflow.
    expect(converting.filter((s) => s.args < 4)).toEqual([]);
  });
});

/** The argument count of each readTypedNumber call in one file, counting only top-level commas. */
function callsIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\breadTypedNumber\(/g)) {
    let i = m.index + m[0].length;
    let depth = 1;
    let args = 1;
    let body = "";
    for (; i < text.length && depth > 0; i++) {
      const ch = text[i] as string;
      if ("([{".includes(ch)) depth++;
      else if (")]}".includes(ch)) depth--;
      if (depth === 1 && ch === ",") args++;
      if (depth > 0) body += ch;
    }
    out.push(body.trim() === "" ? 0 : args);
  }
  return out;
}
