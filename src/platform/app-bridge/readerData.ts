/**
 * What the iPhone app needs to list and export the reader's data the way /your-data/ does
 * (App plan §8.7, "export and clear by namespace, with the same namespaces as the website"):
 * the site's own registry of keys, kinds and labels, and the record the bridge mirrors them
 * into. `scripts/app/export-edition.ts` writes this into the edition manifest, so the app
 * never re-authors a label or guesses which keys the site keeps.
 */

import { type KeyRegistry, type StorageKind, storageKeyRegistry } from "../storage/keys.ts";
import { SNAPSHOT_RECORD } from "./userScripts.ts";

export interface ReaderDataEntry {
  readonly key: string;
  readonly kind: StorageKind;
  readonly label: string;
  readonly exportable: boolean;
}

export interface ReaderDataManifest {
  readonly snapshot: { readonly namespace: string; readonly key: string };
  /** In the registry's order, which is the order /your-data/ lists and exports them. */
  readonly registry: readonly ReaderDataEntry[];
}

export function readerDataManifest(registry: KeyRegistry = storageKeyRegistry): ReaderDataManifest {
  return {
    snapshot: { namespace: SNAPSHOT_RECORD.namespace, key: SNAPSHOT_RECORD.key },
    registry: registry.all().map((entry) => ({
      key: entry.key,
      kind: entry.kind,
      label: entry.label,
      exportable: entry.exportable,
    })),
  };
}
