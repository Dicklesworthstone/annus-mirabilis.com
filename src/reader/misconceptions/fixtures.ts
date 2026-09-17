/**
 * Two named fixture Misconception entries for am-read-misconception-callouts-a3o's own tests
 * (its bead text names both): "halving the diffusivity halves the displacement" (right about D
 * itself, wrong about the displacement, which scales by 1/sqrt(2)) and a two-opposites entry
 * modeled on "length contraction is an optical illusion" versus "the rod is physically squashed."
 * Not content for the reader -- real per-paper misconception content is out of this bead's scope.
 */
import type { Misconception } from "../../content/schemas/argument.ts";

const authorship = {
  draftedBy: [{ id: "agent-plumhawk", kind: "model" as const, modelId: "claude-sonnet-5" }],
} as const;

export const fixtureHalvingDiffusivity: Misconception = Object.freeze({
  id: "misc-halving-diffusivity-halves-displacement",
  paper: "brownian-motion",
  temptingClaims: ["Halving the diffusivity D halves the mean displacement."],
  whyTempting:
    "The displacement law lambda_x = sqrt(2 D t) does grow with D, and halving a factor that appears in a formula reads, at a glance, like it halves the output.",
  whereItIsTrue:
    "Halving D does halve the mean squared displacement lambda_x^2 -- that part of the intuition is correct.",
  whatIsTrue: {
    r0: "Halving D does not halve the displacement itself; it shrinks it to about 0.71 times its size, because the displacement is a square root of D.",
    r1: "lambda_x = sqrt(2 D t), so halving D scales lambda_x by sqrt(1/2) = 1/sqrt(2) ~ 0.70711, not by 1/2.",
    r2: "lambda_x(D/2, t) / lambda_x(D, t) = sqrt((D/2) / D) = sqrt(1/2) = 1/sqrt(2) ~ 0.70711.",
    r3: "The squared displacement lambda_x^2 = 2 D t is linear in D; the displacement lambda_x itself is not.",
  },
  instrumentIds: ["bm-06"],
  anchors: ["s5"],
  resultIds: ["bm-displacement-law"],
  sources: [],
  intervention: {
    instrumentId: "bm-06",
    defaultsReviewed: {
      model:
        "The default view starts with D and t both visible so halving D can be read off the same panel as the resulting spread.",
      labels:
        "The D control is labeled as a diffusivity, not as 'spread size', so it does not pre-suggest a linear relationship.",
      defaultControls:
        "The default preset holds t fixed while D is changed, isolating the relationship this misconception concerns.",
      feedback:
        "The radius readout updates live as D changes, so the 1/sqrt(2) scaling is directly observable.",
    },
    reviewRecordId: "rr-misc-halving-diffusivity",
  },
  authorship,
  reviewState: "draft",
} satisfies Misconception);

/** No instrument treatment -- exercises the `staticTreatment` rendering path and a misconception
 * that concerns two result cards at once, for collectForResults' grouping. */
export const fixtureStaticTreatmentOnly: Misconception = Object.freeze({
  id: "misc-molecular-number-is-a-single-molecule-count",
  paper: "brownian-motion",
  temptingClaims: ["Avogadro's number is the number of molecules Einstein actually counted."],
  whyTempting:
    "The derivation ends in a number reported to a few significant figures, which reads like the outcome of a direct count.",
  whereItIsTrue: "none",
  whatIsTrue: {
    r0: "No molecule was ever counted directly; the number comes from fitting the observed spread of many particles to the diffusion law and solving for N.",
    r1: "N_A is inferred from measured diffusivity, viscosity, temperature, and particle radius via the Stokes-Einstein relation -- an indirect determination, not a tally.",
    r2: "N_A = RT / (3 pi eta a D), with every quantity on the right measured independently of counting molecules.",
  },
  staticTreatment: {
    reason:
      "No interactive instrument isolates 'was this counted or inferred' as a manipulable variable; the distinction is presented as running text next to the derivation instead.",
  },
  anchors: ["s5"],
  resultIds: ["bm-displacement-law", "bm-molecular-number"],
  sources: [],
  intervention: {
    defaultsReviewed: {
      model: "N/A -- no instrument is attached to this entry.",
      labels: "N/A -- no instrument is attached to this entry.",
      defaultControls: "N/A -- no instrument is attached to this entry.",
      feedback: "N/A -- no instrument is attached to this entry.",
    },
    reviewRecordId: "rr-misc-molecular-number",
  },
  authorship,
  reviewState: "draft",
} satisfies Misconception);

export const fixtureLengthContraction: Misconception = Object.freeze({
  id: "misc-length-contraction-illusion-or-squash",
  paper: "special-relativity",
  temptingClaims: [
    "Length contraction is just an optical illusion -- the rod is not really shorter.",
    "The rod is physically squashed by its motion, like a spring under compression.",
  ],
  whyTempting:
    "Both readings try to keep 'length' as a single frame-independent fact: one keeps the rod's rest-frame length as the real one and demotes the moving-frame measurement to an illusion; the other keeps the moving-frame measurement as real and treats it as a mechanical effect of motion, by analogy with a physically compressed object.",
  whereItIsTrue: "none",
  whatIsTrue: {
    r0: "The rod really is shorter as measured in a frame where it moves -- not an illusion of perspective, and not a mechanical squashing. Length is a relation between the rod and a frame, not a single fact about the rod.",
    r1: "Length contraction is a real disagreement between frames' simultaneity conventions, not a compression: each frame measures the rod's endpoints at times that are simultaneous in that frame, and frames disagree about which pairs of events are simultaneous.",
    r2: "L' = L0 / gamma, where L0 is the rest length and gamma = 1/sqrt(1 - v^2/c^2); the measurement in the moving frame uses that frame's own simultaneity slice, not a distorted view of the rest-frame slice.",
    r3: "Both 'illusion' and 'squash' presuppose an observer-independent length exists and treat the Lorentz transformation as a correction to it; paper 3 replaces that premise with the relativity of simultaneity itself.",
  },
  instrumentIds: ["sr-length-contraction"],
  anchors: ["s4"],
  resultIds: [],
  sources: [],
  intervention: {
    instrumentId: "sr-length-contraction",
    defaultsReviewed: {
      model:
        "The default view shows both frames' simultaneity slices side by side, so neither the rest-frame nor the moving-frame length is presented as the single true one.",
      labels:
        "Both readouts are labeled by frame ('length in S', 'length in S-prime'), never as 'true length' or 'apparent length'.",
      defaultControls:
        "The default preset starts at v = 0 so the reader sees the two readouts agree before introducing relative motion.",
      feedback:
        "Increasing v visibly separates the two frames' simultaneity slices at the rod's endpoints, tying the contraction to that separation rather than to a compression animation.",
    },
    reviewRecordId: "rr-misc-length-contraction",
  },
  authorship,
  reviewState: "draft",
} satisfies Misconception);
