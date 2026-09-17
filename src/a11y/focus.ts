/**
 * Focus management and restoration utility (am-a11y-baseline-1cg5).
 *
 * Implements a focus stack supporting:
 * - Nested overlays, modals, and clarifications
 * - Return-focus restoration on dismissal
 * - Keyboard Tab trapping within dialog scopes
 */

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]:not([tabindex="-1"])',
].join(", ");

export interface FocusScope {
  readonly container: HTMLElement;
  readonly returnTarget: HTMLElement | null;
}

const focusStack: FocusScope[] = [];

/**
 * Returns all visible focusable elements within a container.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  if (!container) return [];
  const rawList = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return rawList.filter((el) => {
    // Exclude explicitly hidden elements
    if (el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") {
      return false;
    }
    if (el.style.display === "none" || el.style.visibility === "hidden") {
      return false;
    }
    if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
      const computed = window.getComputedStyle(el);
      if (computed.display === "none" || computed.visibility === "hidden") {
        return false;
      }
    }
    return true;
  });
}

/**
 * Pushes a new focus scope onto the stack and shifts focus to container or its first focusable element.
 */
export function pushFocusScope(
  container: HTMLElement,
  returnTarget?: HTMLElement | null,
): FocusScope {
  const activeEl =
    returnTarget !== undefined
      ? returnTarget
      : typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;

  const scope: FocusScope = {
    container,
    returnTarget: activeEl,
  };
  focusStack.push(scope);

  // Move focus into the new scope
  const focusables = getFocusableElements(container);
  if (focusables.length > 0 && focusables[0]) {
    focusables[0].focus();
  } else if (container) {
    if (!container.hasAttribute("tabindex")) {
      container.setAttribute("tabindex", "-1");
    }
    container.focus();
  }

  return scope;
}

/**
 * Pops the top focus scope and restores focus to its saved return target.
 */
export function popFocusScope(): HTMLElement | null {
  const scope = focusStack.pop();
  if (scope?.returnTarget && typeof scope.returnTarget.focus === "function") {
    scope.returnTarget.focus();
    return scope.returnTarget;
  }
  return null;
}

/**
 * Gets the current focus scope depth.
 */
export function getFocusStackDepth(): number {
  return focusStack.length;
}

/**
 * Clears the entire focus stack without restoring focus.
 */
export function clearFocusStack(): void {
  focusStack.length = 0;
}

/**
 * Traps Tab and Shift+Tab key navigation within the active container.
 */
export function trapFocus(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== "Tab") return;

  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = typeof document !== "undefined" ? document.activeElement : null;

  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      event.preventDefault();
      last?.focus();
    }
  } else {
    if (active === last || !container.contains(active)) {
      event.preventDefault();
      first?.focus();
    }
  }
}
