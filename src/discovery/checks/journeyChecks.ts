/**
 * Compiler checks and reference validations for Discovery Journeys.
 * Specification: am-disc-journey-framework-umbg, AGENTS.md (§7.1–7.4)
 */

import { evaluateShelfDate } from "../../content/checks/epistemic/shelfDate.ts";
import { checkVoice } from "../../content/checks/voice/index.ts";
import {
  FORK_VARIES_KINDS,
  type Journey,
  JourneySchemaError,
  validateJourney,
} from "../../content/schemas/journey.ts";
import { checkMoveSummary } from "./moveSummaryGuard.ts";

export interface JourneyFinding {
  readonly rule: string;
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly path: string;
  readonly journeyId: string;
  readonly element?: string | undefined;
  readonly repair?: string | undefined;
}

export interface CardLookupContext {
  readonly [cardId: string]: {
    readonly id: string;
    readonly date?: { readonly latestYear?: number };
    readonly status?: string;
    /**
     * The card's own admitted-1905 declaration, passed through to `evaluateShelfDate` unchanged.
     *
     * Needed by the shelf check: a 1905 result may sit on the desk only as an admitted import, and
     * the rule reads this to tell that case from an unflagged post-cutoff card. Shaped as the rule
     * wants it rather than as the card stores it, so no conversion happens here.
     */
    readonly admittedImport?:
      | boolean
      | { readonly resultId?: string | undefined; readonly declaringJourney?: string | undefined }
      | undefined;
  };
}

export interface JourneyCheckOptions {
  readonly cards?: CardLookupContext | undefined;
  readonly knownInstruments?: ReadonlySet<string> | readonly string[] | undefined;
  readonly knownChains?: ReadonlySet<string> | readonly string[] | undefined;
  readonly knownEquations?: ReadonlySet<string> | readonly string[] | undefined;
  readonly knownEntranceRecords?: ReadonlySet<string> | readonly string[] | undefined;
  readonly isMoveStep?: (chainId: string, stepId: string) => boolean | undefined;
}

const FORBIDDEN_PHRASES = [
  "what einstein thought",
  "einstein's thought process",
  "einsteins thought process",
  "what einstein was thinking",
];

function checkForbiddenPhrases(text: string, path: string, journeyId: string): JourneyFinding[] {
  const findings: JourneyFinding[] = [];
  const lower = text.toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lower.includes(phrase)) {
      findings.push({
        rule: "journey-forbidden-phrase",
        severity: "error",
        message: `Forbidden phrase "${phrase}" found in journey content.`,
        path,
        journeyId,
        repair:
          "Describe the logical and physical argument rather than Einstein's internal thoughts.",
      });
    }
  }
  return findings;
}

/**
 * Validates a Journey record against all compiler rules.
 */
/**
 * WHAT A SCHEMA ERROR COSTS, said in the finding rather than left to be inferred from a count.
 *
 * `validateJourney` throws on its FIRST violation and this function returns straight after, so a
 * journey that fails the schema is reported as exactly one finding and every epistemic gate below
 * is skipped. "1 finding" then reads as a small problem.
 *
 * It was not. Measured 2026-10-07: brownian-motion carried one invalid fork outcome and reported a
 * single finding for as long as it stood, while the move-summary guard, the fork contract and four
 * voice checks never ran on it. Its move summary had been three sentences against a guard that
 * requires one, from the day it was written, and no run ever said so (am-4k0m). Repairing the
 * outcome took that journey from 1 finding to 5.
 *
 * Not running the rest is the right behaviour -- the checks below read the NORMALISED journey and
 * crashed with a TypeError when they were pointed at a raw one, as the comment inside this function
 * records -- so the repair is to make the silence audible, not to remove it.
 */
const UNMEASURED_SUFFIX =
  "No other journey check ran: this function returns after a schema error, so the shelf-date rule, " +
  "the fork contract, the mockery guard, the move-summary guard and the voice checks are UNMEASURED " +
  "on this journey rather than passed. Expect more findings once this one is repaired.";

