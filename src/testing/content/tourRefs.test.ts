/**
 * A TOUR'S STEPS POINT AT THINGS THAT EXIST (am-2rl9, after am-3a8u).
 *
 * A tour is a reader's guided route: each step names an instrument, and may name the preset or
 * tape whose settings answer its predict prompt, and the prompt itself. A reference that resolves
 * to nothing is a step that cannot do what it says, and nothing checked them.
 *
 * ADDED WHILE IT IS GREEN, which is the whole reason it is worth adding now. The same sweep over
 * the instrument manifests found 29 dangling argumentIds and needed a baseline to be useful at
 * all (argumentRefsRatchet.test.ts). This family is clean today: every reference the single
 * fifteen-minute tour makes resolves. A guard put in at zero stays at zero, and never has to
 * argue about which of its failures were inherited.
 *
 * WHAT IT DOES NOT CHECK: whether the preset or tape a step cites is the RIGHT one for its
 * prompt. That is an editorial judgement, and the mass-energy tour records one of them in its own
 * header, where a reader of the record can weigh it.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseYaml } from "../../content/provenance/yaml.ts";

const ROOT = process.cwd();

type Manifest = Readonly<{ presets: Set<string>; prompts: Set<string> }>;

function manifests(): Map<string, Manifest> {
  const out = new Map<string, Manifest>();
  const dir = join(ROOT, "content", "experiments");
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".yaml")) continue;
    const d = parseYaml(readFileSync(join(dir, file), "utf8")) as {
      id?: unknown;
      presets?: { presetId?: unknown; id?: unknown }[];
      predictMode?: { prompts?: { promptId?: unknown; id?: unknown }[] };
    };
    if (typeof d.id !== "string") continue;
    out.set(d.id, {
      presets: new Set((d.presets ?? []).map((p) => String(p.presetId ?? p.id))),
      prompts: new Set((d.predictMode?.prompts ?? []).map((p) => String(p.promptId ?? p.id))),
    });
  }
  return out;
}

function tapeIds(): Set<string> {
  const dir = join(ROOT, "content", "experiments", "tapes");
  if (!existsSync(dir)) return new Set();
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => f.replace(/\.yaml$/, "")),
  );
}

describe("a tour's steps point at things that exist", () => {
  const labs = manifests();
  const tapes = tapeIds();

  test("every instrument, preset, prompt and tape a step names resolves", () => {
    const dir = join(ROOT, "content", "tours");
    const bad: string[] = [];
    let refs = 0;
    let steps = 0;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".yaml")) continue;
      const tour = parseYaml(readFileSync(join(dir, file), "utf8")) as {
        steps?: Record<string, unknown>[];
      };
      for (const step of tour.steps ?? []) {
        steps += 1;
        const at = `${file} ${String(step.id)}`;
        const instrument = typeof step.instrument === "string" ? step.instrument : undefined;
        if (instrument) {
          refs += 1;
          if (!labs.has(instrument)) bad.push(`${at}: no instrument ${instrument}`);
        }
        if (typeof step.tape === "string") {
          refs += 1;
          if (!tapes.has(step.tape)) bad.push(`${at}: no tape ${step.tape}`);
        }
        if (typeof step.preset === "string") {
          refs += 1;
          if (!labs.get(instrument ?? "")?.presets.has(step.preset))
            bad.push(`${at}: ${instrument ?? "(no instrument)"} has no preset ${step.preset}`);
        }
        if (typeof step.promptId === "string") {
          refs += 1;
          if (!labs.get(instrument ?? "")?.prompts.has(step.promptId))
            bad.push(`${at}: ${instrument ?? "(no instrument)"} has no prompt ${step.promptId}`);
        }
      }
    }
    console.log(
      `[tour refs] ${refs} references over ${steps} steps, against ${labs.size} manifests and ${tapes.size} tapes`,
    );
    expect(bad).toEqual([]);
    // Non-vacuity on both sides: a tour directory read as empty, or manifests read as empty,
    // would satisfy the assertion above while checking nothing. The floor is measured, not
    // guessed: 9 references over 8 steps on 2026-09-28, and the first version of this line said
    // 10 because I picked a round number before counting, which made the guard fail on a corpus
    // it had nothing wrong with.
    expect(refs).toBeGreaterThan(5);
    expect(steps).toBeGreaterThan(5);
    expect(labs.size).toBeGreaterThan(25);
    expect(tapes.size).toBeGreaterThan(15);
  });
});
