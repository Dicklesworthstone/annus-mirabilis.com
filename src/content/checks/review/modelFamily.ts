/**
 * MODEL ID TO VENDOR FAMILY, AS A DECLARED TABLE (am-rc1001-bridge-plan-pcjk.17).
 *
 * `validateAgentReview` checks that a reviewer's id differs from the translator's and never that
 * the MODEL differs. Measured 2026-10-01 and again here: every `modelId` in
 * content/translation-units is `claude-opus-5-5` -- 2,463 occurrences, translators and reviewers
 * alike -- so "agents other than its translator" is satisfied by pane name while the model is the
 * same one twice. AGENTS.md's later ruling asks for "at least one by a reviewer of a DIFFERENT
 * MODEL FAMILY from the author", and no code in this repository knew what a family was.
 *
 * WHETHER THE ENGLISH UNITS MUST SATISFY THAT IS AN OWNER DECISION (D-B on pcjk.17), so nothing
 * here is wired into the guard. This is only the table the decision needs either way: if diversity
 * is required the comparison needs a family notion, and if same-model review is kept the guard's
 * comment still has to say what a family is in order to say it does not care.
 *
 * WHY A TABLE AND NOT A STRING TEST, which is the whole content of this module. `am-yvf3` removed
 * `reviewerId.includes("gpt")` and `...includes("claude")` after a HUMAN reviewer named Claude was
 * classified as a model, and its test pins seven names that carry no vendor word at all --
 * `grok-4.6`, `gemini-3.8-flash-high`, `o3`, `llama-4` among them. A substring test gets those
 * wrong in both directions: it misses a bare name and it claims a family for any id that happens to
 * contain a vendor's letters. So matching here is an ANCHORED prefix against a declared list, and
 * an id that matches nothing returns undefined rather than a guessed family.
 *
 * `undefined` IS NOT A FAMILY AND NOT A MISMATCH. `familiesDiffer` returns a typed verdict rather
 * than a boolean for exactly this reason: two unrecognised ids are not evidence of diversity, and a
 * boolean would make them read as a pass. That is the shape of a check that cannot fail.
 */

/** The vendor families this project's agents belong to. */
export type ModelFamily = "anthropic" | "openai" | "google" | "xai" | "meta";

/**
 * Declared prefixes, each with the evidence it is here.
 *
 * Every entry names a model this project has actually run or recorded, because a table of families
 * nobody uses invites a guess for the ones it omits, which is the failure above.
 */
const FAMILY_PREFIXES: readonly Readonly<{
  prefix: string;
  family: ModelFamily;
  evidence: string;
}>[] = Object.freeze([
  Object.freeze({
    prefix: "claude-",
    family: "anthropic",
    evidence:
      "The only modelId in content/translation-units: claude-opus-5-5, 2,463 occurrences across " +
      "821 units' translators and 1,642 review rounds.",
  }),
  Object.freeze({
    prefix: "gpt-",
    family: "openai",
    evidence:
      'AGENTS.md addresses a "Codex/GPT-5.2" pane directly, and its cloud-OCR policy delegates ' +
      "every OCR run to a GPT-5.6 Luna worker.",
  }),
  Object.freeze({
    prefix: "codex-",
    family: "openai",
    evidence: "The same AGENTS.md note names Codex as a pane on this project.",
  }),
  Object.freeze({
    prefix: "o3",
    family: "openai",
    evidence: "Pinned by name in authorship.test.ts's am-yvf3 case as an id with no vendor word.",
  }),
  Object.freeze({
    prefix: "o4-",
    family: "openai",
    evidence: "The successor naming of the o3 line, declared so it is not an unknown id later.",
  }),
  Object.freeze({
    prefix: "gemini-",
    family: "google",
    evidence:
      'gemini-3.8-flash-high, pinned in authorship.test.ts as "a live agent on this project".',
  }),
  Object.freeze({
    prefix: "grok-",
    family: "xai",
    evidence:
      'grok-4.6, pinned in authorship.test.ts as "a live agent on this project" and the id whose ' +
      "misclassification the substring test was removed for.",
  }),
  Object.freeze({
    prefix: "llama-",
    family: "meta",
    evidence: "Pinned by name in authorship.test.ts's am-yvf3 case.",
  }),
]);

/** Every declared prefix with its family and the reason it is declared, for a reviewer. */
export const DECLARED_MODEL_PREFIXES = FAMILY_PREFIXES;

/**
 * The family of a model id, or undefined when the table does not declare it.
 *
 * Matching is an anchored prefix on the id as recorded. `my-gpt-clone` is NOT openai, because the
 * vendor letters are not at the start; that is the direction a substring test fails in, and the one
 * that silently credits an unknown model to a family it has nothing to do with.
 */
export function familyOf(modelId: string): ModelFamily | undefined {
  const id = modelId.trim().toLowerCase();
  if (id === "") return undefined;
  // Longest prefix first, so `o4-` is not shadowed by a shorter entry if one is added later.
  const sorted = [...FAMILY_PREFIXES].sort((a, b) => b.prefix.length - a.prefix.length);
  return sorted.find((entry) => id.startsWith(entry.prefix))?.family;
}

export type FamilyComparison =
  /** Both ids are declared and belong to different families. */
  | Readonly<{ kind: "differ"; author: ModelFamily; reviewer: ModelFamily }>
  /** Both ids are declared and belong to the same family. */
  | Readonly<{ kind: "same"; family: ModelFamily }>
  /** At least one id is not declared, so no comparison can be made. Never a pass. */
  | Readonly<{ kind: "unknown-model"; undeclared: readonly string[] }>;

/**
 * Whether two model ids belong to different families.
 *
 * Returns `unknown-model` rather than a boolean when either id is undeclared, naming the ids. A
 * caller must treat that as a refusal: an id the table does not know could belong to any family,
 * including the author's, so reading it as diversity would be the vacuous pass this module exists
 * to prevent.
 */
export function familiesDiffer(authorModelId: string, reviewerModelId: string): FamilyComparison {
  const author = familyOf(authorModelId);
  const reviewer = familyOf(reviewerModelId);
  const undeclared = [
    ...(author === undefined ? [authorModelId] : []),
    ...(reviewer === undefined ? [reviewerModelId] : []),
  ];
  if (author === undefined || reviewer === undefined) {
    return { kind: "unknown-model", undeclared };
  }
  return author === reviewer
    ? { kind: "same", family: author }
    : { kind: "differ", author, reviewer };
}
