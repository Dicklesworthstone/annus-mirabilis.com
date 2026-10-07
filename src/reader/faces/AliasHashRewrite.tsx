"use client";

import { useEffect } from "react";

/**
 * The JavaScript half of am-read-anchors-navigation-a6o's alias criterion: "A retired id from the
 * alias fixture lands on its new location with JavaScript disabled, AND is rewritten by replacement
 * with JavaScript enabled, without adding a history entry."
 *
 * The no-script half already worked and still does the real work. `GermanFace.tsx` emits
 * `<span id={retired} data-alias-of={target} />` for every retired id whose successor this face
 * publishes, so the browser's own fragment navigation lands the reader in the right place with no
 * script at all. Measured in the built site on 2026-10-07: 33 of the 37 declared records ship as
 * such anchors, the four absent ones pointing at reference occurrences that are anchors on no face.
 *
 * So this island changes nothing about WHERE the reader lands. It corrects the address bar, which
 * matters for one reason worth stating plainly: a reader who copies the URL after following an old
 * link would otherwise pass the retired id on again.
 *
 * `history.replaceState` is the whole point of the criterion's last clause. It rewrites the current
 * entry rather than pushing one, so Back still goes where the reader came from rather than to the
 * same page under its old spelling.
 *
 * WHY THE FLAT MAP AND NOT `rewrittenHashFor`. `src/reader/anchors/aliases.ts` exports
 * `rewrittenHashFor`, which computes exactly this and is the validated owner's wrapper. It takes
 * `AliasRecord[]`, and `resolveAlias` runs every record through `validateAliasRecord`, which
 * requires `reason`, `date` and `editor`. The reasons are long -- several are over 200 characters
 * of editorial justification citing page images -- so using it here means serialising all of that
 * prose to the browser to rewrite a fragment. Against a measured ~33 KB of brotli headroom on this
 * route (171,494 of 204,800), that is a poor trade for an address-bar correction.
 *
 * The map `GermanFace` already holds is the server-resolved answer, and
 * `src/content/notation/aliasReadersAgree.test.ts` holds that reader to the owner: it asserts, over
 * the real corpus, that the flat first target equals `resolveAlias`'s resolved first target, and a
 * planted chain in `content/aliases/mass-energy.yaml` reddens it. That gate is what licenses this
 * shortcut, and if it ever goes red this island is wrong too.
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
    const next = rewrittenAliasHash(window.location.hash, aliases);
    if (next === null) return;
    // Only rewrite to something this document actually carries. The map is filtered server-side to
    // published targets, so this is defence in depth rather than the primary guard; without it a
    // stale map would move the address bar to a fragment that leads nowhere, which is worse than
    // leaving the retired spelling in place.
    if (document.getElementById(next.slice(1)) === null) return;
    window.history.replaceState(window.history.state, "", next);
  }, [aliases]);
  return null;
}
