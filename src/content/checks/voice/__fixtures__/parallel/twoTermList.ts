// Planted fixture for noParallelDenyLists.test.ts (am-f6hr).
//
// EXACTLY TWO terms from the deny-list vocabulary, one below MIN_MATCHING_TERMS.
// The boundary test used to call the scanner with roots: [], which scans no file,
// so it was true for a threshold of 1, 2, 3 or 99 and pinned nothing. This file is
// the lower side of the boundary; dangerousWords.ts beside it is the upper side.
// Adding a third vocabulary term here silently destroys the test - it would then
// be expected to fail and would, for the wrong reason.
export const TWO_TERM_LIST = ["streak", "badge"];