export function checkJourney(raw: Journey, options: JourneyCheckOptions = {}): JourneyFinding[] {
  const findings: JourneyFinding[] = [];
  const jId = (raw as { id?: unknown } | null | undefined)?.id;
  const journeyId = typeof jId === "string" ? jId : "";

  // 1. Structure validation AND NORMALISATION.
  //
  // The return value used to be discarded and every check below read the RAW object, which is a
  // different thing: `validateJourney` fills the defaults the schema promises -- `support` becomes
  // `{}`, `premiseRefs` becomes `[]` -- and the checks never saw them. A stage carrying only the four
  // fields the schema REQUIRES therefore crashed this function with a TypeError at
  // `for (const pRef of stage.premiseRefs)`, measured 2026-10-05 against a real journey. A crash is
  // not a refusal: it gives a build an unreadable stack instead of a finding, and it happens on input
  // the schema calls valid. Reading what was validated is the fix, and it is the same rule AGENTS.md
  // states as "a check on inputs reads the inputs" -- here, the inputs as the schema defines them.
  let journey: Journey;
  try {
    journey = validateJourney(raw);
  } catch (err: unknown) {
    if (err instanceof JourneySchemaError) {
      findings.push({
        rule: err.code || "journey-schema-error",
        severity: "error",
        message: `${err.message} ${UNMEASURED_SUFFIX}`,
        path: err.path || "journey",
        journeyId: journeyId,
      });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      findings.push({
        rule: "journey-schema-error",
        severity: "error",
        message: `${message} ${UNMEASURED_SUFFIX}`,
        path: "journey",
        journeyId: journeyId,
      });
    }
    return findings;
  }

  // Top-level forbidden phrase checks
  if (journey.naggingFact) {
    findings.push(...checkForbiddenPhrases(journey.naggingFact, "journey.naggingFact", journeyId));
  }
  if (journey.firstHonestQuestion) {
    findings.push(
      ...checkForbiddenPhrases(
        journey.firstHonestQuestion,
        "journey.firstHonestQuestion",
        journeyId,
      ),
    );
  }
  if (journey.ppeTask) {
    if (journey.ppeTask.task)
      findings.push(
        ...checkForbiddenPhrases(journey.ppeTask.task, "journey.ppeTask.task", journeyId),
      );
    if (journey.ppeTask.perturbPrompt)
      findings.push(
        ...checkForbiddenPhrases(
          journey.ppeTask.perturbPrompt,
          "journey.ppeTask.perturbPrompt",
          journeyId,
        ),
      );
    if (journey.ppeTask.explainPrompt)
      findings.push(
        ...checkForbiddenPhrases(
          journey.ppeTask.explainPrompt,
          "journey.ppeTask.explainPrompt",
          journeyId,
        ),
      );
  }

  // 1b. THE 1904 SHELF, CHECKED AT THE SHELF ITSELF.
  //
  // The shelf-date rule below (section 6) ran only over `stage.premiseRefs`, and the four real
  // journeys declare no stages -- the staged chain is the discover page's JSX -- so the rule that
  // AGENTS.md calls a build gate examined ZERO premise references on the population a reader reaches.
  // Measured 2026-10-05 by planting `plant-jeans-1905` on light-quanta's shelf, status `available`,
  // latestYear 1905, with no flag of any kind: `checkJourney` returned its usual 5 findings and 0
  // shelf-date violations, with and without a cards context. The gate could not fail.
  //
  // A journey's `shelf` is its own declaration of what sat on the 1904 desk, so it is checked here on
  // its own terms. The rule is the SAME `evaluateShelfDate`, never a second copy of it, called with
  // `kind: "shelf"` and `parallelWorkAcknowledged: true`: a card marked `parallel-work` may sit on the
  // shelf precisely BECAUSE its own status says so and a reader sees that label, while a STAGE citing
  // it must still acknowledge it, which section 6 enforces separately. What fails here is a card past
  // the cutoff wearing no flag at all, and a `later` card, which belongs in a world check rather than
  // on the desk.
  //
  // A card id the context does not know is not judged: `options.cards` is often absent (the fixture
  // tests pass none), and refusing on an unknown id would turn every caller without a catalogue red.
  // `realJourneys.test.ts` asserts the real call passes a context covering every id, so the silence
  // cannot hide there.
  if (Array.isArray(journey.shelf) && options.cards) {
    const declaredImports = journey.admittedImports?.map((imp) => imp.importId) ?? [];
    for (let i = 0; i < journey.shelf.length; i++) {
      const cardId = journey.shelf[i];
      if (typeof cardId !== "string") continue;
      const card = options.cards[cardId];
      if (!card) continue;
      const status =
        card.status === "parallel-work" || card.status === "later" || card.status === "available"
          ? card.status
          : "available";
      const decision = evaluateShelfDate(
        { id: `${journeyId}.shelf`, kind: "shelf", parallelWorkAcknowledged: true },
        {
          id: cardId,
          status,
          latestYear: card.date?.latestYear ?? 0,
          ...(card.admittedImport === undefined ? {} : { admittedImport: card.admittedImport }),
        },
        { id: journeyId, admittedImports: declaredImports },
      );
      if (!decision.ok) {
        findings.push({
          rule: "shelf-date-violation",
          severity: "error",
          message: `The 1904 shelf lists "${cardId}" (${decision.reason}).`,
          path: `journey.shelf[${i}]`,
          journeyId,
          repair: decision.repair,
        });
      }
    }
  }

  // 2. Completeness & Pending Elements
  const requiredElements = [
    "shelf",
    "naggingFact",
    "firstHonestQuestion",
    "stages",
    "forks",
    "move",
    "move.r0Summary",
    "worldChecks",
    "sourceJumps",
    "exercises.instrumented",
    "ppeTask",
    "doors.frontDoor",
    "doors.sideDoors",
  ];

  const hasShelf = Boolean(journey.shelf && journey.shelf.length > 0);
  const hasNaggingFact = Boolean(journey.naggingFact?.trim());
  const hasFirstHonestQuestion = Boolean(journey.firstHonestQuestion?.trim());
  const hasStages = Array.isArray(journey.stages) && journey.stages.length >= 1;
  const hasForks =
    Array.isArray(journey.forks) && journey.forks.length >= 2 && journey.forks.length <= 3;
  const hasMove = Boolean(journey.move?.label && journey.move.chainId && journey.move.stepId);
  const hasMoveSummary = Boolean(journey.move?.r0Summary?.text?.trim());
  const hasWorldChecks = Array.isArray(journey.worldChecks) && journey.worldChecks.length >= 1;
  const hasSourceJumps = Array.isArray(journey.sourceJumps) && journey.sourceJumps.length >= 1;
  const instrumentedCount = journey.exercises?.filter((e) => e.role === "instrumented").length ?? 0;
  const explanationCount = journey.exercises?.filter((e) => e.role === "explanation").length ?? 0;
  const hasInstrumentedExercises = instrumentedCount >= 2 && instrumentedCount <= 5;
  const hasPpeTask = Boolean(journey.ppeTask?.task?.trim());
  const hasFrontDoor = Boolean(journey.doors?.frontDoor?.id);
  const hasSideDoors =
    Array.isArray(journey.doors?.sideDoors) && journey.doors.sideDoors.length >= 1;

  const elementPresentMap: Record<string, boolean> = {
    shelf: hasShelf,
    naggingFact: hasNaggingFact,
    firstHonestQuestion: hasFirstHonestQuestion,
    stages: hasStages,
    forks: hasForks,
    move: hasMove,
    "move.r0Summary": hasMoveSummary,
    worldChecks: hasWorldChecks,
    sourceJumps: hasSourceJumps,
    "exercises.instrumented": hasInstrumentedExercises,
    ppeTask: hasPpeTask,
    "doors.frontDoor": hasFrontDoor,
    "doors.sideDoors": hasSideDoors,
  };

  const pendingSet = new Set<string>();
  if (journey.completeness === "partial" && Array.isArray(journey.pendingElements)) {
    for (const pe of journey.pendingElements) {
      pendingSet.add(pe.element);
      if (elementPresentMap[pe.element] === true) {
        findings.push({
          rule: "journey-pending-element-already-present",
          severity: "error",
          message: `Pending element "${pe.element}" is already present in journey record.`,
          path: `journey.pendingElements[${pe.element}]`,
          journeyId: journeyId,
          element: pe.element,
          repair: `Remove "${pe.element}" from pendingElements or declare the missing parts.`,
        });
      }
    }
  }

  if (journey.completeness === "complete") {
    for (const elem of requiredElements) {
      if (!elementPresentMap[elem]) {
        findings.push({
          rule: "journey-complete-missing-element",
          severity: "error",
          message: `Complete journey is missing required element "${elem}".`,
          path: `journey.${elem}`,
          journeyId: journeyId,
          element: elem,
          repair: `Provide "${elem}" or declare completeness: "partial" with pendingElements.`,
        });
      }
    }
  } else {
    // Partial journey: any missing required element MUST be declared in pendingElements
    for (const elem of requiredElements) {
      if (!elementPresentMap[elem] && !pendingSet.has(elem)) {
        findings.push({
          rule: "journey-partial-undeclared-pending-element",
          severity: "error",
          message: `Partial journey is missing required element "${elem}" without declaring it in pendingElements.`,
          path: `journey.${elem}`,
          journeyId: journeyId,
          element: elem,
          repair: `Add "${elem}" to pendingElements with reason and ownerBead.`,
        });
      }
    }
  }

  // 3. Exercise count bounds
  if (instrumentedCount < 2 || instrumentedCount > 5) {
    if (journey.completeness === "complete" || !pendingSet.has("exercises.instrumented")) {
      findings.push({
        rule: "journey-instrumented-exercise-count",
        severity: "error",
        message: `A journey must have between 2 and 5 instrumented exercises (found ${instrumentedCount}).`,
        path: "journey.exercises",
        journeyId: journeyId,
        repair: "Include between 2 and 5 instrumented exercises.",
      });
    }
  }

  if (explanationCount > 4) {
    findings.push({
      rule: "journey-explanation-exercise-count",
      severity: "error",
      message: `A journey may have at most 4 explanation exercises (found ${explanationCount}).`,
      path: "journey.exercises",
      journeyId: journeyId,
      repair: "Reduce explanation exercises to 4 or fewer.",
    });
  }

  // 4. Move summary validation
  if (journey.move?.r0Summary?.text) {
    const summaryRes = checkMoveSummary(journey.move.r0Summary.text);
    if (!summaryRes.valid) {
      for (const issue of summaryRes.issues) {
        findings.push({
          rule: issue.rule,
          severity: "error",
          message: issue.message,
          path: "journey.move.r0Summary.text",
          journeyId: journeyId,
          repair: issue.repair,
        });
      }
    }
  }

  // 5. Forks & Branches
  if (Array.isArray(journey.forks)) {
    for (let fIdx = 0; fIdx < journey.forks.length; fIdx++) {
      const fork = journey.forks[fIdx];
      if (!fork) continue;
      const fPath = `journey.forks[${fIdx}]`;

      if (fork.question) {
        findings.push(...checkForbiddenPhrases(fork.question, `${fPath}.question`, journeyId));
      }

      if (!fork.varies || !FORK_VARIES_KINDS.includes(fork.varies)) {
        findings.push({
          rule: "fork-varies-missing",
          severity: "error",
          message: `Fork "${fork.id}" is missing valid "varies" property.`,
          path: `${fPath}.varies`,
          journeyId: journeyId,
          repair: `Set varies to one of: ${FORK_VARIES_KINDS.join(", ")}.`,
        });
      }

      let papersRouteCount = 0;
      for (let bIdx = 0; bIdx < fork.branches.length; bIdx++) {
        const branch = fork.branches[bIdx];
        if (!branch) continue;
        const bPath = `${fPath}.branches[${bIdx}]`;

        if (branch.outcome.type === "papers-route") {
          papersRouteCount++;
        }

        // Voice lint on branch texts
        const stepTexts = (branch.steps ?? []).map((s: { text?: string } | string) =>
          typeof s === "string" ? s : (s?.text ?? ""),
        );
        const textsToVoiceCheck = [
          branch.label,
          branch.hypothesis,
          branch.worksWhen,
          ...stepTexts,
          branch.outcome?.plainLanguage,
        ];
        for (const txt of textsToVoiceCheck) {
          if (txt) {
            const voiceFindings = checkVoice(txt, { context: "journey-branch" });
            for (const vf of voiceFindings) {
              findings.push({
                rule: `voice-${vf.rule}`,
                severity: vf.severity === "error" ? "error" : "warning",
                message: `Voice violation in branch "${branch.id}": matched "${vf.matchedText}" (${vf.suggestion})`,
                path: bPath,
                journeyId: journeyId,
                repair: vf.suggestion,
              });
            }
            const forbiddenFindings = checkForbiddenPhrases(txt, bPath, journeyId);
            findings.push(...forbiddenFindings);
          }
        }

        // Measurement-choice fork cannot dead-end
        if (
          fork.varies === "measurement-choice" &&
          branch.outcome.type === "dead-end-on-constraint"
        ) {
          findings.push({
            rule: "fork-measurement-choice-cannot-dead-end",
            severity: "error",
            message: `Fork "${fork.id}" with varies: "measurement-choice" cannot use "dead-end-on-constraint" outcome.`,
            path: `${bPath}.outcome.type`,
            journeyId: journeyId,
            repair: "Use correct-but-weaker or undecided-on-available-evidence instead.",
          });
        }

        // Empirically equivalent requires non-trivial scopeNote
        if (branch.outcome.type === "empirically-equivalent-not-refuted") {
          if (!branch.outcome.scopeNote?.trim()) {
            findings.push({
              rule: "fork-scope-note-missing",
              severity: "error",
              message: `Branch "${branch.id}" with empirically-equivalent-not-refuted requires a scopeNote naming the observable class.`,
              path: `${bPath}.outcome.scopeNote`,
              journeyId: journeyId,
              repair: "Name the specific observable class within which predictions agree.",
            });
          } else if (
            branch.outcome.scopeNote.toLowerCase().includes("they agree here") ||
            branch.outcome.scopeNote.trim().length < 10
          ) {
            findings.push({
              rule: "fork-scope-note-trivial",
              severity: "error",
              message: `Branch "${branch.id}" scopeNote must name the observable class, not simply state agreement.`,
              path: `${bPath}.outcome.scopeNote`,
              journeyId: journeyId,
              repair: "Name the observable class within which the predictions agree.",
            });
          }
        }

        // Undecided requires insufficiency and whatWouldDecide
        if (branch.outcome.type === "undecided-on-available-evidence") {
          if (!branch.outcome.insufficiency?.trim()) {
            findings.push({
              rule: "fork-undecided-missing-insufficiency",
              severity: "error",
              message: `Branch "${branch.id}" is undecided on available evidence but is missing insufficiency statement.`,
              path: `${bPath}.outcome.insufficiency`,
              journeyId: journeyId,
              repair: "Explain why 1904 evidence is insufficient to decide this branch.",
            });
          }

          if (!branch.outcome.whatWouldDecide) {
            findings.push({
              rule: "fork-undecided-missing-what-would-decide",
              severity: "error",
              message: `Branch "${branch.id}" is undecided on available evidence but is missing whatWouldDecide.`,
              path: `${bPath}.outcome.whatWouldDecide`,
              journeyId: journeyId,
              repair: "Specify what later measurement or evidence resolved this question.",
            });
          } else {
            const wwd = branch.outcome.whatWouldDecide;
            // Check if whatWouldDecide resolves to something already available
            const card = options.cards?.[wwd.recordId];
            if (card) {
              if (
                card.status === "available" ||
                (card.date?.latestYear && card.date.latestYear <= 1904)
              ) {
                findings.push({
                  rule: "fork-undecided-already-decidable",
                  severity: "error",
                  message: `Branch "${branch.id}" whatWouldDecide points to "${wwd.recordId}" which is already available on the 1904 shelf (status: "${card.status}").`,
                  path: `${bPath}.outcome.whatWouldDecide.recordId`,
                  journeyId: journeyId,
                  repair: "Reference a later (post-1904) evidence record.",
                });
              }
            } else if (wwd.status === "available" || (wwd.year !== undefined && wwd.year <= 1904)) {
              findings.push({
                rule: "fork-undecided-already-decidable",
                severity: "error",
                message: `Branch "${branch.id}" whatWouldDecide points to pre-1905 evidence "${wwd.recordId}".`,
                path: `${bPath}.outcome.whatWouldDecide.recordId`,
                journeyId: journeyId,
                repair: "Reference a post-1904 evidence record.",
              });
            }
          }
        }
      }

      if (papersRouteCount !== 1) {
        findings.push({
          rule: "fork-papers-route-count",
          severity: "error",
          message: `Fork "${fork.id}" must have exactly one "papers-route" branch (found ${papersRouteCount}).`,
          path: `${fPath}.branches`,
          journeyId: journeyId,
          repair: "Designate exactly one branch as papers-route.",
        });
      }
    }
  }

  // 6. Stages & Premise citations
  const admittedImportSet = new Set(journey.admittedImports?.map((imp) => imp.importId) ?? []);
  if (Array.isArray(journey.stages)) {
    for (let sIdx = 0; sIdx < journey.stages.length; sIdx++) {
      const stage = journey.stages[sIdx];
      if (!stage) continue;
      const sPath = `journey.stages[${sIdx}]`;

      if (stage.title)
        findings.push(...checkForbiddenPhrases(stage.title, `${sPath}.title`, journeyId));
      if (stage.question)
        findings.push(...checkForbiddenPhrases(stage.question, `${sPath}.question`, journeyId));
      if (stage.computeFromShelf)
        findings.push(
          ...checkForbiddenPhrases(stage.computeFromShelf, `${sPath}.computeFromShelf`, journeyId),
        );
      if (stage.support?.explanation)
        findings.push(
          ...checkForbiddenPhrases(
            stage.support.explanation,
            `${sPath}.support.explanation`,
            journeyId,
          ),
        );
      if (stage.support?.workedExample?.prompt)
        findings.push(
          ...checkForbiddenPhrases(
            stage.support.workedExample.prompt,
            `${sPath}.support.workedExample.prompt`,
            journeyId,
          ),
        );
      if (stage.support?.partialComparison?.explanation)
        findings.push(
          ...checkForbiddenPhrases(
            stage.support.partialComparison.explanation,
            `${sPath}.support.partialComparison.explanation`,
            journeyId,
          ),
        );
      if (stage.support?.prediction?.prompt)
        findings.push(
          ...checkForbiddenPhrases(
            stage.support.prediction.prompt,
            `${sPath}.support.prediction.prompt`,
            journeyId,
          ),
        );
      if (stage.support?.prediction?.explanation)
        findings.push(
          ...checkForbiddenPhrases(
            stage.support.prediction.explanation,
            `${sPath}.support.prediction.explanation`,
            journeyId,
          ),
        );
      if (stage.support?.transferCase?.explanation)
        findings.push(
          ...checkForbiddenPhrases(
            stage.support.transferCase.explanation,
            `${sPath}.support.transferCase.explanation`,
            journeyId,
          ),
        );

      // Check premise citations
      for (const pRef of stage.premiseRefs) {
        if (pRef.importId) {
          if (!admittedImportSet.has(pRef.importId)) {
            findings.push({
              rule: "stage-unadmitted-import",
              severity: "error",
              message: `Stage "${stage.id}" cites import "${pRef.importId}" which is not declared in admittedImports.`,
              path: `${sPath}.premiseRefs`,
              journeyId: journeyId,
              repair: `Declare "${pRef.importId}" in journey.admittedImports.`,
            });
          }
        } else {
          const card = options.cards?.[pRef.cardId];
          if (card) {
            const status =
              card.status === "parallel-work" ||
              card.status === "later" ||
              card.status === "available"
                ? card.status
                : "available";
            const decision = evaluateShelfDate(
              {
                id: stage.id,
                kind: "chain",
                parallelWorkAcknowledged: pRef.parallelWorkAcknowledged === true,
              },
              {
                id: pRef.cardId,
                status,
                latestYear: card.date?.latestYear ?? 0,
              },
              { id: journeyId, admittedImports: [...admittedImportSet] },
            );
            if (!decision.ok) {
              findings.push({
                rule: "shelf-date-violation",
                severity: "error",
                message: `Stage "${stage.id}" cites premise "${pRef.cardId}" (${decision.reason}).`,
                path: `${sPath}.premiseRefs`,
                journeyId: journeyId,
                repair: decision.repair,
              });
            }
          }
        }
      }

      // Check prediction field in support has no numeric literals
      if (stage.support.prediction?.choices) {
        for (const choice of stage.support.prediction.choices) {
          if (/^\s*[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?\s*$/.test(choice)) {
            findings.push({
              rule: "prediction-numeric-literal-forbidden",
              severity: "error",
              message: `Stage "${stage.id}" prediction choice "${choice}" is a raw numeric literal.`,
              path: `${sPath}.support.prediction.choices`,
              journeyId: journeyId,
              repair:
                "Use conceptual or proportional options; numeric values come from live models.",
            });
          }
        }
      }
    }
  }

  // 7. Doors validation
  if (journey.doors) {
    const arrivesAt = journey.doors.frontDoor?.arrivesAtEquationId;
    if (arrivesAt && Array.isArray(journey.doors.sideDoors)) {
      for (let dIdx = 0; dIdx < journey.doors.sideDoors.length; dIdx++) {
        const sd = journey.doors.sideDoors[dIdx];
        if (!sd) continue;
        if (sd.arrivesAtEquationId !== arrivesAt) {
          findings.push({
            rule: "doors-arrives-at-mismatch",
            severity: "error",
            message: `Side door "${sd.id}" arrivesAtEquationId "${sd.arrivesAtEquationId}" does not match front door "${arrivesAt}".`,
            path: `journey.doors.sideDoors[${dIdx}].arrivesAtEquationId`,
            journeyId: journeyId,
            repair: "All doors of one journey must arrive at the same equation ID.",
          });
        }
      }
    }
  }

  // 8. World Checks
  if (Array.isArray(journey.worldChecks)) {
    for (let wIdx = 0; wIdx < journey.worldChecks.length; wIdx++) {
      const wc = journey.worldChecks[wIdx];
      if (!wc) continue;
      const wPath = `journey.worldChecks[${wIdx}]`;
      if (wc.laterEvidence && wc.laterEvidence.year <= 1904) {
        findings.push({
          rule: "world-check-later-evidence-year-invalid",
          severity: "error",
          message: `World check "${wc.id}" laterEvidence year must be post-1904 (got ${wc.laterEvidence.year}).`,
          path: `${wPath}.laterEvidence.year`,
          journeyId: journeyId,
          repair: "laterEvidence must postdate 1904.",
        });
      }
    }
  }

  return findings;
}
