/**
 * On-demand worker loading policy and reading-only integration (am-a11y-reading-only-6wwd).
 *
 * Requirements:
 * 1. Reading-only mode prevents worker loading until an explicit interactive action is taken.
 * 2. Autoload triggers worker initialization on route entry when reading-only is disabled.
 * 3. Viewport and intent triggers allow lazy hydration without blocking the reading path.
 *
 * Spec: AGENTS.md §6.2, §15.4 and am-rt-worker-scheduler-7tl
 */

export interface LoadOnDemandPolicy {
  readonly autoload?: boolean | undefined;
  readonly readingOnly?: boolean | undefined;
  readonly viewportTrigger?: boolean | undefined;
  readonly intentTrigger?: boolean | undefined;
}

export function shouldInitializeWorker(
  policy: LoadOnDemandPolicy = {},
  hasExplicitAction = false,
): boolean {
  // Rule 1: With reading-only on, no worker loads until an explicit action
  if (policy.readingOnly === true) {
    return hasExplicitAction;
  }

  // Rule 2: Explicit action always loads
  if (hasExplicitAction) {
    return true;
  }

  // Rule 3: Autoload when enabled
  if (policy.autoload === true) {
    return true;
  }

  // Rule 4: Viewport or intent triggers
  if (policy.viewportTrigger === true || policy.intentTrigger === true) {
    return true;
  }

  return false;
}
