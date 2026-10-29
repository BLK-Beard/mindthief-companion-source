import type {Comparison,FightResult,Summary} from './types';
export function mean(values:number[]){return values.reduce((v,n)=>v+n,0)/Math.max(1,values.length);}
export function margin(values:number[]){if(values.length<2)return 0;const m=mean(values);return 1.96*Math.sqrt(values.reduce((v,n)=>v+(n-m)**2,0)/(values.length-1)/values.length);}
export function summarize(results:FightResult[]):Summary{
 const wins=results.map(r=>Number(r.win));
 return{winRate:mean(wins),winMargin:margin(wins),survival:mean(results.map(r=>Number(r.survived))),damage:mean(results.map(r=>r.damage)),summonDamage:mean(results.map(r=>r.summonDamage)),controlledDamage:mean(results.map(r=>r.controlledDamage)),conditionDamage:mean(results.map(r=>r.conditionDamage)),iceUses:mean(results.map(r=>r.iceUses)),mobileTurns:mean(results.map(r=>r.mobileTurns)),movement:mean(results.map(r=>r.movement)),rounds:mean(results.map(r=>r.rounds)),hp:mean(results.map(r=>r.hp)),exhaustion:mean(results.map(r=>Number(r.exhausted))),score:mean(results.map(r=>r.score)),runs:results.length};
}
export function compare(results:FightResult[],baseline:FightResult[]):Comparison{
 if(results.length!==baseline.length)throw new Error('Paired comparisons require matching seeds and sample counts.');
 const differences=results.map((r,i)=>r.score-baseline[i].score),wins=results.map((r,i)=>Number(r.win)-Number(baseline[i].win));
 return{summary:summarize(results),delta:mean(differences),deltaMargin:margin(differences),winDelta:mean(wins),winDeltaMargin:margin(wins)};
}
