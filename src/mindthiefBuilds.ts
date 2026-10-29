import type {AdvisorItem} from './itemAdvisor';
import {equipmentBuildValue} from './equipmentBuildValue.ts';
import {journalValue} from './journalBias.ts';
import type {JournalBias} from './journalBias';
import type {SimSpec} from './simulation/types';
import {perkCount} from './mindthiefPerks.ts';
import type {PerkSelections} from './mindthiefPerks';
import {assessHand,cardRoles,explainSwap,swapSupportsHand} from './buildContext.ts';
import type {SwapExplanation} from './buildContext';
export type Style = 'Melee' | 'Ice' | 'Control' | 'Summons' | 'Scurry';
export const styles: Style[] = ['Melee', 'Ice', 'Control', 'Summons','Scurry'];
export const styleNames:Record<Style,string>={Melee:'Assassin',Ice:'Ice Mage',Control:'HypnoRat',Summons:'Rat Overlord',Scurry:'Scurry'};
export const styleDescriptions:Record<Style,string>={Melee:'Apply negative conditions, then exploit attacks that gain damage for each condition on the target.',Ice:'Create Ice reliably, then spend it on control and damage while keeping useful actions when Ice is unavailable.',Control:'Control enemies and make them fight each other while limiting your own exposure.',Scurry:'Maximize repeatable movement, top-and-bottom move combinations, Jump, and flexible initiative. Combat is secondary.',Summons:'Make your rats the workhorses: grant attacks and movement, keep them alive, and use your melee abilities to trigger Feedback Loop.'};
export type BuildReview = {
  top: string; bottom: string; ratings: number[]; melee?: number; control?: number;
  conditions?: number; summon?: 'body' | 'support' | 'sustain' | 'sharing';
};
export type BuildCard = {
  name: string; initiative: string; augment?: boolean; topLost?: boolean; bottomLost?: boolean;
  level?:string;
  simulationModel?:SimSpec;
  buildReview?: BuildReview;
  actionIndex?: { top: BuildAction; bottom: BuildAction };
};
export function styleCardRating(card:BuildCard,style:Style){if(style!=='Scurry')return card.buildReview?.ratings[['Melee','Ice','Control','Summons'].indexOf(style)]??0;const r=cardRoles(card);const jump=card.simulationModel?.bottom.effects.some(e=>e.kind==='move'&&e.jump)||card.simulationModel?.top.effects.some(e=>e.kind==='move'&&e.jump);return Math.min(10,Number(r.move)*3+r.moveAmount+Number(jump)*2+Number(r.defense)*0.5+Number(+card.initiative<=30)*0.5);}
type BuildAction = { moves: (string | number)[] | null; elements: { generate: string[] | null; consume: string[] | null } };
const names = (cards: BuildCard[]) => new Set(cards.map(c => c.name));
const has = (cards: BuildCard[], name: string) => cards.some(c => c.name === name);
export const isRat = (c: BuildCard) => c.buildReview?.summon === 'body' || c.name === 'many as one';
export const conditionPayoff=(c:BuildCard)=>['submissive affliction','perverse edge','psychic projection'].includes(c.name);
export const enemyAttackControl=(c:BuildCard)=>['withering claw',"the mind's weakness",'possession','brain leech','silent scream','domination','phantasmal killer'].includes(c.name);
const iceSource = (c: BuildCard) => c.actionIndex?.top.elements.generate?.includes('Ice');
const iceConsumer = (c: BuildCard) => [c.actionIndex?.top, c.actionIndex?.bottom].some(a => a?.elements.consume?.includes('Ice'));
export function cardReason(c: BuildCard, style: Style): string {
  if(style==='Scurry'){
    const movement=(['top','bottom'] as const).flatMap(side=>{const half=c.simulationModel?.[side];return !half?.loss&&!half?.active?half?.effects.filter(e=>e.kind==='move').map(e=>e.kind==='move'?side+' Move '+e.amount+(e.jump?' with Jump':''):'')??[]:[];});
    if(movement.length)return movement.join(' · ')+'. Keep this half cycling for travel.';
    return cardRoles(c).defense?'Protection or healing supports continued travel.':'Adds initiative flexibility; prioritize the hand’s movement cards.';
  }
  if (style === 'Summons') {
    if (c.name === 'feedback loop') return 'Grants summon attacks after your melee attack abilities, plus a summon Attack 2 and Move +0 when activated.';
    if (c.name === 'possession') return 'Move 3 yourself, then grant a rat Move 2 to reach a target or keep up.';
    if (c.name === 'telepathic command') return 'Grant a rat Attack +0, or Move 4 yourself and grant it Move 4.';
    if (c.name === 'silent scream') return 'Melee abilities trigger Heal 2 at Range 2, helping keep a nearby rat alive; competes with Feedback Loop for an Augment slot.';
    if (c.name === 'many as one') return 'Rat King uses current HP for attack strength; the other half shares Augments with the first qualifying ally each round. Both halves are losses and cannot be used together from this card.';
    if (c.name === 'gangling abomination') return 'Rat Monstrosity gains +1 Attack against a target with a negative condition.';
    if (c.name === 'gnawing horde') return 'Rat Swarm brings repeatable melee attacks and Poison, enabling extra attacks from granted summon actions.';
    if (c.name === 'domination') return 'Allows two active Augments, enabling Feedback Loop plus healing or another passive; costs another card held active.';
    if ((c.buildReview?.conditions ?? 0) > 0) return 'Negative conditions protect rats or enable Rat Monstrosity’s conditional damage.';
    if ((c.buildReview?.melee ?? 0) > 0) return 'Your melee attack abilities can trigger an active Feedback Loop; use the other card for movement or summon support.';
  }
  if (style === 'Ice' && iceSource(c)) return 'Creates Ice for a later payoff; newly created Ice cannot fuel your own action in the same turn.';
  if (style === 'Ice' && iceConsumer(c)) return 'Provides an Ice payoff; keep a generator and a useful base action for turns without Ice.';
  if (style === 'Control' && c.buildReview?.control) return 'Provides enemy control. Count controlled damage separately from your own melee attacks.';
  if (c.augment) return `${c.buildReview?.top ?? 'Provides a passive Augment.'}`;
  return c.buildReview?.bottom ?? 'Adds a complementary action and initiative option.';
}

