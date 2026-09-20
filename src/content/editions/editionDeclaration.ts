/**
 * Edition declaration (`content/source-blocks/<slug>/edition.yaml`).
 * Each German-edition bead writes its paper's file. This module validates the format.
 */

import { parseRouteSlug, type RouteSlug } from "../ids.ts";
import { loadOwnersRegistry, type OwnersRegistry } from "../owners/parseOwners.ts";
import { PAPER_BIB_KEYS } from "./ledgerPresence.ts";

export type EditionDeclaration = Readonly<{
  paper: RouteSlug;
  bibliographicKey: string;
  facsimileDigest?: string | undefined;
  ledgerDigest?: string | undefined;
  editors: readonly string[];
  reconciliationRunId?: string | undefined;
}>;

export type DeclarationIssue = Readonly<{
  code:
    | "unknown-paper"
    | "bib-key-mismatch"
    | "missing-digest"
    | "model-only-editors"
    | "unknown-editor"
    | "editor-not-assigned"
    | "owners-registry-unavailable"
    | "missing-reconciliation-run";
  message: string;
}>;

const HUMAN_EDITOR_PATTERN = /^[a-z][a-z0-9-]+$/;
const MODEL_EDITOR_PATTERN = /^(gpt-|claude-|gemini-|grok-|o[0-9]|agent-|model-)/i;

export type ValidateDeclarationOptions = Readonly<{
  /** Injected for tests and for a run against another root. */
  ownersRegistry?: OwnersRegistry | undefined;
  repoRoot?: string | undefined;
}>;

export function validateEditionDeclaration(
  raw: unknown,
  options: ValidateDeclarationOptions = {},
): {
  ok: boolean;
  declaration?: EditionDeclaration;
  issues: readonly DeclarationIssue[];
} {
  const issues: DeclarationIssue[] = [];
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      issues: [{ code: "unknown-paper", message: "edition.yaml must be an object." }],
    };
  }
  const o = raw as Record<string, unknown>;
  const paperRaw = typeof o.paper === "string" ? o.paper : "";
  const paper = parseRouteSlug(paperRaw);
  if (!paper.ok) {
    issues.push({ code: "unknown-paper", message: `Unknown paper slug "${paperRaw}".` });
  }
  const bibliographicKey = typeof o.bibliographicKey === "string" ? o.bibliographicKey : "";
  if (paper.ok && bibliographicKey !== PAPER_BIB_KEYS[paper.value]) {
    issues.push({
      code: "bib-key-mismatch",
      message: `bibliographicKey "${bibliographicKey}" does not match ${PAPER_BIB_KEYS[paper.value]}.`,
    });
  }
  const facsimileDigest = typeof o.facsimileDigest === "string" ? o.facsimileDigest : undefined;
  const ledgerDigest = typeof o.ledgerDigest === "string" ? o.ledgerDigest : undefined;
  if (!facsimileDigest || !ledgerDigest) {
    issues.push({
      code: "missing-digest",
      message: "edition.yaml requires facsimileDigest and ledgerDigest.",
    });
  }
  const editors = Array.isArray(o.editors)
    ? o.editors.filter((e): e is string => typeof e === "string")
    : [];
  if (editors.length === 0 || editors.every((e) => MODEL_EDITOR_PATTERN.test(e))) {
    issues.push({
      code: "model-only-editors",
      message: "editors must include at least one human editor id; a model-only list is refused.",
    });
  }
  // A human editor id is checked against docs/OWNERS.md, not against a spelling rule.
  //
  // This loop used to accept any id matching /^[a-z][a-z0-9-]+$/ and call the result
  // "unknown-editor" when it did not, so "ed-albert", "nobody" and "j-random-hacker"
  // all passed as recognized humans. The bead's section D says the validator fails on
  // an unknown human id and that the id is "the person's id in docs/OWNERS.md"; the
  // registry has been parseable this whole time and four other checks already use it.
  // An unfilled recruiting slot is listed in OWNERS.md but is not a person, so it is
  // refused separately rather than silently accepted by mere presence.
  let registry: OwnersRegistry | undefined = options.ownersRegistry;
  if (registry === undefined) {
    try {
      registry =
        options.repoRoot === undefined
          ? loadOwnersRegistry()
          : loadOwnersRegistry(options.repoRoot);
    } catch (err: unknown) {
      registry = undefined;
      issues.push({
        code: "owners-registry-unavailable",
        message:
          `docs/OWNERS.md could not be read (${err instanceof Error ? err.message : String(err)}), ` +
          "so no editor id could be checked against it. An unreadable registry is not an empty one.",
      });
    }
  }
  let registeredHumans = 0;
  for (const editor of editors) {
    if (MODEL_EDITOR_PATTERN.test(editor)) continue;
    if (!HUMAN_EDITOR_PATTERN.test(editor)) {
      issues.push({ code: "unknown-editor", message: `Unknown human editor id "${editor}".` });
      continue;
    }
    if (registry === undefined) continue;
    const owner = registry.getOwner(editor);
    if (!owner) {
      issues.push({
        code: "unknown-editor",
        message: `Human editor "${editor}" is not found in docs/OWNERS.md.`,
      });
      continue;
    }
    if (!registry.isAssigned(editor)) {
      issues.push({
        code: "editor-not-assigned",
        message:
          `Human editor "${editor}" is listed in docs/OWNERS.md but is not assigned ` +
          `(status "${owner.status}"). An unfilled recruiting slot cannot edit an edition.`,
      });
      continue;
    }
    registeredHumans += 1;
  }
  if (registry !== undefined && registeredHumans === 0 && editors.length > 0) {
    // Reached when every entry was a model, an unknown id, or an unfilled slot. The
    // model-only rule above catches the all-model case; this catches a list whose only
    // "human" is not a person the registry knows.
    if (!issues.some((i) => i.code === "model-only-editors")) {
      issues.push({
        code: "model-only-editors",
        message:
          "editors must include at least one human editor who is assigned in docs/OWNERS.md.",
      });
    }
  }
  const reconciliationRunId =
    typeof o.reconciliationRunId === "string" ? o.reconciliationRunId : undefined;
  if (o.reconciliationRunId !== undefined && !reconciliationRunId) {
    issues.push({
      code: "missing-reconciliation-run",
      message: "reconciliationRunId names no run.",
    });
  }
  if (issues.length > 0) return { ok: false, issues: Object.freeze(issues) };
  if (!paper.ok) return { ok: false, issues: Object.freeze(issues) };
  return {
    ok: true,
    declaration: {
      paper: paper.value,
      bibliographicKey,
      facsimileDigest,
      ledgerDigest,
      editors: Object.freeze(editors),
      reconciliationRunId,
    },
    issues: [],
  };
}
