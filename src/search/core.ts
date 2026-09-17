/** DOM-free search over compiled edition projections. Queries never leave this module. */
export const SEARCH_VERSION = 1;
export const SEARCH_LIMITS = Object.freeze({
  queryCharacters: 256,
  queryTerms: 24,
  documents: 20000,
  documentCharacters: 160000,
  results: 30,
  shardBytes: 2 * 1024 * 1024,
  totalBytes: 16 * 1024 * 1024,
  manifestBytes: 64 * 1024,
  shards: 128,
  // Provisional per-shard transfer budget from am-plat-search-index-snx1.
  gzipShardBytes: 153600,
});
export const SEARCH_TYPES = [
  "paper", "section", "argument", "equation", "instrument", "foundation", "result",
  "sentence-de", "sentence-en", "glossary", "misconception", "margin", "timeline",
  "knowledge-card", "person", "essay", "connection-thread", "tour", "capstone",
] as const;
export type SearchType = (typeof SEARCH_TYPES)[number];
export type SearchDocument = Readonly<{
  id: string;
  type: SearchType;
  paper: string;
  section: string;
  lang: string;
  title: string;
  text: string;
  terms: readonly string[];
  route: string;
  anchor: string;
  face: string;
  scopeLabel: string;
}>;
export type SearchAlias = Readonly<{
  phrase: string;
  target: string;
  label: "search aid" | "modern term";
}>;
export type SearchHit = Readonly<{
  document: SearchDocument;
  score: number;
  snippet: string;
  aliasLabel: SearchAlias["label"] | null;
}>;
const GREEK: Readonly<Record<string, string>> = Object.freeze({
  α: "alpha", β: "beta", γ: "gamma", δ: "delta", ε: "epsilon", ζ: "zeta",
  η: "eta", θ: "theta", ι: "iota", κ: "kappa", λ: "lambda", μ: "mu",
  ν: "nu", ξ: "xi", π: "pi", ρ: "rho", σ: "sigma", ς: "sigma", τ: "tau",
  υ: "upsilon", φ: "phi", χ: "chi", ψ: "psi", ω: "omega",
});
const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻";
const DIGITS = "0123456789+-";
const STOP_WORDS = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "is", "it", "does", "do", "how",
  "what", "why", "with", "for", "der", "die", "das", "ein", "eine", "und", "von", "ist",
]);

/** String arithmetic, so scientific notation does not overflow or lose significant digits. */
function numberToken(source: string): string {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/u.exec(source);
  if (!match) return source;
  const exponent = Number(match[4] ?? 0) - (match[3]?.length ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100000) return source;
  let digits = (match[2]! + (match[3] ?? "")).replace(/^0+/u, "");
  if (!digits) return "0";
  const trailing = /0+$/u.exec(digits)?.[0].length ?? 0;
  if (trailing) digits = digits.slice(0, -trailing);
  return `${match[1] === "-" ? "-" : ""}${digits}e${exponent + trailing}`;
}

