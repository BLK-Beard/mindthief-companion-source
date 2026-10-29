import {itemReserveValue} from '../itemAdvisor.ts';
import type {ItemUse} from '../itemAdvisor';
import {describeTurnChoices} from './turnChoices.ts';
import type {TurnChoices} from './turnChoices';
import {lossOpportunityCost,incrementalLossPayoff,tacticalStateValue,counterfactualPlay} from './lossEconomy.ts';
import {playstyleSetupValue,lossInvestmentReason,situationalLosses,isCombatLoss} from './playstyleStrategy.ts';
import type {LossReserve} from './playstyleStrategy';
import {styleCardRating} from '../mindthiefBuilds.ts';
import {perkCount} from '../mindthiefPerks.ts';
import {startFight,cloneState,plays,step,potential,remainingActionTurns,finishRoundRest} from './engine.ts';
import type {State,Play} from './engine';
import type {BuildCard} from '../mindthiefBuilds';
import type {Config,Effect} from './types';
export type CoachSnapshot={charges?:number;roundActive?:string[];roundActiveSides?:Record<string,'top'|'bottom'>;phase?:'select'|'cleanup'|'long-rest';hand:string[];discard:string[];lost:string[];active:string[];activeSides:Record<string,'top'|'bottom'>;hp:number;round:number;ice:number;dark:number};
export type CoachTurn={itemUses?:ItemUse[];choices?:TurnChoices;action?:Play;restElement?:'Ice'|'Dark'|'none';kind?:'play'|'long-rest'|'short-rest'|'wait';shortRestAfter?:boolean;round:number;top:string;bottom:string;topDefault:boolean;bottomDefault:boolean;initiative:number;order:string;why:string[];notes:string[];hp:number;damage:number;ratDamage:number;movement:number;jumpMovement:number;ice:boolean;dark:boolean;available:string[];lost:string[];active:string[]};
export type CoachSequence={turns:CoachTurn[];score:number;damage:number;ratDamage:number;hp:number};
export type CoachResult={reserves:LossReserve[];sequences:CoachSequence[];evaluated:number;distance:number};
const walk=(effects:Effect[]):Effect[]=>effects.flatMap(e=>[e,...e.kind==='control'||e.kind==='consume'?walk(e.effects):[]]);
function lesson(before:State,after:State,play:Play,cards:BuildCard[],config:Config):string[]{
 const halves=[{side:'top' as const,index:play.top,basic:play.topDefault},{side:'bottom' as const,index:play.bottom,basic:play.bottomDefault}];
 const used=halves.flatMap(h=>h.basic?[]:walk(cards[h.index].simulationModel![h.side].effects));
 const why:string[]=[];
 if((config.playstyle==='Scurry'||config.secondaryPlaystyle==='Scurry')&&after.movement>before.movement)why.push(`Use the action halves for ${after.movement-before.movement} hexes of travel${after.jumpMovement>before.jumpMovement?' with Jump available':''}; combat is secondary.`);
 if(used.some(e=>e.kind==='augment'))why.push('Set up the Augment now for later melee abilities; keep its card active.');
 if(used.some(e=>e.kind==='summon')){
  const rat=after.rats.find(r=>r.born===before.round);
  const nearest=rat?Math.min(...before.enemies.filter(e=>e.wave===before.wave&&e.hp>0).map(e=>Math.abs(e.pos-rat.pos))):0;
  why.push(nearest>=3?'Deploy while there is space to set up; the rat starts acting next round, before you. Verify actual enemy reach.':'Deploy for repeated work starting next round, not an immediate attack. At close range, confirm you can protect it.');
  why.push('The summon loss funds repeated rat turns and granted attacks; preserve other loss cards for later payoffs.');
 }
 if(play.retreat&&used.some(e=>e.kind==='summon'))why.unshift('Use movement to create space before summoning; do not assume enemies stay away afterward.');
 if(used.some(e=>e.kind==='grant'))why.push(after.ratDamage>before.ratDamage?'Convert the living rat’s position into extra actions.':'The summon grant needs a living rat and a reachable target; check its position.');
 if(used.some(e=>e.kind==='infuse'))why.push('Create the element for a later turn; it becomes available after this turn.');
 if(used.some(e=>e.kind==='consume'||e.kind==='attack'&&e.boosts?.length))why.push('Spend an available element only when its linked bonus helps; keep the base action as fallback.');
 if(after.conditionDamage>before.conditionDamage)why.push('Exploit existing negative conditions for extra damage. Conditions added by an attack do not boost that same attack.');
 if(used.some(e=>e.kind==='control'))why.push(used.some(e=>e.kind==='control'&&e.effects.some(a=>a.kind==='move'))?'Only the printed control ability lets you move an enemy; resolve that granted movement.':'Control the printed attack only. Enemies must already be in reach; their normal movement remains automatic.');
 if(after.moved){const first=halves[play.bottomFirst?1:0],moves=!first.basic&&walk(cards[first.index].simulationModel![first.side].effects).some(e=>e.kind==='move');why.push(moves?'Use the first action’s movement to reach the next action’s target.':'Attack or set up first, then use the other action to reposition.');}
 if(used.some(e=>e.kind==='status'&&e.condition==='Invisible'))why.push('Use Invisible to cover exposure; check its printed restrictions and duration.');
 if(halves.some(h=>!h.basic&&cards[h.index].simulationModel![h.side].loss))why.push('This uses a loss action: take the payoff only when it justifies reduced endurance.');
 return [...new Set(why)].slice(0,4);
}
function record(before:State,after:State,play:Play,cards:BuildCard[],config:Config,opposite?:State):CoachTurn{
 const long=play.rest!==undefined;
 const why=long?['Spend this round at initiative 99 to recover cards, choose a loss, and optionally Heal 2 Self.','Check that resting at 99 is safe on the actual board. Your summons still act before your rest.','Heal 2 clears Poison instead of restoring HP when poisoned, and removes Wound. Spent items refresh; recovered usable equipment contributes to the rest comparison.']:lesson(before,after,play,cards,config);
 if(play.shortRest)why.unshift('Short rest at the end of this round: recover tempo without spending the next turn, but lose a random discard and do not heal.');
 if(play.restElement==='none')why.push('Preserve the element for a later Ice/control payoff; the optional rest perk is skipped.');
 else if(play.restElement)why.push('Use the unlocked rest-control perk after resting, consuming '+play.restElement+' before end-of-round waning.');
 return{itemUses:after.itemUses,choices:describeTurnChoices(cards,play,after,opposite),action:{...play},kind:long?'long-rest':'play',shortRestAfter:!!play.shortRest,round:before.round,top:long?'Long rest':cards[play.top].name,bottom:long?cards[play.rest!].name:cards[play.bottom].name,topDefault:play.topDefault,bottomDefault:play.bottomDefault,initiative:play.initiative,order:play.bottomFirst?'Bottom → Top':'Top → Bottom',why,notes:after.notes,hp:after.hp,damage:after.damage-before.damage,ratDamage:after.ratDamage-before.ratDamage,movement:after.movement-before.movement,jumpMovement:after.jumpMovement-before.jumpMovement,ice:after.elements.Ice>0,dark:after.elements.Dark>0,available:cards.filter((_,i)=>after.zones[i]==='hand').map(c=>c.name),lost:cards.filter((_,i)=>after.zones[i]==='lost').map(c=>c.name),active:cards.filter((_,i)=>after.zones[i]==='active').map(c=>c.name)};}
