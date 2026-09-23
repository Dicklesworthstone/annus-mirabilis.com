import type { ExecutionOutcome, RetryGuidance } from "./outcomes.ts";
import type { RequestRefusal } from "./refusals.ts";
import {
  outputStatusRegistry,
  type ParameterAction,
  type ResultPayload,
  type ScientificResult,
} from "./types.ts";

export type AuthoredExplanation = Readonly<{
  message: string;
  nextAction?: string | undefined;
}>;

export type ResolvedExplanation = Readonly<{
  message: string;
  nextAction: string;
  action?: ParameterAction | undefined;
}>;

const outcomeRetryActions: Record<RetryGuidance, string> = Object.freeze({
  "retry-same-request": "Retry the calculation with the same request.",
  "new-run": "Start a new calculation run with different settings.",
  reload: "Reload the page to restore required calculation assets.",
  none: "This device or configuration does not support this calculation.",
});

/**
 * The reader sentence for an output status, for a view that holds only the status name. Views used
 * to print the name itself ("underdetermined", "(analytic-limit)") where a value could not be shown.
 */
export function statusMessage(status: string): string {
  const entry = (outputStatusRegistry as Readonly<Record<string, { message: string } | undefined>>)[
    status
  ];
  return entry?.message ?? "No value is available at these settings.";
}

/** Resolves reader-facing explanation and next action for an output result. */
export function explainResult(
  result: ScientificResult | ResultPayload,
  authored?: AuthoredExplanation,
): ResolvedExplanation {
  const generic = outputStatusRegistry[result.status];

  switch (result.status) {
    case "value": {
      return {
        message: authored?.message ?? generic.message,
        nextAction: authored?.nextAction ?? generic.nextAction,
      };
    }
    case "symbolic": {
      const defaultAction =
        result.unspecifiedSymbols.length > 0
          ? `Supply ${result.unspecifiedSymbols.join(", ")} to evaluate a numerical value.`
          : generic.nextAction;
      return {
        message: authored?.message ?? generic.message,
        nextAction: authored?.nextAction ?? defaultAction,
      };
    }
    case "analytic-limit": {
      return {
        message: authored?.message ?? (result.description || generic.message),
        nextAction: authored?.nextAction ?? generic.nextAction,
      };
    }
    case "underdetermined": {
      const defaultMessage = result.compatibleFamily
        ? `These observations do not select a unique value (${result.compatibleFamily}).`
        : generic.message;
      const defaultAction =
        result.neededInformation.length > 0
          ? result.neededInformation.join(" ")
          : generic.nextAction;
      return {
        message: authored?.message ?? defaultMessage,
        nextAction: authored?.nextAction ?? defaultAction,
      };
    }
    case "not-applicable": {
      return {
        message: authored?.message ?? (result.reason || generic.message),
        nextAction: authored?.nextAction ?? generic.nextAction,
      };
    }
    case "outside-domain": {
      let defaultAction: string = generic.nextAction;
      let action: ParameterAction | undefined;
      if ("alternativeModel" in result.boundary) {
        defaultAction = `Select alternative model: ${result.boundary.alternativeModel}.`;
      } else if ("parameterId" in result.boundary) {
        action = result.boundary;
        defaultAction = `Set ${result.boundary.parameterId} to ${String(result.boundary.value)} to enter the valid domain.`;
      }
      return {
        message: authored?.message ?? (result.reason || generic.message),
        nextAction: authored?.nextAction ?? defaultAction,
        ...(action ? { action } : {}),
      };
    }
    case "divergent": {
      const defaultMessage = result.rate?.statement ?? generic.message;
      const defaultAction = result.finiteUnder
        ? `Set ${result.finiteUnder.parameterId} to ${String(result.finiteUnder.value)} to obtain a finite result.`
        : generic.nextAction;
      return {
        message: authored?.message ?? defaultMessage,
        nextAction: authored?.nextAction ?? defaultAction,
        ...(result.finiteUnder ? { action: result.finiteUnder } : {}),
      };
    }
  }
}

/** Resolves reader-facing explanation and repair action for a request refusal. */
export function explainRefusal(refusal: RequestRefusal): ResolvedExplanation {
  const primaryRepair = refusal.rankedRepairs[0];
  return {
    message: refusal.message,
    nextAction: primaryRepair?.label ?? "Adjust requested settings to a supported range.",
    ...(primaryRepair?.action ? { action: primaryRepair.action } : {}),
  };
}

/** Resolves reader-facing explanation and recovery action for an execution outcome. */
export function explainOutcome(outcome: ExecutionOutcome): ResolvedExplanation {
  return {
    message: outcome.message,
    nextAction: outcomeRetryActions[outcome.retry] ?? outcomeRetryActions.none,
  };
}

/** Helper to check whether any text leaks raw enum identifiers. */
export function containsIdentifierLeak(text: string, statusEnumIds: readonly string[]): string[] {
  const leaks: string[] = [];
  for (const id of statusEnumIds) {
    // Only check multi-word hyphenated identifiers to avoid false positives on common words
    if (id.includes("-")) {
      const pattern = new RegExp(`\\b${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (pattern.test(text)) {
        leaks.push(id);
      }
    }
  }
  return leaks;
}

const physicalWordingPattern = /\b(impossible|nature|forbidden)\b/i;

/** Helper to check whether text makes physical claims (prohibited for software/numerical/input refusals & outcomes). */
export function containsPhysicalWording(text: string): boolean {
  return physicalWordingPattern.test(text);
}
