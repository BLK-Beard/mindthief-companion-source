import type {BuildCard} from '../mindthiefBuilds';
import {cloneState,finishRoundRest,step} from './engine.ts';
import {coachScore,restoreCoachState} from './turnCoach.ts';
import type {CoachResult,CoachSnapshot,CoachSequence} from './turnCoach';
import type {Config} from './types';
export type ChallengeSummary={cases:number;meanGain:number;worstGain:number;complete:number};
function validRest(state:ReturnType<typeof restoreCoachState>,index:number){return state.zones[index]==='discard'||state.active.some(a=>a.card===index&&!a.loss);}
/** Paired, bounded own-action probes. No monster/ally turns, new cards, or perk unlocks. */
export function challengeSequence(sequence:CoachSequence,cards:BuildCard[],config:Config,distance:number,snapshot?:CoachSnapshot):ChallengeSummary{
 const gains:number[]=[];let complete=0;
 const settings={...config,advisorOnly:true,allyCount:0};
 for(let trial=0;trial<8;trial++){
  const testConfig={...settings,seed:config.seed+trial*97,encounter:trial%4===1?'armor' as const:trial%4===2?'mixed' as const:'rooms' as const};
  let state=restoreCoachState(cards,testConfig,snapshot);
  const spacing=trial%4===3?2:1,offset=[0,0,1,-1,0,1,0,0][trial];
  for(const e of state.enemies){e.pos=Math.max(1,distance+offset)+(e.pos-3)*spacing;if(trial>=4){e.hp+=2;e.maxHp+=2;}}
  const initial=cloneState(state),base=coachScore(initial,testConfig,cards);let finished=true;
  for(const turn of sequence.turns){
   if(state.hp<=0||state.exhausted){finished=false;break;}
   if(turn.kind==='short-rest'||turn.kind==='wait'){
    if(turn.kind==='short-rest'&&state.zones.filter(z=>z==='discard').length<2){finished=false;break;}
    state=finishRoundRest(state,turn.kind==='short-rest',true,turn.restElement);continue;
   }
   const action=turn.action;if(!action){finished=false;break;}
   if(action.rest!==undefined){
    const eligible=state.zones.filter(z=>z==='discard').length+state.active.filter(a=>!a.loss).length;
    if(eligible<2||!validRest(state,action.rest)){finished=false;break;}
   }else if(action.top===action.bottom||state.zones[action.top]!=='hand'||state.zones[action.bottom]!=='hand'){finished=false;break;}
   state=step(state,cards,testConfig,action,true);
  }
  if(finished)complete++;
  gains.push(coachScore(state,testConfig,cards)-base-(finished?0:8));
 }
 return{cases:8,meanGain:gains.reduce((a,b)=>a+b,0)/gains.length,worstGain:Math.min(...gains),complete};
}
export function challengeAdvice(result:CoachResult,cards:BuildCard[],config:Config,snapshot?:CoachSnapshot):CoachResult{
 const worstWeight=(config.advisorIntent??'defensive')==='defensive'?0.45:config.advisorIntent==='burst'?0.15:0.3;
 const ranked=result.sequences.map((sequence,index)=>{const test=challengeSequence(sequence,cards,config,result.distance,snapshot);return{sequence,index,score:test.meanGain*(1-worstWeight)+test.worstGain*worstWeight};}).sort((a,b)=>b.score-a.score||a.index-b.index);
 return{...result,sequences:ranked.map(r=>r.sequence)};
}
