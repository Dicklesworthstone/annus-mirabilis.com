/** Public lab targets and notebook capabilities; importing this table never opens device storage. */
const laboratories = Object.freeze({
  "bm-01": Object.freeze({
    experimentId: "bm-01",
    paper: "brownian-motion",
    anchor: "arg-bm-observable",
    title: "Brownian tracer",
    href: "/lab/bm-01/",
    requiresScientificCheckpoint: false,
  } as const),
  "bm-05": Object.freeze({
    experimentId: "bm-05",
    paper: "brownian-motion",
    anchor: "arg-bm-independent-steps",
    title: "Random walks",
    href: "/lab/bm-05/",
    requiresScientificCheckpoint: false,
  } as const),
  "bm-07": Object.freeze({
    experimentId: "bm-07",
    paper: "brownian-motion",
    anchor: "arg-bm-inference",
    title: "Molecular-number inference",
    href: "/lab/bm-07/",
    requiresScientificCheckpoint: true,
  } as const),
  "bm-08": Object.freeze({
    experimentId: "bm-08",
    paper: "brownian-motion",
    anchor: "arg-bm-inference",
    title: "Particle and camera",
    href: "/lab/bm-08/",
    requiresScientificCheckpoint: true,
  } as const),
});

export type NotebookRecordingExperiment = keyof typeof laboratories;
export function recordingLaboratory(experimentId: string) {
  return Object.hasOwn(laboratories, experimentId)
    ? laboratories[experimentId as NotebookRecordingExperiment]
    : null;
}

