/**
 * Reusable page checks for the browser acceptance harness
 * (am-test-e2e-harness-bqmh requirement 6).
 *
 * Checks:
 * - No horizontal page-level overflow (`document.documentElement.scrollWidth <= clientWidth`)
 * - Semantic MathML presence and absence of raw $LaTeX$ strings
 * - Focus restoration after closing dialogs/drawers
 * - Footnotes and anchor locators reachability
 * - Print fidelity and unclipped equations
 * - Axe-core accessibility audit supplement (0 serious/critical violations)
 */

import AxeBuilder from "@axe-core/playwright";
import type { Page } from "playwright";
import { checkNoHorizontalOverflow, compareEssentialPrintText } from "./measure.ts";

export interface PageCheckResult {
  readonly ok: boolean;
  readonly message?: string;
  readonly details?: unknown;
}

/**
 * Checks that the page has no page-level horizontal overflow.
 */
export async function checkHorizontalOverflow(page: Page): Promise<PageCheckResult> {
  const measurements = await page.evaluate(() => {
    const doc = document.documentElement;
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
    };
  });

  const check = checkNoHorizontalOverflow(measurements.scrollWidth, measurements.clientWidth);
  if (!check.ok) {
    return {
      ok: false,
      message: `Horizontal overflow detected: scrollWidth (${check.scrollWidth}px) > clientWidth (${check.clientWidth}px) by ${check.overflowPx}px`,
      details: check,
    };
  }

  return { ok: true, details: check };
}

/**
 * Checks that equations are rendered as semantic MathML (<math>) and no raw
 * unparsed $...$ text nodes exist in the visible content.
 */
export async function checkMathMLSemantics(page: Page): Promise<PageCheckResult> {
  const result = await page.evaluate(() => {
    const mathElements = Array.from(document.querySelectorAll("math"));
    const rawLatexRegex = /(?:^|[^\\])\$([^$]+)\$/;
    const bodyText = document.body.innerText || "";
    const rawMatches = bodyText.match(rawLatexRegex);

    const mathChecks = mathElements.map((el) => {
      const hasSemantics = el.querySelector("semantics") !== null;
      return { hasSemantics };
    });

    return {
      mathCount: mathElements.length,
      mathChecks,
      rawLatexFound: rawMatches ? rawMatches[0] : null,
    };
  });

  if (result.rawLatexFound) {
    return {
      ok: false,
      message: `Raw unparsed LaTeX text found in DOM: "${result.rawLatexFound}"`,
      details: result,
    };
  }

  if (result.mathCount === 0) {
    return {
      ok: false,
      message: "No <math> MathML elements found in page",
      details: result,
    };
  }

  const invalidMath = result.mathChecks.find((c) => !c.hasSemantics);
  if (invalidMath) {
    return {
      ok: false,
      message: "MathML element is missing semantic <semantics> wrapper",
      details: result,
    };
  }

  return { ok: true, details: result };
}

/**
 * Checks that opening and closing an overlay or drawer restores keyboard focus
 * to the element that triggered it.
 */
export async function checkFocusRestoration(
  page: Page,
  openSelector = "#open-dialog-btn",
  closeSelector = "#close-dialog-btn",
): Promise<PageCheckResult> {
  const openBtn = page.locator(openSelector).first();
  const closeBtn = page.locator(closeSelector).first();

  if ((await openBtn.count()) === 0) {
    return { ok: false, message: `Open trigger "${openSelector}" not found` };
  }

  await openBtn.focus();
  const initialActiveId = await page.evaluate(() => document.activeElement?.id);

  await openBtn.click();
  await page.waitForTimeout(50);

  if ((await closeBtn.count()) === 0) {
    return { ok: false, message: `Close trigger "${closeSelector}" not found` };
  }

  await closeBtn.click();
  await page.waitForTimeout(50);

  const finalActiveId = await page.evaluate(() => document.activeElement?.id);

  if (finalActiveId !== initialActiveId) {
    return {
      ok: false,
      message: `Focus was not restored to trigger (expected id "${initialActiveId}", but active is "${finalActiveId}")`,
      details: { initialActiveId, finalActiveId },
    };
  }

  return { ok: true, details: { restoredElementId: finalActiveId } };
}

/**
 * Checks that footnote marks link to existing footnote definitions.
 */
export async function checkFootnotesAndLocators(page: Page): Promise<PageCheckResult> {
  const result = await page.evaluate(() => {
    const footnoteLinks = Array.from(document.querySelectorAll('a[href^="#fn"]'));
    const missingTargets: string[] = [];

    for (const link of footnoteLinks) {
      const href = link.getAttribute("href");
      if (href && href.startsWith("#")) {
        const targetId = href.slice(1);
        const target = document.getElementById(targetId);
        if (!target) {
          missingTargets.push(href);
        }
      }
    }

    return {
      footnoteLinksCount: footnoteLinks.length,
      missingTargets,
    };
  });

  if (result.missingTargets.length > 0) {
    return {
      ok: false,
      message: `Footnote links point to missing targets: ${result.missingTargets.join(", ")}`,
      details: result,
    };
  }

  return { ok: true, details: result };
}

/**
 * Checks that under print media emulation, essential prose and formulas
 * remain visible and are not clipped with overflow:hidden.
 */
export async function checkPrintFidelity(page: Page): Promise<PageCheckResult> {
  await page.emulateMedia({ media: "print" });
  try {
    const printCheck = await page.evaluate(() => {
      const equations = Array.from(document.querySelectorAll(".equation-block, math"));
      const clippedElements: string[] = [];

      for (const eq of equations) {
        const style = window.getComputedStyle(eq);
        if (style.display === "none" || style.visibility === "hidden") {
          clippedElements.push("Hidden equation in print");
        }
        if (style.overflow === "hidden" && parseInt(style.maxHeight || "9999", 10) < 50) {
          clippedElements.push("Clipped equation max-height in print");
        }
      }

      return {
        equationCount: equations.length,
        clippedElements,
      };
    });

    if (printCheck.clippedElements.length > 0) {
      return {
        ok: false,
        message: `Print clipping defects found: ${printCheck.clippedElements.join("; ")}`,
        details: printCheck,
      };
    }

    return { ok: true, details: printCheck };
  } finally {
    await page.emulateMedia({ media: "screen" });
  }
}

/**
 * Runs an axe-core accessibility audit and asserts zero serious or critical violations.
 */
export async function checkAccessibilityAxe(page: Page): Promise<PageCheckResult> {
  try {
    const axeResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    const seriousOrCritical = axeResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    if (seriousOrCritical.length > 0) {
      const summaries = seriousOrCritical.map(
        (v) => `[${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`,
      );
      return {
        ok: false,
        message: `Axe accessibility violations found: ${summaries.join("; ")}`,
        details: seriousOrCritical,
      };
    }

    return { ok: true, details: { violationCount: axeResults.violations.length } };
  } catch (error) {
    return {
      ok: false,
      message: `Axe audit failed to execute: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