/** Editorial whole-hand utility. No combat win-rate or calibrated damage claim. */
export function handValue(cards: BuildCard[], style: Style, perks:PerkSelections={}, journal?:JournalBias,equipment:AdvisorItem[]=[]): number {
  let value = cards.reduce((sum, c) => sum + styleCardRating(c,style), 0);
  const active = new Set<string>();
  const plannedAugment = style === 'Scurry' ? undefined : style === 'Summons' && has(cards,'feedback loop') ? cards.find(c=>c.name==='feedback loop') : [...cards].filter(c=>c.augment).sort((a,b)=>styleCardRating(b,style)-styleCardRating(a,style))[0];
  if(plannedAugment) active.add(plannedAugment.name);
  if(style === 'Summons') {
    const rat=[...cards].filter(isRat).sort((a,b)=>styleCardRating(b,style)-styleCardRating(a,style)||+b.initiative-+a.initiative)[0];
    if(rat) active.add(rat.name);
    if(has(cards,'domination') && has(cards,'feedback loop') && has(cards,'silent scream')) {active.add('domination');active.add('silent scream');}
  }
  // An active card's other half and initiative are unavailable in later cycles.
  const cycling=cards.filter(c=>!active.has(c.name));
  const melee = cycling.filter(c => (c.buildReview?.melee ?? 0) > 0).length;
  const context=assessHand(cards,style,perks);
  const moves = context.moves;
  const fast = cycling.filter(c => +c.initiative <= 30).length;
  const sources = cards.filter(iceSource).length;
  const consumers = cards.filter(iceConsumer).length;
  const rats = cards.filter(isRat).length;
  const support = cards.filter(c => c.buildReview?.summon === 'support').length;
  const augments = cards.filter(c => c.augment).length;
  // Coverage has diminishing returns; a fast card supports many two-card initiative choices.
  value += Math.min(moves, 5) * 2 + Math.min(fast, 5) * 1.5;
  value -= Math.max(0, 3 - moves) * 8 + Math.max(0, 2 - fast) * 6;
  const capacity = has(cards, 'domination') ? 2 : 1;
  if(style!=='Scurry')value -= Math.max(0, augments - capacity) * 5;
  if (style === 'Melee') {
    const setup=cards.filter(c=>c.buildReview?.conditions).length,payoffs=cards.filter(conditionPayoff).length;
    value += Math.min(melee, 6) * 2 + Number(augments > 0) * 8 + Math.min(setup,3)*3+payoffs*5+Number(setup>0&&payoffs>0)*8;
  }
  if (style === 'Ice') value += Math.min(sources, 3) * 4 + Math.min(consumers, 3) * 4 - Number(consumers > 0 && sources === 0) * 22;
  if (style === 'Control') value += Math.min(cards.filter(enemyAttackControl).length, 5) * 5;
  if(style==='Scurry')value+=Math.min(moves,8)*5+cards.reduce((n,c)=>n+cardRoles(c).moveAmount,0)*0.7+Math.min(context.defense,3)*2+Number(context.fast>0&&context.late>0)*3;
  if (style === 'Summons') {
    value += Number(rats > 0) * 24 + Number(rats > 0 && support > 0) * 10;
    value -= Math.max(0, rats - 1) * 8; // Several summon losses/active cards consume endurance.
    if (rats === 0) value -= support * 10;
    if (rats && has(cards, 'feedback loop')) value += Math.min(melee, 5) * 5;
    if (rats && has(cards, 'silent scream')) value += 4;
    if (rats && has(cards, 'domination') && has(cards, 'feedback loop') && has(cards, 'silent scream')) value += 10;
    if (has(cards, 'gangling abomination')) value += Math.min(cards.filter(c => c.buildReview?.conditions).length, 3) * 2;
    if (has(cards, 'many as one') && rats>1 && augments) value += 3;
    // Support needs a rat and enough own attack abilities to use Feedback Loop.
    if (rats && has(cards, 'feedback loop') && melee < 3) value -= (3 - melee) * 10;
    value -= Math.max(0,active.size-2)*4;
  }
  // Only selected, completed perks contribute; no hypothetical unlock credit.
  value += perkCount(perks,'conditionDamage')*Math.min(cards.filter(c=>c.buildReview?.conditions).length,3)*(style==='Melee'?1.8:0.6);
  value += perkCount(perks,'ice')*Math.min(consumers,3)*(style==='Ice'?1.8:0.5);
  value += perkCount(perks,'controlDeck')*cards.filter(enemyAttackControl).length*(style==='Control'?2:0.5);
  value += perkCount(perks,'immobilize')*cards.filter(conditionPayoff).length;
  value += perkCount(perks,'restControl')*Math.min(sources+cards.filter(c=>c.actionIndex?.top.elements.generate?.includes('Dark')||c.actionIndex?.bottom.elements.generate?.includes('Dark')).length,3);
  value += Math.min(context.defense,3)*2+Number(context.fast>0&&context.late>0)*2;
  value -= context.coreMissing.length*18+context.orphaned.length*8;
  return value + journalValue(cards,journal) + equipmentBuildValue(cards,style,equipment);
}

