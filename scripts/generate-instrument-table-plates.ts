#!/usr/bin/env bun
/**
 * Writes src/generated/instrument-table-plates.json: for each registered instrument that
 * /instruments/ shows without a picture, the plate its laboratory's own page gives (dispatch 246).
 *
 * Each laboratory route is rendered on the server with its default settings, as `next build`
 * renders it, and scripts/instrument-table-plate.ts reads the first table in view that holds
 * values. So every number on a plate is the one the laboratory itself prints for its static worked
 * case, computed by the owner it labels, and none is typed here or on the catalogue. It runs last in
 * prepare:lab, after the generators whose output the laboratory pages import, so every build reads
 * the values again and a plate cannot go stale while its laboratory moves on.
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
import type { ReactElement } from "react";
import { renderToReadableStream } from "react-dom/server";
import { CATALOGUE_IDS, CATALOGUE_STATUS } from "../src/experiments/catalogue.ts";
import { readTablePlate, type TablePlate } from "./instrument-table-plate.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "src/generated/instrument-table-plates.json");
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
for (const id of ids) {
  try {
    const plate = readTablePlate(await renderLaboratory(id));
    if (plate) plates[id] = plate;
    else unread[id] = "no table of values in view on its page";
  } catch (error) {
    unread[id] = `its page did not render: ${(error as Error).message.split("\n")[0]}`;
  }
}

mkdirSync(join(ROOT, "src/generated"), { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ plates, unread }, null, 2)}\n`);
console.log(
  JSON.stringify({
    event: "instrument-table-plates-generated",
    instruments: ids.length,
    plates: Object.keys(plates).length,
    unread,
  }),
);
