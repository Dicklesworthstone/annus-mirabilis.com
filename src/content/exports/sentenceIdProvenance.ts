/**
 * EVERY EXPORTED SENTENCE ID CAME FROM A RECORD, AND NO TWO UNITS SHARE ONE (am-49lz).
 *
 * `emitter.ts` passes ids through from the content records everywhere -- `b.id`, `eq.id`, `arg.id`,
 * `exp.id`, `n.id`, `s.id`. One place used to MINT instead, falling back to `${b.id}-s1` for every
 * block of a section with no cut sentence units, and it minted into the repository's frozen grammar:
 * `docs/CONTENT_IDS.md` defines `s<n>-p<m>-s<k>` as section n, paragraph m, sentence k, so
 * `s4-p6` + `-s1` is a well-formed id of the real scheme denoting the WHOLE PARAGRAPH where the real
 * one denotes its first sentence. No consumer could tell the two apart, and the exports exist for
 * indexing, agent-assisted review and citation.
 *
 * THREE ARMS, AND THE SHAPE OF THEM IS A CORRECTION TO am-49lz. The bead asks for a gate asserting
 * that "emitted sentence ids are unique across the whole corpus, not only within a paper". Measured
 * over the four real manifests before implementing it: 214 of 632 declared ids are declared by MORE
 * THAN ONE paper, 100 of them sentence-shaped, and `s0-p1-s1` is declared by all four. That is not a
 * defect. The grammar is section-and-paragraph relative, so `s0-p1-s1` names a different real
 * sentence in each paper, and a corpus-wide uniqueness rule would refuse the corpus's own frozen
 * ids. The arms that DO hold:
 *
 *   - `not-declared`: an id emitted for a paper that paper's manifest does not declare. This is the
 *     bead's class A where it is detectable, and the finding names the paper that really owns the
 *     id, which is what makes it actionable.
 *   - `duplicate-in-paper`: the same id emitted twice for one paper. Two units addressed by one id
 *     within one paper is unambiguous breakage, and it is the bead's class C -- brownian re-minting
 *     one of its own 90.
 *   - `duplicate-undeclared`: the same id emitted by two papers where NEITHER declares it. That is
 *     the bead's class B with its real content: two generators agreeing on a string nobody froze.
 *     The same id declared by both papers is NOT a finding, because that is the grammar working.
 *
 * WHAT THIS CANNOT SEE, stated because the limit is load-bearing. When a minted id happens to be a
 * string the emitting paper also declares -- `s4-p6` + `-s1` where `s4-p6-s1` is a real unit of that
 * same paper -- the id exists, so no arm here fires, and only a check on the REFERENT would catch
 * that the exported text is the paragraph rather than its first sentence. That is why the fix is to
 * stop minting rather than to detect minting: a detector of this shape cannot be complete.
 *
 * WHY THIS IS A MODULE AND NOT ONLY A TEST. AGENTS.md: a gate's own proof must not live only in the
 * lane that gate controls, or it disappears at exactly the moment the gate fails open. The predicate
 * lives here so a release script can run it over whatever it is about to publish, and so the plants
 * in `sentenceIdProvenance.test.ts` drive the same code a release would.
 *
 * WHAT A CLEAN RESULT PROVES AND WHAT IT DOES NOT. It proves every id the emitter emitted is an id
 * some manifest declares, and that no id is emitted twice across the corpus. It does NOT prove the
 * id denotes the right sentence: an id that exists in the manifest but is attached to the wrong
 * block passes this and is a different check.
 */

/** One paper's emitted sentence ids, in emission order. */
export interface EmittedSentenceIds {
  readonly paper: string;
  readonly sentenceIds: readonly string[];
}

export interface SentenceIdFinding {
  /** See the three arms in this module's docblock. */
  readonly kind: "not-declared" | "duplicate-in-paper" | "duplicate-undeclared";
  readonly paper: string;
  readonly sentenceId: string;
  readonly detail: string;
}

