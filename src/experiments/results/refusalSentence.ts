import type { RequestRefusal } from "./refusals.ts";

/** The sentence a reader is shown for a refusal: the validator's specific requirement when it gave
 * one in details.requirements, otherwise the code's registered message. It lives apart from
 * refusals.ts because every diffusion kernel imports that module, and show-the-code pins each
 * kernel's whole import graph: a lab helper added there drifted seven closure pins. */
export function refusalSentence(refusal: Pick<RequestRefusal, "message" | "details">): string {
  const requirement = refusal.details?.requirements;
  return typeof requirement === "string" && requirement.trim() ? requirement : refusal.message;
}
