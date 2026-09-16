/**
 * Emulation utilities other beads reuse (am-test-e2e-harness-bqmh
 * requirement 3): forced colors, color scheme, Chromium vision-deficiency
 * emulation, the WCAG 1.4.12 text-spacing stylesheet, request-interception
 * predicates, and CPU throttling read from `perf/profiles.json`. Each pure
 * piece is separated from the Playwright calls that would apply it to a
 * live page or route.
 */

import { readFile } from "node:fs/promises";
import type { BrowserEngine } from "./lanes.ts";

export type ForcedColors = "active" | "none";
export type ColorScheme = "light" | "dark" | "no-preference";

// ---------------------------------------------------------------------------
// Vision-deficiency emulation (Chromium-only).
// ---------------------------------------------------------------------------

export const VISION_DEFICIENCIES = [
  "protanopia",
  "deuteranopia",
  "tritanopia",
  "achromatopsia",
  "blurredVision",
] as const;
export type VisionDeficiency = (typeof VISION_DEFICIENCIES)[number];

export type Availability = "available" | "not-available";

/** Chromium implements `Page.emulateVisionDeficiency`; WebKit and Firefox do not. */
export function visionDeficiencyAvailability(browser: BrowserEngine): Availability {
  return browser === "chromium" ? "available" : "not-available";
}

// ---------------------------------------------------------------------------
// WCAG 1.4.12 text-spacing stylesheet.
// ---------------------------------------------------------------------------

export const TEXT_SPACING_STYLESHEET = [
  "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }",
  "p { margin-bottom: 2em !important; }",
].join("\n");

export interface TextSpacingDeclarations {
  lineHeight: string;
  paragraphSpacing: string;
  letterSpacing: string;
  wordSpacing: string;
}

function extractDeclaration(css: string, property: string): string {
  const pattern = new RegExp(`${property}\\s*:\\s*([^;]+?)\\s*(?:!important)?\\s*;`, "i");
  const match = pattern.exec(css);
  if (!match?.[1])
    throw new Error(`text-spacing stylesheet is missing a "${property}" declaration`);
  return match[1].trim();
}

/** Parses the four WCAG 1.4.12 values back out of the stylesheet, so a test can assert on them directly. */
export function parseTextSpacingStylesheet(css: string): TextSpacingDeclarations {
  return {
    lineHeight: extractDeclaration(css, "line-height"),
    paragraphSpacing: extractDeclaration(css, "margin-bottom"),
    letterSpacing: extractDeclaration(css, "letter-spacing"),
    wordSpacing: extractDeclaration(css, "word-spacing"),
  };
}

// ---------------------------------------------------------------------------
// Request interception: block *.wasm; delay one response behind another.
// ---------------------------------------------------------------------------

/** True for any request whose path ends in `.wasm`, ignoring a query string or fragment. */
export function isWasmRequestUrl(url: string): boolean {
  const withoutFragment = url.split("#")[0] ?? url;
  const withoutQuery = withoutFragment.split("?")[0] ?? withoutFragment;
  return withoutQuery.toLowerCase().endsWith(".wasm");
}

export interface DelayedRelease<Id> {
  readonly id: Id;
  readonly delayMs: number;
}

/**
 * Given a set of responses with their configured artificial delays, returns
 * the order they resolve in. A caller uses this to script "an older request
 * released after a newer one": a longer `delayMs` on the older request makes
 * it arrive last, and the harness's instrument checks assert the DOM still
 * reflects the newer `data-accepted-input-revision`.
 */
export function releaseOrder<Id>(releases: readonly DelayedRelease<Id>[]): Id[] {
  return [...releases].sort((a, b) => a.delayMs - b.delayMs).map((release) => release.id);
}

// ---------------------------------------------------------------------------
// CPU throttling from perf/profiles.json.
// ---------------------------------------------------------------------------

export interface CpuThrottlingProfilesFile {
  profiles: readonly { id: string; cpuSlowdown: { factor: number; calibration: string } }[];
}

export type CpuThrottling =
  | { status: "available"; profileId: string; factor: number; calibration: string }
  | { status: "not-available"; profileId: string };

/** WebKit cannot throttle CPU; do not mix performance assertions into acceptance lanes (see AGENTS.md pitfalls). */
export function resolveCpuThrottling(
  profiles: CpuThrottlingProfilesFile | undefined,
  profileId: string,
): CpuThrottling {
  const profile = profiles?.profiles.find((candidate) => candidate.id === profileId);
  if (!profile) return { status: "not-available", profileId };
  return {
    status: "available",
    profileId,
    factor: profile.cpuSlowdown.factor,
    calibration: profile.cpuSlowdown.calibration,
  };
}

/**
 * Reads `perf/profiles.json` (or a caller-supplied path, for fixtures) and
 * resolves throttling for one profile id. A missing file reports
 * `not-available` rather than falling back to a default factor, since a
 * silent default would misreport what was actually measured.
 */
export async function loadCpuThrottling(
  profileId: string,
  profilesPath = "perf/profiles.json",
): Promise<CpuThrottling> {
  let raw: string;
  try {
    raw = await readFile(profilesPath, "utf8");
  } catch {
    return { status: "not-available", profileId };
  }
  const parsed = JSON.parse(raw) as CpuThrottlingProfilesFile;
  return resolveCpuThrottling(parsed, profileId);
}
