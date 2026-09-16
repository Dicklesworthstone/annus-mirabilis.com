import type { OutputContract, ParameterClass } from "../store/instanceStore.ts";
export type Bm05Parameters=Readonly<{ kernel:"coin"|"uniform"|"gaussian"; stepRms:number; tau:number; walkers:number; runSteps:number; n:number; seed:string; bias:number }>;
export const BM05_DEFAULTS:Bm05Parameters=Object.freeze({kernel:"coin",stepRms:.5e-6,tau:.1,walkers:2000,runSteps:400,n:4,seed:"1905",bias:.6});
export const BM05_CLASSES:Readonly<Record<keyof Bm05Parameters,ParameterClass>>=Object.freeze({kernel:"input",stepRms:"input",tau:"input",walkers:"input",runSteps:"input",seed:"input",n:"measurement",bias:"estimator"});
export const BM05_MODEL=Object.freeze({id:"bm05-host-preview-v1",constantSetId:"not-applicable",label:"Synthetic independent steps · ideal model, host calculation"});
export const WALK_TRACE_POINTS=101;
export const BM05_PROMPT=Object.freeze({id:"bm-05-predict-step-shape",question:"After many steps, what will changing the step law while keeping its variance do?",candidates:Object.freeze([
 Object.freeze({candidateId:"two-separate-piles",label:"Keep two separate piles"}),Object.freeze({candidateId:"same-bell-shape",label:"Approach the same bell shape and spread"}),Object.freeze({candidateId:"wider-bell",label:"Make a wider bell despite the same variance"}),
])});
const c=(unit:string,semanticKind:string,ownerId:string,statuses:OutputContract["statuses"]=["value"]):OutputContract=>Object.freeze({unit,semanticKind,ownerId,statuses:Object.freeze([...statuses])});
const law=(unit:string,owner:string,statuses:OutputContract["statuses"]=["value"])=>c(unit,"declared-step-model",`diffusion.${owner}`,statuses);
export const BM05_OUTPUTS:Readonly<Record<string,OutputContract>>=Object.freeze({
 stepMean:law("m","kernelMoments"),stepSecondMoment:law("m2","kernelMoments"),stepFourthMoment:law("m4","kernelMoments"),diffusionCoefficient:law("m2/s","kernelDiffusivity"),
 stepKurtosis:c("1","step-excess-kurtosis","bm05.measure"),sumKurtosis:c("1","sum-excess-kurtosis","bm05.measure",["value","not-applicable"]),
 sampleMean:c("m","sample-coordinate-mean","diffusion.ensembleMoments"),sampleMeanSquare:c("m2","sample-coordinate-second-moment","diffusion.ensembleMoments"),sampleRms:c("m","sample-coordinate-rms","diffusion.ensembleMoments"),
 modelMeanSquare:c("m2","model-coordinate-second-moment","diffusion.randomWalkMoments"),modelRms:c("m","model-coordinate-rms","diffusion.randomWalkMoments"),elapsedTime:c("s","selected-step-time","diffusion.randomWalkMoments"),
 kolmogorovDistance:c("1","sample-cdf-distance-to-gaussian","diffusion.kolmogorovDistanceToGaussian",["value","not-applicable"]),shapeTerm:c("1","kernel-sum-cdf-distance-to-gaussian","diffusion.kolmogorovShapeTerm",["value","not-applicable"]),
 samplingTerm:c("1","dkw-sampling-bound","diffusion.dkwBound"),agreementBound:c("1","shape-plus-sampling-bound","bm05.measure",["value","not-applicable"]),withinBound:c("1","sample-within-declared-bound","bm05.measure",["value","not-applicable"]),
 walkPositions:c("m","synthetic-walk-endpoints","diffusion.recordWalks"),traceTimes:c("s","sampled-trace-times","bm05.measure"),traceDisplacements:c("m","sampled-walk-traces","diffusion.recordWalks"),
 histogramEdges:c("m","step-aligned-bin-edges","bm05.measure"),histogramCounts:c("1","all-walker-bin-counts","diffusion.displacementHistogram"),histogramFrequencies:c("1","all-walker-bin-proportions","diffusion.displacementHistogram"),histogramGaussian:c("1","gaussian-bin-probabilities","diffusion.intervalProbability"),histogramExact:c("1","finite-step-bin-probabilities","bm05.measure"),
 underflow:c("1","sample-underflow-count","diffusion.displacementHistogram"),overflow:c("1","sample-overflow-count","diffusion.displacementHistogram"),
 coinPositions:c("m","exact-coin-support","diffusion.coinWalkDistribution",["value","not-applicable"]),coinProbabilities:c("1","exact-coin-probabilities","diffusion.coinWalkDistribution",["value","not-applicable"]),coinNumerators:c("1","exact-binomial-numerators","diffusion.coinWalkDistribution",["value","not-applicable"]),coinDenominator:c("1","exact-binomial-denominator","diffusion.coinWalkDistribution",["value","not-applicable"]),
 comparisonSteps:c("1","recorded-comparison-steps","bm05.measure"),comparisonSampleMsd:c("m2","sample-second-moment-history","bm05.measure"),comparisonModelMsd:c("m2","model-second-moment-history","bm05.measure"),comparisonDistance:c("1","sample-distance-history","bm05.measure"),comparisonShape:c("1","shape-term-history","bm05.measure"),
 recordingDraws:c("1","logical-realization-draws","diffusion.recordWalks"),requestDraws:c("1","executed-random-draws-this-request","bm05.measure"),replayedDraws:c("1","deterministic-replay-draws","diffusion.observeWalks"),reusedRecording:c("1","recording-reuse-indicator","bm05.measure"),retainedBytes:c("1","private-recording-bytes","bm05.measure"),
 biasedDiffusion:law("m2/s","kernelDiffusivity",["value","outside-domain"]),biasedMean:law("m","kernelMoments"),biasedDrift:law("m/s","kernelDiffusivity"),biasedCenteredDiffusion:law("m2/s","kernelDiffusivity"),
 cauchyDiffusion:law("m2/s","kernelDiffusivity",["outside-domain"]),continuumLimit:law("m2/s","continuumLimit",["outside-domain"]),
 continuumIntervals:c("s","analytic-limit-intervals","bm05.measure"),fixedStepCoefficients:c("m2/s","fixed-step-coefficient-sequence","diffusion.continuumLimit"),fixedRatioSteps:c("m","fixed-diffusion-step-sequence","bm05.measure"),fixedRatioCoefficients:c("m2/s","fixed-ratio-coefficient-sequence","diffusion.continuumLimit"),
});
export function bm05BinCount(p:Bm05Parameters):number {return p.n===0?1:p.kernel==="coin"?Math.min(41,p.n+1):40;}
export function walkComparisonSteps(p:Bm05Parameters):readonly number[] {return [...new Set([4,16,64,400].filter(n=>n<=p.runSteps).concat([Math.min(p.runSteps,400),...(p.n>0?[p.n]:[])]))].sort((a,b)=>a-b);}
export function bm05Layout(id:string,p:Bm05Parameters):number|null {
 if(id==="walkPositions")return p.walkers;
 if(id==="traceTimes")return WALK_TRACE_POINTS;
 if(id==="traceDisplacements")return Math.min(20,p.walkers)*WALK_TRACE_POINTS;
 if(id==="histogramEdges")return bm05BinCount(p)+1;
 if(id.startsWith("histogram"))return bm05BinCount(p);
 if(["coinPositions","coinProbabilities","coinNumerators"].includes(id))return p.n+1;
 if(id.startsWith("comparison"))return walkComparisonSteps(p).length;
 if(["continuumIntervals","fixedStepCoefficients","fixedRatioSteps","fixedRatioCoefficients"].includes(id))return 4;
 return null;
}
