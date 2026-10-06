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
  "paper",
  "section",
  "argument",
  "equation",
  "instrument",
  "foundation",
  "result",
  "sentence-de",
  "sentence-en",
  "glossary",
  "misconception",
  "margin",
  "timeline",
  "knowledge-card",
  "person",
  "essay",
  "connection-thread",
  "tour",
  // A RECORDED WALKTHROUGH IS NOT A TOUR, and the site's own vocabulary keeps them apart: a Tour is
  // a guided reading path across a paper (/tours/, "Guided reading paths"), a walkthrough is an
  // ordered run of ONE instrument (/tapes/). Indexing the 22 walkthroughs under "tour" grouped them
  // in the palette under a heading reading "Tours", which is a word the site uses for something
  // else. Additive: this makes a new value valid and narrows nothing.
  "walkthrough",
  // A DISCOVERY ROUTE IS A THIRD GUIDED THING, kept apart from the other two for the same reason:
  // /tours/ is a reading path across a paper, /tapes/ is an ordered run of one instrument, and
  // /discover/ is a reconstruction of the problem before its solution was known. AGENTS.md calls
  // the last of these the site's signature content and labels it "a route you could take".
  // Additive: this makes a new value valid and narrows nothing.
  "discovery",
  "capstone",
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
  α: "alpha",
  β: "beta",
  γ: "gamma",
  δ: "delta",
  ε: "epsilon",
  ζ: "zeta",
  η: "eta",
  θ: "theta",
  ι: "iota",
  κ: "kappa",
  λ: "lambda",
  μ: "mu",
  ν: "nu",
  ξ: "xi",
  π: "pi",
  ρ: "rho",
  σ: "sigma",
  ς: "sigma",
  τ: "tau",
  υ: "upsilon",
  φ: "phi",
  χ: "chi",
  ψ: "psi",
  ω: "omega",
});
const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻";
const DIGITS = "0123456789+-";
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "or",
  "to",
  "in",
  "is",
  "it",
  "does",
  "do",
  "how",
  "what",
  "why",
  "with",
  "for",
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "und",
  "von",
  "ist",
]);

/** String arithmetic, so scientific notation does not overflow or lose significant digits. */
function numberToken(source: string): string {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/u.exec(source);
  if (!match) return source;
  const exponent = Number(match[4] ?? 0) - (match[3]?.length ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100000) return source;
  const integerPart = match[2] ?? "";
  let digits = (integerPart + (match[3] ?? "")).replace(/^0+/u, "");
  if (!digits) return "0";
  const trailing = /0+$/u.exec(digits)?.[0]?.length ?? 0;
  if (trailing) digits = digits.slice(0, -trailing);
  return `${match[1] === "-" ? "-" : ""}${digits}e${exponent + trailing}`;
}

/** Matching keys only; never use normalized text in a source quotation or visible excerpt. */
export function normalizeSearchText(input: string): string {
  const text = input
    .replace(
      /([0-9])([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+)/gu,
      (_, base: string, power: string) =>
        `${base}^${Array.from(power, (c) => DIGITS[SUPERSCRIPTS.indexOf(c)]).join("")}`,
    )
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\\(?:cdot|times)(?![a-z])/gu, "×")
    .replace(/\\(?:mu|upmu)\b/gu, "μ")
    .replace(/(?<=\d),(?=\d)/gu, ".")
    .replace(/\^\{([+-]?\d+)\}/gu, "^$1")
    .replace(
      /(?<![\p{L}\p{N}])(?:(\d+(?:\.\d+)?)\s*[×·*]\s*)?10\s*\^\s*([+-]?\d+)/gu,
      (_, coefficient: string | undefined, exponent: string) => `${coefficient ?? "1"}e${exponent}`,
    )
    .replace(
      /\b(bm|lq|sr|me)[ -]?0?(\d{1,2})\b/gu,
      (_, family: string, n: string) => `${family}${n.padStart(2, "0")}`,
    )
    .replace(
      /\b(?:mikron|microns?|micromet(?:er|re)s?|um)\b|μm|μ(?![\p{L}\p{N}])/gu,
      " micrometre ",
    )
    .replace(/[α-ω]/gu, (symbol) => ` ${GREEK[symbol] ?? symbol} `)
    .replace(/(?:\\)?varphi\b/gu, "phi")
    .replace(/([\p{L}])['′’](?!\p{L})/gu, "$1prime")
    .replace(/ß/gu, "ss")
    .replace(/ä|ae/gu, "a")
    .replace(/ö|oe/gu, "o")
    .replace(/ü|ue/gu, "u")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const tokens = text.match(/[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?|[\p{L}][\p{L}\p{N}]*/gu) ?? [];
  return tokens.map((token) => (/^[-+]?\d/u.test(token) ? numberToken(token) : token)).join(" ");
}

function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c <= 0x08 || c === 0x0b || c === 0x0c || (c >= 0x0e && c <= 0x1f)) {
      return true;
    }
  }
  return false;
}

