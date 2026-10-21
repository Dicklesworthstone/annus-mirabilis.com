/**
 * EVERY PUBLISHED WALKTHROUGH WHOSE LABORATORY CAN BE DRIVEN IS OFFERED BY THAT LABORATORY.
 *
 * On 2026-10-20 seven laboratories gained a `WalkthroughControl` and two were missed. The miss was
 * not a judgement call: the mount loop was keyed on `src/components/lab/<labId>/*Lab.tsx`, and
 * SR-02 (`MagnetConductorLab.tsx`) and ME-02 (`CoefficientLab.tsx`) live DIRECTLY in
 * `src/components/lab/`. The loop found no directory, skipped them silently, and the count read as
 * complete. Both had a converted tape and a full `_TAPE` binding the whole time.
 *
 * That is the wrong-population error this repository documents under "A Count Used As Evidence Is
 * Anchored", made while repairing instances of it. A count cannot notice its own missing members,
 * so this asserts the SHORTFALL is empty rather than asserting a total.
 *
 * THE INVARIANT. A published tape reaches a reader only if some component mounts the control for
 * its laboratory. A laboratory can be driven only if it exports a `_TAPE` binding -- a
 * `DraftTapeBinding` deliberately carries no `createSession`, because a worker laboratory's shared
 * link "loads settings only; they never start a calculation". So:
 *
 *     { published tape } INTERSECT { lab has a _TAPE binding } MINUS { lab mounts the control } = {}
 *
 * and any member of that difference is a laboratory whose reader cannot reach a walkthrough that
 * exists, for no declared reason.
 *
 * WHICH HALF OF THE QUESTION THIS ANSWERS. It asks whether the control is MOUNTED, not whether it
 * RENDERS a button -- `WalkthroughControl` declines a tape whose mode or checkpoint it cannot play,
 * which is correct and is why ME-03 shows none today. Whether a mounted control produces a button
 * that PLAYS is `src/components/lab/walkthroughButtonReaches.test.tsx`, which presses every one.
 *
 * Mounting is read from source with COMMENTS STRIPPED, because a docblock naming the component is
 * not a mount, and this file and several laboratories discuss it in prose.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { TEACHING_TAPES } from "../../experiments/permalink/teachingTapeCatalogue.ts";

const ROOT = resolve(new URL("../../../", import.meta.url).pathname);
const LAB_DIR = join(ROOT, "src", "components", "lab");

/** Comment bodies blanked, newlines kept so a line number still means something. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_m, lead: string) => lead);
}

/** Every `.tsx` under src/components/lab, at any depth, excluding tests. */
function labComponents(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) labComponents(path, found);
    else if (entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) found.push(path);
  }
  return found;
}

/** `sr-02` -> `sr02`, the directory a laboratory's modules live in. */
const dirOf = (experimentId: string) => experimentId.replace("-", "");

const publishedIds = [...new Set([...TEACHING_TAPES.values()].map((t) => t.experimentId))].sort();

const components = labComponents(LAB_DIR);
const mountedBindings = new Set<string>();
for (const file of components) {
  const code = withoutComments(readFileSync(file, "utf8"));
  if (!code.includes("<WalkthroughControl")) continue;
  for (const match of code.matchAll(/binding=\{([A-Z0-9_]+_TAPE)\}/g)) {
    const name = match[1];
    if (name) mountedBindings.add(name);
  }
}

const bindingNameOf = (experimentId: string) => `${dirOf(experimentId).toUpperCase()}_TAPE`;
const hasLabBinding = (experimentId: string) =>
  existsSync(join(ROOT, "src", "experiments", dirOf(experimentId), "tape.ts"));

describe("published walkthroughs reach the laboratory that owns them", () => {
  test("the populations are non-vacuous, and both are named", () => {
    console.log(
      `[census] walkthrough coverage: ${TEACHING_TAPES.size} published tape(s) over ${publishedIds.length} laboratory id(s); ` +
        `${components.length} lab component(s) scanned; ${mountedBindings.size} binding(s) mounted`,
    );
    // A pass over zero published tapes, or zero components, is what this test exists to refuse.
    expect(publishedIds.length).toBeGreaterThanOrEqual(19);
    expect(components.length).toBeGreaterThanOrEqual(30);
    expect(mountedBindings.size).toBeGreaterThanOrEqual(8);
  });

  test("no laboratory with a drivable binding has an unoffered walkthrough", () => {
    const drivable = publishedIds.filter(hasLabBinding);
    const shortfall = drivable.filter((id) => !mountedBindings.has(bindingNameOf(id)));
    console.log(
      `[census] of ${publishedIds.length} laboratory id(s) with a published tape, ${drivable.length} have a _TAPE binding; ` +
        `shortfall ${shortfall.length}${shortfall.length > 0 ? `: ${shortfall.join(", ")}` : ""}`,
    );
    expect(drivable.length).toBeGreaterThanOrEqual(14);
    expect(
      shortfall,
      `these laboratories can be driven and publish a walkthrough no component offers: ${shortfall.join(", ")}`,
    ).toEqual([]);
  });

  test("the laboratories excluded for a draft binding are named, not silently dropped", () => {
    // Reported rather than asserted: a worker laboratory's link loads settings and starts nothing,
    // so it has no host session to stand behind a Play button. If one ever gains a `_TAPE`
    // binding, the test above picks it up and this list shortens on its own.
    const draftOnly = publishedIds.filter((id) => !hasLabBinding(id));
    console.log(
      `[census] excluded for a draft-only binding: ${draftOnly.length} (${draftOnly.join(", ") || "none"})`,
    );
    for (const id of draftOnly) {
      expect(
        existsSync(join(ROOT, "src", "experiments", dirOf(id), "draftTape.ts")),
        `${id} has neither a tape.ts nor a draftTape.ts, so its exclusion has no declared reason`,
      ).toBe(true);
    }
  });

  test("the comment stripper does not credit a mention as a mount", () => {
    // Both directions, because a stripper that removed everything would report a clean surface
    // forever and a stripper that removed nothing would credit this very docblock.
    expect(withoutComments("// <WalkthroughControl binding={XX_TAPE} />")).not.toContain(
      "<WalkthroughControl",
    );
    expect(withoutComments("/* <WalkthroughControl binding={XX_TAPE} /> */")).not.toContain(
      "<WalkthroughControl",
    );
    expect(withoutComments("<WalkthroughControl binding={XX_TAPE} />")).toContain(
      "<WalkthroughControl",
    );
    // A trailing comment must not swallow the code before it.
    expect(withoutComments("<WalkthroughControl /> // mounted here")).toContain(
      "<WalkthroughControl",
    );
    // And a URL's // must survive, or every file with a link loses its tail.
    expect(withoutComments('const u = "https://example.com/x";')).toContain("https://example.com");
  });
});
