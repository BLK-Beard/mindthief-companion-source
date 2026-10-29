import type {BuildCard} from './mindthiefBuilds';
export type JournalBias={cards:Record<string,number>;combos:string[][]};
const normalize=(text:string)=>text.toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]+/g,' ').trim();
/** Match explicit card names and outcome words; never infer new card effects. */
export function readJournal(notes:string[],catalog:BuildCard[]):JournalBias {
 const cards:Record<string,number>={},combos:string[][]=[];
 for(const note of notes)for(const sentence of note.split(/[.!?\n]+/)){
  const text=normalize(sentence),mentions=catalog.filter(c=>text.includes(normalize(c.name))).map(c=>c.name);
  if(!mentions.length)continue;
  const negative=/\b(didn t work|doesn t work|did not work|does not work|not effective|failed|bad|weak|ineffective|poor|avoid|not useful|not good)\b/.test(text);
  const positive=/\b(worked|works|successful|success|effective|great|strong|good|excellent|combo|synergy)\b/.test(text);
  if(!negative&&!positive)continue;
  for(const name of mentions)cards[name]=Math.max(-1.5,Math.min(1.5,(cards[name]??0)+(negative?-0.75:0.75)));
  if(!negative&&mentions.length>1&&!combos.some(c=>c.length===mentions.length&&c.every(n=>mentions.includes(n))))combos.push(mentions);
 }
 return{cards,combos};
}
export function journalValue(hand:BuildCard[],bias?:JournalBias){if(!bias)return 0;const names=new Set(hand.map(c=>c.name));return hand.reduce((sum,c)=>sum+(bias.cards[c.name]??0),0)+Math.min(3,bias.combos.filter(combo=>combo.every(n=>names.has(n))).length)*1.5;}
