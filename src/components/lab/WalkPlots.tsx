import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import type { Bm05Parameters } from "../../experiments/bm05/definition.ts";
import { array,display,identity,scalar } from "./presentation.ts";
export function WalkPaths({snapshot}:{snapshot:AcceptedSnapshot}) {
 const p=snapshot.parameters as Bm05Parameters,times=array(snapshot,"traceTimes"),traces=array(snapshot,"traceDisplacements"),length=times.length;
 let extent=0;for(let i=0;i<traces.length;i++)extent=Math.max(extent,Math.abs(traces.at(i)));extent||=p.stepRms;
 const last=times.at(length-1),x=(i:number)=>38+(last===0?0:times.at(i)/last*232),y=(v:number)=>122-v/extent*82;
 return <figure className="plot" {...identity(snapshot)}><svg viewBox="0 0 300 255" role="img" aria-label="The first twenty recorded walks, or all walks when fewer than twenty are requested. Time is horizontal and signed displacement is vertical. The statistics include every walker.">
  <path d="M38 35V210H270M38 122H270" className="axis"/>
  {Array.from({length:traces.length/length},(_,i)=><path key={i} d={Array.from({length},(_,j)=>`${j?'L':'M'}${x(j)},${y(traces.at(i*length+j))}`).join(' ')} className="walk-trace"/>)}
  {p.n===0&&<circle cx="38" cy="122" r="4" className="histogram-bar"/>}
  <text x="38" y="20">Signed displacement (μm)</text><text x="4" y="42">{display(extent,1e6)}</text><text x="17" y="126">0</text><text x="38" y="232">0 s</text><text x="215" y="232">{display(last)} s</text>
 </svg><figcaption>{p.n===0?'No steps yet: every walker is at the starting point.':`The first ${Math.min(20,p.walkers)} paths, sampled at at most 101 times for drawing.`} Joining recorded points does not model motion between jumps. These are mathematical walks, not observed molecular collisions.</figcaption></figure>;
}
export function WalkHistogram({snapshot}:{snapshot:AcceptedSnapshot}) {
 const p=snapshot.parameters as Bm05Parameters,edges=array(snapshot,"histogramEdges"),observed=array(snapshot,"histogramFrequencies"),exact=array(snapshot,"histogramExact"),gaussian=array(snapshot,"histogramGaussian");
 const maximum=Math.max(...observed.copy(),...exact.copy(),...gaussian.copy(),.001),count=observed.length,x=(i:number)=>38+i/count*232,y=(v:number)=>207-v/maximum*165;
 return <figure className="plot" {...identity(snapshot)}><svg viewBox="0 0 300 255" role="img" aria-label={p.n===0?"All probability is at zero before any steps. No Gaussian curve is drawn.":"Solid bars show the sampled fraction in each bin; short horizontal marks show the finite-step law; the dashed line shows Gaussian probabilities for the same bins."}>
  <path d="M38 35V207H270" className="axis"/>
  {Array.from({length:count},(_,i)=><g key={i}><rect x={x(i)} y={y(observed.at(i))} width={232/count-1} height={207-y(observed.at(i))} className="histogram-bar"/><path d={`M${x(i)+1} ${y(exact.at(i))}H${x(i+1)-1}`} className="walk-exact"/></g>)}
  {p.n>0&&<path d={Array.from({length:count},(_,i)=>`${i?'L':'M'}${x(i+.5)},${y(gaussian.at(i))}`).join(' ')} className="comparison-curve"/>}
  <text x="38" y="20">Fraction in each bin</text><text x="5" y="44">{display(maximum)}</text><text x="38" y="230">{display(edges.at(0),1e6)} μm</text><text x="210" y="230">{display(edges.at(count),1e6)} μm</text>
 </svg><figcaption>Solid bars: all {p.walkers} synthetic endpoints. Short solid marks: the finite-step law. {p.n>0?'Dashed: Gaussian probabilities over exactly the same bins, not a density curve.':'The single bar contains the point mass at zero, not a finite density.'} Outside the bins: {scalar(snapshot,"underflow")} left, {scalar(snapshot,"overflow")} right; these walkers remain in every statistic.</figcaption></figure>;
}
export function WalkConvergence({snapshot}:{snapshot:AcceptedSnapshot}) {
 const ns=array(snapshot,"comparisonSteps"),sample=array(snapshot,"comparisonDistance"),shape=array(snapshot,"comparisonShape"),msd=array(snapshot,"comparisonSampleMsd"),model=array(snapshot,"comparisonModelMsd");
 const last=ns.at(ns.length-1),maximum=Math.max(...sample.copy(),...shape.copy(),.001),x=(n:number)=>38+Math.log(n)/Math.log(Math.max(2,last))*232,y=(v:number)=>204-v/maximum*165;
 const path=(a:ReturnType<typeof array>)=>Array.from({length:a.length},(_,i)=>`${i?'L':'M'}${x(ns.at(i))},${y(a.at(i))}`).join(' ');
 return <section {...identity(snapshot)}><h3>What remains different after many steps?</h3><figure className="plot"><svg viewBox="0 0 300 250" role="img" aria-label="Distance from the Gaussian cumulative distribution across recorded step counts. The horizontal step-count axis is logarithmic. Solid is the synthetic sample; dashed is the finite-step law. The following table supplies all values."><path d="M38 35V204H270" className="axis"/><path d={path(sample)} className="curve"/><path d={path(shape)} className="comparison-curve"/>{Array.from({length:ns.length},(_,i)=><circle key={i} cx={x(ns.at(i))} cy={y(sample.at(i))} r="3" className="histogram-bar"/>)}<text x="38" y="20">Cumulative-probability gap</text><text x="4" y="44">{display(maximum)}</text><text x="38" y="228">1 step</text><text x="202" y="228">{last} steps</text></svg><figcaption>Solid: this sample’s largest cumulative-probability gap from the Gaussian. Dashed: the finite-step law’s gap. The step axis is logarithmic. Lines only join the evaluated step counts; fluctuations in a finite sample need not decrease at every observation.</figcaption></figure>
  <div className="table-scroll" tabIndex={0} role="region" aria-label="Step comparison table"><table><caption>Same recorded trial: shape and spread at each comparison</caption><thead><tr><th scope="col">Steps</th><th scope="col">Sample gap</th><th scope="col">Law gap</th><th scope="col">Sample mean square (μm²)</th><th scope="col">Model mean square (μm²)</th></tr></thead><tbody>{Array.from({length:ns.length},(_,i)=><tr key={i}><th scope="row">{ns.at(i)}</th><td>{display(sample.at(i))}</td><td>{display(shape.at(i))}</td><td>{display(msd.at(i),1e12)}</td><td>{display(model.at(i),1e12)}</td></tr>)}</tbody></table></div>
 </section>;
}
