/**
 * WHETHER A MANIFEST'S `quantityId` NAMES A REGISTERED QUANTITY, AND WHAT IT NAMES WHEN IT DOES NOT.
 *
 * `outputs[].quantityId` and `parameters[].quantityId` are the join to dimension, mathematical kind,
 * frame, permitted units and colour role. AGENTS.md requires the compiler to reject "a live term that
 * is not an exact canonical quantity id" and warns that "a similar glyph is never a binding key".
 * Nothing read the field against the registry, so an unregistered id passed every gate (am-8be1).
 *
 * `scripts/report-unregistered-quantity-ids.ts` already reports the population and sorts it by what
 * each manifest declares (`enumerated-control`, `buffer-shaped`, `scalar-candidate`). This is the
 * other half, the one the bead's third criterion asks for: a gate, so the population cannot grow
 * quietly. The two instruments were written independently and agree on the total at 220, which is
 * worth more than either number alone.
 *
 * WHAT THE CORPUS ACTUALLY DOES, measured 2026-10-28 over 33 manifests and 638 entries, every one of
 * which carries a quantityId:
 *
 *     418  resolve to one of the 315 registered quantities
 *     132  SELF-NAMED: the quantityId is the entry's own id, so it asserts no reference at all
 *      84  UNBOUND: it names something else, and nothing in the registry or the corpus knows the name
 *       2  LOCAL-REFERENCE: it names a self-named entry in the same manifest (bm-01's parameter `M`
 *          carries `ensembleSize`, which is its own output's self-name)
 *       2  REPRESENTATION-FIELD: a declared `representationFields` entry of a registered quantity.
 *          `resolveQuantityId` reports these unregistered ON PURPOSE, so that a plotting
 *          representation is never silently exchanged for a different physical quantity; folding
 *          them into "unbound" would report declared data as a typo.
 *
 * THE SPLIT BY FIELD IS THE FINDING, and it is not in the bead. Among OUTPUTS, 119 of the 142 that do
 * not resolve are self-named -- the author had no registry id and wrote the output's own. Among
 * PARAMETERS only 13 of 76 are, so a parameter that does not resolve is usually ASSERTING a reference:
 * `seed` carries `streamSeed`, `cells` carries `gridCellCount`, `trials` carries `trialCount`. Those
 * are the ones that are binding to nothing.
 *
 * AND THE 84 ARE NOT RANDOM. Many are the laboratory contract's own `semanticKind` copied into the
 * field: lq-07's `e1Ev`, `e2Ev`, `energyDeficitEv` and `eOtherEv` all carry `energy`, its two power
 * outputs carry `power`, and six of sr-03's entries carry `measurementKind`. One, lq-01's
 * `screenIntensity`, carries `coordinate-intensity` -- hyphenated, so it cannot be a quantity id under
 * any future authoring, since ids are lower camel case. That is "never lookup by human label" in a
 * new place: a kind word is not an identity.
 *
 * WHAT THIS GATE ASSERTS, AND WHAT IT DELIBERATELY DOES NOT. It asserts that the set of entries whose
 * quantityId does not resolve is EXACTLY the recorded set, keyed by identity rather than counted, so
 * that a new one fails and a swap cannot hide inside an unchanged total. It does NOT decide what any
 * of the 220 should become. Whether a per-frame buffer is a quantity at all, whether a selector should
 * carry the field, and which of the 84 want a rename against an existing id, a unit variant, or a new
 * record are the editorial questions the bead reserves to an owner, and a gate that answered them by
 * minting 84 quantities would be doing the thing the bead's own last criterion forbids.
 *
 * The classifier is pure and takes its resolution as an argument, so its proof can run without the
 * registry and without the corpus (AGENTS.md: a gate's own test must not live only in the lane that
 * gate controls).
 */

/** The fields a manifest exposes to this check. Only what it reads. */
export type BoundManifest = Readonly<{
  id: string;
  outputs?: readonly Readonly<{ id: string; quantityId?: string | undefined }>[] | undefined;
  parameters?: readonly Readonly<{ id: string; quantityId?: string | undefined }>[] | undefined;
}>;

export type BindingField = "outputs" | "parameters";

/**
 * Why a binding is what it is. Ordered strongest first, and the classifier applies them in this
 * order: a registered id wins even when it happens to equal the entry's own id, because that is a
 * real binding and not a local name.
 */
export type BindingClass =
  | "registered"
  | "representation-field"
  | "legacy-spelling"
  | "self-named"
  | "local-reference"
  | "unbound";

export type QuantityBinding = Readonly<{
  lab: string;
  field: BindingField;
  entryId: string;
  quantityId: string;
  bindingClass: BindingClass;
  /** `<lab>:<field>:<entryId>`, the identity the baseline is keyed by. */
  key: string;
  /** For a legacy spelling or a representation field, what it resolves toward. */
  canonical?: readonly string[] | undefined;
}>;

export type QuantityBindingReport = Readonly<{
  /** How many manifests were examined. Zero means every count below establishes nothing. */
  labs: number;
  /** Every outputs[] and parameters[] entry seen, whether or not it carried a quantityId. */
  entries: number;
  bindings: readonly QuantityBinding[];
  /** Everything that did not resolve, in any of the four non-registered classes. */
  unresolved: readonly QuantityBinding[];
}>;

