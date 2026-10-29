import type {Style} from './mindthiefBuilds';
export type PerkSelections=Record<string,boolean[]>;
export type PerkDefinition={id:string;boxes:number;linked?:boolean;title:string;benefit:string;styles:Style[]};
export const mindthiefPerks:PerkDefinition[]=[
 {id:'replaceNegatives',boxes:2,title:'Replace two −1 cards with one +0 card',benefit:'After the attack ability, control its target to Move 1.',styles:['Control']},
 {id:'conditionDamage',boxes:3,title:'Replace one +0 with a +1 condition-bonus card',benefit:'Add +1 Attack for each negative condition the target already has.',styles:['Melee','Control']},
 {id:'replaceZero',boxes:2,title:'Replace one +0 card with one +2 card',benefit:'Improves the deck used by you and your summons.',styles:['Melee','Summons']},
 {id:'immobilize',boxes:1,title:'Add two +1 Immobilize cards',benefit:'Apply Immobilize after attack damage.',styles:['Melee','Control','Summons']},
 {id:'ice',boxes:3,title:'Add one +2 Ice card',benefit:'Infuse Ice after the acting figure’s turn; it cannot fund an earlier action.',styles:['Ice','Summons']},
 {id:'invisible',boxes:2,title:'Add one rolling Invisible Self card',benefit:'The attacking figure gains Invisible, including a rat drawing the card.',styles:['Melee','Summons']},
 {id:'scenario',boxes:1,title:'Ignore scenario effects and add one rolling +1 card',benefit:'The rolling +1 changes the modifier deck. These training encounters have no scenario penalties.',styles:['Melee','Ice','Control','Summons']},
 {id:'controlDeck',boxes:1,title:'Controlled enemy attacks may use your modifier deck',benefit:'Enables your upgraded deck for enemy attacks you control. Without this unlock, they use the monster deck.',styles:['Control']},
 {id:'lyingLow',boxes:1,title:'Count as last in initiative order for monster focus',benefit:'Changes focus tie-breaking for the Mindthief only; summons do not gain this benefit.',styles:['Melee','Control','Summons']},
 {id:'restControl',boxes:2,linked:true,title:'After each rest, consume Ice or Dark for enemy control',benefit:'Optionally control one enemy within Range 5 to perform Attack 1. Both connected boxes are required.',styles:['Ice','Control']},
];
export const masteries=[{id:'controlKills',text:'In a single scenario, kill 5 or more enemies with control abilities.'},{id:'fourAugments',text:'In a single scenario, trigger the on-attack effect from four different Augments at least 3 times each.'}];
export function perkCount(selections:PerkSelections|undefined,id:string){const definition=mindthiefPerks.find(p=>p.id===id);if(!definition)return 0;const boxes=selections?.[id]?.slice(0,definition.boxes)??[];return definition.linked?Number(boxes.filter(Boolean).length===definition.boxes):boxes.filter(Boolean).length;}
export function spentMarks(selections:PerkSelections|undefined){return mindthiefPerks.reduce((sum,p)=>sum+(selections?.[p.id]?.slice(0,p.boxes).filter(Boolean).length??0),0);}
export type Modifier={value:number;rolling?:boolean;effect?:'controlMove'|'conditionDamage'|'Immobilize'|'Ice'|'Invisible'};
export const specialModifiers:Record<number,Modifier>={101:{value:0,effect:'controlMove'},102:{value:1,effect:'conditionDamage'},103:{value:1,effect:'Immobilize'},104:{value:2,effect:'Ice'},105:{value:0,rolling:true,effect:'Invisible'},106:{value:1,rolling:true}};
export const baseModifiers=[-2,-1,-1,-1,-1,-1,0,0,0,0,0,0,1,1,1,1,1,2,-99,99];
export function modifierDeck(selections:PerkSelections={}){
 const deck=[...baseModifiers];const replace=(value:number,times:number,add:number)=>{for(let n=0;n<times;n++){const i=deck.indexOf(value);if(i<0)throw new Error('Perk replacements exceed the base modifier supply.');deck.splice(i,1);}deck.push(add);};
 for(let n=0;n<perkCount(selections,'replaceNegatives');n++)replace(-1,2,101);
 for(let n=0;n<perkCount(selections,'conditionDamage');n++)replace(0,1,102);
 for(let n=0;n<perkCount(selections,'replaceZero');n++)replace(0,1,2);
 if(perkCount(selections,'immobilize'))deck.push(103,103);
 for(let n=0;n<perkCount(selections,'ice');n++)deck.push(104);
 for(let n=0;n<perkCount(selections,'invisible');n++)deck.push(105);
 if(perkCount(selections,'scenario'))deck.push(106);
 return deck;
}
export function unlockedPerkAdvice(selections:PerkSelections,style:Style){return mindthiefPerks.filter(p=>perkCount(selections,p.id)>0&&p.styles.includes(style));}
