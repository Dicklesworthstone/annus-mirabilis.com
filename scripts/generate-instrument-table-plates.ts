#!/usr/bin/env bun
/**
 * Writes src/generated/instrument-table-plates.json: for each registered instrument that
 * /instruments/ shows without a picture, the plate its laboratory's own page gives (dispatch 246).
 *
 * Each laboratory route is rendered on the server with its default settings, as `next build`
 * renders it, and scripts/instrument-table-plate.ts reads the first table in view that holds
 * values. So every number on a plate is the one the laboratory itself prints for its static worked
 * case, computed by the owner it labels, and none is typed here or on the catalogue. It runs after
 * every prepare:lab generator whose output the laboratory pages import (only the search index follows
 * it), so every build reads the values again and a plate cannot go stale while its laboratory moves
 * on. A page that imports a generated file nobody has written yet fails the chain rather than
 * becoming "unread".
 *
 * Also writes instrument-worked-cases.json: bounded default settings, accepted table readouts,
 * model limits and source links for every registered core laboratory, the optical shelf and supported
 * named modes.
 * The reading-only renderer consumes this display data without importing a live lab or owner.
 *
 * Which instruments: the registered ones without a picture, by the rule /instruments/ uses to show
 * one (a manifest entry and a file on disk). An instrument this cannot read, because its page does
 * not render or holds no table of values, is listed under "unread" with the reason, and the
 * catalogue shows its drawn plate. That is reported rather than fatal: the catalogue's test is the
 * gate, and it names the instrument.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactElement } from "react";
import { renderToReadableStream } from "react-dom/server";
import { parseYaml } from "../src/content/provenance/yaml.ts";
import { CATALOGUE_IDS, CATALOGUE_STATUS, DECLARED_MODES } from "../src/experiments/catalogue.ts";
import { SHELF_DEFINITIONS as SHELF_CONTEXT } from "../src/experiments/shelf/definition.ts";
import { isShelfId, SHELF_IDS } from "../src/experiments/shelfOptics/definition.ts";
import {
  type InstrumentWorkedCase,
  WORKED_CASE_SCHEMA_VERSION,
} from "../src/experiments/workedCases/types.ts";
import { labName } from "../src/reader/actions/labNames.ts";
import {
  readTablePlate,
  type TablePlate,
  unreadReasonForRenderFailure,
} from "./instrument-table-plate.ts";
import { readInstrumentWorkedCase, type WorkedCaseMetadata } from "./instrument-worked-case.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "src/generated/instrument-table-plates.json");
const WORKED_CASES = join(ROOT, "src/generated/instrument-worked-cases.json");
const FIGURES = join(ROOT, "public/figures/instruments");

const manifestPath = join(FIGURES, "manifest.json");
const pictures: Record<string, unknown> | null = existsSync(manifestPath)
  ? ((JSON.parse(readFileSync(manifestPath, "utf8")) as { pictures?: Record<string, unknown> })
      .pictures ?? {})
  : null;

/** The rule src/app/instruments/page.tsx applies: listed by the generator, and on disk. */
function hasPicture(id: string): boolean {
  if (pictures && !(id in pictures)) return false;
  return existsSync(join(FIGURES, `${id}.webp`));
}

/** The laboratory page as a browser without JavaScript receives it, every island loaded. */
async function renderLaboratory(id: string): Promise<string> {
  const route = (await import(join(ROOT, "src/app/lab", id, "page.tsx"))) as {
    default: (props: unknown) => ReactElement | Promise<ReactElement>;
  };
  const element = await route.default({
    params: Promise.resolve({}),
    searchParams: Promise.resolve({}),
  });
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}

const plates: Record<string, TablePlate> = {};
const unread: Record<string, string> = {};
const ids = CATALOGUE_IDS.filter((id) => CATALOGUE_STATUS[id] === "registered" && !hasPicture(id));
const coreIds = CATALOGUE_IDS.filter(
  (id) => CATALOGUE_STATUS[id] === "registered" && /^(?:bm|lq|sr|me)-\d{2}$/.test(id),
);
const workedCases: Record<string, InstrumentWorkedCase> = {};
const paperNames: Readonly<Record<string, string>> = {
  "brownian-motion": "Brownian motion",
  "light-quanta": "Light quanta",
  "special-relativity": "Special relativity",
  "mass-energy": "Mass and energy",
};