/**
 * The registry questions this check needs, as functions, so the proof can supply them. The real
 * caller passes the registry's own `resolveQuantityId` and representation-field index; nothing here
 * re-implements resolution, which is how two spellings of the same question are avoided.
 */
export type QuantityResolution = Readonly<{
  /** Exact registry membership. */
  registered: (id: string) => boolean;
  /** The owning quantity id when `id` is a declared representation field, else undefined. */
  representationField: (id: string) => string | undefined;
  /** The canonical ids when `id` is a RECORDED legacy spelling, else undefined. */
  legacySpelling: (id: string) => readonly string[] | undefined;
}>;

/** The ids an entry uses to name itself, per manifest: `quantityId === id`. */
function selfNamesOf(manifest: BoundManifest): ReadonlySet<string> {
  const names = new Set<string>();
  for (const field of ["outputs", "parameters"] as const)
    for (const entry of manifest[field] ?? [])
      if (typeof entry.quantityId === "string" && entry.quantityId === entry.id)
        names.add(entry.id);
  return names;
}

/**
 * Classifies every quantityId in every manifest given. The report carries the whole population and
 * not only the failures, so a caller can state what it examined beside its verdict.
 */
export function checkQuantityBindings(
  manifests: readonly BoundManifest[],
  resolve: QuantityResolution,
): QuantityBindingReport {
  const bindings: QuantityBinding[] = [];
  let entries = 0;
  for (const manifest of manifests) {
    const selfNames = selfNamesOf(manifest);
    for (const field of ["outputs", "parameters"] as const) {
      for (const entry of manifest[field] ?? []) {
        entries += 1;
        const quantityId = entry.quantityId;
        // A missing quantityId is the schema's business, not this check's: `validateExperiment`
        // already refuses a parameter without one. Counting it here as unbound would report a
        // schema refusal as a binding defect.
        if (typeof quantityId !== "string" || quantityId.trim() === "") continue;
        const owning = resolve.representationField(quantityId);
        const legacy = resolve.legacySpelling(quantityId);
        const bindingClass: BindingClass = resolve.registered(quantityId)
          ? "registered"
          : owning !== undefined
            ? "representation-field"
            : legacy !== undefined
              ? "legacy-spelling"
              : quantityId === entry.id
                ? "self-named"
                : selfNames.has(quantityId)
                  ? "local-reference"
                  : "unbound";
        bindings.push(
          Object.freeze({
            lab: manifest.id,
            field,
            entryId: entry.id,
            quantityId,
            bindingClass,
            key: `${manifest.id}:${field}:${entry.id}`,
            ...(owning !== undefined
              ? { canonical: Object.freeze([owning]) }
              : legacy !== undefined
                ? { canonical: Object.freeze([...legacy]) }
                : {}),
          }),
        );
      }
    }
  }
  return Object.freeze({
    labs: manifests.length,
    entries,
    bindings: Object.freeze(bindings),
    unresolved: Object.freeze(bindings.filter((b) => b.bindingClass !== "registered")),
  });
}

/** The one line a caller prints beside its verdict, naming its denominator. */
export function summarizeQuantityBindings(report: QuantityBindingReport): string {
  const of = (c: BindingClass) => report.bindings.filter((b) => b.bindingClass === c).length;
  return (
    `${report.bindings.length} quantityId(s) on ${report.entries} entr(ies) across ${report.labs} manifest(s): ` +
    `${of("registered")} registered, ${of("self-named")} self-named, ${of("unbound")} unbound, ` +
    `${of("local-reference")} local reference(s), ${of("representation-field")} representation field(s), ` +
    `${of("legacy-spelling")} legacy spelling(s)`
  );
}

/**
 * The recorded set against the live one, in BOTH directions. A new unresolved binding is the defect
 * the gate exists for; a recorded one that no longer appears is a debt that has been paid and whose
 * record must come down with it, because "a baseline that only ever rises is a budget".
 */
export function compareToBaseline(
  report: QuantityBindingReport,
  baseline: Readonly<Record<string, string>>,
): Readonly<{
  added: readonly QuantityBinding[];
  stale: readonly string[];
  reclassified: readonly Readonly<{ key: string; was: string; now: BindingClass }>[];
}> {
  const live = new Map(report.unresolved.map((b) => [b.key, b] as const));
  const added = report.unresolved.filter((b) => baseline[b.key] === undefined);
  const stale = Object.keys(baseline)
    .filter((k) => !live.has(k))
    .sort();
  const reclassified = [...live.entries()]
    .filter(([k, b]) => baseline[k] !== undefined && baseline[k] !== b.bindingClass)
    .map(([k, b]) => Object.freeze({ key: k, was: baseline[k] as string, now: b.bindingClass }))
    .sort((a, b) => a.key.localeCompare(b.key));
  return Object.freeze({
    added: Object.freeze(added),
    stale: Object.freeze(stale),
    reclassified: Object.freeze(reclassified),
  });
}