/** Matching keys only; never use normalized text in a source quotation or visible excerpt. */
export function normalizeSearchText(input: string): string {
  const text = input
    .replace(/([0-9])([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+)/gu, (_, base: string, power: string) =>
      `${base}^${Array.from(power, (c) => DIGITS[SUPERSCRIPTS.indexOf(c)]).join("")}`)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\\(?:cdot|times)(?![a-z])/gu, "×")
    .replace(/\\(?:mu|upmu)\b/gu, "μ")
    .replace(/(?<=\d),(?=\d)/gu, ".")
    .replace(/\^\{([+-]?\d+)\}/gu, "^$1")
    .replace(/(?<![\p{L}\p{N}])(?:(\d+(?:\.\d+)?)\s*[×·*]\s*)?10\s*\^\s*([+-]?\d+)/gu,
      (_, coefficient: string | undefined, exponent: string) => `${coefficient ?? "1"}e${exponent}`)
    .replace(/\b(bm|lq|sr|me)[ -]?0?(\d{1,2})\b/gu,
      (_, family: string, n: string) => `${family}${n.padStart(2, "0")}`)
    .replace(/\b(?:mikron|microns?|micromet(?:er|re)s?|um)\b|μm|μ(?![\p{L}\p{N}])/gu, " micrometre ")
    .replace(/[α-ω]/gu, (symbol) => ` ${GREEK[symbol] ?? symbol} `)
    .replace(/(?:\\)?varphi\b/gu, "phi")
    .replace(/([\p{L}])['′’](?!\p{L})/gu, "$1prime")
    .replace(/ß/gu, "ss")
    .replace(/ä|ae/gu, "a").replace(/ö|oe/gu, "o").replace(/ü|ue/gu, "u")
    .normalize("NFD").replace(/\p{M}/gu, "");
  const tokens = text.match(/[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?|[\p{L}][\p{L}\p{N}]*/gu) ?? [];
  return tokens.map((token) => /^[-+]?\d/u.test(token) ? numberToken(token) : token).join(" ");
}

function boundedText(value: unknown, name: string, max: number, empty = false): asserts value is string {
  if (typeof value !== "string" || (!empty && !value.trim()) || value.length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))
    throw new TypeError(`Invalid search document ${name}.`);
}

/** Only known local routes and content anchors, never executable or external result URLs. */
export function validateSearchDocument(value: unknown): SearchDocument {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Invalid search document.");
  const d = value as Record<string, unknown>;
  for (const key of ["id", "title", "paper", "lang", "scopeLabel"])
    boundedText(d[key], key, key === "title" ? 1000 : 500);
  for (const key of ["section", "anchor", "face"])
    boundedText(d[key], key, 500, true);
  boundedText(d.text, "text", SEARCH_LIMITS.documentCharacters, true);
  boundedText(d.route, "route", 1000);
  if (!SEARCH_TYPES.includes(d.type as SearchType) ||
      !/^\/(?:papers|foundations|lab|notation|discover|essays|connections|tours|capstones|timeline|1904)(?:\/[a-zA-Z0-9_-]+)*\/?$/u.test(d.route) ||
      !/^[a-zA-Z0-9_.:-]*$/u.test(d.anchor as string) ||
      !["", "reading", "german", "english", "results", "gloss", "facsimile"].includes(d.face as string) ||
      !Array.isArray(d.terms) || d.terms.length > 128)
    throw new TypeError("Invalid search route, anchor, face, type or terms.");
  for (const term of d.terms) boundedText(term, "term", 1000);
  return Object.freeze({
    id: d.id as string, type: d.type as SearchType, paper: d.paper as string,
    section: d.section as string, lang: d.lang as string, title: d.title as string,
    text: d.text, terms: Object.freeze([...d.terms]) as readonly string[], route: d.route,
    anchor: d.anchor as string, face: d.face as string, scopeLabel: d.scopeLabel as string,
  });
}

export function searchResultHref(document: SearchDocument): string {
  const d = validateSearchDocument(document);
  return `${d.route}${d.face ? `?view=${encodeURIComponent(d.face)}` : ""}${
    d.anchor ? `#${encodeURIComponent(d.anchor)}` : ""}`;
}

export function validateAliases(input: unknown, ids: ReadonlySet<string>): readonly SearchAlias[] {
  if (!Array.isArray(input) || input.length > 2048) throw new TypeError("Invalid search aliases.");
  return Object.freeze(input.map((value) => {
    if (!value || typeof value !== "object") throw new TypeError("Invalid search alias.");
    boundedText(value.phrase, "alias phrase", SEARCH_LIMITS.queryCharacters);
    if (!ids.has(value.target) || !["modern term", "search aid"].includes(value.label))
      throw new TypeError("Search alias must resolve to an indexed document and have a label.");
    return Object.freeze({ phrase: value.phrase as string, target: value.target as string,
      label: value.label as SearchAlias["label"] });
  }));
}

export function createSearchEngine(documents: readonly SearchDocument[], aliases: readonly SearchAlias[] = []) {
  if (documents.length > SEARCH_LIMITS.documents) throw new RangeError("Search document budget exceeded.");
  const docs = documents.map(validateSearchDocument).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const ids = new Set<string>();
  for (const doc of docs) {
    if (ids.has(doc.id)) throw new TypeError(`Duplicate search id: ${doc.id}.`);
    ids.add(doc.id);
  }
  const admittedAliases = validateAliases(aliases, ids);
  const postings = new Map<string, Map<number, number>>();
  const titles: string[] = [], keys: string[] = [];
  docs.forEach((doc, index) => {
    titles.push(normalizeSearchText(doc.title));
    keys.push(normalizeSearchText(doc.terms.join(" ")));
    for (const [value, weight] of [[doc.title, 8], [doc.terms.join(" "), 12], [doc.text, 1]] as const) {
      for (const term of new Set(normalizeSearchText(value).split(" ").filter(Boolean))) {
        let posting = postings.get(term);
        if (!posting) { posting = new Map(); postings.set(term, posting); }
        posting.set(index, (posting.get(index) ?? 0) + weight);
      }
    }
  });
  const vocabulary = [...postings.keys()].sort();
  const aliasMap = new Map<string, SearchAlias[]>();
  for (const alias of admittedAliases) {
    const phrase = normalizeSearchText(alias.phrase);
    aliasMap.set(phrase, [...(aliasMap.get(phrase) ?? []), alias]);
  }
  const indexById = new Map(docs.map((doc, index) => [doc.id, index]));
  return Object.freeze({
    size: docs.length,
    search(query: string, options: { paper?: string; type?: SearchType; limit?: number } = {}): readonly SearchHit[] {
      if (typeof query !== "string" || query.length > SEARCH_LIMITS.queryCharacters) return [];
      const phrase = normalizeSearchText(query);
      const allTerms = [...new Set(phrase.split(" ").filter(Boolean))];
      let terms = allTerms.filter((t) => !STOP_WORDS.has(t));
      if (!terms.length) terms = allTerms;
      if (!terms.length || terms.length > SEARCH_LIMITS.queryTerms) return [];
      let candidates = new Map<number, number>();
      for (const [termIndex, term] of terms.entries()) {
        const matching = new Map(postings.get(term) ?? []);
        // Prefixes support German compound words; one-letter physics symbols remain exact.
        if (term.length >= 3 && !/^[-+]?\d/u.test(term)) {
          let lo = 0, hi = vocabulary.length;
          while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (vocabulary[mid]! < term) lo = mid + 1; else hi = mid;
          }
          for (let i = lo; i < vocabulary.length && vocabulary[i]!.startsWith(term); i++) {
            if (vocabulary[i] === term) continue;
            for (const [index, weight] of postings.get(vocabulary[i]!)!)
              matching.set(index, Math.max(matching.get(index) ?? 0, weight * 0.5));
          }
        }
        if (termIndex === 0) candidates = matching;
        else {
          for (const [index, score] of candidates) {
            const weight = matching.get(index);
            if (weight === undefined) candidates.delete(index);
            else candidates.set(index, score + weight);
          }
        }
      }
      const scores = candidates;
      const labels = new Map<number, SearchAlias["label"]>();
      for (const alias of aliasMap.get(phrase) ?? []) {
        const index = indexById.get(alias.target)!;
        scores.set(index, (scores.get(index) ?? 0) + 200);
        labels.set(index, alias.label);
      }
      const limit = Math.max(1, Math.min(SEARCH_LIMITS.results,
        Number.isSafeInteger(options.limit) ? options.limit! : 20));
      return [...scores.entries()]
        .filter(([index]) => (!options.paper || docs[index]!.paper === options.paper) &&
          (!options.type || docs[index]!.type === options.type))
        .map(([index, score]): SearchHit => {
          const document = docs[index]!;
          if (titles[index] === phrase) score += 80;
          else if (titles[index]!.includes(phrase)) score += 25;
          if (keys[index] === phrase) score += 100;
          const text = document.text.replace(/\s+/gu, " ").trim();
          return { document, score, snippet: text.length > 220 ? `${text.slice(0, 217)}…` : text,
            aliasLabel: labels.get(index) ?? null };
        })
        .sort((a, b) => b.score - a.score || (a.document.id < b.document.id ? -1 : 1))
        .slice(0, limit);
    },
  });
}
export type SearchEngine = ReturnType<typeof createSearchEngine>;
