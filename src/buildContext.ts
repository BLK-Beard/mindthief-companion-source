import type {BuildCard,Style} from './mindthiefBuilds';
import type {Effect} from './simulation/types';
import {perkCount} from './mindthiefPerks.ts';
import type {PerkSelections} from './mindthiefPerks';
const title=(s:string)=>s.replace(/\b\w/g,c=>c.toUpperCase()).replace(/'S\b/g,"'s");
const contains=(cards:BuildCard[],name:string)=>cards.some(c=>c.name===name);
type Roles={move:boolean;moveAmount:number;attack:boolean;conditions:boolean;conditionalSetup:boolean;payoff:boolean;ice:boolean;consumeIce:boolean;control:boolean;reposition:boolean;rat:boolean;grant:boolean;grantMove:boolean;defense:boolean;healing:boolean;burst:boolean};
const cache=new WeakMap<BuildCard,Roles>();
const negative=(values:string[]|undefined)=>values?.some(c=>['Poison','Wound','Muddle','Disarm','Stun','Immobilize'].includes(c))??false;
export function cardRoles(card:BuildCard):Roles{
 const saved=cache.get(card);if(saved)return saved;
 const r:Roles={move:false,moveAmount:0,attack:false,conditions:false,conditionalSetup:false,payoff:false,ice:false,consumeIce:false,control:false,reposition:false,rat:false,grant:false,grantMove:false,defense:false,healing:false,burst:false};
 for(const side of ['top','bottom'] as const){const half=card.simulationModel?.[side];if(!half)continue;
  const walk=(effects:Effect[],controlled=false,gated=false)=>{for(const e of effects){
   if(e.kind==='move'&&!controlled&&!half.loss&&!half.active){r.move=true;r.moveAmount=Math.max(r.moveAmount,e.amount);}
   if(e.kind==='attack'){
    if(!controlled&&!half.loss&&!half.active)r.attack=true;
    if(negative(e.conditions)){if(gated)r.conditionalSetup=true;else r.conditions=true;}
    if(e.perCondition)r.payoff=true;
    if(e.conditions?.some(c=>['Stun','Disarm','Muddle','Immobilize'].includes(c)))r.defense=true;
    if(controlled)r.control=true;
    for(const b of e.boosts??[])if(b.element==='Ice'){r.consumeIce=true;if(negative(b.conditions))r.conditionalSetup=true;}
   }
   if(e.kind==='control'){if(e.effects.some(e=>e.kind==='move'))r.reposition=true;walk(e.effects,true,gated);}
   if(e.kind==='consume'){if(e.element==='Ice')r.consumeIce=true;walk(e.effects,controlled,true);}
   if(e.kind==='infuse'&&e.element==='Ice'&&!half.loss&&!half.active)r.ice=true;
   if(e.kind==='summon'){r.rat=true;if(e.rat.poison)r.conditions=true;}
   if(e.kind==='grant'){if(e.action==='attack')r.grant=true;else r.grantMove=true;}
   if(e.kind==='heal'){r.healing=true;r.defense=true;}
   if(e.kind==='status'&&['Invisible','Stun','Disarm','Muddle','Immobilize'].includes(e.condition))r.defense=true;
   if(e.kind==='status'&&!e.self&&negative([e.condition])){if(gated)r.conditionalSetup=true;else r.conditions=true;}
   if(e.kind==='move'&&e.throughPoison)r.conditions=true;
   if(e.kind==='augment'){
    if(e.augment==='withering')r.conditions=true;
    if(e.augment==='projection')r.payoff=true;
    if(e.augment==='scream'){r.healing=true;r.defense=true;}
    if(e.augment==='killer')r.control=true;
   }
  }};
  walk(half.effects);if(half.loss)r.burst=true;
 }
 if(!card.simulationModel){r.move=(card.actionIndex?.bottom.moves??[]).some(n=>typeof n==='number'&&n>=2)&&!card.bottomLost;r.attack=!!card.buildReview?.melee;r.conditions=!!card.buildReview?.conditions;r.ice=!!card.actionIndex?.top.elements.generate?.includes('Ice')&&!card.topLost;r.consumeIce=!!card.actionIndex?.bottom.elements.consume?.includes('Ice');}
 cache.set(card,r);return r;
}
export type HandContext={moves:number;moveNames:string[];fast:number;late:number;defense:number;defenseNames:string[];ice:number;consumers:number;conditions:number;payoffs:number;rats:number;grants:number;grantMoves:number;attacks:number;controls:number;activeNames:string[];coreMissing:string[];orphaned:string[]};
export function assessHand(cards:BuildCard[],style:Style,perks:PerkSelections={}):HandContext{
 const activeNames:string[]=[];
 const aug=style==='Scurry'?undefined:style==='Summons'?cards.find(c=>c.name==='feedback loop'):[...cards].filter(c=>c.augment).sort((a,b)=>(b.buildReview?.ratings[['Melee','Ice','Control','Summons'].indexOf(style)]??0)-(a.buildReview?.ratings[['Melee','Ice','Control','Summons'].indexOf(style)]??0))[0];
 if(aug)activeNames.push(aug.name);
 if(style==='Summons'){const rat=cards.find(c=>cardRoles(c).rat);if(rat)activeNames.push(rat.name);}
 const cycling=cards.filter(c=>!activeNames.includes(c.name));
 const ice=cycling.filter(c=>cardRoles(c).ice).length;
 const c:HandContext={moves:cycling.filter(c=>cardRoles(c).move).length,moveNames:cycling.filter(c=>cardRoles(c).move).map(c=>c.name),fast:cycling.filter(c=>+c.initiative<=30).length,late:cycling.filter(c=>+c.initiative>=60).length,defense:cards.filter(c=>cardRoles(c).defense).length,defenseNames:cards.filter(c=>cardRoles(c).defense).map(c=>c.name),ice,consumers:cards.filter(c=>cardRoles(c).consumeIce).length,conditions:cards.filter(c=>cardRoles(c).conditions||cardRoles(c).conditionalSetup&&(ice>0||perkCount(perks,'ice')>0)).length,payoffs:cards.filter(c=>cardRoles(c).payoff).length+Number(perkCount(perks,'conditionDamage')>0),rats:cards.filter(c=>cardRoles(c).rat).length,grants:cards.filter(c=>cardRoles(c).grant).length,grantMoves:cards.filter(c=>cardRoles(c).grantMove).length,attacks:cycling.filter(c=>cardRoles(c).attack).length,controls:cards.filter(c=>cardRoles(c).control).length,activeNames,coreMissing:[],orphaned:[]};
 if(style==='Melee'){if(!c.conditions)c.coreMissing.push('negative-condition setup');if(!c.payoffs)c.coreMissing.push('condition-based damage payoff');}
 if(style==='Ice'){if(!c.ice)c.coreMissing.push('repeatable Ice creation');if(!c.consumers)c.coreMissing.push('Ice payoff');}
 if(style==='Control'&&c.controls<2)c.coreMissing.push('repeatable enemy-attack control');
 if(style==='Scurry'){if(c.moves<4)c.coreMissing.push('repeatable movement coverage');}
 if(style==='Summons'){if(!c.rats)c.coreMissing.push('rat summon');if(!c.grants)c.coreMissing.push('granted rat attacks');if(contains(cards,'feedback loop')&&c.attacks<2)c.coreMissing.push('own attack abilities to trigger Feedback Loop');}
 if(!c.rats)for(const card of cards)if(cardRoles(card).grant||cardRoles(card).grantMove)c.orphaned.push(card.name);
 if(contains(cards,'domination')&&cards.filter(c=>c.augment).length<2)c.orphaned.push('domination');
 return c;
}
type Link={text:string;names:string[]};
function linksFor(card:BuildCard,kept:BuildCard[],style:Style,perks:PerkSelections):Link[]{
 const r=cardRoles(card),c=assessHand(kept,style,perks),links:Link[]=[];
 const withCards=(match:(c:BuildCard)=>boolean,text:(names:string)=>string)=>{const names=kept.filter(match).slice(0,3).map(c=>c.name);if(names.length)links.push({names,text:text(names.map(title).join(', '))});};
 if(style==='Melee'){
  if(card.augment&&card.name!=='feedback loop')withCards(c=>cardRoles(c).attack,n=>`Offers a passive benefit for the recurring attacks on ${n}. Choose it instead of another Augment unless Domination is active.`);
  if(r.conditions)withCards(c=>cardRoles(c).payoff,n=>`Applies negative conditions before ${n} cashes them in for bonus damage.`);
  if(r.conditions&&perkCount(perks,'conditionDamage'))links.push({names:[],text:'Sets up the condition-bonus modifier cards you have unlocked.'});
  if(r.payoff)withCards(c=>cardRoles(c).conditions,n=>`Converts the negative conditions from ${n} into extra attack damage.`);
  if(r.attack)withCards(c=>!!c.augment&&['withering claw',"the mind's weakness",'psychic projection','phantasmal killer'].includes(c.name),n=>`Adds another repeatable attack option for the passive benefit of ${n}.`);
 }
 if(style==='Ice'){
  if(r.ice)withCards(c=>cardRoles(c).consumeIce,n=>`Creates Ice repeatedly for ${n} on later turns.`);
  if(r.consumeIce)withCards(c=>cardRoles(c).ice,n=>`Uses Ice supplied by ${n} for its linked damage or control effect.`);
  if(r.consumeIce&&!c.ice&&perkCount(perks,'ice'))links.push({names:[],text:'Can use your unlocked Ice modifiers, although those draws are not a guaranteed supply.'});
 }
 if(style==='Control'){
  if(r.reposition)withCards(c=>cardRoles(c).control,n=>`Repositions enemies to help the attacks controlled by ${n} reach another monster.`);
  if(r.control)withCards(c=>cardRoles(c).control||cardRoles(c).conditions,n=>`Adds enemy attacks alongside ${n}, letting monsters damage one another.`);
  if(r.control&&perkCount(perks,'controlDeck'))links.push({names:[],text:'Can use the upgraded character modifier deck because your controlled-deck perk is unlocked.'});
  if(r.attack&&contains(kept,'phantasmal killer'))links.push({names:['phantasmal killer'],text:'Your attack triggers Phantasmal Killer’s controlled enemy attack.'});
  if(r.conditions&&c.controls)withCards(c=>cardRoles(c).control,n=>`Conditions soften targets for the enemy attacks granted by ${n}.`);
 }
 if(style==='Summons'){
  if(r.rat)withCards(c=>cardRoles(c).grant||cardRoles(c).grantMove||c.name==='silent scream',n=>`Provides a rat for the granted actions or healing from ${n}.`);
  if((r.grant||r.grantMove)&&c.rats)withCards(c=>cardRoles(c).rat,n=>`Grants ${r.grant?'extra attacks':'movement'} to ${n}, keeping the rats productive instead of leaving them behind.`);
  if(card.name==='silent scream'&&c.rats)withCards(c=>cardRoles(c).rat,n=>`Heal 2 at Range 2 can sustain ${n} after your melee abilities. It competes with Feedback Loop unless Domination is active.`);
  if(card.name==='domination'&&kept.filter(c=>c.augment).length>=2)withCards(c=>!!c.augment,n=>`Allows two of ${n} to stay active together, at the cost of another card out of circulation.`);
  if(r.attack&&c.rats&&contains(kept,'feedback loop'))links.push({names:['feedback loop',...kept.filter(c=>cardRoles(c).rat).slice(0,1).map(c=>c.name)],text:'Gives Feedback Loop another own attack ability to turn into a granted rat attack.'});
  if(r.conditions&&contains(kept,'gangling abomination'))links.push({names:['gangling abomination'],text:'Enables Rat Monstrosity’s bonus against a target with a negative condition.'});
  if(card.name==='many as one'&&c.rats&&kept.some(c=>c.augment))links.push({names:kept.filter(c=>c.augment||cardRoles(c).rat).slice(0,3).map(c=>c.name),text:'Its sharing half can pass active Augments to an existing rat. Choose that half or Rat King; the same card cannot provide both.'});
 }
 if(style==='Scurry'){
  if(r.move)withCards(c=>cardRoles(c).move,n=>`Combines with movement on ${n} for longer travel across both action halves.`);
  
  if(r.defense)withCards(c=>cardRoles(c).move,n=>`Protects your HP while repositioning with ${n}.`);
 }
 return links;
}
export type SwapExplanation={why:string[];brief:string[];partners:string[];movement:string;initiative:string;survival:string;tradeoff:string;kind:'Core synergy'|'Coverage repair'};
export function explainSwap(hand:BuildCard[],out:BuildCard,into:BuildCard,style:Style,perks:PerkSelections={}):SwapExplanation{
 const kept=hand.filter(c=>c.name!==out.name),next=[...kept,into],before=assessHand(hand,style,perks),after=assessHand(next,style,perks),r=cardRoles(into),links=linksFor(into,kept,style,perks);
 const why=links.map(l=>l.text);
 if(after.coreMissing.length<before.coreMissing.length)why.push('Fills a missing part of the chosen playstyle instead of adding an unrelated effect.');
 if(r.move&&after.moves>before.moves)why.push('Repairs repeatable movement coverage so the other card can provide an attack or control ability.');
 if(+into.initiative<=30&&after.fast>before.fast)why.push('Adds an early initiative option without requiring you to lead with your slower payoff card.');
 if(r.defense&&after.defense>before.defense)why.push('Adds damage prevention or recovery, helping preserve HP and cards otherwise lost to negate damage.');
 if(!why.length)why.push('No direct synergy with the remaining hand was identified.');
 const named=(match:(c:BuildCard)=>boolean)=>kept.filter(match).slice(0,2).map(c=>title(c.name)).join(' / ');
 const brief:string[]=[];
 if(style==='Melee'){
  if(r.payoff&&before.conditions)brief.push(`Turns ${named(c=>cardRoles(c).conditions)||'existing'} conditions into damage.`);
  else if(r.conditions&&before.payoffs)brief.push(`Sets up ${named(c=>cardRoles(c).payoff)||'your unlocked condition modifiers'}.`);
  else if(into.augment&&into.name!=='feedback loop')brief.push('Adds a passive for your existing attacks.');
  else if(r.attack&&kept.some(c=>c.augment))brief.push('Adds repeatable attacks for your active Augment.');
 }
 if(style==='Ice'){if(r.ice)brief.push(`Feeds Ice to ${named(c=>cardRoles(c).consumeIce)||'your payoffs'}.`);else if(r.consumeIce)brief.push(`Spends ${named(c=>cardRoles(c).ice)||'modifier-generated'} Ice on damage/control.`);}
 if(style==='Control'){if(r.control)brief.push('Adds enemy-on-enemy attacks.');else if(r.reposition)brief.push('Positions enemies for controlled attacks.');else if(r.conditions)brief.push('Conditions strengthen controlled attacks.');}
 if(style==='Scurry'){if(r.move)brief.push('Adds repeatable movement for mobile turns.');else if(r.defense)brief.push('Protects you while repositioning.');}
 if(style==='Summons'){
  if(r.rat)brief.push(`Provides a rat for ${named(c=>cardRoles(c).grant||cardRoles(c).grantMove)||'your summon plan'}.`);
  else if(into.name==='silent scream')brief.push('Heals nearby rats after melee abilities.');
  else if(into.name==='domination')brief.push('Keeps two existing Augments active.');
  else if(r.grant)brief.push('Grants your rats extra attacks.');
  else if(r.grantMove)brief.push('Keeps your rats in attack range.');
  else if(r.attack&&contains(kept,'feedback loop'))brief.push('Triggers Feedback Loop’s rat attacks.');
  else if(r.conditions&&contains(kept,'gangling abomination'))brief.push('Enables Rat Monstrosity’s damage bonus.');
 }
 if(after.moves>before.moves)brief.push('Adds repeatable movement.');
 else if(after.fast>before.fast)brief.push('Adds an early initiative option.');
 else if(after.defense>before.defense)brief.push('Adds protection or healing.');
 if(!brief.length)brief.push(after.coreMissing.length<before.coreMissing.length?'Repairs a missing playstyle role.':'Supports the remaining hand.');
 const lose=cardRoles(out);
 return{why,brief:brief.slice(0,2),partners:[...new Set(links.flatMap(l=>l.names))],kind:links.length?'Core synergy':'Coverage repair',movement:`Repeatable movement options: ${before.moves} → ${after.moves}. ${r.move?`${title(into.name)} supplies printed Move ${r.moveAmount} without a loss.`:'Default Move 2 remains a fallback on a different card.'}`,initiative:`Repeatable early-initiative cards: ${before.fast} → ${after.fast}; late options: ${before.late} → ${after.late}. The new card offers initiative ${into.initiative}; choose the lead from the actual two-card pair.`,survival:`Protection or healing options: ${before.defense} → ${after.defense}. ${style==='Summons'&&into.name==='telepathic command'?'Its Invisible protects you; be careful about redirecting enemy focus onto a rat.':'Keep prevention available rather than relying on early loss actions.'}`,tradeoff:`${lose.move&&!r.move?'Gives up a printed movement option. ':''}${lose.defense&&!r.defense?'Gives up a protection or healing option. ':''}${out.augment?'Changes your available passive Augment choices. ':''}${r.burst?'Includes an optional loss half; default actions still avoid the loss. ':''}Review both halves of ${title(out.name)} before applying.`};
}
export function swapSupportsHand(hand:BuildCard[],out:BuildCard,into:BuildCard,style:Style,perks:PerkSelections={}):boolean{
 const kept=hand.filter(c=>c.name!==out.name),before=assessHand(hand,style,perks),after=assessHand([...kept,into],style,perks),r=cardRoles(into);
 if(after.coreMissing.length>before.coreMissing.length)return false;
 if(before.coreMissing.length===0&&after.coreMissing.length)return false;
 if(after.moves<Math.min(3,before.moves)||after.fast<Math.min(2,before.fast)||after.defense<Math.min(1,before.defense))return false;
 if(after.orphaned.some(name=>!before.orphaned.includes(name)))return false;
 if(after.coreMissing.length<before.coreMissing.length)return true;
 if(linksFor(into,kept,style,perks).length)return true;
 // Off-theme cards are only considered to repair a genuine mobility, speed or survival hole.
 return r.move&&before.moves<3&&after.moves>before.moves||+into.initiative<=30&&before.fast<2&&after.fast>before.fast||r.defense&&before.defense===0&&after.defense>0;
}
