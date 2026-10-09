#!/usr/bin/env bun
/**
 * WHAT THE BUILD EMITTED, in the census's one grammar (am-rc1001-bridge-plan-pcjk.9).
 *
 * `bun run build` is `prepare-lane && next build`, and neither printed a page count that this
 * repository authors. The prepare lane prints "prepare lane: N generators ran", which measures the
 * GENERATORS and not the build -- AGENTS.md already warns that conflating those two is how a
 * typecheck outage hid for a day. So a build that emitted a handful of pages, or none, reported the
 * same thing as a complete one: `next build` exits 0 either way, and every downstream gate that
 * reads `out/` would then be measuring a population nobody declared.
 *
 * THIS REPORTS AND NEVER FAILS THE BUILD, which is the one design decision here worth stating. A
 * reporter at the end of the build chain that could exit non-zero would be able to break every
 * pane's build and the deploy, for a reporting improvement; the risk is not worth it and is not
 * needed, because the census judges the number it prints. That is the same arrangement `lint` and
 * `unit-tests` use (`gateRefusesVacuous: false`): the gate states its population and the census
 * decides whether it is enough.
 *
 * The floor is 250 against the 721 pages measured on 2026-10-08 -- about a third, so a build that
 * lost two thirds of the site is caught while a legitimately smaller profile is not refused. A
 * tighter floor would have to move every time a route is added or a profile narrows, and a floor
 * that moves on ordinary work is a floor people raise without reading.
 */

import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { reportPopulation } from "../gate-census/population.ts";

/**
 * `.html` FILES, and the directory test is not pedantry. `find out -name '*.html' | wc -l` reports
 * 721 where this reports 720, and this is the right number: `next build` emits a DIRECTORY named
 * `out/_next/static/chunks/app/offline/[paper]/[file]/index.html`, which `find` matches by name
 * regardless of type. A page count that included it would be counting a directory as a page.
 *
 * SKIPS ARE COUNTED, NOT SWALLOWED. The first version returned `0` for an unreadable directory and
 * `continue`d past an unstattable entry in silence, so a permission error would have shrunk the
 * population with nothing saying so -- a counter inheriting the silence of what it reads, which is
 * the failure this whole census exists to prevent. The caller prints the skip count beside the
 * total, and a non-zero skip count makes the number provisional rather than wrong-and-quiet.
 */
export function countHtmlPages(dir: string): { pages: number; skipped: number } {
  let pages = 0;
  let skipped = 0;
  let entries: readonly string[];
  try {
    entries = readdirSync(dir);
  } catch {
    // A missing out/ is zero pages, which is the honest answer and the one the floor catches; a
    // directory that exists and cannot be read is a skip, and the two must not look alike.
    return { pages: 0, skipped: 1 };
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let isDir: boolean;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      skipped += 1;
      continue;
    }
    if (isDir) {
      const inner = countHtmlPages(full);
      pages += inner.pages;
      skipped += inner.skipped;
    } else if (entry.endsWith(".html")) pages += 1;
  }
  return { pages, skipped };
}

/** The floor, and the measurement it is derived from. Exported so a test can state both. */
export const BUILD_PAGE_FLOOR = 250;
export const BUILD_PAGES_MEASURED_2026_10_08 = 721;

export function reportBuildPopulation(outDir: string): {
  examined: number;
  skipped: number;
  vacuous: boolean;
} {
  const { pages: examined, skipped } = countHtmlPages(outDir);
  if (skipped > 0) {
    console.error(
      `[build-population] ${skipped} entr(y|ies) under ${outDir} could not be read, so the page ` +
        "count below is a floor on the real number rather than the number. Fix the permissions " +
        "before citing it.",
    );
  }
  const vacuous = reportPopulation({
    gate: "build",
    examined,
    noun: "HTML pages emitted",
    minimum: BUILD_PAGE_FLOOR,
  });
  if (vacuous) {
    // Printed, not thrown. See the docblock: this must never be able to fail a build.
    console.error(
      `[build-population] ${examined} HTML page(s) in ${outDir}, below the declared floor of ` +
        `${BUILD_PAGE_FLOOR}. The build exited 0, so this is a reporting line and not a refusal; ` +
        "the gate census judges it. Check that the export completed and that the profile is the " +
        "one you meant.",
    );
  }
  return { examined, skipped, vacuous };
}

if (import.meta.main) {
  // EVERYTHING IS CAUGHT, because this runs at the end of `bun run build` and `vercel.json`'s
  // buildCommand is `bun run build`. A reporting line that could throw would be able to fail every
  // pane's build and the deploy, which is a trade nobody would take for a printed number.
  try {
    reportBuildPopulation(resolve(process.cwd(), "out"));
  } catch (error) {
    console.error(
      `[build-population] could not count the emitted pages (${
        error instanceof Error ? error.message : String(error)
      }); the build is unaffected and no population is declared for this run.`,
    );
  }
}
