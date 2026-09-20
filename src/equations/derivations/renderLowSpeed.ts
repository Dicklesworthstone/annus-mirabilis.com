import { renderToString } from "katex";
import { parseRational } from "../../content/dimensions/rational.ts";
import type { CompiledEquation } from "../viewTypes.ts";
import type { LowSpeedCertificate } from "./massEnergyLowSpeed.ts";
import type { LowSpeedFormula, LowSpeedProofView } from "./lowSpeedView.ts";

/** All TeX is composed here from checked rational coefficients or fixed text;
 * no user-authored TeX or browser calculation enters the payload.
 */
function formula(latex:string, spoken:string):LowSpeedFormula {
  const options = {displayMode:true,throwOnError:true,strict:"error" as const,trust:false,maxExpand:1000,maxSize:20};
  return {latex,spoken,html:renderToString(latex,{...options,output:"html"}),
    mathml:renderToString(latex,{...options,output:"mathml"})};
}
function fraction(text:string):string {
  const r = parseRational(text);
  return r.den === 1n ? String(r.num) : `\\frac{${r.num}}{${r.den}}`;
}
export function renderLowSpeedProof(checked:LowSpeedCertificate, equations:readonly CompiledEquation[]):Omit<LowSpeedProofView,"sourceDigest"> {
  const {normalizedTree: _tree, ...certificate} = checked;
  const used = certificate.equationIds.map(id => {
    const record = equations.find(e => e.id === id);
    if (!record) throw new Error(`Missing low-speed equation ${id}.`);
    const {title,spoken,html,mathml,plainLatex,treeDigest} = record;
    return {id,title,spoken,html,mathml,plainLatex,treeDigest};
  });
  return {certificate,equations:used,approximations:([2,4,6] as const).map(order => {
    const terms = certificate.coefficients.slice(0,order+1).flatMap((coefficient,k) => coefficient === "0" ? [] :
      [`${fraction(coefficient)}${k ? `\\beta^{${k}}` : ""}`]);
    return {order,omittedPower:order+2,omittedCoefficient:certificate.coefficients[order+2]!,
      formula:formula(`\\gamma-1\\approx ${terms.join("+")}`,`Keep powers through ${order} in the dimensionless speed ratio beta, which means v divided by c. This is an approximation, not a finite-speed equality.`)};
  }),factorization:formula(String.raw`\frac{2\Delta K}{v^2}=\frac{L}{c^2}\,\frac{2(\gamma-1)}{\beta^2},\qquad \beta=\frac{v}{c},\quad v\ne 0`,
    "For nonzero v, twice the kinetic-energy drop over v squared equals L over c squared times the dimensionless quotient twice the difference gamma minus one, divided by beta squared. The unchanged-offset premise is required for the kinetic interpretation."),
    limit:formula(String.raw`\lim_{\beta\to0}\frac{2(\gamma-1)}{\beta^2}=`+fraction(certificate.limit.limit),
    `The two-sided limit of the dimensionless quotient is exactly ${certificate.limit.limit}. The original quotient has no value at beta equal to zero.`)};
}
