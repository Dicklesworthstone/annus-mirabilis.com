import type { CheckedLinearCertificate } from "./linearCertificate.ts";

/** Pre-rendered data only. No checker, symbolic algebra, or KaTeX enters the client. */
export type LinearProofView = Readonly<{
  certificate: CheckedLinearCertificate;
  sourceDigest: string;
  premises: readonly Readonly<{ id: string; label: string; explanation: string }>[];
  steps: readonly Readonly<{ id: string; title: string; reason: string; detail: string; foundation: string; move: boolean }>[];
  equations: readonly Readonly<{
    id: string; argument: string; title: string; spoken: string;
    html: string; mathml: string; plainLatex: string; treeDigest: string;
  }>[];
}>;
