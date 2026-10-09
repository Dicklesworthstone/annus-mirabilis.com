/**
 * THE FAMILY TABLE, AND THE TWO WAYS A STRING TEST GETS IT WRONG.
 *
 * The reasoning is in modelFamily.ts. What matters here is that the table is proved against the
 * exact names `am-yvf3` was filed for, in BOTH directions, because that bead's defect was a
 * substring test and a substring test passes a naive version of every case below except two.
 *
 *   MISSES a bare name: `grok-4.6`, `gemini-3.8-flash-high`, `o3`, `llama-4` carry no vendor word,
 *   so `includes("gpt") || includes("claude")` classified none of them.
 *   CLAIMS a family it should not: `my-gpt-clone` and `not-a-claude-model` contain the vendor
 *   letters and are not those vendors' models. An anchored prefix refuses both.
 *
 * And `undefined` is tested as its own outcome rather than folded into "not the same family",
 * because an unknown id read as diversity is the vacuous pass this module exists to prevent.
 */

import { describe, expect, test } from "bun:test";
import {
  DECLARED_MODEL_PREFIXES,
  familiesDiffer,
  familyOf,
  type ModelFamily,
} from "./modelFamily.ts";

describe("the table maps the ids this project actually runs", () => {
  test("every id am-yvf3 pinned as carrying no vendor word is still classified", () => {
    // The seven names authorship.test.ts pins, each as a live or historical agent id.
    const expected: readonly (readonly [string, ModelFamily])[] = [
      ["grok-4.6", "xai"],
      ["gemini-3.8-flash-high", "google"],
      ["llama-4", "meta"],
      ["o3", "openai"],
      ["gpt-4o", "openai"],
      ["claude-opus-5", "anthropic"],
      ["claude-opus-5-5", "anthropic"],
    ];
    for (const [id, family] of expected) {
      expect(familyOf(id)).toBe(family);
    }
  });

  test("the corpus's own model id is declared, since the guard would compare it", () => {
    // 2,463 occurrences in content/translation-units, translators and reviewers alike.
    expect(familyOf("claude-opus-5-5")).toBe("anthropic");
  });

  test("every declared prefix carries the evidence it is declared for", () => {
    expect(DECLARED_MODEL_PREFIXES.length).toBeGreaterThan(4);
    for (const entry of DECLARED_MODEL_PREFIXES) {
      // A table of families nobody uses invites a guess for the ones it omits.
      expect(entry.evidence.length).toBeGreaterThan(40);
      expect(entry.prefix).not.toBe("");
      expect(familyOf(`${entry.prefix}x`)).toBe(entry.family);
    }
  });
});

describe("an anchored prefix, not a substring", () => {
  test("the vendor letters anywhere but the start do NOT claim a family", () => {
    // These are the false positives a substring test produces. Each must be unknown.
    for (const id of [
      "my-gpt-clone",
      "not-a-claude-model",
      "xgrok-9",
      "a-gemini-wrapper",
      "openai-o3-proxy",
      "llama",
    ]) {
      expect(familyOf(id)).toBeUndefined();
    }
  });

  test("an id the table does not declare is undefined, never a new family by default", () => {
    for (const id of ["mistral-large", "qwen-3", "deepseek-v3", "", "   ", "unknown"]) {
      expect(familyOf(id)).toBeUndefined();
    }
  });

  test("case and surrounding whitespace do not change the answer", () => {
    expect(familyOf("  Claude-Opus-5-5  ")).toBe("anthropic");
    expect(familyOf("GROK-4.6")).toBe("xai");
  });
});

describe("comparing two models never passes on ignorance", () => {
  test("the corpus's actual situation reads as SAME, which is the finding pcjk.17 reported", () => {
    const verdict = familiesDiffer("claude-opus-5-5", "claude-opus-5-5");
    expect(verdict.kind).toBe("same");
    expect(verdict.kind === "same" && verdict.family).toBe("anthropic");
  });

  test("two declared families differ, and the verdict names both", () => {
    const verdict = familiesDiffer("claude-opus-5-5", "gpt-5.6");
    expect(verdict.kind).toBe("differ");
    expect(verdict.kind === "differ" && verdict.author).toBe("anthropic");
    expect(verdict.kind === "differ" && verdict.reviewer).toBe("openai");
  });

  test("an UNDECLARED id is its own verdict, not diversity and not sameness", () => {
    // The vacuous pass this module exists to prevent: a boolean would make two unknown ids read
    // as "different families" and credit a review round that proves nothing.
    const one = familiesDiffer("claude-opus-5-5", "mistral-large");
    expect(one.kind).toBe("unknown-model");
    expect(one.kind === "unknown-model" && one.undeclared).toEqual(["mistral-large"]);

    const both = familiesDiffer("qwen-3", "mistral-large");
    expect(both.kind).toBe("unknown-model");
    expect(both.kind === "unknown-model" && both.undeclared).toEqual(["qwen-3", "mistral-large"]);

    // Same unknown id twice is also not sameness, because the table cannot say what it is.
    expect(familiesDiffer("qwen-3", "qwen-3").kind).toBe("unknown-model");
  });

  test("a model whose family differs from a SIBLING of its own vendor still reads same", () => {
    // Two Anthropic models are not model diversity, which is the distinction the ruling rests on.
    expect(familiesDiffer("claude-opus-5-5", "claude-haiku-4-5-20251001").kind).toBe("same");
    // And two OpenAI ids spelled differently are likewise one family.
    expect(familiesDiffer("gpt-5.6", "o3").kind).toBe("same");
  });
});
