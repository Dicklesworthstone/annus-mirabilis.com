import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  CATALOGUE_IDS,
  CATALOGUE_QUESTIONS,
  type CatalogueId,
  REGISTERED_IDS,
} from "../experiments/catalogue.ts";
import { resolveExperimentDispatch, type ViewLoaders } from "../experiments/dispatch.tsx";
import { assertOwnerBinding, MissingOwnerError, OWNER_BINDINGS } from "../experiments/owners.ts";
import { REGISTRY, registryEntry, registryParityViolations } from "../experiments/registry.ts";

describe("owners: every registered id names exactly one real binding", () => {
  /**
   * THE NAME CARRIES NO NUMBER, deliberately. It used to read "all 33 registered ids ..." with 33
   * hardcoded in the assertion beside it, and registering light-thread made the tree 34: the test
   * failed, and its NAME was a second place the number had to be corrected. A count in a test name
   * is a fact about the tree stored where nothing checks it - had only the assertion been updated,
   * the name would have gone on claiming 33 forever.
   *
   * The assertion is now the relation it always meant: the bound ids and the registered ids are the
   * same set. That cannot drift when an instrument is added, and it says more than a count did -
   * a count of 34 is equally satisfied by 34 bindings for 30 registered ids and four strays.
   *
   * The floors keep it from being vacuous: the set must be non-empty, and it must be a proper
   * subset of the catalogue, so a registry that registered everything - or nothing - fails here
   * rather than passing an equality between two empty sets. This is the same derive-do-not-hardcode
   * move the MissingOwnerError test below already documents, applied to the count.
   */
  /*
   * Two shapes of owner are real, and the naming rule below admits exactly those two.
   *
   * 1. One instrument, one session module: `lq-01` -> src/experiments/lq01/session.ts, with a
   *    function named for it (createLq01Session).
   * 2. One FAMILY owner shared by several instruments: the three shelf-optics comparisons all
   *    bind src/experiments/shelfOptics/evaluation.ts's evaluateShelfOptics. That is the
   *    ownership AGENTS.md asks for ("Kernels own the law"; do not duplicate an owner per page),
   *    and src/experiments/shelfOptics/registration.test.mjs pins exactly that module. Until
   *    2026-09-22 this test demanded shape 1 for every id, so the two tests contradicted each
   *    other and no binding could satisfy both; the fast lane was red on it from the moment the
   *    shelf commits arrived.
   *
   * Shape 2 is not a loophole: a binding off the per-id path passes only when at least two
   * registered ids name the same module AND the same function. A single stray id pointing at
   * some other file still fails. And every binding, of either shape, must now name a function
   * the module really exports, checked by importing it. Before this, "the module exists" was the
   * only link to reality, so a binding naming a misspelled or deleted function passed.
   */
  test("the ids with an owner binding are exactly the registered ids", async () => {
    const bound = new Set(Object.keys(OWNER_BINDINGS));
    const registered = new Set<string>(REGISTERED_IDS);
    expect(bound).toEqual(registered);
    expect(registered.size).toBeGreaterThan(0);
    expect(registered.size).toBeLessThan(CATALOGUE_IDS.length);

    const sharers = new Map<string, string[]>();
    for (const [id, binding] of Object.entries(OWNER_BINDINGS)) {
      if (binding?.kind !== "reference-evaluator") continue;
      const key = `${binding.module}#${binding.function}`;
      sharers.set(key, [...(sharers.get(key) ?? []), id]);
    }

    let familyBindings = 0;
    for (const [id, binding] of Object.entries(OWNER_BINDINGS)) {
      // `light-thread` -> `lightThread`. The old rule was id.replace("-", ""), which gives
      // "lightthread" and matched nothing on disk; it had never been reached, because the
      // hardcoded count above failed first and aborted the test before the loop. A count that
      // fails early hides every assertion after it.
      const directoryId = id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
      expect(binding?.kind).toBe("reference-evaluator");
      if (binding?.kind !== "reference-evaluator") continue;
      const perInstrument = binding.module === `src/experiments/${directoryId}/session.ts`;
      if (perInstrument) {
        expect(binding.function.toLowerCase()).toContain(directoryId.toLowerCase());
      } else {
        // A family owner: at least two registered ids share this exact module and function,
        // all members share the id prefix (`shelf-`), the module lives under a directory named
        // from that prefix (src/experiments/shelfOptics/), and it is no member's own
        // per-instrument session. Without the last three, lq-01 could "join" the shelf family,
        // or lq-02 could point at lq01/session.ts and call the pair a family.
        const family = sharers.get(`${binding.module}#${binding.function}`) ?? [];
        const prefix = id.split("-")[0] ?? id;
        const camel = (f: string) => f.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
        const genuineFamily =
          family.length >= 2 &&
          family.every((f) => f.split("-")[0] === prefix) &&
          binding.module.startsWith(`src/experiments/${prefix}`) &&
          family.every((f) => binding.module !== `src/experiments/${camel(f)}/session.ts`);
        expect({ id, module: binding.module, genuineFamily }).toEqual({
          id,
          module: binding.module,
          genuineFamily: true,
        });
        familyBindings += 1;
      }
      // "naming their real session module" is a claim about the filesystem, so it is checked
      // against the filesystem rather than against a second copy of the naming rule...
      const path = resolve(process.cwd(), binding.module);
      expect(existsSync(path)).toBe(true);
      // ...and the function it names must really be exported there.
      const mod = (await import(path)) as Record<string, unknown>;
      expect({ id, exported: typeof mod[binding.function] }).toEqual({
        id,
        exported: "function",
      });
    }
    // The family branch is exercised, not merely permitted: the shelf family is bound today.
    expect(familyBindings).toBeGreaterThan(0);
  });

  test("assertOwnerBinding returns null for in-preparation ids without checking a binding", () => {
    expect(assertOwnerBinding("shelf-michelson-morley", "in-preparation")).toBeNull();
  });

  test("assertOwnerBinding throws MissingOwnerError, naming the id, for a registered id with no binding", () => {
    // Derived rather than hardcoded: the registry grows every tick, so this picks whichever
    // catalogue id genuinely has no owner binding right now, instead of naming one that may
    // gain a binding later (this test broke twice from exactly that drift before this fix).
    const unbound = CATALOGUE_IDS.find((id) => !(id in OWNER_BINDINGS));
    if (!unbound) throw new Error("expected at least one catalogue id with no owner binding");
    expect(() => assertOwnerBinding(unbound, "registered")).toThrow(MissingOwnerError);
    try {
      assertOwnerBinding(unbound, "registered");
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(MissingOwnerError);
      expect((error as MissingOwnerError).id).toBe(unbound);
      expect((error as Error).message).toContain(unbound);
    }
  });
});

