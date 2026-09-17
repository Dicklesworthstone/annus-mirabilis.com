/**
 * Automated Accessibility Checks Suite for WCAG 2.2 AA Baseline (am-a11y-baseline-1cg5).
 *
 * Implements pure evaluation functions and DOM verification algorithms for:
 * 1. Focus obscuring (2.4.11 / 2.4.12) via 9-point bounding box sampling.
 * 2. Target size minimum (2.5.8) 24x24px with spacing exception.
 * 3. Text spacing resilience (1.4.12) with overflow and clipping detection.
 * 4. Language of parts (3.1.2) for German source passages (`lang="de"`).
 * 5. Page titles (2.4.2) for unique, non-empty route titles.
 * 6. Link purpose (2.4.4) for non-vague accessible names.
 * 7. Use of color (1.4.1) for non-color second channels on semantic tokens.
 * 8. Pointer cancellation (2.5.2) for down-event restraint and abort handling.
 */

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface BoxRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

export interface A11yCheckViolation {
  readonly rule: string;
  readonly criterion: string;
  readonly elementId?: string | undefined;
  readonly message: string;
  readonly repair: string;
  readonly details?: Record<string, unknown> | undefined;
}

/**
 * 1. Focus Obscuring Check (WCAG 2.4.11 / 2.4.12)
 * Samples 9 points across the element's bounding box to verify it is not 100% obscured.
 */
export function checkFocusObscuring(
  targetBox: BoxRect,
  obscuringBoxes: readonly BoxRect[],
): { isObscured: boolean; coveredPoints: number; totalPoints: number } {
  const points: Point2D[] = [
    { x: targetBox.left, y: targetBox.top },
    { x: targetBox.left + targetBox.width / 2, y: targetBox.top },
    { x: targetBox.right, y: targetBox.top },
    { x: targetBox.left, y: targetBox.top + targetBox.height / 2 },
    { x: targetBox.left + targetBox.width / 2, y: targetBox.top + targetBox.height / 2 },
    { x: targetBox.right, y: targetBox.top + targetBox.height / 2 },
    { x: targetBox.left, y: targetBox.bottom },
    { x: targetBox.left + targetBox.width / 2, y: targetBox.bottom },
    { x: targetBox.right, y: targetBox.bottom },
  ];

  let coveredPoints = 0;

  for (const pt of points) {
    const isCovered = obscuringBoxes.some((obs) => {
      return pt.x >= obs.left && pt.x <= obs.right && pt.y >= obs.top && pt.y <= obs.bottom;
    });
    if (isCovered) {
      coveredPoints++;
    }
  }

  return {
    isObscured: coveredPoints === points.length,
    coveredPoints,
    totalPoints: points.length,
  };
}

/**
 * 2. Target Size Minimum Check (WCAG 2.5.8)
 * Verifies interactive element is >= 24x24 px or has adequate spacing to adjacent targets.
 */
