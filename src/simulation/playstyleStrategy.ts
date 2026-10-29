import type {BuildCard,Style} from '../mindthiefBuilds';
import {cardRoles} from '../buildContext.ts';
import type {State} from './engine';
import {remainingActionTurns} from './engine.ts';
import type {Config,Effect} from './types';
const chosen=(config:Config,style:Style)=>config.playstyle===style||config.secondaryPlaystyle===style;
const ownEffects=(effects:Effect[]):Effect[]=>effects.flatMap(e=>[e,...e.kind==='consume'?ownEffects(e.effects):[]]);
const cycling=(cards:BuildCard[],state:State)=>cards.filter((_,i)=>state.zones[i]==='hand'||state.zones[i]==='discard');
export function playstyleSetupValue(state:State,cards:BuildCard[],config:Config):number{
 const cycle=cycling(cards,state),roles=cycle.map(cardRoles),augments=state.active.flatMap(a=>a.augment?[a.augment]:[]);
 const melee=roles.filter(r=>r.attack).length,conditions=roles.some(r=>r.conditions)||augments.includes('withering'),payoff=roles.some(r=>r.payoff)||augments.includes('projection');
 const future=Math.min(4,remainingActionTurns(state));let value=0;
 if(chosen(config,'Melee')){
  if(conditions&&payoff)value+=6;
  if(augments.includes('withering')&&payoff)value+=5;
  if(augments.includes('projection')&&conditions)value+=5;
 }
 if(chosen(config,'Ice')){
  const sources=roles.filter(r=>r.ice).length,consumers=roles.filter(r=>r.consumeIce).length;
  if(sources&&consumers)value+=6;
  if(state.elements.Ice>0&&cycle.some((c)=>state.zones[cards.indexOf(c)]==='hand'&&cardRoles(c).consumeIce))value+=3;
 }
 if(chosen(config,'Control')){
  const controls=roles.filter(r=>r.control).length;
  if(augments.includes('killer')&&melee)value+=6+Math.min(2,controls)*2;
  if(controls>=2)value+=3;
 }
 if(chosen(config,'Scurry')){
  if(roles.filter(r=>r.move).length>=2)value+=4;
  value+=state.movement*2+state.jumpMovement*0.2;
 }
 // The charge loss earns its value through usable attacks, never merely through its Move 4.
 if(chosen(config,'Melee')&&state.charges>0&&melee>=2){const synergy=payoff?1:0;value+=Math.min(state.charges,melee*2,future)* (2+synergy);}
 const rats=state.rats.filter(r=>r.hp>0);
 if(chosen(config,'Summons')&&rats.length&&state.active.some(a=>a.effect==='sharing')){
  const transferable=augments.filter(a=>a!=='feedback'||rats.length>=2);
  value+=Math.min(future,3)*Math.min(2,transferable.length)*2;
 }
 return value;
}
export function lossInvestmentReason(before:State,after:State,cards:BuildCard[],effects:Effect[],config:Config):string|null{
 const cycle=cycling(cards,after),future=remainingActionTurns(after);
 const ownAttacks=cycle.filter(c=>cardRoles(c).attack).length;
 if(effects.some(e=>e.kind==='persistent'&&e.effect==='charges')&&future>=3&&ownAttacks>=2&&chosen(config,'Melee')){
  return 'Invest in four later melee attacks with Stun and Curse; keep enough attacks to use the charges. Move 4 alone does not justify this loss.';
 }
 if(effects.some(e=>e.kind==='persistent'&&e.effect==='sharing')&&chosen(config,'Summons')&&after.rats.some(r=>r.hp>0)&&after.active.some(a=>a.augment&&a.augment!=='feedback')){
  return 'Share a useful active Augment with the first qualifying rat attack each round; keep the rat alive to repay this loss.';
 }
 const statusCount=(state:State)=>state.enemies.filter(e=>e.hp>0&&(e.status.Stun!==undefined||e.status.Immobilize!==undefined)).length;
 if(chosen(config,'Ice')&&after.elements.Ice>before.elements.Ice&&statusCount(after)>statusCount(before)&&cycle.some(c=>cardRoles(c).consumeIce)&&after.damage>before.damage){
  return 'This loss combines a landed control effect, damage, and Ice for a later payoff; preserve the card’s repeatable half otherwise.';
 }
 const attacks=ownEffects(effects).filter(e=>e.kind==='attack');
 if(chosen(config,'Melee')&&attacks.some(e=>e.kind==='attack'&&e.perCondition)&&after.conditionDamage-before.conditionDamage>=4){
  return 'Cash in several existing negative conditions for the loss attack; keep it until that setup is in place.';
 }
 if(chosen(config,'Scurry')&&after.movement-before.movement>=7&&effects.some(e=>e.kind==='move'&&e.amount>=4)){
  return 'Use this loss only when the extra travel is needed now; favor repeatable movement for ordinary turns.';
 }
 return null;
}
export type LossReserve={card:string;side:'top'|'bottom';reason:string};
export function situationalLosses(cards:BuildCard[],state:State,config:Config):LossReserve[]{
 const result:LossReserve[]=[];
 for(const [i,c] of cards.entries()){if(state.zones[i]==='active'&&state.active.some(a=>a.card===i&&a.effect==='charges')&&state.charges===0){result.push({card:c.name,side:'bottom',reason:'Remaining charges are not recorded; verify them on the card. This advisor does not assume four unused charges.'});continue;}if(state.zones[i]!=='hand')continue;for(const side of ['top','bottom'] as const){const half=c.simulationModel![side];if(!half.loss)continue;
  const e=half.effects;let reason='';
  if(chosen(config,'Control')&&e.some(a=>a.kind==='takeover'))reason='Use only after seeing an enemy ability worth controlling. Its turn is not predicted here.';
  else if(chosen(config,'Melee')&&e.some(a=>a.kind==='attack'&&a.perCondition))reason='Build several negative conditions first, then cash them in. Keep its other half available until then.';
  else if(chosen(config,'Ice')&&e.some(a=>a.kind==='infuse'))reason='Commit when the full attack/control sequence matters. Ice alone rarely repays losing a repeatable source.';
  else if(chosen(config,'Scurry')&&e.some(a=>a.kind==='loot'))reason='A scenario or loot objective may justify this loss; ordinary travel does not.';
  else if(chosen(config,'Summons')&&e.some(a=>a.kind==='persistent'&&a.effect==='sharing'))reason='Requires a living rat and a useful active Augment. Share only with the first qualifying ally each round.';
  if(reason)result.push({card:c.name,side,reason});
 }}return result.slice(0,4);
}
export function isCombatLoss(effects:Effect[],advisorOnly:boolean){return !effects.every(e=>e.kind==='loot')&&!(advisorOnly&&effects.some(e=>e.kind==='takeover'));}