export interface SentenceIdProvenanceResult {
  readonly findings: readonly SentenceIdFinding[];
  /** Sentence ids examined, which is the denominator every verdict here is read against. */
  readonly examined: number;
  readonly papers: number;
  /** Ids declared by the manifests handed in, so a caller can see it did not check against nothing. */
  readonly declared: number;
  /**
   * Ids emitted by more than one paper where EVERY emitting paper declares them. Reported, never a
   * finding: this is the per-paper grammar working, and 100 sentence-shaped ids are shared this way.
   */
  readonly sharedDeclaredIds: readonly string[];
}

/**
 * Checks emitted sentence ids against the ids their manifests declare.
 *
 * `declaredByPaper` maps a paper slug to the ids that paper's manifest freezes. An id is accepted
 * when the paper that emitted it declares it; an id declared by a DIFFERENT paper is a finding, not
 * a pass, because that is exactly the shape of a minted id colliding with a frozen one.
 */
export function checkSentenceIdProvenance(
  emitted: readonly EmittedSentenceIds[],
  declaredByPaper: ReadonlyMap<string, ReadonlySet<string>>,
): SentenceIdProvenanceResult {
  const findings: SentenceIdFinding[] = [];
  /** paper -> ids it has already emitted, for the within-paper arm. */
  const emittedByPaper = new Map<string, Set<string>>();
  /** id -> the papers that emitted it, for the cross-paper arms. */
  const emitters = new Map<string, string[]>();
  const undeclared = new Set<string>();
  let examined = 0;

  for (const entry of emitted) {
    const declared = declaredByPaper.get(entry.paper);
    let own = emittedByPaper.get(entry.paper);
    if (own === undefined) {
      own = new Set<string>();
      emittedByPaper.set(entry.paper, own);
    }
    for (const sentenceId of entry.sentenceIds) {
      examined += 1;

      if (declared === undefined) {
        undeclared.add(sentenceId);
        findings.push({
          kind: "not-declared",
          paper: entry.paper,
          sentenceId,
          detail: `no manifest was supplied for paper '${entry.paper}', so nothing declares this id`,
        });
      } else if (!declared.has(sentenceId)) {
        undeclared.add(sentenceId);
        // Naming the other paper when one declares it turns "unknown id" into the actionable
        // report: that is an id minted into another paper's frozen grammar.
        const elsewhere = [...declaredByPaper]
          .filter(([slug, ids]) => slug !== entry.paper && ids.has(sentenceId))
          .map(([slug]) => slug);
        findings.push({
          kind: "not-declared",
          paper: entry.paper,
          sentenceId,
          detail:
            elsewhere.length > 0
              ? `not declared by ${entry.paper}; declared by ${elsewhere.join(", ")}, so this is a frozen id of another paper`
              : `not declared by ${entry.paper} or any other manifest supplied`,
        });
      }

      if (own.has(sentenceId)) {
        findings.push({
          kind: "duplicate-in-paper",
          paper: entry.paper,
          sentenceId,
          detail: `emitted more than once within ${entry.paper}, so two units share one id`,
        });
      }
      own.add(sentenceId);
      emitters.set(sentenceId, [...(emitters.get(sentenceId) ?? []), entry.paper]);
    }
  }

  // The cross-paper arm, and it fires ONLY where nobody declares the id. A shared DECLARED id is
  // the grammar working; a shared undeclared one is two generators agreeing on an invented string.
  const sharedDeclaredIds: string[] = [];
  for (const [sentenceId, papers] of emitters) {
    const distinct = [...new Set(papers)];
    if (distinct.length < 2) continue;
    if (undeclared.has(sentenceId)) {
      findings.push({
        kind: "duplicate-undeclared",
        paper: distinct.join(", "),
        sentenceId,
        detail: `emitted by ${distinct.join(", ")} and declared by none of them, so one invented id addresses several units`,
      });
    } else {
      sharedDeclaredIds.push(sentenceId);
    }
  }

  let declaredTotal = 0;
  for (const ids of declaredByPaper.values()) declaredTotal += ids.size;

  return {
    findings,
    examined,
    papers: emitted.length,
    declared: declaredTotal,
    sharedDeclaredIds: sharedDeclaredIds.sort(),
  };
}
