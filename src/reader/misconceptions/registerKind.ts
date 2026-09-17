/**
 * Registers the `misconception` clarification kind (am-read-misconception-callouts-a3o) with the
 * real closed registry (src/reader/stack/kinds.ts, owned by am-read-return-stack-oxa). This file
 * calls `registerClarificationKind`, exported by that module precisely so other beads can add a
 * kind without editing kinds.ts itself -- "registering a kind is the only way to add one" is
 * that bead's own rule, and this is the intended extension point, not a workaround for it.
 *
 * `descends: true`: opening a misconception (from an instrument link, a results-face collection
 * entry, or a paper list) pushes a return-stack frame like every other kind except `term`.
 */
import { createElement } from "react";
import type { Misconception } from "../../content/schemas/argument.ts";
import { registerClarificationKind } from "../stack/kinds.ts";
import type { InterventionStatus } from "./MisconceptionCallout.tsx";
import { MisconceptionCallout } from "./MisconceptionCallout.tsx";

export type MisconceptionTarget = Readonly<{ id: string }>;

type RegisteredEntry = Readonly<{
  misconception: Misconception;
  interventionStatus: InterventionStatus;
}>;

/**
 * The compiled misconception ledger, populated once per page by whatever loads the paper's
 * content (mirroring how `instrument-view`'s render reaches the dispatcher's own registry, not
 * a second one built here). A kind opened before its content registers renders the same honest
 * "not loaded" notice `instrument-view` would for an id its dispatcher does not recognize --
 * never a silent fallback to another entry. `interventionStatus` is supplied by the caller
 * (computed by interventionGate.ts against the real review records), never guessed here.
 */
const contentRegistry = new Map<string, RegisteredEntry>();

export function registerMisconceptionContent(entries: readonly RegisteredEntry[]): void {
  for (const entry of entries) contentRegistry.set(entry.misconception.id, entry);
}

export function __clearMisconceptionContentForTesting(): void {
  contentRegistry.clear();
}

const MISCONCEPTION_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

function parseMisconceptionId(raw: string): MisconceptionTarget | null {
  return MISCONCEPTION_ID_PATTERN.test(raw) ? Object.freeze({ id: raw }) : null;
}

function misconceptionStaticHref(parsed: MisconceptionTarget): string {
  return `#misconception-${parsed.id}`;
}

function misconceptionTitle(parsed: MisconceptionTarget): string {
  return `A common wrong turn (${parsed.id})`;
}

let registered = false;

/** Idempotent: safe to call from more than one entry point (a route module and a test) without
 * tripping the registry's own duplicate-registration guard. */
export function registerMisconceptionKind(): void {
  if (registered) return;
  registerClarificationKind<MisconceptionTarget>("misconception", {
    parseId: parseMisconceptionId,
    render: ({ parsed }) => {
      const entry = contentRegistry.get(parsed.id);
      if (!entry) {
        return createElement(
          "p",
          { className: "notice", "data-misconception-not-loaded": parsed.id },
          `This misconception (${parsed.id}) is not loaded on this page.`,
        );
      }
      // Opened from elsewhere via the stack: renders expanded, at the default (R1) Detail and
      // the printed lens -- the reader's own Detail/lens preference lives in navigation state
      // this low-level render entry point does not import (see types.ts's own note on that).
      return createElement(MisconceptionCallout, {
        misconception: entry.misconception,
        detail: 1,
        modernLens: false,
        expanded: true,
        interventionStatus: entry.interventionStatus,
      });
    },
    staticHref: misconceptionStaticHref,
    title: misconceptionTitle,
    descends: true,
  });
  registered = true;
}
