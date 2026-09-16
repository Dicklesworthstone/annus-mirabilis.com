import { describe, expect, test } from "bun:test";
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
  test("all 33 registered ids bind to a reference-evaluator naming their real session module", () => {
    expect(Object.keys(OWNER_BINDINGS).length).toBe(33);
    for (const [id, binding] of Object.entries(OWNER_BINDINGS)) {
      const directoryId = id.replace("-", "");
      expect(binding?.kind).toBe("reference-evaluator");
      if (binding?.kind === "reference-evaluator") {
        expect(binding.module).toBe(`src/experiments/${directoryId}/session.ts`);
        expect(binding.function.toLowerCase()).toContain(directoryId);
      }
    }
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

  test("all 33 registered core ids resolve to 'registered' with their real owner bindings", () => {
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
});
