import type { DiscoveryPaper } from "../../content/schemas/discovery.ts";

/** Public case identity only. Private answers and notebook entry ids never enter a link. */
export function revisitPromptId(paper: DiscoveryPaper, stageId: string): string {
  return `revisit-${paper}-${stageId}`;
}

export function revisitHref(paper: DiscoveryPaper, stageId: string): string {
  return `/discover/revisit/#explanation-${revisitPromptId(paper, stageId)}`;
}

/** Keep ordinary teach-back links unchanged, including imported unknown question identities. */
export function revisitHrefFromPrompt(paper: string, promptId: string): string | null {
  const prefix = `revisit-${paper}-`;
  return promptId.startsWith(prefix) &&
    /^step-\d{2}(?:-[a-z0-9]+)*$/u.test(promptId.slice(prefix.length))
    ? `/discover/revisit/#explanation-${promptId}`
    : null;
}
