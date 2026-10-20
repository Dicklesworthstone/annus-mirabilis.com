/**
 * Journey II's exercises: one expression, checked against the host diffusion owner, and one
 * explanation part the reader judges against its criteria.
 *
 * MOVED, NOT REWRITTEN (am-4k0m). Both parts were `const` declarations inside
 * src/app/discover/brownian-motion/page.tsx, unexported, so nothing but that page could reach
 * them -- and `realJourneys.ts` could not compose the journey's `exercises` because of it. The
 * three other papers already keep their parts in a module of this name. The two object literals
 * below are the page's, character for character; the page imports them now and renders exactly
 * what it rendered before.
 *
 * The journey record's `ExerciseRef` carries an id, a role and a prompt. The role is derived from
 * the part's TYPE rather than declared twice: an ExpressionExercisePart is `instrumented` because
 * a kernel checks it, an ExplanationExercisePart is `explanation` because the reader judges it
 * against the criteria. Nothing about either part is restated in the journey.
 */

import type { ExpressionExercisePart } from "../../components/discover/ExercisePart.tsx";
import type { ExplanationExercisePart } from "../../components/discover/ExplanationPart.tsx";

export const DISPLACEMENT_SCALE_EXERCISE: ExpressionExercisePart = {
  id: "bm-displacement-scale-rewrite",
  prompt:
    "Along one axis the mean square displacement is 2·D·t. Watch the same particle in the plane, moving along x and y independently. What is its root mean square distance from the start?",
  declaredNames: ["D", "t"],
  domains: {
    D: { min: 1e-14, max: 1e-10, scale: "log" },
    t: { min: 0.1, max: 100, scale: "log" },
  },
  referenceSource: "2*sqrt(D*t)",
  tolerance: { absolute: 1e-9, relative: 1e-9 },
  // Length, mass, time, temperature, current, amount: D in m²/s and t in s, so an answer with the
  // wrong dimension, such as D*t, is told so before any numbers are compared.
  dimensions: { D: ["2", "0", "-1", "0", "0", "0"], t: ["0", "0", "1", "0", "0", "0"] },
  workedExplanation:
    "The squared distance from the start is x² + y². Each axis contributes a mean square of 2·D·t, independently, so the mean square distance is 4·D·t, and its root is sqrt(4·D·t) = 2·sqrt(D·t). That is sqrt(2) times the one-axis value, sqrt(2·D·t), not twice it: the two mean squares add, not the two distances.",
};
export const SQUARE_ROOT_IN_WORDS: ExplanationExercisePart = {
  id: "bm-square-root-in-words",
  prompt:
    "Put it in your own words. In four times as long, a particle kicked about at random typically gets only twice as far. Why not four times as far, as a particle drifting at a steady speed would?",
  criteria: [
    "Each kick is independent of the last, so a step one way is as likely to be undone by the next step as to be continued.",
    "What grows in proportion to time is the mean square displacement, because the mean squares of independent steps add.",
    "The typical distance is the square root of the mean square, so four times the time gives the square root of four: twice as far.",
    "A drifting particle’s steps all point the same way, so nothing cancels and its distance grows in proportion to time.",
  ],
  workedExplanation:
    "Split the time into many short intervals. In each one the particle is kicked one way or the other, independently of every earlier kick, and its displacement is the sum of these steps. The average of that sum is zero, because each direction is equally likely, but the average of its square is not. Squaring the sum gives each step’s own square plus products of pairs of different steps, and because the steps are independent each of those products averages to zero. What is left is the sum of the steps’ own squares, which grows with the number of steps, and so in proportion to time. Four times as long gives four times the mean square, and the typical distance, its square root, is the square root of four times as large: twice. A particle drifting at a steady speed takes steps that all point the same way. Nothing cancels, and four times the time carries it four times as far.",
};
