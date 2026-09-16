/**
 * Hand-written owner bindings for registered catalogue ids
 * (am-inst-registry-dispatcher-66l0). "A reusable physical or numerical law
 * belongs in FrankenSim... Kernels own the law" (AGENTS.md); this module
 * names, per instrument, which kind of owner computed its numbers. No
 * FrankenSim WASM artifact is used anywhere in this repository yet (every
 * number is a labeled host calculation), so every binding below is
 * `reference-evaluator`, pointing at that instrument's real session entry
 * point (`src/experiments/bm0N/session.ts`'s `createBm0NSession`), not a
 * placeholder.
 */

import type { CatalogueId } from "./catalogue.ts";

export type OwnerBinding =
  | Readonly<{ kind: "reference-evaluator"; module: string; function: string }>
  | Readonly<{
      kind: "frankensim";
      capability: string;
      export: string;
      fallback: Readonly<{ module: string; function: string }>;
    }>
  | Readonly<{ kind: "static" }>;

export const OWNER_BINDINGS: Readonly<Partial<Record<CatalogueId, OwnerBinding>>> = Object.freeze({
  "lq-01": Object.freeze({
    kind: "reference-evaluator",
    module: "src/experiments/lq01/session.ts",
    function: "createLq01Session",
  }),
  "lq-08": Object.freeze({
    kind: "reference-evaluator",
    module: "src/experiments/lq08/session.ts",
    function: "createLq08Session",
  }),
  "bm-01": Object.freeze({
    kind: "reference-evaluator",
    module: "src/experiments/bm01/session.ts",
    function: "createBm01Session",
  }),
  "bm-02": Object.freeze({
    kind: "reference-evaluator",
    module: "src/experiments/bm02/session.ts",
    function: "computeBm02Snapshot",
  }),
  "bm-03": Object.freeze({
    kind: "reference-evaluator",
    module: "src/experiments/bm03/session.ts",
    function: "createBm03Session",
  }),
  "bm-04": Object.freeze({
    kind: "reference-evaluator",
    module: "src/experiments/bm04/session.ts",
    function: "createBm04Session",
  }),
  "bm-05": Object.freeze({
    kind: "reference-evaluator",
    module: "src/experiments/bm05/session.ts",
    function: "createBm05Session",
  }),
  "bm-06": Object.freeze({
    kind: "reference-evaluator",
    module: "src/experiments/bm06/session.ts",
    function: "createBm06Session",
  }),
  "bm-07": Object.freeze({
    kind: "reference-evaluator",
    module: "src/experiments/bm07/session.ts",
    function: "createBm07Session",
  }),
  "bm-08": Object.freeze({
    kind: "reference-evaluator",
    module: "src/experiments/bm08/session.ts",
    function: "createBm08Session",
  }),
  "me-01": Object.freeze({
    kind: "reference-evaluator",
    module: "src/experiments/me01/session.ts",
    function: "createMe01Session",
  }),
  "me-02": Object.freeze({
    kind: "reference-evaluator",
    module: "src/experiments/me02/session.ts",
    function: "createMe02Session",
  }),
});

export class MissingOwnerError extends Error {
  readonly id: CatalogueId;
  constructor(id: CatalogueId) {
    super(
      `Registered catalogue id "${id}" has no owner binding. An entry without an owner or ` +
        `explicit static status fails the build (am-inst-registry-dispatcher-66l0 requirements).`,
    );
    this.name = "MissingOwnerError";
    this.id = id;
  }
}

/** Throws `MissingOwnerError` for a registered id with no binding; this is the build-failing check the acceptance criteria require. */
export function assertOwnerBinding(
  id: CatalogueId,
  status: "registered" | "in-preparation",
): OwnerBinding | null {
  if (status === "in-preparation") return null;
  const binding = OWNER_BINDINGS[id];
  if (!binding) throw new MissingOwnerError(id);
  return binding;
}