function boundedText(
  value: unknown,
  name: string,
  max: number,
  empty = false,
): asserts value is string {
  if (
    typeof value !== "string" ||
    (!empty && !value.trim()) ||
    value.length > max ||
    hasControlCharacter(value)
  )
    throw new TypeError(`Invalid search document ${name}.`);
}

/** Only known local routes and content anchors, never executable or external result URLs. */
export function validateSearchDocument(value: unknown): SearchDocument {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Invalid search document.");
  const d = value as Record<string, unknown>;
  for (const key of ["id", "title", "paper", "lang", "scopeLabel"])
    boundedText(d[key], key, key === "title" ? 1000 : 500);
  for (const key of ["section", "anchor", "face"]) boundedText(d[key], key, 500, true);
  boundedText(d.text, "text", SEARCH_LIMITS.documentCharacters, true);
  boundedText(d.route, "route", 1000);
  if (
    !SEARCH_TYPES.includes(d.type as SearchType) ||
    // ROUTE FAMILIES, AND WHY A SEGMENT MAY NOW CONTAIN A DOT.
    //
    // `tapes` joins the list because the 22 recorded walkthroughs became pages this week and were
    // unfindable: measured on the published shards, /papers/, /foundations/ and /lab/ were indexed
    // and /tapes/ had zero documents.
    //
    // A segment is `[a-zA-Z0-9_-]+` optionally followed by `.[a-zA-Z0-9_-]+` groups, because one
    // tape id is `the-boost-to-0.6c` (AGENTS.md permits a dot between two digits). The dot can only
    // sit BETWEEN allowed runs, so a segment can never be `.`, `..` or `.hidden`, and the traversal
    // cases in core.test.mjs stay refused: /lab/../admin has a `..` segment that matches nothing
    // here, and /papers/%2e%2e/ had no `%` in the class at all.
    !/^\/(?:papers|foundations|lab|notation|discover|essays|connections|tours|tapes|capstones|timeline|1904)(?:\/[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)*\/?$/u.test(
      d.route,
    ) ||
    !/^[a-zA-Z0-9_.:-]*$/u.test(d.anchor as string) ||
    !["", "reading", "german", "english", "results", "gloss", "facsimile"].includes(
      d.face as string,
    ) ||
    !Array.isArray(d.terms) ||
    d.terms.length > 128
  )
    throw new TypeError("Invalid search route, anchor, face, type or terms.");
  for (const term of d.terms) boundedText(term, "term", 1000);
  return Object.freeze({
    id: d.id as string,
    type: d.type as SearchType,
    paper: d.paper as string,
    section: d.section as string,
    lang: d.lang as string,
    title: d.title as string,
    text: d.text,
    terms: Object.freeze([...d.terms]) as readonly string[],
    route: d.route,
    anchor: d.anchor as string,
    face: d.face as string,
    scopeLabel: d.scopeLabel as string,
  });
}

export function searchResultHref(document: SearchDocument): string {
  const d = validateSearchDocument(document);
  return `${d.route}${d.face ? `?view=${encodeURIComponent(d.face)}` : ""}${
    d.anchor ? `#${encodeURIComponent(d.anchor)}` : ""
  }`;
}

export function validateAliases(input: unknown, ids: ReadonlySet<string>): readonly SearchAlias[] {
  if (!Array.isArray(input) || input.length > 2048) throw new TypeError("Invalid search aliases.");
  return Object.freeze(
    input.map((value) => {
      if (!value || typeof value !== "object") throw new TypeError("Invalid search alias.");
      boundedText(value.phrase, "alias phrase", SEARCH_LIMITS.queryCharacters);
      if (!ids.has(value.target) || !["modern term", "search aid"].includes(value.label))
        throw new TypeError("Search alias must resolve to an indexed document and have a label.");
      return Object.freeze({
        phrase: value.phrase as string,
        target: value.target as string,
        label: value.label as SearchAlias["label"],
      });
    }),
  );
}

/**
 * Optimal string alignment distance (insertions, deletions, substitutions, and a swap of two
 * neighbouring letters as one edit), stopping early once every path exceeds `limit`.
 */
export function editDistance(a: string, b: string, limit: number): number {
  const rows = a.length + 1,
    cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    let rowBest = Number.POSITIVE_INFINITY;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(
        (d[i - 1]?.[j] ?? 0) + 1,
        (d[i]?.[j - 1] ?? 0) + 1,
        (d[i - 1]?.[j - 1] ?? 0) + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        value = Math.min(value, (d[i - 2]?.[j - 2] ?? 0) + 1);
      const row = d[i];
      if (row) row[j] = value;
      rowBest = Math.min(rowBest, value);
    }
    if (rowBest > limit) return rowBest;
  }
  return d[rows - 1]?.[cols - 1] ?? Number.POSITIVE_INFINITY;
}

/** Adjacent normalized tokens, never a substring inside a longer word or a generated regex. */
function containsPhrase(field: string, phrase: string): boolean {
  return ` ${field} `.includes(` ${phrase} `);
}

/**
 * Find the strongest bounded passage in the original spelling. The masks describe the actual
 * vocabulary admitted by this query (including prefixes and typo corrections), not an invented
 * replacement quotation. Overlapping windows also handle expressions such as "6 × 10^23" whose
 * normalization spans several whitespace-separated pieces. Only returned hits pay this cost.
 */
function passageSnippet(
  source: string,
  matchedWords: ReadonlyMap<string, number>,
  phrases: readonly string[],
): string {
  const text = source.replace(/\s+/gu, " ").trim();
  if (text.length <= 220) return text;
  let bestStart = 0,
    bestEnd = 217,
    bestScore = -1;
  for (let offset = 0; offset < text.length; offset += 96) {
    let start = offset;
    if (start > 0) {
      start = text.indexOf(" ", start);
      if (start < 0) break;
      start++;
    }
    let end = Math.min(text.length, start + 218);
    if (end < text.length) {
      const boundary = text.lastIndexOf(" ", end);
      if (boundary > start) end = boundary;
      // A long unbroken token must still be clipped without bisecting a surrogate pair.
      else if (text.charCodeAt(end) >= 0xdc00 && text.charCodeAt(end) <= 0xdfff) end--;
    }
    const normalized = normalizeSearchText(text.slice(start, end));
    let mask = 0;
    for (const word of normalized.split(" ")) mask |= matchedWords.get(word) ?? 0;
    let score = 0;
    while (mask) {
      score++;
      mask &= mask - 1;
    }
    for (const phrase of phrases) if (containsPhrase(normalized, phrase)) score += 32;
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
      bestEnd = end;
    }
  }
  return `${bestStart ? "…" : ""}${text.slice(bestStart, bestEnd)}${bestEnd < text.length ? "…" : ""}`;
}

export function createSearchEngine(
  documents: readonly SearchDocument[],
  aliases: readonly SearchAlias[] = [],
) {
  if (documents.length > SEARCH_LIMITS.documents)
    throw new RangeError("Search document budget exceeded.");
  const docs = documents
    .map(validateSearchDocument)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const ids = new Set<string>();
  for (const doc of docs) {
    if (ids.has(doc.id)) throw new TypeError(`Duplicate search id: ${doc.id}.`);
    ids.add(doc.id);
  }
  const admittedAliases = validateAliases(aliases, ids);
  const postings = new Map<string, Map<number, number>>();
  const titles: string[] = [],
    keys: string[] = [];
  docs.forEach((doc, index) => {
    titles.push(normalizeSearchText(doc.title));
    keys.push(normalizeSearchText(doc.terms.join(" ")));
    for (const [value, weight] of [
      [doc.title, 8],
      [doc.terms.join(" "), 12],
      [doc.text, 1],
    ] as const) {
      for (const term of new Set(normalizeSearchText(value).split(" ").filter(Boolean))) {
        let posting = postings.get(term);
        if (!posting) {
          posting = new Map();
          postings.set(term, posting);
        }
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
    search(
      query: string,
      options: { paper?: string; type?: SearchType; limit?: number } = {},
    ): readonly SearchHit[] {
      if (typeof query !== "string" || query.length > SEARCH_LIMITS.queryCharacters) return [];
      const phrase = normalizeSearchText(query);
      // Only completed double quotes constrain a phrase; an unfinished quote can be typed live.
      // Stop words inside quotes are retained by the final phrase check, even though the index
      // intersection below omits them. Smart quotes copied from a passage work as well.
      const quotedPhrases = [...query.matchAll(/"([^"]+)"|“([^”]+)”/gu)]
        .map((match) => normalizeSearchText(match[1] ?? match[2] ?? ""))
        .filter(Boolean);
      const allTerms = [...new Set(phrase.split(" ").filter(Boolean))];
      let terms = allTerms.filter((t) => !STOP_WORDS.has(t));
      if (!terms.length) terms = allTerms;
      if (!terms.length || terms.length > SEARCH_LIMITS.queryTerms) return [];
      let candidates = new Map<number, number>();
      const matchedWords = new Map<string, number>();
      const markWord = (word: string, termIndex: number) => {
        matchedWords.set(word, (matchedWords.get(word) ?? 0) | (1 << termIndex));
      };
      for (const [termIndex, term] of terms.entries()) {
        const matching = new Map(postings.get(term) ?? []);
        if (matching.size) markWord(term, termIndex);
        // Prefixes support German compound words; one-letter physics symbols remain exact.
        if (term.length >= 3 && !/^[-+]?\d/u.test(term)) {
          let lo = 0,
            hi = vocabulary.length;
          while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            const vocabMid = vocabulary[mid];
            if (vocabMid !== undefined && vocabMid < term) lo = mid + 1;
            else hi = mid;
          }
          for (let i = lo; i < vocabulary.length; i++) {
            const word = vocabulary[i];
            if (!word?.startsWith(term)) break;
            if (word === term) continue;
            const wordPostings = postings.get(word);
            if (!wordPostings) continue;
            markWord(word, termIndex);
            for (const [index, weight] of wordPostings)
              matching.set(index, Math.max(matching.get(index) ?? 0, weight * 0.5));
          }
        }
        // A term nothing matches, not even as a prefix, is probably mistyped ("brownain",
        // "relativty"). Words one edit away (two from eight letters), a swapped pair counting as
        // one, stand in at a lower weight. A term that matches anything is left as typed, so a
        // correctly spelled word is never diluted by its neighbours.
        if (!matching.size && term.length >= 4 && !/^[-+]?\d/u.test(term)) {
          const allowed = term.length >= 8 ? 2 : 1;
          for (const word of vocabulary) {
            if (Math.abs(word.length - term.length) > allowed) continue;
            if (editDistance(term, word, allowed) > allowed) continue;
            const wordPostings = postings.get(word);
            if (!wordPostings) continue;
            markWord(word, termIndex);
            for (const [index, weight] of wordPostings)
              matching.set(index, Math.max(matching.get(index) ?? 0, weight * 0.4));
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
        const index = indexById.get(alias.target);
        if (index !== undefined) {
          scores.set(index, (scores.get(index) ?? 0) + 200);
          labels.set(index, alias.label);
        }
      }
      const limit = Math.max(
        1,
        Math.min(
          SEARCH_LIMITS.results,
          typeof options.limit === "number" && Number.isSafeInteger(options.limit)
            ? options.limit
            : 20,
        ),
      );
      const hits: Omit<SearchHit, "snippet">[] = [];
      for (const [index, initialScore] of scores.entries()) {
        const document = docs[index];
        if (!document) continue;
        if (options.paper && document.paper !== options.paper) continue;
        if (options.type && document.type !== options.type) continue;
        if (quotedPhrases.length) {
          // Do not stitch a quotation across the title/body boundary or between unrelated terms.
          // Aliases remain useful search aids, but cannot claim a quotation occurs in the source.
          const fields = [document.title, document.text, ...document.terms].map(normalizeSearchText);
          if (!quotedPhrases.every((quoted) => fields.some((field) => containsPhrase(field, quoted))))
            continue;
        }
        let score = initialScore;
        const title = titles[index];
        if (title === phrase) score += 80;
        else if (title?.includes(phrase)) score += 25;
        if (keys[index] === phrase) score += 100;
        // Matching folds case and marks, so k, K and k* all normalize to "k" and a short title
        // like "k*" even scores as an exact title. A term spelled exactly as typed, case and
        // marks included, is the letter the reader meant, and it outranks its folded neighbours.
        if (document.terms.includes(query.trim())) score += 100;
        hits.push({
          document,
          score,
          aliasLabel: labels.get(index) ?? null,
        });
      }
      return hits
        .sort((a, b) => b.score - a.score || (a.document.id < b.document.id ? -1 : 1))
        .slice(0, limit)
        .map((hit) => ({
          ...hit,
          snippet: passageSnippet(hit.document.text, matchedWords, quotedPhrases),
        }));
    },
  });
}
export type SearchEngine = ReturnType<typeof createSearchEngine>;
