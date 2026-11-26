import type { Metadata } from "next";
import { loadMillikanOverlay } from "../../../../experiments/lq08/millikanRecord.ts";
import { prepareMillikanAnalysis } from "../../../../reasoning/photoelectricData/millikanAnalysis.ts";
import { PhotoelectricDataWorkbench } from "../../../../reasoning/photoelectricData/PhotoelectricDataWorkbench.tsx";
import { modernPhotoelectricReference } from "../../../../reasoning/photoelectricData/session.ts";

export const metadata: Metadata = {
  title: "Refit Millikan’s sodium measurements",
  description: "Use the signed voltages from Millikan’s 1916 sodium figure to estimate Planck’s constant and test how the choice of points affects the slope.",
  alternates: { canonical: "/lab/lq-08/millikan/" },
};

export default function MillikanAnalysisPage() {
  const reference = modernPhotoelectricReference();
  const record = prepareMillikanAnalysis(loadMillikanOverlay(), reference);
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Light quanta · Later evidence · 1916</p>
        <h1>What slope do Millikan’s sodium measurements give?</h1>
        <p className="lead">
          In 1905 Einstein predicted how the stopping potential rises with frequency.
          In 1916 Millikan plotted the voltages at which the photocurrent vanished for
          six mercury lines. How closely does the slope of those observations agree with h/e?
        </p>
      </header>
      {record.kind === "available" ? (
        <>
          <p>
            Begin with the five points Millikan says fixed his slope. Inspect the residuals,
            then select all six and refit. The estimated h multiplies your fitted slope by
            the modern elementary charge. Millikan used the charge value available in 1916.
          </p>
          <PhotoelectricDataWorkbench example={record.analysis} reference={reference} />
        </>
      ) : (
        <section className="reading">
          <h2>Historical measurements unavailable</h2>
          <p>{record.reason}</p>
          <p>{record.citation}</p>
        </section>
      )}
      <nav className="actions" aria-label="Continue investigating light quanta">
        <a href="/discover/light-quanta/investigate/">Return to the light-quanta investigation</a>
        <a href="/papers/light-quanta/#s8">Read Einstein’s 1905 argument in §8</a>
        <a href="/lab/lq-08/">Compare with the photoelectric apparatus</a>
      </nav>
    </>
  );
}
