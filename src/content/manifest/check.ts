/**
 * Content Compiler Plugin for Source Manifests.
 *
 * Registers with check family 'manifest' to validate source manifests during content compilation.
 *
 * Spec: AGENTS.md and am-cm-source-manifest-6qa
 */

import { registerCheck } from "../compiler/checks/registry.ts";
import { validateSourceManifest } from "./schema.ts";
import type { SourceManifest } from "./types.ts";
import { validateManifest } from "./validator.ts";

export const SOURCE_MANIFEST_CHECK_ID = "source-manifest-validator";

/**
 * Registers the manifest check with the compiler plugin registry.
 */
export function registerSourceManifestCheck(): void {
  registerCheck({
    id: SOURCE_MANIFEST_CHECK_ID,
    family: "manifest",
    severity: "error",
    beadId: "am-cm-source-manifest-6qa",
    description:
      "Validates source manifest completeness, locators, page spans, sequence continuity, and import chronology.",
    run: (context) => {
      const manifests = new Map<string, SourceManifest>();

      // Look for source manifest records in context
      for (const [key, value] of context.records.entries()) {
        if (value && typeof value === "object") {
          const rec = value as Record<string, unknown>;
          if (
            rec.kind === "source-manifest" ||
            (typeof rec.paper === "string" &&
              typeof rec.document === "string" &&
              Array.isArray(rec.units))
          ) {
            try {
              const validated = validateSourceManifest(value, key);
              manifests.set(validated.paper, validated);
            } catch (err: unknown) {
              const error = err instanceof Error ? err : new Error(String(err));
              context.report({
                recordId: key,
                rule: "manifest-schema-invalid",
                message: error.message,
              });
            }
          }
        }
      }

      for (const manifest of manifests.values()) {
        const diagnostics = validateManifest(manifest, { manifests });
        for (const diag of diagnostics) {
          context.report({
            recordId: manifest.paper,
            rule: diag.rule,
            message: diag.message,
            repair: diag.repair,
            severity: diag.severity,
          });
        }
      }
    },
  });
}

// Auto-register on import
registerSourceManifestCheck();
