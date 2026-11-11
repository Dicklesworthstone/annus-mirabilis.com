"use client";

import { useEffect } from "react";

/**
 * Static alias spans do the navigation, including without JavaScript. This island keeps copied
 * links current by replacing the address rather than pushing a second history entry. The server
 * resolves alias chains once and sends only the destination map; provenance stays in the records.
 */

/**
 * The hash to rewrite to, or `null` when the current hash needs no rewrite: no fragment, a fragment
 * that was never retired, a self-referential record, or a fragment that is not decodable at all.
 * Pure, because a fragment is untrusted input and the branch table is the part worth testing.
 */
export function rewrittenAliasHash(
  currentHash: string,
  aliases: Readonly<Record<string, string>>,
): string | null {
  const raw = currentHash.startsWith("#") ? currentHash.slice(1) : currentHash;
  if (!raw) return null;
  let id: string;
  try {
    id = decodeURIComponent(raw);
  } catch {
    // A malformed percent-escape is a fragment no anchor can carry; leave the bar alone rather
    // than guess. `resolveFacsimileTarget` refuses the same input the same way.
    return null;
  }
  // `Object.hasOwn`, NOT `aliases[id]`. A plain object literal inherits `toString`, `constructor`
  // and `__proto__`, so a bare index returns a FUNCTION for `#toString` and this returned
  // "#function toString() { [native code] }". The test for it was written before the code and
  // caught it on the first run. The `typeof` check then makes the string contract explicit rather
  // than inferred.
  if (!Object.hasOwn(aliases, id)) return null;
  const target = aliases[id];
  if (typeof target !== "string" || target === "" || target === id) return null;
  return `#${target}`;
}

export function AliasHashRewrite({
  aliases,
}: {
  /** Retired id to the published id that absorbed it, already filtered to targets this face emits. */
  readonly aliases: Readonly<Record<string, string>>;
}) {
  useEffect(() => {
    const rewrite = () => {
      const next = rewrittenAliasHash(window.location.hash, aliases);
      if (next === null) return;
      // A whole-paper map may be shared with a section view. Only a statically rendered alias
      // and its actual successor may change this page's address; never canonicalise an absent id.
      const target = document.getElementById(next.slice(1));
      const alias = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (target === null || alias?.getAttribute("data-alias-of") !== next.slice(1)) return;
      window.history.replaceState(window.history.state, "", next);
    };
    rewrite();
    window.addEventListener("hashchange", rewrite);
    return () => window.removeEventListener("hashchange", rewrite);
  }, [aliases]);
  return null;
}
