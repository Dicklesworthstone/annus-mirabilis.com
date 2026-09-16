/**
 * The registry: catalogue status joined with owner bindings
 * (am-inst-registry-dispatcher-66l0). Building `REGISTRY` throws
 * `MissingOwnerError` (owners.ts) if any registered id lacks a binding, so
 * a broken registration fails at import time, not silently at render time.
 *
 * This is a deliberately smaller shape than the bead's originally planned
 * `content/experiments/<id>.yaml`-compiled manifest (question, source and
 * argument ids, parameter schema, scenarios, tapes, predict-mode prompts,
 * and the rest): that compiler (am-cm-schemas-experiment-fuu) does not
 * exist yet. `RegistryEntry` carries exactly what this repository can
 * honestly assert today — status, owner, and an authored question where
 * one exists — and is additive, not a rewrite, when the fuller manifest
 * lands.
 */

import {
  CATALOGUE_IDS,
  CATALOGUE_QUESTIONS,
  CATALOGUE_STATUS,
  type CatalogueId,
  type CatalogueStatus,
} from "./catalogue.ts";
import { assertOwnerBinding, type OwnerBinding } from "./owners.ts";

export interface RegistryEntry {
  readonly id: CatalogueId;
  readonly status: CatalogueStatus;
  readonly owner: OwnerBinding | null;
  readonly question: string | undefined;
}

function buildEntry(id: CatalogueId): RegistryEntry {
  const status = CATALOGUE_STATUS[id];
  return Object.freeze({
    id,
    status,
    owner: assertOwnerBinding(id, status),
    question: CATALOGUE_QUESTIONS[id],
  });
}

/** Built eagerly at module load: a registration bug is a load-time failure, not a render-time surprise. */
export const REGISTRY: Readonly<Record<CatalogueId, RegistryEntry>> = Object.freeze(
  Object.fromEntries(CATALOGUE_IDS.map((id) => [id, buildEntry(id)])) as Record<
    CatalogueId,
    RegistryEntry
  >,
);

export function registryEntry(id: CatalogueId): RegistryEntry {
  return REGISTRY[id];
}

/**
 * Manifest/catalogue parity (Test Plan's "registry.test.ts"): every
 * registered id has a non-null owner, and every id with an owner binding is
 * marked registered. `owners.ts` failing to build already catches the
 * first direction; this is the second, checked as a value rather than
 * relying only on the constructor throwing.
 */
export function registryParityViolations(): string[] {
  const violations: string[] = [];
  for (const id of CATALOGUE_IDS) {
    const entry = REGISTRY[id];
    if (entry.status === "registered" && !entry.owner) {
      violations.push(`${id} is registered but has no owner binding`);
    }
    if (entry.status === "in-preparation" && entry.owner) {
      violations.push(`${id} is in-preparation but has an owner binding`);
    }
  }
  return violations;
}
