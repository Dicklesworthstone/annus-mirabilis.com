/**
 * Keyboard navigation, focus management, and deep-link parsing for derivation steps (am-eq-derivation-renderer-9gd7).
 *
 * Implements WCAG 2.1.4 character-key shortcuts that operate only when
 * the derivation component holds focus, plus validated direct-link parsing.
 */

import { announce } from "../../a11y/announce.ts";

export const MAX_DIRECT_LINK_PARAM_LENGTH = 128;

/**
 * Validates and parses a `derivation-step:<chainId>/<stepId>` parameter.
 * Returns null if malformed or over length bound.
 */
export function parseDerivationStepParam(
  param: string | null | undefined,
): { chainId: string; stepId: string } | null {
  if (!param || typeof param !== "string") return null;
  const trimmed = param.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_DIRECT_LINK_PARAM_LENGTH) return null;

  // Pattern: derivation-step:<chainId>/<stepId> or <chainId>/<stepId>
  const prefix = "derivation-step:";
  const clean = trimmed.startsWith(prefix) ? trimmed.slice(prefix.length) : trimmed;

  const parts = clean.split("/");
  if (parts.length !== 2) return null;

  const [chainId, stepId] = parts;
  if (!chainId || !stepId) return null;

  // Validate ID grammar (lowercase alphanumeric + hyphens)
  const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!idPattern.test(chainId) || !idPattern.test(stepId)) {
    return null;
  }

  return { chainId, stepId };
}

export interface StepKeyboardCallbacks {
  readonly onFocusStep: (index: number) => void;
  readonly onToggleExpand: (index: number) => void;
  readonly onExitFocusMode: () => void;
}

/**
 * Handles keyboard events for derivation steps.
 * Operates when focus is within the derivation step list.
 */
export function handleStepKeyDown(
  e: React.KeyboardEvent | KeyboardEvent,
  currentIndex: number,
  totalSteps: number,
  callbacks: StepKeyboardCallbacks,
): boolean {
  switch (e.key) {
    case "ArrowUp": {
      e.preventDefault();
      const prevIndex = Math.max(0, currentIndex - 1);
      callbacks.onFocusStep(prevIndex);
      return true;
    }

    case "ArrowDown": {
      e.preventDefault();
      const nextIndex = Math.min(totalSteps - 1, currentIndex + 1);
      callbacks.onFocusStep(nextIndex);
      return true;
    }

    case "Enter":
    case " ": {
      e.preventDefault();
      callbacks.onToggleExpand(currentIndex);
      return true;
    }

    case "Escape": {
      e.preventDefault();
      callbacks.onExitFocusMode();
      return true;
    }

    default:
      return false;
  }
}

/**
 * Announces step expansion once to assistive technology through polite live-region.
 */
export function announceStepExpanded(stepNumber: number, ruleText: string, isMove: boolean): void {
  const moveMsg = isMove ? " Marked move." : "";
  announce(`Expanded Step ${stepNumber}: ${ruleText}.${moveMsg}`);
}
