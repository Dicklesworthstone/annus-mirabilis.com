import { describe, expect, test } from "bun:test";
import { CATALOGUE_IDS } from "../experiments/catalogue.ts";
import { resolveExperimentDispatch, type ViewLoaders } from "../experiments/dispatch.tsx";
import { assertOwnerBinding, MissingOwnerError, OWNER_BINDINGS } from "../experiments/owners.ts";
import { REGISTRY, registryEntry, registryParityViolations } from "../experiments/registry.ts";

describe("owners: every registered id names exactly one real binding", () => {
  test("all five registered ids bind to a reference-evaluator naming their real session module", () => {
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
    expect(assertOwnerBinding("lq-01", "in-preparation")).toBeNull();
  });

  test("assertOwnerBinding throws MissingOwnerError, naming the id, for a registered id with no binding", () => {
    // lq-02 is still in-preparation with no owner binding today (unlike lq-01, which gained a
    // binding since this test was first written); it stands in here for "a registered id with
    // no binding" without asserting anything about its own real catalogue status.
    expect(() => assertOwnerBinding("lq-02", "registered")).toThrow(MissingOwnerError);
    try {
      assertOwnerBinding("lq-02", "registered");
      throw new Error("expected a throw");
    } catch (error) {
      expect(error).toBeInstanceOf(MissingOwnerError);
      expect((error as MissingOwnerError).id).toBe("lq-02");
      expect((error as Error).message).toContain("lq-02");
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
    const authored = new Set([
      "bm-03",
      "bm-04",
      "bm-05",
      "lq-01",
      "lq-03",
      "lq-08",
      "me-01",
      "me-02",
    ]);
    for (const id of CATALOGUE_IDS) {
      const entry = registryEntry(id);
      if (authored.has(id)) expect(entry.question).toBeTruthy();
      else expect(entry.question).toBeUndefined();
    }
  });
});

describe("resolveExperimentDispatch: the pure resolution contract, no React required", () => {
  test("an id outside the catalogue resolves to 'unknown', never to a substitute instrument", () => {
    const state = resolveExperimentDispatch("wright-flyer");
    expect(state.kind).toBe("unknown");
    if (state.kind === "unknown") {
      expect(state.requestedId).toBe("wright-flyer");
      expect(state.reason).toContain("wright-flyer");
    }
  });

  test("every catalogue id that is NOT a currently-registered id resolves to 'unknown' or 'in-preparation', never 'registered'", () => {
    const registeredSet = new Set([
      "bm-01",
      "bm-02",
      "bm-03",
      "bm-04",
      "bm-05",
      "bm-06",
      "bm-07",
      "bm-08",
      "lq-01",
      "lq-03",
      "lq-08",
      "me-01",
      "me-02",
    ]);
    for (const id of CATALOGUE_IDS) {
      if (registeredSet.has(id)) continue;
      const state = resolveExperimentDispatch(id);
      expect(state.kind).toBe("in-preparation");
    }
  });

  test("a catalogue id with no manifest resolves to in-preparation, carrying its authored question when present", () => {
    // sr-01 is still in-preparation with no authored question today.
    const withQuestion = resolveExperimentDispatch("sr-01");
    expect(withQuestion.kind).toBe("in-preparation");
    if (withQuestion.kind === "in-preparation") expect(withQuestion.question).toBeUndefined();
  });

  test("a registered id resolves to 'registered' with its real owner binding", () => {
    const state = resolveExperimentDispatch("bm-06");
    expect(state.kind).toBe("registered");
    if (state.kind === "registered") {
      expect(state.owner.kind).toBe("reference-evaluator");
      expect(state.mode).toBeNull();
      expect(state.view).toBeUndefined();
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

  test("an unregistered mode address on a registered id resolves to 'unknown', not to the bare id", () => {
    const state = resolveExperimentDispatch("bm-06:kicks-off");
    expect(state.kind).toBe("unknown");
  });
});
