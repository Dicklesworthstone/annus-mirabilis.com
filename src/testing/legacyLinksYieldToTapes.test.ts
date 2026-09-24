import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encodeTapePermalink } from "../experiments/permalink/codec.ts";
import { carriesTapeLink } from "../experiments/permalink/codecCore.ts";
import { type LabTapeBinding, tapeForSettings } from "../experiments/permalink/sessionTape.ts";

/**
 * A laboratory that reads both a ?tape= link and an older settings link of its own leaves a tape's
 * address to the tape (am-inst-permalink-tape-s677).
 *
 * Both readers run on page load, and the older one read a tape's query as a broken settings link.
 * Measured in Chromium on a build of 16880530, opening 18 laboratories plain and then from a tape, 4
 * showed a notice only from the tape, under a state the tape had restored: LQ-05, LQ-06 and LQ-07
 * "This ... link is incomplete or unsupported. The worked example is unchanged.", and ME-02
 * "Unknown setting: tape. The prepared example is unchanged." The laboratories are found from the
 * tree, a tape.ts beside a permalink.ts, so one wired later is checked without being listed.
 */
const experiments = resolve(dirname(fileURLToPath(import.meta.url)), "../experiments");

type Decode = (search: string) => { kind: string };

async function pairs(): Promise<[string, LabTapeBinding, string, Decode][]> {
  const out: [string, LabTapeBinding, string, Decode][] = [];
  for (const dir of readdirSync(experiments).sort()) {
    const tapeFile = resolve(experiments, dir, "tape.ts");
    const linkFile = resolve(experiments, dir, "permalink.ts");
    if (!existsSync(tapeFile) || !existsSync(linkFile)) continue;
    const tapes = (await import(tapeFile)) as Record<string, unknown>;
    const links = (await import(linkFile)) as Record<string, unknown>;
    const binding = Object.entries(tapes).find(([name]) => /^[A-Z0-9]+_TAPE$/.test(name))?.[1];
    if (!binding) continue;
    for (const [name, fn] of Object.entries(links)) {
      if (/^decode[A-Z][A-Za-z0-9]*Settings$/.test(name) && typeof fn === "function")
        out.push([dir, binding as LabTapeBinding, name, fn as Decode]);
    }
  }
  return out;
}

describe("carriesTapeLink reads the query, not the text", () => {
  test("a tape parameter is found wherever it sits, and a key that only contains the word is not one", () => {
    expect(carriesTapeLink("?tape=abc")).toBe(true);
    expect(carriesTapeLink("?v=0.6&tape=abc")).toBe(true);
    expect(carriesTapeLink("?tapes=abc&mode=1905")).toBe(false);
    expect(carriesTapeLink("?note=tape")).toBe(false);
    expect(carriesTapeLink("")).toBe(false);
  });
});

describe("an older settings link leaves a ?tape= address alone", async () => {
  const all = await pairs();

  test("the laboratories with both readers are found (a floor, not a census)", () => {
    console.log(`[legacy links] ${all.length} older decoders beside a tape binding`);
    expect(all.length).toBeGreaterThan(4);
  });

  for (const [dir, binding, name, decode] of all) {
    test(`${dir}: ${name} does not call a valid tape's address an invalid settings link`, () => {
      const tape = tapeForSettings(binding, binding.defaults);
      expect(tape).not.toBeNull();
      if (!tape) return;
      const search = `?tape=${encodeTapePermalink(tape)}`;
      expect(decode(search).kind).not.toBe("invalid");
    });
  }
});
