import { notFound } from "next/navigation";
import { VelocityCompositionLab } from "../../../../../components/lab/sr06/VelocityCompositionLab.tsx";
import { encodeResult } from "../../../../../experiments/results/codec.ts";
import { SR06_DEFAULTS } from "../../../../../experiments/sr06/definition.ts";
import { SR06_PAPER_CASES, velocityCaseAt } from "../../../../../experiments/sr06/paperCases.ts";
import { evaluateSr06 } from "../../../../../experiments/sr06/session.ts";
import labDigests from "../../../../../generated/lab-source-digests.json";
import "../../composition.css";

export const dynamicParams = false;
type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return Object.keys(SR06_PAPER_CASES).map(slug => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const example = velocityCaseAt((await params).slug);
  return example ? { title: example.title, description: example.question } : {};
}

export default async function VelocityPaperCasePage({ params }: Props) {
  const { slug } = await params;
  const example = velocityCaseAt(slug);
  if (!example) notFound();
  const parameters = { ...SR06_DEFAULTS, ...example.parameters };
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Special relativity · §5</p>
        <h1>{example.title}</h1>
        <p className="lead">{example.question}</p>
      </header>
      <VelocityCompositionLab
        key={slug}
        instanceId={`sr06-paper-${slug}`}
        example={{
          parameters,
          sourceDigest: labDigests["sr-06"],
          results: evaluateSr06(parameters).map(encodeResult),
          stepIndex: 0,
          simulationTime: 0,
        }}
      />
      <nav className="lab-onward" aria-label="Return to the equations in §5">
        <h2>Back to the argument</h2>
        <ul>
          {example.sources.map(source => (
            <li key={source.display}>
              <a href={`/equations/special-relativity/${source.display}/`}>{source.label}</a>
            </li>
          ))}
          <li><a href="/lab/sr-06/">Explore other velocity compositions</a></li>
        </ul>
      </nav>
    </>
  );
}
