import type {
  IdentifierBinding,
  KernelDisplayRole,
  KernelFunctionRef,
  TraceRow,
} from "../schemas/experiment.ts";

export type KernelLanguage = "ts" | "rust";

export type ExtractedKernelSource = Readonly<{
  language: KernelLanguage;
  exportName: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  source: string;
  sourceHash: string;
  revision: string;
  identifiers: readonly string[];
}>;

export type KernelIssue = Readonly<{
  code: string;
  instrumentId: string;
  message: string;
  repair?: string | undefined;
  functionName?: string | undefined;
  quantityId?: string | undefined;
  identifier?: string | undefined;
  oldHash?: string | undefined;
  newHash?: string | undefined;
}>;

export type KernelCatalogEntry = Readonly<{
  instrumentId: string;
  kernel: KernelFunctionRef & {
    language: KernelLanguage;
    displayRole: KernelDisplayRole;
  };
  words: Readonly<{ r0: string; r1: string; r2: string; r3?: string | undefined }>;
  equationId?: string | undefined;
  liveTerms: readonly string[];
  identifierBindings: readonly IdentifierBinding[];
  independentReferences?:
    | readonly Readonly<{ experimentId: string; quantityId: string }>[]
    | undefined;
  traceScenarioId?: string | undefined;
}>;

export type WorkedTrace = Readonly<{
  scenarioId: string;
  constantSetId: string;
  constantSetLabel: string;
  functionName: string;
  rows: readonly TraceRow[];
  terminatedAtRow?: number | undefined;
  refusalCode?: string | undefined;
  refusalMessage?: string | undefined;
}>;

export type KernelListing = Readonly<{
  displayRole: KernelDisplayRole;
  language?: KernelLanguage | undefined;
  exportName: string;
  filePath?: string | undefined;
  revision?: string | undefined;
  sourceHash?: string | undefined;
  source?: string | undefined;
  highlightedHtml?: string | undefined;
  words: string;
  equationId?: string | undefined;
  independentReferences: readonly Readonly<{ experimentId: string; quantityId: string }>[];
  trace?: WorkedTrace | undefined;
  identifierBindings: readonly IdentifierBinding[];
}>;

export const KERNEL_DISPLAY_ROLE_LABELS: Readonly<Record<KernelDisplayRole, string>> = {
  "executing-source": "This function ran, in this build, to produce results of this kind.",
  // Said as a reader would (dispatch 218). It read "Audited TypeScript reference evaluator: the
  // owner on this device, or the host fallback for a FrankenSim capability.", which named the
  // runtime's roles, not the code. The source hash and pin stay on the header line beside it.
  "reference-implementation":
    "The site’s own reference code for this law, in TypeScript. It computes the numbers above when the page runs it, and it is what the page uses wherever a FrankenSim result is not available.",
  pseudocode: "Authored explanatory listing. No build executes this listing.",
  derivation:
    "Authored algebraic listing that shows how the expression was obtained. No build executes this listing.",
};

export const PINNED_FRANKENSIM_REVISION = "5bbbfae6f7de614422f6f97f5798a3e00f8ad813";
export const KERNEL_BEAD_ID = "am-inst-show-the-code-4brv";
export const KERNEL_BINDING_CHECK_ID = "kernel-identifier-binding";
export const MAX_TRACE_ROWS = 12;