export function recommendedHand(available: BuildCard[], style: Style, perks:PerkSelections={},journal?:JournalBias,equipment:AdvisorItem[]=[]): BuildCard[] {
  if (available.length <= 10) return [...available];
  const ordered = [...available].sort((a,b) => styleCardRating(b,style)-styleCardRating(a,style) || +a.initiative - +b.initiative || a.name.localeCompare(b.name));
  let best = ordered.slice(0, 10);
  let bestValue = -Infinity;
  // Exact enumeration for the starting pool; deterministic multi-start swap search for larger pools.
  if (available.length <= 16) {
    const visit = (start: number, chosen: BuildCard[]) => {
      if (chosen.length === 10) { const value = handValue(chosen,style,perks,journal,equipment); if (value > bestValue) { bestValue=value; best=[...chosen]; } return; }
      for (let i=start; i<=ordered.length-(10-chosen.length); i++) { chosen.push(ordered[i]); visit(i+1,chosen); chosen.pop(); }
    };
    visit(0, []);
  } else {
    for (let seed=0; seed<6; seed++) {
      const tail=ordered.slice(7);
      let hand = seed === 0 ? ordered.slice(0,10) : [...ordered.slice(0,7), ...[0,1,2].map(i => tail[(seed*2+i)%tail.length])];
      let score = handValue(hand,style,perks,journal,equipment);
      for (let round=0; round<24; round++) {
        const inside=names(hand); let next=hand; let nextScore=score;
        for (const add of ordered.filter(c => !inside.has(c.name))) for (let i=0;i<hand.length;i++) {
          const trial=[...hand]; trial[i]=add; const value=handValue(trial,style,perks,journal,equipment);
          if (value > nextScore+0.001) { next=trial; nextScore=value; }
        }
        if (next === hand) break;
        hand=next; score=nextScore;
      }
      if (score > bestValue) {best=hand; bestValue=score;}
    }
  }
  return best.sort((a,b) => +a.initiative - +b.initiative);
}
export type Swap = { out: BuildCard; into: BuildCard; gain: number; reason: string; explanation:SwapExplanation };
export function recommendedSwaps(cards: BuildCard[], available: BuildCard[], style: Style,perks:PerkSelections={},journal?:JournalBias,equipment:AdvisorItem[]=[]): Swap[] {
  if (cards.length !== 10) return [];
  const baseline=handValue(cards,style,perks,journal,equipment), inside=names(cards); const result: Swap[]=[];
  for (const into of available.filter(c => !inside.has(c.name))) for (const out of cards) {
    if(!swapSupportsHand(cards,out,into,style,perks))continue;
    const gain=handValue(cards.map(c => c === out ? into : c),style,perks,journal,equipment)-baseline;
    if (gain > 0.25) {const explanation=explainSwap(cards,out,into,style,perks);result.push({out,into,gain,reason:explanation.why.join(' '),explanation});}
  }
  return result.sort((a,b) => b.gain-a.gain || a.into.name.localeCompare(b.into.name)).filter((s,i,list) => list.findIndex(x => x.into.name === s.into.name) === i).slice(0,4);
}