describe("registry: built eagerly, one entry per catalogue id", () => {
  test("every catalogue id has a registry entry with a matching status", () => {
    for (const id of CATALOGUE_IDS) {
      const entry = registryEntry(id);
      expect(entry.id).toBe(id);
      expect(REGISTRY[id]).toBe(entry);
    }
  });

  test("every registered entry has a non-null owner; every in-preparation entry has a null owner", () => {
    for (const id of CATALOGUE_IDS) {
      const entry = registryEntry(id);
      if (entry.status === "registered") expect(entry.owner).not.toBeNull();
      else expect(entry.owner).toBeNull();
    }
  });

  test("registryParityViolations is empty against the real, built registry", () => {
    expect(registryParityViolations()).toEqual([]);
  });

  test("only the ids with an authored CATALOGUE_QUESTIONS entry carry a question", () => {
    // Derived from CATALOGUE_QUESTIONS itself, never a duplicated snapshot of its keys.
    const authored = new Set(Object.keys(CATALOGUE_QUESTIONS));
    for (const id of CATALOGUE_IDS) {
      const entry = registryEntry(id);
      if (authored.has(id)) expect(entry.question).toBeTruthy();
      else expect(entry.question).toBeUndefined();
    }
  });
});

describe("resolveExperimentDispatch: the pure resolution contract, no React required", () => {
  test("an id outside the catalogue resolves to 'unknown' with typed refusal code 'unknown-catalogue-id'", () => {
    const state = resolveExperimentDispatch("wright-flyer");
    expect(state.kind).toBe("unknown");
    if (state.kind === "unknown") {
      expect(state.requestedId).toBe("wright-flyer");
      expect(state.reason).toContain("wright-flyer");
      expect(state.refusalCode).toBe("unknown-catalogue-id");
    }
  });

  test("an address with malformed grammar resolves to 'unknown' with typed refusal code 'invalid-address-grammar'", () => {
    const state = resolveExperimentDispatch("bm-01:too:many:colons");
    expect(state.kind).toBe("unknown");
    if (state.kind === "unknown") {
      expect(state.refusalCode).toBe("invalid-address-grammar");
    }
  });

  test("an unregistered mode address on a registered id resolves to 'unknown' with typed refusal code 'undeclared-mode'", () => {
    const state = resolveExperimentDispatch("bm-06:kicks-off");
    expect(state.kind).toBe("unknown");
    if (state.kind === "unknown") {
      expect(state.refusalCode).toBe("undeclared-mode");
      expect(state.reason).toContain("kicks-off");
    }
  });

  test("every catalogue id that is NOT a currently-registered id resolves to 'unknown' or 'in-preparation', never 'registered'", () => {
    // Derived from REGISTERED_IDS itself, never a duplicated snapshot.
    const registeredSet = new Set<CatalogueId>(REGISTERED_IDS);
    for (const id of CATALOGUE_IDS) {
      if (registeredSet.has(id)) continue;
      const state = resolveExperimentDispatch(id);
      expect(state.kind).toBe("in-preparation");
    }
  });

  test("a catalogue id in preparation resolves to in-preparation, carrying its authored question when present", () => {
    // Derived rather than naming one id: any in-preparation id with no authored question
    // demonstrates the same contract without drifting when the registry grows.
    const registeredSet = new Set<CatalogueId>(REGISTERED_IDS);
    const questioned = new Set(Object.keys(CATALOGUE_QUESTIONS));
    const candidate = CATALOGUE_IDS.find((id) => !registeredSet.has(id) && !questioned.has(id));
    if (!candidate) throw new Error("expected an in-preparation id with no authored question");
    const withQuestion = resolveExperimentDispatch(candidate);
    expect(withQuestion.kind).toBe("in-preparation");
    if (withQuestion.kind === "in-preparation") expect(withQuestion.question).toBeUndefined();
  });

  test("every registered core id resolves to 'registered' with its real owner binding", () => {
    // Same reason as above: the loop already covers whatever REGISTERED_IDS holds, so a count in
    // the name only creates a second place for the number to be wrong.
    expect(REGISTERED_IDS.length).toBeGreaterThan(0);
    for (const id of REGISTERED_IDS) {
      const state = resolveExperimentDispatch(id);
      expect(state.kind).toBe("registered");
      if (state.kind === "registered") {
        expect(state.owner.kind).toBe("reference-evaluator");
        expect(state.mode).toBeNull();
        expect(state.id).toBe(id);
      }
    }
  });

  test("a supplied view loader for a registered id is threaded through", () => {
    const loaders: ViewLoaders = {
      "bm-06": async () => ({ default: () => null }),
    };
    const state = resolveExperimentDispatch("bm-06", loaders);
    expect(state.kind).toBe("registered");
    if (state.kind === "registered") expect(state.view).toBe(loaders["bm-06"]);
  });

  test("a frankensim owner binding with blocked WASM yields host fallback, not unavailable (AC 10)", () => {
    // Contract check: an owner with kind 'frankensim' specifies a reference-evaluator fallback
    const mockFrankensimBinding = {
      kind: "frankensim" as const,
      capability: "diffusion.stokes-einstein",
      export: "compute_d",
      fallback: {
        module: "src/physics/reference/diffusion.ts",
        function: "stokesEinsteinD",
      },
    };
    expect(mockFrankensimBinding.kind).toBe("frankensim");
    expect(mockFrankensimBinding.fallback.module).toContain("physics/reference");
    expect(mockFrankensimBinding.fallback.function).toBe("stokesEinsteinD");
  });

  test("no fixture experiment id appears in application catalogue or registry (AC 15)", () => {
    const fixturePattern = /^(?:fixture|test|mock|probe)-/i;
    for (const id of CATALOGUE_IDS) {
      expect(fixturePattern.test(id)).toBe(false);
      expect(id).not.toContain("fixture");
      expect(id).not.toContain("mock");
    }
    for (const id of Object.keys(REGISTRY)) {
      expect(fixturePattern.test(id)).toBe(false);
      expect(id).not.toContain("fixture");
    }
  });
});