export function checkTargetSize(
  target: BoxRect,
  adjacentTargets: readonly BoxRect[] = [],
  minSize = 24,
): { passes: boolean; reason?: string } {
  if (target.width >= minSize && target.height >= minSize) {
    return { passes: true };
  }

  // Check 24px diameter / spacing exception: distance to closest adjacent target + target size >= 24
  let minDistance = Number.POSITIVE_INFINITY;
  for (const adj of adjacentTargets) {
    const dx = Math.max(0, Math.max(target.left - adj.right, adj.left - target.right));
    const dy = Math.max(0, Math.max(target.top - adj.bottom, adj.top - target.bottom));
    const dist = Math.hypot(dx, dy);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  const effectiveSpanX = target.width + (Number.isFinite(minDistance) ? minDistance : minSize);
  const effectiveSpanY = target.height + (Number.isFinite(minDistance) ? minDistance : minSize);

  if (effectiveSpanX >= minSize && effectiveSpanY >= minSize) {
    return { passes: true, reason: "spacing-exception" };
  }

  return {
    passes: false,
    reason: `Target size is ${target.width}x${target.height} px, below minimum ${minSize}x${minSize} px without spacing exemption.`,
  };
}

/**
 * 3. Text Spacing Check (WCAG 1.4.12)
 * Verifies content does not clip or overflow when WCAG text spacing overrides are applied.
 */
export function checkTextSpacing(element: {
  scrollHeight: number;
  clientHeight: number;
  scrollWidth: number;
  clientWidth: number;
  overflow: string;
}): { hasClipping: boolean; message?: string } {
  const isOverflowHidden = element.overflow === "hidden" || element.overflow === "clip";
  const verticalClipped = isOverflowHidden && element.scrollHeight > element.clientHeight + 1;
  const horizontalClipped = isOverflowHidden && element.scrollWidth > element.clientWidth + 1;

  if (verticalClipped || horizontalClipped) {
    return {
      hasClipping: true,
      message: `Text clipped under spacing override: scrollHeight=${element.scrollHeight}, clientHeight=${element.clientHeight}, scrollWidth=${element.scrollWidth}, clientWidth=${element.clientWidth}`,
    };
  }

  return { hasClipping: false };
}

/**
 * 4. Language of Parts Check (WCAG 3.1.2)
 * Verifies German source blocks carry lang="de".
 */
export function checkLanguageOfParts(
  blocks: readonly { id: string; isGermanSource: boolean; lang?: string | undefined }[],
): readonly A11yCheckViolation[] {
  const violations: A11yCheckViolation[] = [];
  for (const block of blocks) {
    if (block.isGermanSource && block.lang !== "de") {
      violations.push({
        rule: "language-of-parts",
        criterion: "3.1.2",
        elementId: block.id,
        message: `German source block '${block.id}' is missing lang="de" attribute (found: '${block.lang ?? "none"}').`,
        repair: `Add lang="de" to the passage container for '${block.id}'.`,
      });
    }
  }
  return violations;
}

/**
 * 5. Page Titles Check (WCAG 2.4.2)
 * Verifies every route has a non-empty, unique title.
 */
export function checkPageTitles(
  routes: readonly { route: string; title: string }[],
): readonly A11yCheckViolation[] {
  const violations: A11yCheckViolation[] = [];
  const seenTitles = new Map<string, string>();

  for (const r of routes) {
    if (!r.title || r.title.trim().length === 0) {
      violations.push({
        rule: "page-titled",
        criterion: "2.4.2",
        elementId: r.route,
        message: `Route '${r.route}' has an empty page title.`,
        repair: `Specify a descriptive, unique title for route '${r.route}'.`,
      });
      continue;
    }

    const existingRoute = seenTitles.get(r.title);
    if (existingRoute && existingRoute !== r.route) {
      violations.push({
        rule: "page-titled",
        criterion: "2.4.2",
        elementId: r.route,
        message: `Duplicate page title '${r.title}' shared between '${existingRoute}' and '${r.route}'.`,
        repair: `Ensure each route has a unique title describing its specific topic or paper.`,
      });
    } else {
      seenTitles.set(r.title, r.route);
    }
  }

  return violations;
}

/**
 * 6. Link Purpose in Context Check (WCAG 2.4.4)
 * Rejects empty accessible names and vague link text.
 */
const VAGUE_LINK_PATTERNS = /^(here|click here|more|link|read more|learn more|see more)$/i;

export function checkLinkPurpose(
  links: readonly { id?: string; href: string; accessibleName: string }[],
): readonly A11yCheckViolation[] {
  const violations: A11yCheckViolation[] = [];

  for (const link of links) {
    const name = (link.accessibleName || "").trim();
    if (!name) {
      violations.push({
        rule: "link-purpose",
        criterion: "2.4.4",
        elementId: link.id || link.href,
        message: `Link to '${link.href}' has no accessible name.`,
        repair: `Provide descriptive link text or an aria-label describing the destination.`,
      });
    } else if (VAGUE_LINK_PATTERNS.test(name)) {
      violations.push({
        rule: "link-purpose",
        criterion: "2.4.4",
        elementId: link.id || link.href,
        message: `Link has vague accessible name '${name}' pointing to '${link.href}'.`,
        repair: `Change link text to describe what will be found at '${link.href}' (e.g. 'Read Einstein's 1905 paper on Light Quanta').`,
      });
    }
  }

  return violations;
}

/**
 * 7. Use of Color Check (WCAG 1.4.1)
 * Verifies elements using semantic color tokens also provide a secondary non-color channel.
 */
export function checkColorIndependence(
  items: readonly {
    id: string;
    hasSemanticColor: boolean;
    nonColorChannel?:
      | {
          hasVisibleText?: boolean;
          hasDataTermBinding?: boolean;
          hasDashPatternOrMarker?: boolean;
          hasDistinctShape?: boolean;
          hasSpokenLabel?: boolean;
        }
      | undefined;
  }[],
): readonly A11yCheckViolation[] {
  const violations: A11yCheckViolation[] = [];

  for (const item of items) {
    if (item.hasSemanticColor) {
      const ch = item.nonColorChannel;
      const hasSecondary =
        ch &&
        (ch.hasVisibleText ||
          ch.hasDataTermBinding ||
          ch.hasDashPatternOrMarker ||
          ch.hasDistinctShape ||
          ch.hasSpokenLabel);

      if (!hasSecondary) {
        violations.push({
          rule: "use-of-color",
          criterion: "1.4.1",
          elementId: item.id,
          message: `Element '${item.id}' uses semantic color without a secondary non-color channel (label, marker, or dash pattern).`,
          repair: `Add a visible label, distinctive marker/pattern, or term badge binding to '${item.id}'.`,
        });
      }
    }
  }

  return violations;
}

/**
 * 8. Pointer Cancellation Check (WCAG 2.5.2)
 * Verifies that actions commit only on pointerup within bounds, never on pointerdown or when cancelled.
 */
export function evaluatePointerSequence(
  events: readonly (
    | { type: "pointerdown"; x: number; y: number }
    | { type: "pointermove"; x: number; y: number }
    | { type: "pointerup"; x: number; y: number }
    | { type: "pointercancel" }
  )[],
  targetBounds: BoxRect,
): { didCommit: boolean; reason: string } {
  let pending = false;

  for (const ev of events) {
    if (ev.type === "pointerdown") {
      pending = true;
    } else if (ev.type === "pointercancel") {
      pending = false;
      return { didCommit: false, reason: "cancelled-by-pointercancel" };
    } else if (ev.type === "pointerup") {
      if (!pending) {
        return { didCommit: false, reason: "up-without-down" };
      }
      pending = false;
      const inside =
        ev.x >= targetBounds.left &&
        ev.x <= targetBounds.right &&
        ev.y >= targetBounds.top &&
        ev.y <= targetBounds.bottom;

      if (inside) {
        return { didCommit: true, reason: "committed-on-valid-release" };
      } else {
        return { didCommit: false, reason: "aborted-released-outside-bounds" };
      }
    }
  }

  return { didCommit: false, reason: pending ? "pending-incomplete" : "idle" };
}
