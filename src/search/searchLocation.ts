import { SEARCH_LIMITS, SEARCH_TYPES, type SearchType } from "./core.ts";

export type SearchLocation = Readonly<{
  query: string;
  paper: string;
  type: SearchType | "";
}>;
export const EMPTY_SEARCH: SearchLocation = Object.freeze({ query: "", paper: "", type: "" });

function valid(value: SearchLocation): boolean {
  return (
    value.query.length <= SEARCH_LIMITS.queryCharacters &&
    // In Unicode mode this matches only lone surrogates, not complete astral characters.
    !/[\uD800-\uDFFF]/u.test(value.query) &&
    // The control characters below are the SUBJECT of this test, not an accident in it. The rule
    // exists to catch a control character that reached a pattern by mistake, usually pasted; here
    // the class is written out on purpose so a query carrying one is refused, which is what keeps
    // an untrusted fragment from putting a NUL or an escape sequence into a URL, a log line or a
    // DOM attribute. Six of the lint gate's errors were this one line. Removing the class would
    // not satisfy the rule's intent, it would delete the check.
    // biome-ignore lint/suspicious/noControlCharactersInRegex: deliberate, see above
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value.query) &&
    (value.paper === "" || /^[a-z0-9][a-z0-9-]{0,79}$/u.test(value.paper)) &&
    (value.type === "" || SEARCH_TYPES.includes(value.type))
  );
}

/** Explicitly shared state lives in the fragment, never in an HTTP query or local storage. */
export function searchResultsHref(value: SearchLocation): string | null {
  if (!valid(value)) return null;
  const params = new URLSearchParams();
  if (value.query) params.set("q", value.query);
  if (value.paper) params.set("paper", value.paper);
  if (value.type) params.set("type", value.type);
  const fragment = params.toString();
  return `/search/results/${fragment ? `#${fragment}` : ""}`;
}

/** Refuse ambiguous, oversized or malformed links rather than silently broadening a search. */
export function readSearchLocation(hash: string): SearchLocation | null {
  if (hash === "" || hash === "#") return EMPTY_SEARCH;
  if (!hash.startsWith("#") || hash.length > 4096 || /[\uD800-\uDFFF]/u.test(hash)) return null;
  try {
    // URLSearchParams tolerates malformed escapes; a shared link must round-trip without loss.
    decodeURIComponent(hash.slice(1).replace(/\+/gu, " "));
    const params = new URLSearchParams(hash.slice(1));
    const seen = new Set<string>();
    for (const key of params.keys()) {
      if (!["q", "paper", "type"].includes(key) || seen.has(key)) return null;
      seen.add(key);
    }
    const value = {
      query: params.get("q") ?? "",
      paper: params.get("paper") ?? "",
      type: (params.get("type") ?? "") as SearchLocation["type"],
    };
    return valid(value) ? Object.freeze(value) : null;
  } catch {
    return null;
  }
}