export function restoreCoachState(cards:BuildCard[],config:Config,snapshot?:CoachSnapshot):State{
 const state=startFight(cards,config,config.seed);if(!snapshot)return state;
 state.round=snapshot.round;state.hp=Math.max(0,Math.min(config.hp,snapshot.hp));state.elements={Ice:snapshot.ice,Dark:snapshot.dark};
 state.zones=cards.map(c=>snapshot.hand.includes(c.name)?'hand':snapshot.discard.includes(c.name)?'discard':snapshot.active.includes(c.name)?'active':'lost');
 if(snapshot.phase==='cleanup')cards.forEach((c,i)=>{if(snapshot.roundActive?.includes(c.name)){const side=snapshot.roundActiveSides?.[c.name]??'top';state.zones[i]=c.simulationModel![side].loss?'lost':'discard';}});
 state.active=[];state.rats=[];
 cards.forEach((c,index)=>{if(state.zones[index]!=='active')return;const side=snapshot.activeSides[c.name]??'top',half=c.simulationModel![side];const augment=half.effects.find(e=>e.kind==='augment'),persistent=half.effects.find(e=>e.kind==='persistent');state.active.push({card:index,side,loss:!!half.loss,augment:augment?.kind==='augment'?augment.augment:undefined,effect:persistent?.kind==='persistent'?persistent.effect:undefined});for(const effect of half.effects){if(effect.kind==='summon')state.rats.push({...effect.rat,maxHp:effect.rat.hp,pos:0,source:index,born:state.round-1,status:{}});if(effect.kind==='persistent'&&effect.effect==='charges')state.charges=Math.max(0,Math.min(4,snapshot.charges??0));}});
 return state;
}
function lossHalves(cards:BuildCard[],play:Play){if(play.rest!==undefined)return[];return[{i:play.top,side:'top' as const,basic:play.topDefault},{i:play.bottom,side:'bottom' as const,basic:play.bottomDefault}].filter(h=>!h.basic&&cards[h.i].simulationModel![h.side].loss);}
export function lossJustified(before:State,after:State,_repeatable:State,cards:BuildCard[],play:Play,config:Config,alternative?:(play:Play)=>State|undefined):boolean{
 const losses=lossHalves(cards,play);if(!losses.length)return true;
 if(losses.some(h=>!isCombatLoss(cards[h.i].simulationModel![h.side].effects,!!config.advisorOnly)))return false;
 const clear=after.enemies.every(e=>e.hp<=0)&&after.hp>0;
 return losses.every(h=>{
  const counter=alternative?alternative(counterfactualPlay(play,h.side)):step(before,cards,config,counterfactualPlay(play,h.side),false);if(!counter)return false;
  const effects=cards[h.i].simulationModel![h.side].effects;
  const firstRat=(config.playstyle==='Summons'||config.secondaryPlaystyle==='Summons')&&!before.rats.some(r=>r.hp>0)&&effects.some(e=>e.kind==='summon')&&after.rats.some(r=>r.hp>0);
  const investment=lossInvestmentReason(before,after,cards,effects,config);
  const persistent=effects.some(e=>e.kind==='persistent');
  if(firstRat||persistent&&investment)return true;
  if(after.hp>0&&counter.hp<=0)return true;
  if(clear&&counter.enemies.some(e=>e.hp>0))return true;
  const payoff=incrementalLossPayoff(after,counter,config);
  const cost=lossOpportunityCost(before,after,counter,cards[h.i],h.side,config);
  // A condition payoff still needs an actual prepared target; an unrelated other half
  // cannot justify this loss. Burst intent discounts future value, never target legality.
  return payoff>=Math.max(config.advisorIntent==='burst'?3:5,cost);
 });
}
export function coachScore(state:State,config:Config,cards:BuildCard[]){
 const ratStyle=config.playstyle==='Summons'||config.secondaryPlaystyle==='Summons';
 const rats=state.rats.filter(r=>r.hp>0),rat=rats.sort((a,b)=>(b.king?Math.ceil(b.hp/2):b.attack)-(a.king?Math.ceil(a.hp/2):a.attack))[0];
 // One rat is a persistent engine, rather than a burst loss. Credit its conditional future work
 // without predicting enemy actions or rewarding additional summon losses indiscriminately.
 const ratEngine=ratStyle&&rat?Math.min(5,remainingActionTurns(state))*(rat.king?Math.ceil(rat.hp/2):rat.attack)+Math.min(3,cards.filter(c=>state.zones[cards.indexOf(c)]!=='lost'&&c.simulationModel&&walk([...c.simulationModel.top.effects,...c.simulationModel.bottom.effects]).some(e=>e.kind==='grant')).length)*2:0;
 const deploymentSpace=ratStyle&&rat&&rat.born===state.round-1?Math.min(3,Math.min(...state.enemies.filter(e=>e.wave===state.wave&&e.hp>0).map(e=>Math.abs(e.pos-rat.pos)),3))*1.5:0;
 const ready=cards.filter((_,i)=>state.zones[i]==='hand').map(c=>styleCardRating(c,config.playstyle??'Melee')+(config.secondaryPlaystyle?styleCardRating(c,config.secondaryPlaystyle):0)).sort((a,b)=>b-a).slice(0,2).reduce((a,b)=>a+b,0)*0.2;
 const mobilityWeight=config.playstyle==='Scurry'?(config.secondaryPlaystyle?0.5:1):config.secondaryPlaystyle==='Scurry'?0.5:0;
 return itemReserveValue(state.items,config.advisorIntent)+potential(state,config)+tacticalStateValue(state,config)+ready+ratEngine+deploymentSpace+playstyleSetupValue(state,cards,config)-state.damage*1.6*mobilityWeight;
}
function restElements(state:State,config:Config):('Ice'|'Dark'|'none'|undefined)[]{return perkCount(config.perks??{},'restControl')?['none',...state.elements.Ice>0?['Ice' as const]:[],...state.elements.Dark>0?['Dark' as const]:[]]:[undefined];}
export function teachTurns(cards:BuildCard[],config:Config,distance=3,turns=3,snapshot?:CoachSnapshot):CoachResult{
 config={...config,advisorOnly:true,allyCount:0,advisorIntent:config.advisorIntent??'defensive',perks:config.perks??{}};
 const initial=restoreCoachState(cards,config,snapshot);for(const e of initial.enemies)e.pos=distance+(e.pos-3);
 type Candidate={state:State;turns:CoachTurn[];score:number;opening:string};
 let beam:Candidate[]=[{state:initial,turns:[],score:coachScore(initial,config,cards),opening:''}],evaluated=0;
 if(snapshot?.phase==='cleanup'){
  beam=[];const canShort=initial.zones.filter(z=>z==='discard').length>=2;
  for(const short of canShort?[false,true]:[false])for(const element of short?restElements(initial,config):[undefined]){
   const state=finishRoundRest(initial,short,false,element);const row:CoachTurn={restElement:element,kind:short?'short-rest':'wait',round:initial.round,top:'',bottom:'',topDefault:false,bottomDefault:false,initiative:0,order:'End of round',why:short?['Short rest now, before elements wane: lose a random discard, recover the rest, and keep next turn available.','No healing. You may suffer 1 damage once to redraw the random loss; protect a core combo only if the HP cost is safe.']:['Do not rest yet: keep endurance and existing cards available. Long rest remains an option next round if eligible.'],notes:state.notes,hp:state.hp,damage:state.damage-initial.damage,ratDamage:state.ratDamage-initial.ratDamage,movement:0,jumpMovement:0,ice:state.elements.Ice>0,dark:state.elements.Dark>0,available:cards.filter((_,i)=>state.zones[i]==='hand').map(c=>c.name),lost:cards.filter((_,i)=>state.zones[i]==='lost').map(c=>c.name),active:cards.filter((_,i)=>state.zones[i]==='active').map(c=>c.name)};
   if(element==='none')row.why.push('Keep Ice/Dark for your next turn rather than spending it on the optional rest perk.');else if(element)row.why.push('Consume '+element+' for the unlocked rest-control perk before the element wanes.');
   beam.push({state,turns:[row],score:coachScore(state,config,cards),opening:short?'short-rest':'wait'});
  }
 }

 for(let round=0;round<Math.min(3,Math.max(2,turns));round++){
  const next:Candidate[]=[];
  for(const candidate of beam){
   if(candidate.state.hp<=0||candidate.state.exhausted||candidate.state.enemies.every(e=>e.hp<=0)){next.push(candidate);continue;}
   const ready=cloneState(candidate.state);
   const options=plays(ready,cards,config).flatMap(play=>play.rest!==undefined?restElements(ready,config).map(restElement=>({...play,restElement})): [play,...ready.zones.filter(z=>z==='hand').length<=4||ready.zones.filter(z=>z==='discard').length>=4?restElements(ready,config).map(restElement=>({...play,shortRest:true,restElement})):[]]);
   const tested:{play:Play;state:State}[]=[];
   for(const play of options){
    if(evaluated>=5000)break;
    const state=step(ready,cards,config,play,false);evaluated++;
    tested.push({play,state});
   }
   const alternatives=new Map(tested.map(t=>[JSON.stringify(t.play),t.state]));
   const alternative=(p:Play)=>{const key=JSON.stringify(p),cached=alternatives.get(key);if(cached)return cached;if(evaluated>=5000)return undefined;const state=step(ready,cards,config,p,false);evaluated++;alternatives.set(key,state);return state;};
   const repeatable=tested.filter(t=>!lossHalves(cards,t.play).length).sort((a,b)=>potential(b.state,config)-potential(a.state,config))[0];
   for(const {play,state} of tested){
    if(repeatable&&!lossJustified(ready,state,repeatable.state,cards,play,config,alternative))continue;
    if(repeatable&&repeatable.state.hp>0&&state.hp<=0)continue;
    const opposite=alternatives.get(JSON.stringify({...play,bottomFirst:!play.bottomFirst}));
    const turn=record(ready,state,play,cards,config,opposite);
    if(play.shortRest&&!state.notes.includes('Short rest: random discard loss'))continue;
    const investments=lossHalves(cards,play).map(h=>lossInvestmentReason(ready,state,cards,cards[h.i].simulationModel![h.side].effects,config)).filter((r):r is string=>!!r);
    if(investments.length)turn.why.unshift(...new Set(investments));
    else if(lossHalves(cards,play).length)turn.why.unshift('Commit the loss only for this decisive payoff, survival need, or rat setup; otherwise use the default half.');
    const opening=candidate.opening||(play.rest!==undefined?'long-rest':`${play.top}:${play.bottom}:${play.topDefault}:${play.bottomDefault}:${!!play.shortRest}`);
    next.push({state,turns:[...candidate.turns,turn],score:coachScore(state,config,cards),opening});
   }
  }
  if(!next.length)break;
  const perOpening=new Map<string,number>();
  const ranked=next.sort((a,b)=>b.score-a.score).filter(c=>{const n=perOpening.get(c.opening)??0;if(n>=2)return false;perOpening.set(c.opening,n+1);return true;});
  beam=ranked.slice(0,6);
  if((config.playstyle==='Summons'||config.secondaryPlaystyle==='Summons')&&!initial.rats.some(r=>r.hp>0)){
   const setup=ranked.filter(c=>c.state.rats.some(r=>r.hp>0)).slice(0,2);
   for(const c of setup)if(!beam.includes(c)){beam.pop();beam.unshift(c);}
  }
  if(config.playstyle==='Melee'||config.secondaryPlaystyle==='Melee'){
   const setup=ranked.find(c=>c.state.charges>0&&playstyleSetupValue(c.state,cards,config)>playstyleSetupValue(initial,cards,config));
   if(setup&&!beam.includes(setup)){beam.pop();beam.push(setup);}
  }
 }
 const openings=new Set<string>();
 const sequences=beam.sort((a,b)=>b.score-a.score).filter(c=>c.turns.length&&!openings.has(c.opening)&&!!openings.add(c.opening)).slice(0,3).map(c=>({turns:c.turns,score:c.score,damage:c.state.damage,ratDamage:c.state.ratDamage,hp:c.state.hp}));
 return{sequences,evaluated,distance,reserves:situationalLosses(cards,initial,config)};
}

