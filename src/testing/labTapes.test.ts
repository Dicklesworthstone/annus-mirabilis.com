import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { strictParse } from "../content/schemas/strictParse.ts";
import { declaredDomains } from "../experiments/controls/declaredDomain.ts";
import { decodeTapePermalink, encodeTapePermalink } from "../experiments/permalink/codec.ts";
import {
  type LabTapeBinding,
  restoreTape,
  tapeForSettings,
} from "../experiments/permalink/sessionTape.ts";

/**
 * Every laboratory with a ?tape= binding restores a shared link to exactly the settings it was
 * recorded with (am-inst-permalink-tape-s677).
 *
 * Each case changes one setting away from the laboratory's defaults, to a value inside the domain
 * its manifest declares, so a restore that did nothing would leave the defaults and fail.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function bindings(): Promise<[string, LabTapeBinding][]> {
  const out: [string, LabTapeBinding][] = [];
  for (const dir of readdirSync(resolve(root, "src/experiments")).sort()) {
    const file = resolve(root, "src/experiments", dir, "tape.ts");
    if (!existsSync(file)) continue;
    const mod = (await import(file)) as Record<string, unknown>;
    for (const [name, value] of Object.entries(mod))
      if (/^[A-Z0-9]+_TAPE$/.test(name)) out.push([name, value as LabTapeBinding]);
  }
  return out;
}

/**
 * Laboratories whose validator accepts a text value for a number by putting its default back, a
 * silent coercion recorded on am-lab-domains-silently-clamped-pzj5. Named here so a new one fails.
 */
const COERCING_LABS: readonly string[] = [];

/** One setting moved inside its declared domain, and accepted by the laboratory. */
function changedSettings(binding: LabTapeBinding): Record<string, unknown> | null {
  const defaults = binding.defaults;
  for (const [id, domain] of Object.entries(declaredDomains(binding.environment.experimentId))) {
    const current = defaults[id];
    if (typeof current !== "number" || domain.min === undefined || domain.max === undefined)
      continue;
    for (const target of [(current + domain.max) / 2, (current + domain.min) / 2]) {
      if (target === current) continue;
      const settings = { ...defaults, [id]: target };
      if (binding.validate(settings).kind === "accepted") return settings;
    }
  }
  return null;
}

describe("every laboratory's shared link restores its settings", async () => {
  const all = await bindings();

  test("the bindings are there (a floor, not a census)", () => {
    expect(all.length).toBeGreaterThan(10);
  });

  for (const [name, binding] of all) {
    const lab = binding.environment.experimentId;

    test(`${lab}: the binding's model is the manifest's tapeModel`, () => {
      const manifest = strictParse(
        readFileSync(resolve(root, "content/experiments", `${lab}.yaml`), "utf8"),
        "yaml",
      ) as { tapeModel?: { modelId: string; modelVersion: number } };
      expect(manifest.tapeModel).toBeDefined();
      expect(binding.environment.modelId).toBe(manifest.tapeModel?.modelId ?? "");
      expect(binding.environment.modelVersion).toBe(manifest.tapeModel?.modelVersion ?? -1);
    });

    test(`${lab} (${name}): a changed setting shared as a link restores exactly`, () => {
      const settings = changedSettings(binding);
      expect(settings).not.toBeNull();
      if (!settings) return;
      const tape = tapeForSettings(binding, settings);
      expect(tape).not.toBeNull();
      if (!tape) return;
      const decoded = decodeTapePermalink(
        `https://x.test/lab/${lab}/?tape=${encodeTapePermalink(tape)}`,
      );
      expect(decoded.kind).toBe("success");
      if (decoded.kind !== "success") return;

      const session = binding.createSession(`${lab}-tape-test`);
      expect(session.acceptedParameters()).not.toEqual(settings);
      expect(restoreTape(binding, session, decoded.tape)).toEqual({ kind: "restored" });
      expect(session.acceptedParameters()).toEqual(settings);
    });

    test(`${lab}: a recorded change the lab refuses stops the replay with parameters-rejected, in its own words`, () => {
      // The initial conditions are checked before replay; a recorded change is not, so the
      // runner's parameters-rejected refusal stops it, and the reader gets the laboratory's
      // sentence rather than the error it travels in.
      const settings = changedSettings(binding);
      const tape = settings ? tapeForSettings(binding, settings) : null;
      expect(tape).not.toBeNull();
      if (!tape || !settings) return;
      const numeric = Object.keys(settings).find((k) => typeof settings[k] === "number");
      expect(numeric).toBeDefined();
      const session = binding.createSession(`${lab}-tape-event`);
      const before = { ...session.acceptedParameters() };
      const restored = restoreTape(binding, session, {
        ...tape,
        events: [
          { actionIndex: 1, commandClass: "setup-change", paramId: numeric ?? "", value: "abc" },
        ],
      });
      expect(restored.kind).toBe("not-restored");
      if (restored.kind === "not-restored") {
        expect(restored.notice).not.toContain("parameters-rejected");
        expect(restored.notice).not.toContain("Error");
        if (binding.validate({ ...settings, [numeric ?? ""]: "abc" }).kind !== "accepted") {
          expect(restored.notice).toMatch(/^This shared state could not be restored\. \S/);
        } else {
          // ME-03 and SR-13 put their default back for a value that is not a number, instead of
          // refusing it (am-lab-domains-silently-clamped-pzj5). The replay then reaches a different
          // state, and the checkpoint digest is what refuses the link.
          expect(COERCING_LABS).toContain(lab);
          expect(restored.notice).toContain("consistency checks");
        }
      }
      expect(session.acceptedParameters()).toEqual(before);
    });

    test(`${lab}: another laboratory's tape leaves the settings alone`, () => {
      const settings = changedSettings(binding);
      const tape = settings ? tapeForSettings(binding, settings) : null;
      expect(tape).not.toBeNull();
      if (!tape) return;
      const session = binding.createSession(`${lab}-tape-foreign`);
      const before = { ...session.acceptedParameters() };
      const restored = restoreTape(binding, session, { ...tape, experimentId: "xx-00" });
      expect(restored.kind).toBe("not-restored");
      expect(session.acceptedParameters()).toEqual(before);
    });
  }
});
