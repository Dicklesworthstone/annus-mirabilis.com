/** Deliberate violation: view importing WASM worker loader. */
import type { BundleLoadSuccess } from "../../../workers/wasm/loadBundle.ts";

export function PlantedWasmLoader(): BundleLoadSuccess | null {
  return null;
}
