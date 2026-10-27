/**
 * THE REGISTERED KEYS NOTHING WRITES, WITH THE REASON EACH IS STILL LISTED (am-oj0e).
 *
 * `/your-data/` lists every registered key, because "a list that quietly left one out would be a
 * list you could not check" (that page's own sentence, about the withdrawn clarity key). The cost
 * of that honesty is that a reader sees kinds of data this site names and never holds, and until
 * this module existed the page explained exactly one of the seven.
 *
 * ONE SOURCE, READ FROM BOTH ENDS. `/your-data/` renders `readerReason`, and
 * `promisedKeys.test.ts` uses the same list as the set of keys allowed to have no writer. So the
 * prose a reader is shown and the exception the gate permits cannot drift apart, which is the
 * failure AGENTS.md describes for two statements of one rule. Writing a note here does not make a
 * key legitimate: the gate still requires every registered document namespace to have a writer a
 * reader can reach OR a note here, and it fails a note whose key has since GAINED a writer, so
 * this list can only shrink.
 *
 * `engineeringReason` names the owning bead and what is missing. It is not shown to a reader.
 */

export type ReservedKeyKind = "withdrawn" | "not-built";

export type ReservedKeyNote = Readonly<{
  /** Every registered key this one reason covers. */
  keys: readonly string[];
  kind: ReservedKeyKind;
  /** The heading phrase a reader sees for this group on /your-data/. */
  readerLabel: string;
  /** What a reader is told, in the site's voice. Shown on /your-data/. */
  readerReason: string;
  /** The owning bead and the measured reason nothing writes it. Never shown to a reader. */
  engineeringReason: string;
}>;

export const RESERVED_KEY_NOTES: readonly ReservedKeyNote[] = Object.freeze([
  Object.freeze({
    keys: Object.freeze(["am:clarity:v1"]),
    kind: "withdrawn" as const,
    readerLabel: "The “was this clear?” answers",
    readerReason:
      "This key was reserved for a one-click “this was clear / this was not” answer under a paragraph. That feature was withdrawn on 2 October 2026 and will not be built, so nothing writes to the key, nothing ever did, and there is nothing in it to export. The site collects no answers of any kind.",
    engineeringReason:
      "D-2026-10-02-withdraw-clarity-signal: the owner withdrew the clarity control, so nothing will ever write this.",
  }),
  Object.freeze({
    keys: Object.freeze(["am:tours:v1"]),
    kind: "not-built" as const,
    readerLabel: "Progress on guided reading paths",
    readerReason:
      "A guided route keeps your place in its own link rather than on your device, and keeps no record of how far along you are. Bookmark a stop and it opens again; nothing is written here.",
    engineeringReason:
      "am-oj0e: ActiveTourGuide is navigation only and tells the reader there is no automatic progress record; the position lives in ?tour=&tourStop=&tourRevision=. Whether this entry goes or stays with a note is am-tours-infra-g518's call.",
  }),
  Object.freeze({
    keys: Object.freeze(["am:journeys:v1"]),
    kind: "not-built" as const,
    readerLabel: "Your choices in Discover",
    readerReason:
      "Discover shows the branches of a fork beside one another instead of asking you to pick one, so there is no choice of yours to keep. Nothing is written here.",
    engineeringReason:
      "am-disc-journey-framework-umbg: journeyStorage.ts can write it and no page imports it, because Fork.tsx and Branch.tsx render every branch with no reader selection.",
  }),
  Object.freeze({
    keys: Object.freeze([
      "am:discovery-notes:v1:light-quanta",
      "am:discovery-notes:v1:brownian-motion",
      "am:discovery-notes:v1:special-relativity",
      "am:discovery-notes:v1:mass-energy",
    ]),
    kind: "not-built" as const,
    readerLabel: "Discovery notes, one key per paper",
    readerReason:
      "The journeys have no notebook of their own yet. A prediction you record in a journey's investigation is kept under its own key, listed above. Nothing is written to these four.",
    engineeringReason:
      "am-read-notebook-tde: storedNotebook.ts can write them and no page imports it, because noteManifest(journey) reads journey.stages and all four real journeys declare stages: [] (am-4k0m).",
  }),
]);

/** Every reserved key, flattened, for the gate that permits exactly these to have no writer. */
export const RESERVED_KEYS: readonly string[] = Object.freeze(
  RESERVED_KEY_NOTES.flatMap((note) => [...note.keys]),
);

/** The note covering a key, or `undefined` when a key is not reserved. */
export function reservedKeyNote(key: string): ReservedKeyNote | undefined {
  return RESERVED_KEY_NOTES.find((note) => note.keys.includes(key));
}
