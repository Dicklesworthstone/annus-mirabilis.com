/**
 * Compiler checks and reference validations for Discovery Journeys.
 * Specification: am-disc-journey-framework-umbg, AGENTS.md (§7.1–7.4)
 */

import { evaluateShelfDate } from "../../content/checks/epistemic/shelfDate.ts";
import { checkVoice } from "../../content/checks/voice/index.ts";
import {
  FORK_VARIES_KINDS,
  type Journey,
  OUTCOME_TYPES,
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
export function checkJourney(
  journey: Journey,
  options: JourneyCheckOptions = {},
): JourneyFinding[] {
  const findings: JourneyFinding[] = [];
  const jId = journey.id;

  // 1. Structure validation
  try {
    validateJourney(journey);
  } catch (err: any) {
    findings.push({
      rule: err.code || "journey-schema-error",
      severity: "error",
      message: err.message,
      path: err.path || "journey",
      journeyId: jId,
    });
    return findings;
  }

  // Top-level forbidden phrase checks
  if (journey.naggingFact) {
    findings.push(...checkForbiddenPhrases(journey.naggingFact, "journey.naggingFact", jId));
  }
  if (journey.firstHonestQuestion) {
    findings.push(
      ...checkForbiddenPhrases(journey.firstHonestQuestion, "journey.firstHonestQuestion", jId),
    );
  }
  if (journey.ppeTask) {
    if (journey.ppeTask.task)
      findings.push(...checkForbiddenPhrases(journey.ppeTask.task, "journey.ppeTask.task", jId));
    if (journey.ppeTask.perturbPrompt)
      findings.push(
        ...checkForbiddenPhrases(
          journey.ppeTask.perturbPrompt,
          "journey.ppeTask.perturbPrompt",
          jId,
        ),
      );
    if (journey.ppeTask.explainPrompt)
      findings.push(
        ...checkForbiddenPhrases(
          journey.ppeTask.explainPrompt,
          "journey.ppeTask.explainPrompt",
          jId,
        ),
      );
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

  const hasShelf = journey.shelf && journey.shelf.length > 0;
  const hasNaggingFact = Boolean(journey.naggingFact && journey.naggingFact.trim());
  const hasFirstHonestQuestion = Boolean(
    journey.firstHonestQuestion && journey.firstHonestQuestion.trim(),
  );
  const hasStages = Array.isArray(journey.stages) && journey.stages.length >= 1;
  const hasForks =
    Array.isArray(journey.forks) && journey.forks.length >= 2 && journey.forks.length <= 3;
  const hasMove = Boolean(
    journey.move && journey.move.label && journey.move.chainId && journey.move.stepId,
  );
  const hasMoveSummary = Boolean(
    journey.move?.r0Summary?.text && journey.move.r0Summary.text.trim(),
  );
  const hasWorldChecks = Array.isArray(journey.worldChecks) && journey.worldChecks.length >= 1;
  const hasSourceJumps = Array.isArray(journey.sourceJumps) && journey.sourceJumps.length >= 1;
  const instrumentedCount = journey.exercises?.filter((e) => e.role === "instrumented").length ?? 0;
  const explanationCount = journey.exercises?.filter((e) => e.role === "explanation").length ?? 0;
  const hasInstrumentedExercises = instrumentedCount >= 2 && instrumentedCount <= 5;
  const hasPpeTask = Boolean(
    journey.ppeTask && journey.ppeTask.task && journey.ppeTask.task.trim(),
  );
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
          journeyId: jId,
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
          journeyId: jId,
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
          journeyId: jId,
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
        journeyId: jId,
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
      journeyId: jId,
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
          journeyId: jId,
          repair: issue.repair,
        });
      }
    }
  }

  // 5. Forks & Branches
  if (Array.isArray(journey.forks)) {
    for (let fIdx = 0; fIdx < journey.forks.length; fIdx++) {
      const fork = journey.forks[fIdx]!;
      const fPath = `journey.forks[${fIdx}]`;

      if (fork.question) {
        findings.push(...checkForbiddenPhrases(fork.question, `${fPath}.question`, jId));
      }

      if (!fork.varies || !FORK_VARIES_KINDS.includes(fork.varies)) {
        findings.push({
          rule: "fork-varies-missing",
          severity: "error",
          message: `Fork "${fork.id}" is missing valid "varies" property.`,
          path: `${fPath}.varies`,
          journeyId: jId,
          repair: `Set varies to one of: ${FORK_VARIES_KINDS.join(", ")}.`,
        });
      }

      let papersRouteCount = 0;
      for (let bIdx = 0; bIdx < fork.branches.length; bIdx++) {
        const branch = fork.branches[bIdx]!;
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
                journeyId: jId,
                repair: vf.suggestion,
              });
            }
            const forbiddenFindings = checkForbiddenPhrases(txt, bPath, jId);
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
            journeyId: jId,
            repair: "Use correct-but-weaker or undecided-on-available-evidence instead.",
          });
        }

        // Empirically equivalent requires non-trivial scopeNote
        if (branch.outcome.type === "empirically-equivalent-not-refuted") {
          if (!branch.outcome.scopeNote || !branch.outcome.scopeNote.trim()) {
            findings.push({
              rule: "fork-scope-note-missing",
              severity: "error",
              message: `Branch "${branch.id}" with empirically-equivalent-not-refuted requires a scopeNote naming the observable class.`,
              path: `${bPath}.outcome.scopeNote`,
              journeyId: jId,
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
              journeyId: jId,
              repair: "Name the observable class within which the predictions agree.",
            });
          }
        }

        // Undecided requires insufficiency and whatWouldDecide
        if (branch.outcome.type === "undecided-on-available-evidence") {
          if (!branch.outcome.insufficiency || !branch.outcome.insufficiency.trim()) {
            findings.push({
              rule: "fork-undecided-missing-insufficiency",
              severity: "error",
              message: `Branch "${branch.id}" is undecided on available evidence but is missing insufficiency statement.`,
              path: `${bPath}.outcome.insufficiency`,
              journeyId: jId,
              repair: "Explain why 1904 evidence is insufficient to decide this branch.",
            });
          }

          if (!branch.outcome.whatWouldDecide) {
            findings.push({
              rule: "fork-undecided-missing-what-would-decide",
              severity: "error",
              message: `Branch "${branch.id}" is undecided on available evidence but is missing whatWouldDecide.`,
              path: `${bPath}.outcome.whatWouldDecide`,
              journeyId: jId,
              repair: "Specify what later measurement or evidence resolved this question.",
            });
          } else {
            const wwd = branch.outcome.whatWouldDecide;
            // Check if whatWouldDecide resolves to something already available
            if (options.cards && options.cards[wwd.recordId]) {
              const card = options.cards[wwd.recordId]!;
              if (
                card.status === "available" ||
                (card.date?.latestYear && card.date.latestYear <= 1904)
              ) {
                findings.push({
                  rule: "fork-undecided-already-decidable",
                  severity: "error",
                  message: `Branch "${branch.id}" whatWouldDecide points to "${wwd.recordId}" which is already available on the 1904 shelf (status: "${card.status}").`,
                  path: `${bPath}.outcome.whatWouldDecide.recordId`,
                  journeyId: jId,
                  repair: "Reference a later (post-1904) evidence record.",
                });
              }
            } else if (wwd.status === "available" || (wwd.year !== undefined && wwd.year <= 1904)) {
              findings.push({
                rule: "fork-undecided-already-decidable",
                severity: "error",
                message: `Branch "${branch.id}" whatWouldDecide points to pre-1905 evidence "${wwd.recordId}".`,
                path: `${bPath}.outcome.whatWouldDecide.recordId`,
                journeyId: jId,
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
          journeyId: jId,
          repair: "Designate exactly one branch as papers-route.",
        });
      }
    }
  }

  // 6. Stages & Premise citations
  const admittedImportSet = new Set(journey.admittedImports?.map((imp) => imp.importId) ?? []);
  if (Array.isArray(journey.stages)) {
    for (let sIdx = 0; sIdx < journey.stages.length; sIdx++) {
      const stage = journey.stages[sIdx]!;
      const sPath = `journey.stages[${sIdx}]`;

      if (stage.title) findings.push(...checkForbiddenPhrases(stage.title, `${sPath}.title`, jId));
      if (stage.question)
        findings.push(...checkForbiddenPhrases(stage.question, `${sPath}.question`, jId));
      if (stage.computeFromShelf)
        findings.push(
          ...checkForbiddenPhrases(stage.computeFromShelf, `${sPath}.computeFromShelf`, jId),
        );
      if (stage.support?.explanation)
        findings.push(
          ...checkForbiddenPhrases(stage.support.explanation, `${sPath}.support.explanation`, jId),
        );
      if (stage.support?.workedExample?.prompt)
        findings.push(
          ...checkForbiddenPhrases(
            stage.support.workedExample.prompt,
            `${sPath}.support.workedExample.prompt`,
            jId,
          ),
        );
      if (stage.support?.partialComparison?.explanation)
        findings.push(
          ...checkForbiddenPhrases(
            stage.support.partialComparison.explanation,
            `${sPath}.support.partialComparison.explanation`,
            jId,
          ),
        );
      if (stage.support?.prediction?.prompt)
        findings.push(
          ...checkForbiddenPhrases(
            stage.support.prediction.prompt,
            `${sPath}.support.prediction.prompt`,
            jId,
          ),
        );
      if (stage.support?.prediction?.explanation)
        findings.push(
          ...checkForbiddenPhrases(
            stage.support.prediction.explanation,
            `${sPath}.support.prediction.explanation`,
            jId,
          ),
        );
      if (stage.support?.transferCase?.explanation)
        findings.push(
          ...checkForbiddenPhrases(
            stage.support.transferCase.explanation,
            `${sPath}.support.transferCase.explanation`,
            jId,
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
              journeyId: jId,
              repair: `Declare "${pRef.importId}" in journey.admittedImports.`,
            });
          }
        } else if (options.cards && options.cards[pRef.cardId]) {
          const card = options.cards[pRef.cardId]!;
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
            { id: jId, admittedImports: [...admittedImportSet] },
          );
          if (!decision.ok) {
            findings.push({
              rule: "shelf-date-violation",
              severity: "error",
              message: `Stage "${stage.id}" cites premise "${pRef.cardId}" (${decision.reason}).`,
              path: `${sPath}.premiseRefs`,
              journeyId: jId,
              repair: decision.repair,
            });
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
              journeyId: jId,
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
        const sd = journey.doors.sideDoors[dIdx]!;
        if (sd.arrivesAtEquationId !== arrivesAt) {
          findings.push({
            rule: "doors-arrives-at-mismatch",
            severity: "error",
            message: `Side door "${sd.id}" arrivesAtEquationId "${sd.arrivesAtEquationId}" does not match front door "${arrivesAt}".`,
            path: `journey.doors.sideDoors[${dIdx}].arrivesAtEquationId`,
            journeyId: jId,
            repair: "All doors of one journey must arrive at the same equation ID.",
          });
        }
      }
    }
  }

  // 8. World Checks
  if (Array.isArray(journey.worldChecks)) {
    for (let wIdx = 0; wIdx < journey.worldChecks.length; wIdx++) {
      const wc = journey.worldChecks[wIdx]!;
      const wPath = `journey.worldChecks[${wIdx}]`;
      if (wc.laterEvidence && wc.laterEvidence.year <= 1904) {
        findings.push({
          rule: "world-check-later-evidence-year-invalid",
          severity: "error",
          message: `World check "${wc.id}" laterEvidence year must be post-1904 (got ${wc.laterEvidence.year}).`,
          path: `${wPath}.laterEvidence.year`,
          journeyId: jId,
          repair: "laterEvidence must postdate 1904.",
        });
      }
    }
  }

  return findings;
}
