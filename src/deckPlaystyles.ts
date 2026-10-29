import type {Style} from './mindthiefBuilds';
import {styles,styleNames} from './mindthiefBuilds.ts';
export function deckPlaystyles(deck:{playstyles?:Style[];name:string}):Style[]{
 if(deck.playstyles)return [...new Set(deck.playstyles.filter(s=>styles.includes(s)))].slice(0,2);
 return styles.filter(s=>deck.name.toLowerCase().includes(styleNames[s].toLowerCase())).slice(0,2);
}
export function scenarioPlaystyles(scenario:{playstyles?:Style[];deckName:string},deck?:{playstyles?:Style[];name:string}):Style[]{
 if(scenario.playstyles)return deckPlaystyles({name:scenario.deckName,playstyles:scenario.playstyles});
 return deck?deckPlaystyles(deck):deckPlaystyles({name:scenario.deckName});
}

