import type {AdvisorItem} from './itemAdvisor';
import {journalValue} from './journalBias.ts';
import type {JournalBias} from './journalBias';
import {handValue,styleNames,styleCardRating} from './mindthiefBuilds.ts';
import type {BuildCard,Style,Swap} from './mindthiefBuilds';
import {assessHand,cardRoles,explainSwap,swapSupportsHand} from './buildContext.ts';
import type {SwapExplanation} from './buildContext';
import type {PerkSelections} from './mindthiefPerks';
const title=(name:string)=>name.replace(/\b\w/g,c=>c.toUpperCase()).replace(/'S\b/g,"'s");
export function supportsStyle(card:BuildCard,hand:BuildCard[],style:Style){const r=cardRoles(card);if(style==='Scurry')return r.move||r.defense;return style==='Melee'?r.conditions||r.payoff||r.attack&&hand.some(c=>c.augment&&c.name!=='feedback loop'):style==='Ice'?r.ice||r.consumeIce:style==='Control'?r.control||r.reposition:r.rat||r.grant||r.grantMove||card.name==='silent scream'||r.attack&&hand.some(c=>c.name==='feedback loop')&&hand.some(c=>cardRoles(c).rat);}
export function hybridValue(hand:BuildCard[],primary:Style,secondary:Style,perks:PerkSelections={},journal?:JournalBias,equipment:AdvisorItem[]=[]){return journalValue(hand,journal)+(handValue(hand,primary,perks,undefined,equipment)+handValue(hand,secondary,perks,undefined,equipment))/2+Math.min(6,hand.filter(c=>supportsStyle(c,hand,primary)&&supportsStyle(c,hand,secondary)).length)*2;}
export function recommendedHybridHand(available:BuildCard[],primary:Style,secondary:Style,perks:PerkSelections={},journal?:JournalBias,equipment:AdvisorItem[]=[]):BuildCard[]{
 if(primary===secondary)throw new Error('Choose two different playstyles.');
 if(available.length<=10)return[...available];
 const rank=[...available].sort((a,b)=>(styleCardRating(b,primary)+styleCardRating(b,secondary))-(styleCardRating(a,primary)+styleCardRating(a,secondary))||+a.initiative-+b.initiative||a.name.localeCompare(b.name));
 let best=rank.slice(0,10),value=-Infinity;
 if(rank.length<=16){const visit=(start:number,hand:BuildCard[])=>{if(hand.length===10){const score=hybridValue(hand,primary,secondary,perks,journal,equipment);if(score>value){best=[...hand];value=score;}return;}for(let i=start;i<=rank.length-(10-hand.length);i++){hand.push(rank[i]);visit(i+1,hand);hand.pop();}};visit(0,[]);}
 else for(let seed=0;seed<8;seed++){
  const tail=rank.slice(6);let hand=seed===0?rank.slice(0,10):[...rank.slice(0,6),...[0,1,2,3].map(i=>tail[(seed*2+i)%tail.length])],score=hybridValue(hand,primary,secondary,perks,journal,equipment);
  for(let round=0;round<24;round++){let next=hand,nextScore=score;for(const into of rank.filter(c=>!hand.includes(c)))for(let i=0;i<10;i++){const trial=[...hand];trial[i]=into;const candidate=hybridValue(trial,primary,secondary,perks,journal,equipment);if(candidate>nextScore+0.001){next=trial;nextScore=candidate;}}if(next===hand)break;hand=next;score=nextScore;}
  if(score>value){best=hand;value=score;}
 }
 return best.sort((a,b)=>+a.initiative-+b.initiative);
}
export function explainHybridSwap(hand:BuildCard[],out:BuildCard,into:BuildCard,primary:Style,secondary:Style,perks:PerkSelections={}):SwapExplanation{
 const a=explainSwap(hand,out,into,primary,perks),b=explainSwap(hand,out,into,secondary,perks);
 return{...a,brief:[...new Set([...a.brief,...b.brief])].slice(0,2),why:[...new Set([...a.why,...b.why])].filter(s=>!s.startsWith('No direct synergy')),partners:[...new Set([...a.partners,...b.partners])],kind:a.kind==='Core synergy'||b.kind==='Core synergy'?'Core synergy':'Coverage repair',movement:`${styleNames[primary]}: ${a.movement} ${styleNames[secondary]}: ${b.movement}`};
}
export function hybridSwapAllowed(hand:BuildCard[],out:BuildCard,into:BuildCard,primary:Style,secondary:Style,perks:PerkSelections={}){
 const trial=hand.map(c=>c===out?into:c);const safe=(style:Style)=>{const a=assessHand(hand,style,perks),b=assessHand(trial,style,perks);return b.coreMissing.length<=a.coreMissing.length&&b.moves>=Math.min(3,a.moves)&&b.fast>=Math.min(2,a.fast)&&b.defense>=Math.min(1,a.defense)&&!b.orphaned.some(n=>!a.orphaned.includes(n));};
 return safe(primary)&&safe(secondary)&&(swapSupportsHand(hand,out,into,primary,perks)||swapSupportsHand(hand,out,into,secondary,perks));
}
export function hybridCardReason(c:BuildCard,hand:BuildCard[],primary:Style,secondary:Style,perks:PerkSelections={}):string[]{
 const reason=explainHybridSwap(hand,c,c,primary,secondary,perks).brief;
 if(!reason.length){const r=cardRoles(c);reason.push(r.move?`Provides repeatable Move ${r.moveAmount} so a different card can deliver the hybrid’s payoff.`:r.defense?'Provides protection or healing to preserve your HP and card economy.':'Provides a complementary action or initiative option; inspect both halves before saving.');}
 return reason.slice(0,3);
}
export function recommendedHybridSwaps(hand:BuildCard[],available:BuildCard[],primary:Style,secondary:Style,perks:PerkSelections={},journal?:JournalBias,equipment:AdvisorItem[]=[]):Swap[]{
 if(hand.length!==10)return[];const baseline=hybridValue(hand,primary,secondary,perks,journal,equipment),result:Swap[]=[];
 for(const into of available.filter(c=>!hand.some(s=>s.name===c.name)))for(const out of hand){if(!hybridSwapAllowed(hand,out,into,primary,secondary,perks))continue;const gain=hybridValue(hand.map(c=>c===out?into:c),primary,secondary,perks,journal,equipment)-baseline;if(gain>0.25){const explanation=explainHybridSwap(hand,out,into,primary,secondary,perks);result.push({out,into,gain,reason:explanation.why.join(' '),explanation});}}
 return result.sort((a,b)=>b.gain-a.gain).filter((s,i,arr)=>arr.findIndex(x=>x.into.name===s.into.name)===i).slice(0,4);
}
export function hybridPractices(hand:BuildCard[],primary:Style,secondary:Style,perks:PerkSelections={}):string[]{
 const chosen=[primary,secondary],practices:string[]=[];
 const named=(test:(c:BuildCard)=>boolean)=>hand.filter(test).slice(0,3).map(c=>title(c.name)).join(', ');
 const bridges=named(c=>supportsStyle(c,hand,primary)&&supportsStyle(c,hand,secondary));if(bridges)practices.push(`Bridge cards: ${bridges} contribute to both halves of this hybrid.`);
 if(chosen.includes('Scurry'))practices.push(`Use ${named(c=>cardRoles(c).move)||'your movement cards'} to maximize travel across both action halves. Prioritize repeatable Move and Jump for objectives and repositioning; combat belongs to the other style of this hybrid.`);
 if(chosen.includes('Melee'))practices.push(`Establish negative conditions with ${named(c=>cardRoles(c).conditions)||'your unlocked condition effects'} before using ${named(c=>cardRoles(c).payoff)||'your unlocked condition-bonus modifiers'}. Conditions added by an attack do not boost that same attack.`);
 if(chosen.includes('Ice'))practices.push(`Create Ice with ${named(c=>cardRoles(c).ice)||'your available source'} and spend it on a later turn with ${named(c=>cardRoles(c).consumeIce)||'your Ice payoffs'}. Keep a useful base action when Ice is unavailable.`);
 if(chosen.includes('Control'))practices.push(`Use ${named(c=>cardRoles(c).control)||'your control cards'} when monsters can reach each other. Controlling an attack does not remove the monster’s normal turn; preserve a kill, condition, or safe position to handle it.`);
 if(chosen.includes('Summons'))practices.push(`Get ${named(c=>cardRoles(c).rat)||'your rat'} into reach before granting attacks. Use ${named(c=>cardRoles(c).grantMove)||'your movement support'} to keep it productive; preserve rat HP and use your own attacks to trigger Feedback Loop when active.`);
 const a=assessHand(hand,primary,perks),b=assessHand(hand,secondary,perks);practices.push(`Movement and tempo: at least ${Math.min(a.moves,b.moves)} printed movement options remain after the assumed active setup. Pair a movement half with a different card’s payoff, and use early or late initiative deliberately rather than always choosing the faster card.`);
 practices.push(hand.some(c=>c.name==='domination')?'Domination can keep two Augments active, but it and your persistent cards reduce the cards left to cycle. Stage setup before spending loss attacks.':'Keep one Augment active at a time. Switch only when the new benefit justifies losing the old one; avoid spending loss halves before they have a meaningful payoff.');
 return practices;
}
