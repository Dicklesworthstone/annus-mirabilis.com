/**
 * Edition declaration (`content/source-blocks/<slug>/edition.yaml`).
 * Each German-edition bead writes its paper's file. This module validates the format.
 */

import { parseRouteSlug, type RouteSlug } from "../ids.ts";
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
    | "missing-reconciliation-run";
  message: string;
}>;

const HUMAN_EDITOR_PATTERN = /^[a-z][a-z0-9-]+$/;
const MODEL_EDITOR_PATTERN = /^(gpt-|claude-|gemini-|grok-|o[0-9]|agent-|model-)/i;

export function validateEditionDeclaration(raw: unknown): {
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
  for (const editor of editors) {
    if (MODEL_EDITOR_PATTERN.test(editor)) continue;
    if (!HUMAN_EDITOR_PATTERN.test(editor)) {
      issues.push({ code: "unknown-editor", message: `Unknown human editor id "${editor}".` });
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
