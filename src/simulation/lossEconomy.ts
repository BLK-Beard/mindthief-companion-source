import type {BuildCard} from '../mindthiefBuilds';
import type {State,Play} from './engine';
import {remainingActionTurns} from './engine.ts';
import type {Config,Effect} from './types';
const own=(effects:Effect[]):Effect[]=>effects.flatMap(e=>[e,...e.kind==='consume'?own(e.effects):[]]);
/** Value of losing the repeatable other half; deliberately excludes imagined enemy turns. */
export function lossOpportunityCost(before:State,after:State,counter:State,card:BuildCard,lostSide:'top'|'bottom',config:Config):number{
 const other=card.simulationModel![lostSide==='top'?'bottom':'top'];
 const mobility=config.playstyle==='Scurry'&&!config.secondaryPlaystyle;
 const rat=before.rats.find(r=>r.hp>0),feedback=before.active.some(a=>a.augment==='feedback');
 let utility=0;
 if(!other.loss&&!other.active)for(const e of own(other.effects)){
  if(e.kind==='attack'&&!mobility)utility+=Math.max(0,e.amount)*Math.min(2,e.targets??1)+(feedback&&rat&&e.range===undefined?(rat.king?Math.ceil(rat.hp/2):rat.attack):0);
  if(e.kind==='move')utility+=e.amount*(mobility?1.1:0.35)+(e.jump?0.5:0);
  if(e.kind==='infuse')utility+=1;
  if(e.kind==='heal')utility+=e.amount*(before.hp<before.maxHp?0.8:0.25);
 }
 const cycling=counter.zones.filter(z=>z==='hand'||z==='discard').length;
 const uses=Math.min(3,Math.max(1,Math.ceil(remainingActionTurns(counter)/Math.max(1,cycling/2))));
 const turnsLost=Math.max(0,remainingActionTurns(counter)-remainingActionTurns(after));
 const burst=config.advisorIntent==='burst',defensive=(config.advisorIntent??'defensive')==='defensive';
 return uses*utility*(burst?0.3:defensive?0.75:0.6)+turnsLost*(burst?0.4:defensive?1:0.8);
}
export function incrementalLossPayoff(after:State,counter:State,config:Config):number{
 const mobility=config.playstyle==='Scurry'&&!config.secondaryPlaystyle;
 const control=(s:State)=>s.enemies.filter(e=>e.hp>0&&(e.status.Stun!==undefined||e.status.Disarm!==undefined||e.status.Immobilize!==undefined)).length;
 return Math.max(0,after.damage-counter.damage)*(mobility?0.15:1)+Math.max(0,after.movement-counter.movement)*(mobility?2:0.35)+Math.max(0,after.hp-counter.hp)*2+Math.max(0,control(after)-control(counter))*1.5+Math.max(0,after.elements.Ice-counter.elements.Ice)+Math.max(0,after.conditionDamage-counter.conditionDamage)*0.3;
}
export function tacticalStateValue(state:State,config:Config){
 const intent=config.advisorIntent??'defensive';
 const mobility=config.playstyle==='Scurry'&&!config.secondaryPlaystyle;
 const damage=mobility?state.movement:state.damage;
 return intent==='burst'?state.hp+remainingActionTurns(state)*0.5+damage*0.8:intent==='offensive'?state.hp*2+remainingActionTurns(state)*1.5+damage*0.25:state.hp*3+remainingActionTurns(state)*2;
}
export function counterfactualPlay(play:Play,side:'top'|'bottom'):Play{return{...play,...side==='top'?{topDefault:true}:{bottomDefault:true}};}
