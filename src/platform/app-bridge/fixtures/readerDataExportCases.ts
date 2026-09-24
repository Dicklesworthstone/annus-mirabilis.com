/**
 * Golden cases for the app's export of the reader's data, computed by the site's own
 * `exportNamespaces`, so the app's file is the one /your-data/ would have written.
 * `readerDataExport.json` holds them for the Swift tests; `readerData.test.ts` fails when it
 * no longer equals what this module computes.
 *
 * The cases use a fixed registry: real registrations, chosen by key, with frozen labels. So the
 * golden changes when `exportNamespaces` changes, not each time the site registers a new key;
 * that the app carries the live registry is checked separately (readerData.test.ts,
 * export-edition.test.ts). To rewrite the golden, run:
 *
 *   bun src/platform/app-bridge/fixtures/readerDataExportCases.ts
 */

import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type ExportDocument, exportNamespaces } from "../../storage/exportClear.ts";
import { createKeyRegistry, type KeyRegistry, SEED_ENTRIES } from "../../storage/keys.ts";
import { createStorageContext } from "../../storage/store.ts";
import { InMemoryStorage } from "../../storage/testSupport.ts";
import { type ReaderDataEntry, readerDataManifest } from "../readerData.ts";

export const READER_DATA_FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "readerDataExport.json",
);

export interface ReaderDataExportCase {
  readonly name: string;
  readonly registry: readonly ReaderDataEntry[];
  /** The mirror's snapshot: every site key and its stored string. */
  readonly storage: Readonly<Record<string, string>>;
  /**
   * Asked for by the start of a key, as the app's export takes it: one key, or a family such as
   * every paper's discovery notes. The site's `exportNamespaces` is given the registered keys
   * that start with it. Absent means every namespace.
   */
  readonly prefix?: string;
  readonly exportedAt: string;
  readonly expected: ExportDocument;
}

const EXPORTED_AT = "2026-09-24T06:08:00.123Z";

/** One of each shape the site stores, and the keys it must leave out. */
const STORAGE: Readonly<Record<string, string>> = {
  "am:settings:v1:theme": "kramgasse-night",
  "am:settings:v1:typeScale": "125",
  "am:discovery-notes:v1:brownian-motion": JSON.stringify({
    schemaVersion: 1,
    notes: [
      { anchor: "s4-p2-s1", text: "Why λ grows as √t, not t", savedAt: 1790230063000 },
      { anchor: "eq-s4-1", text: "Viscosity k here, not Boltzmann", savedAt: 1790230064500 },
    ],
  }),
  "am:discovery-notes:v1:mass-energy": JSON.stringify({
    schemaVersion: 1,
    notes: [{ anchor: "s0-p1-s2", text: "L/V² before any lamp", savedAt: 1790230065000 }],
  }),
  "am:tours:v1": JSON.stringify({ schemaVersion: 1, tours: { "mass-energy-first": { step: 3 } } }),
  // Unreadable: the site exports it verbatim as a string.
  "am:notebook:v1": '{"schemaVersion":1,"entries":[',
  // Parses, to null: exported as null, not as the text "null".
  "am:predictions:v1": "null",
  // Not in the registry, and not the site's: never exported.
  "am:unregistered:v1": "kept out",
  "another-site": "kept out",
};

/** The keys the cases use, in this order, each with a label frozen for the golden. */
export const FIXTURE_REGISTRY: readonly (readonly [key: string, label: string])[] = [
  ["am:settings:v1:theme", "Reading theme"],
  ["am:settings:v1:typeScale", "Type size"],
  ["am:discovery-notes:v1:brownian-motion", "Discovery notes: Brownian motion"],
  ["am:discovery-notes:v1:mass-energy", "Discovery notes: Mass and energy"],
  ["am:notebook:v1", "Notebook"],
  ["am:tours:v1", "Progress on guided reading paths"],
  ["am:predictions:v1", "Saved predictions"],
  // Registered, with nothing saved: never listed, never exported.
  ["am:journeys:v1", "Your choices and progress in Discover"],
];

/** A key the site no longer registers drops out; readerData.test.ts then names it. */
function fixtureRegistry(withheld?: string): KeyRegistry {
  return createKeyRegistry(
    FIXTURE_REGISTRY.flatMap(([key, label]) => {
      const entry = SEED_ENTRIES.find((registered) => registered.key === key);
      return entry === undefined ? [] : [{ ...entry, label, exportable: key !== withheld }];
    }),
  );
}

function exportCase(name: string, registry: KeyRegistry, prefix?: string): ReaderDataExportCase {
  const storage = new InMemoryStorage();
  for (const [key, value] of Object.entries(STORAGE)) storage.setItem(key, value);
  const ctx = createStorageContext({ registry, getStorage: () => storage });
  const keys =
    prefix === undefined
      ? undefined
      : registry
          .all()
          .map((entry) => entry.key)
          .filter((key) => key.startsWith(prefix));
  const document = exportNamespaces(ctx, keys);
  return {
    name,
    registry: readerDataManifest(registry).registry,
    storage: STORAGE,
    ...(prefix === undefined ? {} : { prefix }),
    exportedAt: EXPORTED_AT,
    expected: { ...document, exportedAt: EXPORTED_AT },
  };
}

export function readerDataExportCases(): readonly ReaderDataExportCase[] {
  return [
    exportCase("everything registered", fixtureRegistry()),
    exportCase("a namespace the registry does not let out", fixtureRegistry("am:tours:v1")),
    exportCase(
      "one namespace asked for by its key",
      fixtureRegistry(),
      "am:discovery-notes:v1:brownian-motion",
    ),
    exportCase("every paper's discovery notes", fixtureRegistry(), "am:discovery-notes:v1:"),
  ];
}

export function readerDataFixtureText(): string {
  return `${JSON.stringify(readerDataExportCases(), null, 2)}\n`;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(READER_DATA_FIXTURE, readerDataFixtureText());
  process.stdout.write(`wrote ${READER_DATA_FIXTURE}\n`);
}
