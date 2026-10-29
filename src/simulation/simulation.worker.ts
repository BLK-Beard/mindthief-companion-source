/// <reference lib="webworker" />
import {recommendedHand} from '../mindthiefBuilds';
import {assessHand,swapSupportsHand} from '../buildContext';
import type {PerkSelections} from '../mindthiefPerks';
import {recommendedHybridHand,hybridSwapAllowed} from '../hybridBuilds';
import type {BuildCard,Style} from '../mindthiefBuilds';
import {simulateFight} from './engine';
import {compare,summarize} from './statistics';
import type {Config,FightResult,SimulationResult,SimSwap} from './types';
type Request={cards:BuildCard[];available:BuildCard[];style:Style;config:Config};
function matches(cards:BuildCard[],style:Style,perks:PerkSelections={}){
 const context=assessHand(cards,style,perks);return context.coreMissing.length===0&&context.orphaned.length===0;
}
self.onmessage=(event:MessageEvent<Request>)=>{
 const {cards,available,style}=event.data;
 const config:Config={...event.data.config,playstyle:style,runs:Math.min(400,Math.max(16,event.data.config.runs))};
 const progress=(message:string,completed:number,total:number)=>self.postMessage({type:'progress',message,completed,total});
 let strategyCount=0;
 try{
  const evaluate=(hand:BuildCard[],settings:Config,runs:number,depth:number,label:string)=>{
   const results:FightResult[]=[];
   for(let i=0;i<runs;i++){results.push(simulateFight(hand,settings,settings.seed+i,depth));if(i%16===0)progress(label,i,runs);}
   return results;
  };
  const optimizeAugments=(hand:BuildCard[],label:string)=>{
   const augments=hand.filter(c=>c.augment).map(c=>c.name);
   const plans:(string[]|undefined)[]=augments.length?[undefined,[],...augments.map(a=>[a])]:[[]];
   if(hand.some(c=>c.name==='domination'))for(let i=0;i<augments.length;i++)for(let j=i+1;j<augments.length;j++)plans.push([augments[i],augments[j]]);
   strategyCount+=plans.length;
   const pilots=plans.map((plan,i)=>{
    progress(`Testing Augment strategies · ${label}`,i,plans.length);
    const settings={...config,augmentPlan:plan};
    const results=Array.from({length:8},(_,seed)=>simulateFight(hand,settings,config.seed+seed,1));
    return{settings,value:summarize(results).score};
   }).sort((a,b)=>b.value-a.value).slice(0,2);
   let bestResults:FightResult[]=[],bestSettings=config,bestScore=-Infinity;
   for(const candidate of pilots){
    const results=evaluate(hand,candidate.settings,config.runs,2,`Simulating ${label} · ${candidate.settings.augmentPlan?.join(' + ')||'adaptive/no Augment'}`);
    const score=summarize(results).score;if(score>bestScore){bestScore=score;bestResults=results;bestSettings=candidate.settings;}
   }
   return{results:bestResults,settings:bestSettings};
  };
  const current=optimizeAugments(cards,'current hand');
  const baseline=current.results;
  const secondary=config.secondaryPlaystyle;
  const fits=(hand:BuildCard[])=>matches(hand,style,config.perks)&&(!secondary||matches(hand,secondary,config.perks));
  const preservesCoverage=(hand:BuildCard[])=>[style,...secondary?[secondary]:[]].every(s=>{const before=assessHand(cards,s,config.perks),after=assessHand(hand,s,config.perks);return after.moves>=Math.min(3,before.moves)&&after.fast>=Math.min(2,before.fast)&&after.defense>=Math.min(1,before.defense);});
  const proposed=secondary?recommendedHybridHand(available,style,secondary,config.perks):recommendedHand(available,style,config.perks);
  let bestCards=cards,bestComparison=compare(baseline,baseline),bestSettings=current.settings;
  if(fits(proposed)&&preservesCoverage(proposed)&&proposed.map(c=>c.name).sort().join('|')!==cards.map(c=>c.name).sort().join('|')){
   const candidate=optimizeAugments(proposed,'playstyle hand');
   const comparison=compare(candidate.results,baseline);if(comparison.delta>Math.max(0.01,comparison.deltaMargin)){bestCards=proposed;bestComparison=comparison;bestSettings=candidate.settings;}
  }
  const coarseBase=evaluate(cards,config,4,1,'Screening possible swaps');
  const coarse:{out:string;into:string;cards:BuildCard[];gain:number}[]=[];
  const outside=available.filter(c=>!cards.some(current=>current.name===c.name));
  let tested=0;const total=outside.length*cards.length;
  for(const into of outside)for(const out of cards){
   const trial=cards.map(c=>c.name===out.name?into:c);
   if(fits(trial)&&(secondary?hybridSwapAllowed(cards,out,into,style,secondary,config.perks):swapSupportsHand(cards,out,into,style,config.perks))){
    const sampled=Array.from({length:4},(_,i)=>simulateFight(trial,config,config.seed+i,1));
    coarse.push({out:out.name,into:into.name,cards:trial,gain:compare(sampled,coarseBase).delta});
   }
   tested++;if(tested%10===0)progress('Screening playstyle-compatible swaps',tested,total);
  }
  const shortlist=coarse.sort((a,b)=>b.gain-a.gain).filter((s,i,arr)=>arr.findIndex(x=>x.into===s.into)===i).slice(0,4);
  const swaps:SimSwap[]=[];
  for(const candidate of shortlist){
   const optimized=optimizeAugments(candidate.cards,candidate.into);
   const comparison=compare(optimized.results,baseline);
   const robust=comparison.delta>Math.max(0.01,comparison.deltaMargin);
   const balanced=comparison.summary.survival>=summarize(baseline).survival-0.05&&comparison.summary.exhaustion<=summarize(baseline).exhaustion+0.1||comparison.winDelta>0.1;
   if(robust&&balanced)swaps.push({out:candidate.out,into:candidate.into,comparison});
   if(robust&&balanced&&comparison.delta>bestComparison.delta){bestCards=candidate.cards;bestComparison=comparison;bestSettings=optimized.settings;}
  }
  const ordered=baseline.map((r,i)=>({score:r.score,i})).sort((a,b)=>a.score-b.score);
  const seed=config.seed+ordered[Math.floor(ordered.length/2)].i;
  const result:SimulationResult={baseline:summarize(baseline),recommended:bestComparison,recommendedNames:bestCards.map(c=>c.name),swaps:swaps.sort((a,b)=>b.comparison.delta-a.comparison.delta).slice(0,3),plan:simulateFight(cards,current.settings,seed,2,true).plan,recommendedPlan:simulateFight(bestCards,bestSettings,seed,2,true).plan,config,testedSwaps:coarse.length,supportedCards:available.filter(c=>c.simulationModel).length,currentAugments:current.settings.augmentPlan??null,recommendedAugments:bestSettings.augmentPlan??null,augmentStrategiesTested:strategyCount};
  self.postMessage({type:'result',result});
 }catch(error){self.postMessage({type:'error',message:error instanceof Error?error.message:'Simulation failed'});}
};
