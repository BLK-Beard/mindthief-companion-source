import type { Effect, Half, SimSpec, Augment, Element, Condition } from './types';
const attack=(amount:number, extras:Partial<Extract<Effect,{kind:'attack'}>>={}):Effect=>({kind:'attack',amount,...extras});
const move=(amount:number, extras:Partial<Extract<Effect,{kind:'move'}>>={}):Effect=>({kind:'move',amount,...extras});
const infuse=(element:Element):Effect=>({kind:'infuse',element});
const consume=(element:Element,...effects:Effect[]):Effect=>({kind:'consume',element,effects});
const control=(...effects:Effect[]):Effect=>({kind:'control',range:4,effects});
const status=(condition:Condition,range=1,self=false):Effect=>({kind:'status',condition,range,self});
const grant=(action:'attack'|'move',amount:number,offset=false):Effect=>({kind:'grant',action,amount,offset});
const augment=(augment:Augment):Effect=>({kind:'augment',augment});
const half=(effects:Effect[],extras:Omit<Half,'effects'>={}):Half=>({effects,...extras});
const model=(top:Half,bottom:Half):SimSpec=>({top,bottom});
// Ordered, actor-specific combat effects. Optional consumption is expanded into legal options by the engine.
// Loot and money never contribute to the training encounter outcome.
export const cardModels:Record<string,SimSpec>={
 'submissive affliction':model(half([attack(2,{perCondition:1})]),half([control(move(1),consume('Ice',{kind:'suffer',amount:2}))])),
 'hidden in the shadows':model(half([attack(3,{killInvisible:true,advantage:true})]),half([status('Invisible',0,true)],{round:true})),
 'scurry':model(half([move(3),attack(2)]),half([{kind:'loot',amount:2}],{loss:true})),
 'withering claw':model(half([augment('withering'),attack(2,{conditions:['Wound']})],{active:true}),half([control(attack(2))])),
 'frigid apparition':model(half([attack(3),infuse('Ice')]),half([move(4),attack(2,{conditions:['Stun']}),infuse('Ice')],{loss:true})),
 "the mind's weakness":model(half([augment('weakness'),attack(2),{kind:'control',range:0,sameTarget:true,effects:[attack(2)]}],{active:true}),half([attack(1,{conditions:['Disarm']})])),
 'pilfer':model(half([attack(2),{kind:'loot',amount:1}]),half([move(4)])),
 'perverse edge':model(half([attack(3,{perCondition:2}),infuse('Dark')],{loss:true}),half([consume('Ice',status('Stun',1)),move(3)])),
 'empathetic assault':model(half([attack(4,{range:5,conditions:['Immobilize']}),infuse('Ice')],{loss:true}),half([move(2),{kind:'heal',amount:2,self:true}])),
 'psychic blade':model(half([augment('blade'),attack(3,{conditions:['Curse']}),{kind:'control',range:0,sameTarget:true,effects:[move(1)]}],{active:true}),half([move(3),{kind:'curseRound'}],{round:true})),
 'feedback loop':model(half([augment('feedback'),grant('attack',2),grant('move',0,true)],{active:true}),half([move(4,{jump:true,returnMuddle:true})])),
 'possession':model(half([control(attack(3,{conditions:['Muddle']}))]),half([move(3),grant('move',2)])),
 'gnawing horde':model(half([{kind:'summon',rat:{name:'Rat Swarm',hp:5,move:2,attack:2,poison:true}}],{active:true,loss:true}),half([move(4)])),
 'fearsome blade':model(half([attack(2,{push:2,conditions:['Curse'],boosts:[{element:'Ice',amount:2}]})]),half([status('Disarm',1),move(4)])),
 'hostile takeover':model(half([attack(2,{range:4,conditions:['Wound']}),infuse('Ice')]),half([{kind:'takeover',range:4},infuse('Dark')],{loss:true,round:true})),
 'brain leech':model(half([control(move(2),attack(2,{boosts:[{element:'Ice',amount:0,conditions:['Wound']}] }))]),half([attack(1),status('Strengthen',0,true)])),
 'cranium overload':model(half([attack(6,{range:4,pierce:5,killSplash:2,designated:true,melee:true})],{loss:true}),half([move(5,{jump:true})])),
 'frozen shiv':model(half([attack(4,{pierce:1}),infuse('Ice')]),half([attack(3),move(3),attack(3),infuse('Ice')],{loss:true})),
 'silent scream':model(half([augment('scream'),attack(2,{conditions:['Immobilize']})],{active:true}),half([control(attack(-1,{offset:true})),infuse('Ice')])),
 'mass hysteria':model(half([attack(1,{range:4,targets:4,pierce:3,conditions:['Muddle']}),infuse('Ice')]),half([move(3,{jump:true,throughPoison:true}),infuse('Dark')])),
 'gangling abomination':model(half([{kind:'summon',rat:{name:'Rat Monstrosity',hp:8,move:3,attack:3,conditional:true}}],{active:true,loss:true}),half([move(2),attack(2)])),
 'telepathic command':model(half([grant('attack',0,true),status('Invisible',0,true)]),half([move(4),grant('move',4)])),
 'dark frenzy':model(half([attack(3,{boosts:[{element:'Ice',amount:2},{element:'Dark',amount:2}]})]),half([move(3),{kind:'control',range:4,count:2,effects:[move(1)]},consume('Ice',{kind:'suffer',amount:1})])),
 'domination':model(half([{kind:'control',range:4,count:2,adjacent:true,effects:[attack(3)]}]),half([{kind:'persistent',effect:'domination'}],{active:true})),
 'psychic projection':model(half([augment('projection'),{kind:'pull',amount:2,range:3},attack(3)],{active:true}),half([attack(3,{range:4,designated:true,melee:true}),infuse('Dark')])),
 'shared nightmare':model(half([attack(2,{range:4,targets:2,conditions:['Poison'],boosts:[{element:'Dark',amount:0,conditions:['Curse']}]}),infuse('Ice')]),half([move(4),attack(1,{range:2,boosts:[{element:'Ice',amount:0,conditions:['Stun']}]})])),
 'corrupting embrace':model(half([attack(1,{conditions:['Disarm']}),attack(2,{conditions:['Muddle']})]),half([move(4),{kind:'persistent',effect:'charges'}],{loss:true,active:true})),
 'many as one':model(half([{kind:'summon',rat:{name:'Rat King',hp:10,move:3,attack:0,king:true}}],{loss:true,active:true}),half([{kind:'persistent',effect:'sharing'}],{loss:true,active:true})),
 'phantasmal killer':model(half([augment('killer'),attack(3,{conditions:['Disarm']})],{active:true}),half([move(2),{kind:'loot',amount:1},status('Invisible',0,true),infuse('Dark')])),
};
