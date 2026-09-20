import { parseContentJson } from "../../content/compiler/loaders.ts";
import { parseMissingStepAllowlist, parseMissingStepLesson } from "./transitionSchema.ts";
import { checkWorkedTransitions } from "./workedCheck.ts";

export type MissingStepContentFile = Readonly<{ path: string; text: string }>;
/** Shared by both content compiler entry points. The HTML emitter adds no separate schema. */
export function checkMissingStepContent(
  files: readonly MissingStepContentFile[],
  argumentsIds: readonly string[],
) {
  const selected = files.filter((file) =>
    /^(?:content\/)?equations\/(?:derivations\/[^/]+\.yaml|missing-step-allowlist\.yaml)$/.test(
      file.path,
    ),
  );
  const diagnostics: { code: string; path: string; message: string }[] = [];
  if (!selected.length) return diagnostics;
  const policy = selected.filter((file) => file.path.endsWith("/missing-step-allowlist.yaml"));
  if (policy.length !== 1)
    return [
      {
        code: "missing-step-policy",
        path: "equations/missing-step-allowlist.yaml",
        message: "Exactly one expansion policy must accompany the derivation records.",
      },
    ];
  let allowed: readonly string[];
  try {
    allowed = parseMissingStepAllowlist(parseContentJson(policy[0]!.text, policy[0]!.path));
  } catch (error) {
    return [
      {
        code: "missing-step-policy",
        path: policy[0]!.path,
        message: error instanceof Error ? error.message : "Invalid expansion policy.",
      },
    ];
  }
  const seen = new Set<string>();
  for (const file of selected.filter((file) => file !== policy[0])) {
    try {
      const lesson = parseMissingStepLesson(
        parseContentJson(file.text, file.path),
        allowed,
        argumentsIds,
      );
      if (seen.has(lesson.chain.id)) throw new Error("Duplicate missing-step chain identity.");
      seen.add(lesson.chain.id);
      checkWorkedTransitions(lesson);
    } catch (error) {
      diagnostics.push({
        code: "missing-step-content",
        path: file.path,
        message: error instanceof Error ? error.message : "Invalid missing-step content.",
      });
    }
  }
  return diagnostics;
}
