import { describe, expect, test } from "bun:test";
import { fixtureHalvingDiffusivity } from "../reader/misconceptions/fixtures.ts";
import {
  __clearMisconceptionContentForTesting,
  registerMisconceptionContent,
  registerMisconceptionKind,
} from "../reader/misconceptions/registerKind.ts";
import { getClarificationKind } from "../reader/stack/kinds.ts";

/**
 * am-read-misconception-callouts-a3o registers the `misconception` clarification kind with the
 * real closed registry (src/reader/stack/kinds.ts, am-read-return-stack-oxa). That registry's own
 * test-only reset is explicitly documented as unsafe to call mid-process (it wipes every OTHER
 * test file's top-level registrations in bun's shared-process runner) -- so, like that bead's own
 * tests, this file never calls it. `registerMisconceptionKind` is idempotent for exactly this
 * reason: every test below (and every other test file that imports this module) can call it
 * freely without tripping the registry's own duplicate-registration guard.
 */
registerMisconceptionKind();

function requireMisconceptionKind() {
  const def = getClarificationKind("misconception");
  if (!def) throw new Error("'misconception' kind did not register.");
  return def;
}

function requireParsed(def: ReturnType<typeof requireMisconceptionKind>, raw: string) {
  const parsed = def.parseId(raw);
  if (!parsed) throw new Error(`Expected "${raw}" to parse as a misconception id.`);
  return parsed;
}

describe("registerMisconceptionKind", () => {
  test("registers 'misconception' in the real closed registry, descends: true", () => {
    const def = getClarificationKind("misconception");
    expect(def).toBeDefined();
    expect(def?.descends).toBe(true);
    expect(typeof def?.render).toBe("function");
  });

  test("calling it again is a no-op, not a throw", () => {
    expect(() => registerMisconceptionKind()).not.toThrow();
    expect(() => registerMisconceptionKind()).not.toThrow();
  });

  test("parseId accepts lowercase-kebab ids and rejects malformed ones", () => {
    const def = requireMisconceptionKind();
    expect(def.parseId("misc-halving-diffusivity-halves-displacement")).toEqual({
      id: "misc-halving-diffusivity-halves-displacement",
    });
    expect(def.parseId("Misc-Bad")).toBeFalsy();
    expect(def.parseId("1-leading-digit")).toBeFalsy();
    expect(def.parseId("has spaces")).toBeFalsy();
    expect(def.parseId("")).toBeFalsy();
  });

  test("staticHref and title are derived from the parsed id", () => {
    const def = requireMisconceptionKind();
    const parsed = requireParsed(def, "misc-test-href-and-title");
    expect(def.staticHref(parsed)).toBe("#misconception-misc-test-href-and-title");
    expect(def.title(parsed)).toContain("misc-test-href-and-title");
  });

  test("render shows the honest 'not loaded' notice for an id nothing has registered content for", () => {
    __clearMisconceptionContentForTesting();
    const def = requireMisconceptionKind();
    const parsed = requireParsed(def, "misc-nothing-registered-this-id");
    const node = def.render?.({ parsed, instanceId: "test-instance-1" });
    // A ReactNode created via createElement; inspect its props rather than rendering, so this
    // stays a .ts (non-JSX) test consistent with kinds.ts's own reasoning for staying .ts.
    const el = node as { type: string; props: Record<string, unknown> };
    expect(el.type).toBe("p");
    expect(el.props["data-misconception-not-loaded"]).toBe("misc-nothing-registered-this-id");
  });

  test("render shows the real callout once content is registered for that id", () => {
    __clearMisconceptionContentForTesting();
    registerMisconceptionContent([
      { misconception: fixtureHalvingDiffusivity, interventionStatus: { state: "reviewed" } },
    ]);
    const def = requireMisconceptionKind();
    const parsed = requireParsed(def, fixtureHalvingDiffusivity.id);
    const node = def.render?.({ parsed, instanceId: "test-instance-2" });
    const el = node as { type: unknown; props: Record<string, unknown> };
    expect(el.props.misconception).toBe(fixtureHalvingDiffusivity);
    expect(el.props.interventionStatus).toEqual({ state: "reviewed" });
    expect(el.props.expanded).toBe(true);
    __clearMisconceptionContentForTesting();
  });

  test("registerMisconceptionContent's interventionStatus is passed through as given, not hardcoded", () => {
    __clearMisconceptionContentForTesting();
    registerMisconceptionContent([
      {
        misconception: fixtureHalvingDiffusivity,
        interventionStatus: { state: "not-yet-reviewed" },
      },
    ]);
    const def = requireMisconceptionKind();
    const parsed = requireParsed(def, fixtureHalvingDiffusivity.id);
    const node = def.render?.({ parsed, instanceId: "test-instance-3" });
    const el = node as { props: Record<string, unknown> };
    expect(el.props.interventionStatus).toEqual({ state: "not-yet-reviewed" });
    __clearMisconceptionContentForTesting();
  });
});
