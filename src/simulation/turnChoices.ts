import type {BuildCard} from '../mindthiefBuilds';
import type {State,Play} from './engine';
import type {Effect} from './types';
export type TurnChoices={initiativeCard:string|null;otherInitiative:{card:string;value:number}|null;first:{card:string;side:'top'|'bottom';basic:boolean}|null;second:{card:string;side:'top'|'bottom';basic:boolean}|null;orderReason:string};
const own=(effects:Effect[]):Effect[]=>effects.flatMap(e=>[e,...e.kind==='consume'?own(e.effects):[]]);
export function describeTurnChoices(cards:BuildCard[],play:Play,after?:State,opposite?:State):TurnChoices{
 if(play.rest!==undefined)return{initiativeCard:null,otherInitiative:null,first:null,second:null,orderReason:'Long rest is the whole turn at initiative 99.'};
 const top={card:cards[play.top].name,side:'top' as const,basic:play.topDefault},bottom={card:cards[play.bottom].name,side:'bottom' as const,basic:play.bottomDefault};
 const first=play.bottomFirst?bottom:top,second=play.bottomFirst?top:bottom;
 const lead=+cards[play.top].initiative===play.initiative?play.top:play.bottom,other=lead===play.top?play.bottom:play.top;
 const effects=(c:typeof first):Effect[]=>c.basic?[c.side==='top'?{kind:'attack',amount:2}:{kind:'move',amount:2}]:own(cards.find(card=>card.name===c.card)!.simulationModel![c.side].effects);
 const a=effects(first),b=effects(second);
 let reason='Both orders have the same modeled outcome; choose the order that fits the actual board.';
 const same=after&&opposite&&Math.abs(after.damage-opposite.damage)<0.01&&Math.abs(after.movement-opposite.movement)<0.01&&Math.abs(after.hp-opposite.hp)<0.01;
 if(a.some(e=>e.kind==='augment')&&b.some(e=>e.kind==='attack'))reason='Activate '+first.card+' before the other card’s melee abilities can use its Augment.';
 else if(a.some(e=>e.kind==='summon')&&b.some(e=>e.kind==='grant'))reason='Create the rat before the other card grants it an action.';
 else if(a.some(e=>e.kind==='move')&&b.some(e=>e.kind==='attack'||e.kind==='control')&&opposite&&!same)reason='Resolve '+first.card+' movement first to bring the other action into reach.';
 else if(a.some(e=>e.kind==='attack'&&e.conditions?.length||e.kind==='move'&&e.throughPoison||e.kind==='status'&&!e.self)&&b.some(e=>e.kind==='attack'&&e.perCondition))reason='Apply the negative conditions before the condition-based payoff.';
 else if(a.some(e=>e.kind==='attack')&&b.some(e=>e.kind==='move')&&opposite&&!same)reason='Resolve the attack while its target is in reach, then reposition.';
 else if(a.some(e=>e.kind==='move')&&b.some(e=>e.kind==='move'))reason='Use both movement halves for travel; adapt their order to terrain and Jump.';
 return{initiativeCard:cards[lead].name,otherInitiative:{card:cards[other].name,value:+cards[other].initiative},first,second,orderReason:reason};
}