function workedCaseMetadata(id: string, mode: string | null): WorkedCaseMetadata {
  if (isShelfId(id)) {
    const context = SHELF_CONTEXT[id];
    return {
      instrumentId: id,
      mode,
      title: labName(id),
      notModeled: context.notModeled,
      notes: [
        "These model predictions use modern SI calibration and illustrative settings. They are not historical observations.",
      ],
      sources: [
        {
          href: "/papers/special-relativity/#" + context.sourceSection,
          label:
            context.sourceSection === "s0"
              ? "Special relativity, introduction"
              : "Special relativity, section " + context.sourceSection.slice(1),
        },
        {
          href: "/lab/" + id + "/#shelf-model-scope",
          label: labName(id) + ": model assumptions and equations",
        },
      ],
    };
  }
  const manifest = parseYaml(
    readFileSync(join(ROOT, "content/experiments", id + ".yaml"), "utf8"),
  ) as {
    notModeled?: unknown;
    sourceRefs?: { paper?: unknown; id?: unknown }[];
  };
  return {
    instrumentId: id,
    mode,
    title: labName(id),
    notModeled: Array.isArray(manifest.notModeled)
      ? manifest.notModeled.filter((item): item is string => typeof item === "string")
      : [],
    sources: (manifest.sourceRefs ?? []).flatMap((ref) =>
      typeof ref.paper === "string" &&
      paperNames[ref.paper] &&
      typeof ref.id === "string" &&
      /^s\d+$/.test(ref.id)
        ? [
            {
              href: "/papers/" + ref.paper + "/#" + ref.id,
              label: paperNames[ref.paper] + ", section " + ref.id.slice(1),
            },
          ]
        : [],
    ),
  };
}

for (const id of new Set([...ids, ...coreIds])) {
  try {
    const html = await renderLaboratory(id);
    if (ids.includes(id)) {
      const plate = readTablePlate(html);
      if (plate) plates[id] = plate;
      else unread[id] = "no table of values in view on its page";
    }
    if (coreIds.includes(id))
      workedCases[id] = readInstrumentWorkedCase(html, workedCaseMetadata(id, null));
  } catch (error) {
    const reason = unreadReasonForRenderFailure(id, error);
    if (ids.includes(id)) unread[id] = reason;
    if (coreIds.includes(id)) workedCases[id] = { kind: "unavailable", address: id, reason };
  }
}

// Shelf reader defaults are illustrative, whereas the full Fizeau page opens at its source
// apparatus settings. Prepare the same view a reader will load, keeping observations separate.
const shelfViews = await import("../src/experiments/views/shelfViews.tsx");
const shelfClarifications = {
  "shelf-michelson-morley": shelfViews.ShelfMichelsonMorleyView,
  "shelf-fizeau": shelfViews.ShelfFizeauView,
  "shelf-maxwell-galilean": shelfViews.ShelfMaxwellGalileanView,
};
for (const id of SHELF_IDS) {
  if (CATALOGUE_STATUS[id] !== "registered") continue;
  try {
    const stream = await renderToReadableStream(
      createElement(shelfClarifications[id], {
        instanceId: "prepared-reading-only-" + id,
        mode: null,
        presentation: "standard",
      }),
    );
    await stream.allReady;
    workedCases[id] = readInstrumentWorkedCase(
      await new Response(stream).text(),
      workedCaseMetadata(id, null),
    );
  } catch (error) {
    workedCases[id] = {
      kind: "unavailable",
      address: id,
      reason: unreadReasonForRenderFailure(id, error),
    };
  }
}

// The actual apparatus clarification prepares different outputs from the analytic default.
// Future declared modes without a prepared adapter stay explicitly unavailable.
for (const id of coreIds) {
  for (const mode of DECLARED_MODES[id]) {
    const address = id + ":" + mode;
    if (id === "sr-02" && mode === "apparatus") {
      const { default: View } = await import("../src/experiments/views/sr02View.tsx");
      const stream = await renderToReadableStream(
        createElement(View, {
          instanceId: "prepared-reading-only-sr02-apparatus",
          mode,
          presentation: "standard",
        }),
      );
      await stream.allReady;
      workedCases[address] = readInstrumentWorkedCase(
        await new Response(stream).text(),
        workedCaseMetadata(id, mode),
      );
    } else
      workedCases[address] = {
        kind: "unavailable",
        address,
        reason: "This mode has no prepared worked example.",
      };
  }
}

mkdirSync(join(ROOT, "src/generated"), { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ plates, unread }, null, 2)}\n`);
writeFileSync(
  WORKED_CASES,
  JSON.stringify({ schemaVersion: WORKED_CASE_SCHEMA_VERSION, cases: workedCases }) + "\n",
);
console.log(
  JSON.stringify({
    event: "instrument-table-plates-generated",
    instruments: ids.length,
    plates: Object.keys(plates).length,
    unread,
    workedCases: Object.values(workedCases).filter((record) => record.kind === "prepared").length,
    unavailableWorkedCases: Object.values(workedCases).filter(
      (record) => record.kind === "unavailable",
    ),
  }),
);
