import type {AdvisorItem} from './itemAdvisor';
import {readJournal} from './journalBias';
import { useMemo, useState } from 'react';
import { cardReason, isRat, recommendedHand, recommendedSwaps, styleNames, styleDescriptions } from './mindthiefBuilds';
import type { BuildCard, Style } from './mindthiefBuilds';
import PlaystylePicker from './PlaystylePicker';
import SwapRationale from './SwapRationale';
import {recommendedHybridHand,recommendedHybridSwaps,hybridCardReason,hybridPractices} from './hybridBuilds';
import type { PerkSelections } from './mindthiefPerks';
const title = (name: string) => name.replace(/\b\w/g,c => c.toUpperCase()).replace(/'S\b/g,"'s");

type Props = { equipment?:AdvisorItem[]; journalNotes?:string[]; style:Style; secondaryStyle:Style|null; onStylesChange:(style:Style,secondary:Style|null)=>void;  perkSelections:PerkSelections; cards: BuildCard[]; available: BuildCard[]; activeAugment?: string; maxHealth?:number; onPropose?: (cards: BuildCard[], style: string) => void; onSwap?: (out: BuildCard, into: BuildCard) => void; onInspect?: (card: BuildCard) => void };
export default function MindthiefAdvice({equipment=[],journalNotes,style,secondaryStyle,onStylesChange,perkSelections,cards,available,activeAugment,onPropose,onSwap,onInspect}: Props) {
  const styleLabel=secondaryStyle?styleNames[style]+' + '+styleNames[secondaryStyle]:styleNames[style];
  const [showHand,setShowHand]=useState(false);
  const journal=useMemo(()=>readJournal(journalNotes??[],available),[journalNotes,available]);
  const initialBest=useMemo(() => (secondaryStyle?recommendedHybridHand(available,style,secondaryStyle,perkSelections,journal,equipment):recommendedHand(available,style,perkSelections,journal,equipment)),[available,style,secondaryStyle,perkSelections,journal,equipment]);
  const swaps=useMemo(() => (secondaryStyle?recommendedHybridSwaps(cards,available,style,secondaryStyle,perkSelections,journal,equipment):recommendedSwaps(cards,available,style,perkSelections,journal,equipment)),[cards,available,style,secondaryStyle,perkSelections,journal,equipment]);
  const best=initialBest;
  const rats=cards.filter(isRat);
  const feedback=cards.some(c => c.name === 'feedback loop');
  const supports=cards.filter(c => c.buildReview?.summon && !isRat(c));
  const inspect=(c: BuildCard) => <button className="text-button" onClick={() => onInspect?.(c)} disabled={!onInspect}>{title(c.name)} ↗</button>;
  return <section className="analysis-policy mindthief-advice" aria-label="Mindthief recommendations">
    <div className="analysis-policy-heading"><div><span className="field-label">MINDTHIEF · RECOMMENDED CARDS</span><h3>Build around your playstyle</h3></div><span>{cards.length} / 10 cards</span></div>
    <PlaystylePicker style={style} secondary={secondaryStyle} onChange={(next,second)=>{onStylesChange(next,second);if(second)setShowHand(true);}}/><div className="recommendation-actions"><button className="text-button" onClick={() => setShowHand(!showHand)} aria-expanded={showHand}>{showHand?'HIDE':'VIEW'} RECOMMENDED TEN</button>{onPropose && <button className="scenario-button" disabled={best.length!==10} onClick={() => onPropose(best,styleLabel)}>USE {secondaryStyle?"HYBRID":styleNames[style].toUpperCase()} HAND</button>}</div><p>{styleDescriptions[style]} {secondaryStyle&&styleDescriptions[secondaryStyle]}</p>{secondaryStyle&&<section className="hybrid-practices"><h4>{styleLabel} · recommended ten-card hand</h4><h5>Core practices</h5><ul>{hybridPractices(best,style,secondaryStyle,perkSelections).map((practice,i)=><li key={i}>{practice}</li>)}</ul></section>}
    {style==='Summons' && <div className="rat-plan"><strong>{rats.length ? `Your rats: ${rats.map(c=>title(c.name)).join(', ')}` : 'Add a rat summon to enable this plan.'}</strong><p>{feedback ? 'Feedback Loop is selected: its granted summon attacks reward your own melee attack abilities.' : 'Feedback Loop is a key candidate for turning your melee abilities into extra rat attacks.'} {supports.length ? `Support in hand: ${supports.map(c=>title(c.name)).join(', ')}.` : 'Look for granted attacks, granted movement, and nearby healing.'}</p><p>Feedback Loop, Silent Scream, and other Augments compete for the active slot unless Domination is active. Holding several cards active and playing summon losses reduces endurance.</p></div>}
    {activeAugment && <p>Active in your scenario: <strong>{title(activeAugment)}</strong>.</p>}
    <h4>{cards.length===10 ? 'Quick playstyle suggestions' : 'Complete your hand'}</h4>
    {cards.length===10 ? swaps.length ? <div className="swap-list quick-swap-grid">{swaps.map(s => <article className="swap-card" key={`${s.out.name}-${s.into.name}`}><div><span className="field-label">REPLACE</span><strong>{title(s.out.name)}</strong><span aria-hidden="true"> → </span>{inspect(s.into)}</div><SwapRationale explanation={s.explanation}/>{onSwap && <button className="scenario-button" onClick={() => onSwap(s.out,s.into)}>APPLY SWAP</button>}</article>)}</div> : <p>Your hand already fits this playstyle well under the current card ratings. Try another style to compare alternatives.</p> : <p>Choose ten cards or use the recommended hand below to start. Swaps appear once the hand is complete.</p>}
    
    {showHand && <ol className="recommended-hand">{best.map(c => <li key={c.name}>{inspect(c)}{secondaryStyle?<ul>{hybridCardReason(c,best,style,secondaryStyle,perkSelections).map((why,i)=><li key={i}>{why}</li>)}</ul>:<p>{cardReason(c,style)}</p>}</li>)}</ol>}
    <p className="guide-footnote">Suggestions use reviewed effects and playstyle fit, not simulated fight outcomes. Level-eligible cards are assumed available. Save the draft when ready.</p>
  </section>;
}
