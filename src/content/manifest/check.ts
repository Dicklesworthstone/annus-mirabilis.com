/**
 * Content Compiler Plugin for Source Manifests.
 *
 * Registers with check family 'manifest' to validate source manifests during content compilation.
 *
 * Spec: AGENTS.md and am-cm-source-manifest-6qa
 */

import { type AliasRecord, validateAliasRecord } from "../aliases.ts";
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
      /**
       * THE ALIASES, WHICH THIS CHECK NEVER PASSED (am-m0na).
       *
       * `validateManifest(manifest, { manifests })` supplied only the manifests, so
       * `context.aliases ?? []` in validator.ts:494 was ALWAYS the empty array and every call to
       * `explainGap(missingId, aliases)` was asked to explain a gap with nothing to explain it
       * from. Measured 2026-10-10: feeding the four manifests raises 31 `sequence-gap` errors, and
       * ALSO feeding the four `content/aliases/<paper>.yaml` files changes that count by ZERO --
       * which is how a check that asks the right question of the wrong input reads exactly like a
       * corpus with 31 real gaps.
       *
       * The records are here to be read: route 19 compiles `content/aliases/<paper>.yaml` under
       * `kind: "aliases"`. Each entry goes through `validateAliasRecord` rather than being cast,
       * because an alias that does not parse must not silently explain a gap -- that would turn
       * this repair into a way of making gaps disappear, which is the opposite of its point.
       */
      const aliases: AliasRecord[] = [];
      let aliasFilesSeen = 0;
      let aliasEntriesRejected = 0;
      for (const [key, value] of context.records.entries()) {
        if (!value || typeof value !== "object") continue;
        const rec = value as Record<string, unknown>;
        if (!Array.isArray(rec.aliases)) continue;
        aliasFilesSeen += 1;
        for (const raw of rec.aliases) {
          const parsed = validateAliasRecord(raw);
          if (parsed.ok) aliases.push(parsed.value);
          else {
            aliasEntriesRejected += 1;
            context.report({
              recordId: key,
              rule: "alias-schema",
              message: `Alias record in "${key}" did not parse, so it cannot explain a gap: ${parsed.error}`,
              repair: "Correct the alias entry, or remove it and let the gap be reported.",
            });
          }
        }
      }

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

      console.log(
        `[census] source-manifest-validator examined ${manifests.size} manifest(s) with ` +
          `${aliases.length} alias record(s) from ${aliasFilesSeen} alias file(s)` +
          (aliasEntriesRejected > 0 ? `, ${aliasEntriesRejected} rejected` : "") +
          (manifests.size > 0 && aliases.length === 0
            ? ". 0 aliases: every sequence gap will report as unexplained, which is a fact about " +
              "the input and not about the corpus (am-m0na)."
            : ""),
      );
      for (const manifest of manifests.values()) {
        const diagnostics = validateManifest(manifest, { manifests, aliases });
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
