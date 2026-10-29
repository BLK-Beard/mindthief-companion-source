import {refreshAdvisorItems} from '../itemAdvisor.ts';
import type {AdvisorItem,ItemUse,ItemModel} from '../itemAdvisor';
import {modifierDeck,baseModifiers,specialModifiers,perkCount} from '../mindthiefPerks.ts';
import type {PerkSelections} from '../mindthiefPerks';
import type { Augment, Condition, Config, Effect, FightResult, Half, PlanTurn, RatSpec, SimCard } from './types';
type Status=Partial<Record<Condition,number>>;
type Ally={hp:number;pos:number;initiative:number};
type Enemy={role?:"melee"|"ranged"|"support";elite?:boolean;id:number;wave:number;hp:number;maxHp:number;pos:number;attack:number;range:number;move:number;shield:number;status:Status;acted:number;takeover:boolean};
type Rat=RatSpec & {hp:number;maxHp:number;pos:number;source:number;born:number;status:Status};
type Deck={cards:number[];cursor:number;shuffle:boolean;curses:number};
export type State={items:AdvisorItem[];itemRequests:number[];itemUses:ItemUse[];perks:PerkSelections;initiative:number;round:number;hp:number;maxHp:number;pos:number;allies:Ally[];allyHp:number;allyPos:number;zones:('hand'|'discard'|'lost'|'active'|'played')[];active:{card:number;side:'top'|'bottom';augment?:Augment;loss:boolean;effect?:string}[];rats:Rat[];enemies:Enemy[];wave:number;elements:{Ice:number;Dark:number};pending:{Ice:boolean;Dark:boolean};status:Status;moved:boolean;noMove:boolean;curseRound:boolean;charges:number;shared:boolean;damage:number;ratDamage:number;controlledDamage:number;conditionDamage:number;iceUses:number;mobileTurns:number;movement:number;jumpMovement:number;exhausted:boolean;rng:number[];playerDeck:Deck;enemyDeck:Deck;notes:string[]};
export type Play={itemIds?:number[];itemElement?:'Ice'|'Dark';top:number;bottom:number;topDefault:boolean;bottomDefault:boolean;bottomFirst:boolean;initiative:number;consumeMask:number;retreat?:boolean;rest?:number;dismiss?:number;shortRest?:boolean;restElement?:'Ice'|'Dark'|'none'};
type Actor={kind:'player'}|{kind:'ally';index?:number}|{kind:'rat';index:number}|{kind:'enemy';index:number};
type Context={last:number;controlled:number[];mask:number;sample:boolean;actor:Actor;allowSharing:boolean;sharingDepth?:number;attackOrigin?:number;retreat?:boolean};
const baseline=baseModifiers;
const live=(s:State)=>s.enemies.filter(e=>e.wave===s.wave&&e.hp>0);
const count=(s:State,zone:string)=>s.zones.filter(z=>z===zone).length;
const activeAugments=(s:State)=>s.active.flatMap(a=>a.augment?[a.augment]:[]);
const hasAugment=(s:State,a:Augment)=>s.active.some(x=>x.augment===a);
function random(s:State,stream:number):number {let x=s.rng[stream]|0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng[stream]=x>>>0;return(x>>>0)/4294967296;}
function shuffle(s:State,deck:Deck,stream:number) {for(let i=deck.cards.length-1;i>0;i--){const j=Math.floor(random(s,stream)*(i+1));[deck.cards[i],deck.cards[j]]=[deck.cards[j],deck.cards[i]];}deck.cursor=0;deck.shuffle=false;}
function deckClone(d:Deck):Deck{return{...d,cards:[...d.cards]};}
export function cloneState(s:State):State{return{...s,items:s.items.map(i=>({...i})),itemRequests:[...s.itemRequests],itemUses:[],zones:[...s.zones],allies:s.allies.map(a=>({...a})),active:s.active.map(a=>({...a})),rats:s.rats.map(r=>({...r,status:{...r.status}})),enemies:s.enemies.map(e=>({...e,status:{...e.status}})),elements:{...s.elements},pending:{...s.pending},status:{...s.status},rng:[...s.rng],playerDeck:deckClone(s.playerDeck),enemyDeck:deckClone(s.enemyDeck),notes:[]};}
export function startFight(cards:SimCard[],config:Config,seed:number):State {
 if(cards.length!==10||new Set(cards.map(c=>c.name)).size!==10||cards.some(c=>!c.simulationModel))throw new Error('Simulation requires ten unique, fully modeled cards.');
 const s:State={items:(config.equipment??[]).map(i=>({...i})),itemRequests:[],itemUses:[],perks:config.perks ?? {},initiative:50,round:1,hp:config.hp,maxHp:config.hp,pos:0,allies:Array.from({length:config.allyCount??(config.allyDamage?1:0)},(_,i)=>({hp:16,pos:0,initiative:25+i*25})),allyHp:config.allyDamage?16:0,allyPos:0,zones:cards.map(()=>'hand'),active:[],rats:[],enemies:[],wave:0,elements:{Ice:0,Dark:0},pending:{Ice:false,Dark:false},status:{},moved:false,noMove:false,curseRound:false,charges:0,shared:false,damage:0,ratDamage:0,controlledDamage:0,conditionDamage:0,iceUses:0,mobileTurns:0,movement:0,jumpMovement:0,exhausted:false,rng:[0,1,2,3,4].map(i=>((seed+1)*2654435761+i*2246822519)>>>0||1),playerDeck:{cards:[...modifierDeck(config.perks),...Array.from({length:(config.equipment??[]).reduce((n,i)=>n+i.penalty,0)},()=>-1)],cursor:0,shuffle:false,curses:0},enemyDeck:{cards:[...baseline],cursor:0,shuffle:false,curses:0},notes:[]};
 for(let wave=0;wave<2;wave++) {
  const varied=config.encounter==='mixed'||config.encounter==='volatile';
  const size=varied?3+Math.min(2,s.allies.length)+Math.floor(random(s,0)*3):3;
  for(let j=0;j<size;j++) {
   const role=varied?(['melee','ranged','support'] as const)[j<3?j:Math.floor(random(s,0)*3)]:config.encounter==='ranged'?'ranged':'melee';
   const elite=varied&&random(s,0)<0.25;
   const hp=(config.encounter==='armor'?8:role==='support'?6:7)+Math.floor(random(s,0)*3)+(elite?3:0);
   const status:Status={};
   if(config.encounter==='volatile'){const condition=([undefined,'Poison','Wound','Strengthen','Muddle'] as const)[Math.floor(random(s,0)*5)];if(condition)status[condition]=condition==='Poison'||condition==='Wound'?Infinity:1;}
   s.enemies.push({id:s.enemies.length,wave,hp,maxHp:hp,pos:3+j,role,elite,attack:(role==='melee'?3:2)+(elite?1:0),range:role==='melee'?1:3,move:2,shield:config.encounter==='armor'?2:elite?1:0,status,acted:0,takeover:false});
  }
 }
 shuffle(s,s.playerDeck,2);shuffle(s,s.enemyDeck,3);return s;
}
function expire(status:Status,round:number){for(const key of Object.keys(status) as Condition[])if((status[key]??Infinity)<=round)delete status[key];}
function negatives(status:Status){return(['Poison','Wound','Muddle','Disarm','Stun','Immobilize'] as Condition[]).filter(k=>status[k]!==undefined).length;}
function addCondition(s:State,e:Enemy,c:Condition){if(c==='Curse'){if(s.enemyDeck.curses<10){const d=s.enemyDeck;d.cards.splice(d.cursor+Math.floor(random(s,3)*(d.cards.length-d.cursor+1)),0,-100);d.curses++;}return;}e.status[c]=c==='Poison'||c==='Wound'?Infinity:s.round+(e.acted===s.round?1:0);}
export function drawResult(s:State,enemy:boolean,attack:number,advantage:number,sample:boolean,conditions=0):{damage:number;effects:string[];conditionalBonus?:number}{
 const d=enemy?s.enemyDeck:s.playerDeck,stream=enemy?3:2;
 const value=(code:number)=>code===102?1+conditions:specialModifiers[code]?.value??code;
 const damage=(codes:number[])=>codes.some(c=>c===-99||c===-100)?0:Math.max(0,(attack+codes.filter(c=>c!==99).reduce((v,c)=>v+value(c),0))*(codes.includes(99)?2:1));
 const effects=(codes:number[])=>codes.flatMap(c=>specialModifiers[c]?.effect&&c!==102?[specialModifiers[c].effect!]:[]);
 if(!sample){const possible=d.cards.slice(d.cursor);const terminal=possible.filter(c=>!specialModifiers[c]?.rolling);const mean=terminal.reduce((sum,c)=>sum+damage([c]),0)/Math.max(1,terminal.length);const rolling=possible.filter(c=>specialModifiers[c]?.rolling).reduce((v,c)=>v+value(c),0)/Math.max(1,terminal.length);return{damage:Math.max(0,mean+rolling),effects:[]};}
 const take=()=>{if(d.cursor>=d.cards.length)shuffle(s,d,stream);const code=d.cards[d.cursor++];if(code===-99||code===99)d.shuffle=true;if(code===-100){d.cards.splice(--d.cursor,1);d.curses--;}return code;};
 const rolling:number[]=[];let first=take();let guard=0;
 while(specialModifiers[first]?.rolling&&guard++<50){rolling.push(first);first=take();}
 let terminal=first;
 if(advantage){const second=take();const a=damage([first]),b=damage([second]);const aEffects=effects([first]),bEffects=effects([second]);
  if(advantage>0)terminal=b+bEffects.length*0.35>a+aEffects.length*0.35?second:first;
  else {const aExtra=aEffects.some(e=>!bEffects.includes(e)),bExtra=bEffects.some(e=>!aEffects.includes(e));const ambiguous=(a<b&&aExtra)||(b<a&&bExtra)||(aExtra&&bExtra);terminal=ambiguous?first:b<a||b===a&&aEffects.length>bEffects.length?second:first;}
 }
 const used=advantage<0?[terminal]:[...rolling,terminal];return{damage:damage(used),effects:effects(used),conditionalBonus:used.filter(c=>c===102).length*conditions};
}
function draw(s:State,enemy:boolean,attack:number,advantage:number,sample:boolean){return drawResult(s,enemy,attack,advantage,sample).damage;}
function hurtEnemy(s:State,e:Enemy,amount:number,owner:'player'|'rat'|'enemy'|'ally') {const applied=Math.min(e.hp,Math.max(0,amount));e.hp-=applied;if(owner!=='ally')s.damage+=applied;if(owner==='rat')s.ratDamage+=applied;if(owner==='enemy')s.controlledDamage+=applied;return applied;}
function actorPos(s:State,actor:Actor){return actor.kind==='player'?s.pos:actor.kind==='ally'?s.allies[actor.index??0]?.pos??s.allyPos:actor.kind==='rat'?s.rats[actor.index].pos:s.enemies[actor.index].pos;}
function targets(s:State,actor:Actor,range:number,origin?:number){const pos=origin??actorPos(s,actor);return live(s).filter(e=>(actor.kind!=='enemy'||e.id!==actor.index)&&Math.abs(e.pos-pos)<=range).sort((a,b)=>a.hp-b.hp||a.id-b.id);}
function heal(status:Status,hp:number,max:number,amount:number){const poison=status.Poison!==undefined;delete status.Poison;delete status.Wound;return poison?hp:Math.min(max,hp+amount);}
function healNearby(s:State,amount:number,range:number,self=false,origin=s.pos){
 if(self){s.hp=heal(s.status,s.hp,s.maxHp,amount);return;}
 const rat=s.rats.filter(r=>r.hp>0&&Math.abs(r.pos-origin)<=range).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
 const playerInRange=Math.abs(s.pos-origin)<=range;
 if(rat&&(rat.hp<rat.maxHp||rat.status.Poison!==undefined)&&(!playerInRange||rat.hp/rat.maxHp < s.hp/s.maxHp || s.hp===s.maxHp)){rat.hp=heal(rat.status,rat.hp,rat.maxHp,amount);s.notes.push(`Heal ${amount} on ${rat.name}`);}else if(playerInRange)s.hp=heal(s.status,s.hp,s.maxHp,amount);
}
function loseForDamage(s:State){const h=s.zones.findIndex(z=>z==='hand');if(h>=0){s.zones[h]='lost';s.notes.push('Lose a hand card to negate damage');return true;}const d=s.zones.flatMap((z,i)=>z==='discard'?[i]:[]);if(d.length>=2){s.zones[d[0]]=s.zones[d[1]]='lost';s.notes.push('Lose two discard cards to negate damage');return true;}return false;}
function hurtPlayer(s:State,amount:number){if(amount>=s.hp&&amount>0&&loseForDamage(s))return;s.hp=Math.max(0,s.hp-amount);}
function moveActor(s:State,actor:Actor,amount:number,retreat=false,jump=false){
 if(actor.kind==='player'&&(s.noMove||s.status.Immobilize!==undefined||s.status.Stun!==undefined))return;
 if(actor.kind==='rat'&&(s.rats[actor.index].status.Immobilize!==undefined||s.rats[actor.index].status.Stun!==undefined))return;
 if(actor.kind==='enemy'&&(s.enemies[actor.index].status.Immobilize!==undefined||s.enemies[actor.index].status.Stun!==undefined))return;
 const pos=actorPos(s,actor),enemy=live(s).filter(e=>actor.kind!=='enemy'||e.id!==actor.index).sort((a,b)=>Math.abs(a.pos-pos)-Math.abs(b.pos-pos))[0];if(!enemy)return;
 const delta=actor.kind==="player"&&retreat?-Math.sign(enemy.pos-pos||1)*amount:Math.sign(enemy.pos-pos)*Math.min(amount,Math.max(0,Math.abs(enemy.pos-pos)-1));
 if(actor.kind==='player'){s.pos+=delta;s.moved ||= delta!==0;s.movement+=Math.abs(delta);if(jump)s.jumpMovement+=Math.abs(delta);}else if(actor.kind==='rat')s.rats[actor.index].pos+=delta;else if(actor.kind==="ally"){const a=s.allies[actor.index??0];if(a)a.pos+=delta;}else {s.enemies[actor.index].pos+=delta;if(delta)s.notes.push(`Mindthief control: enemy ${actor.index+1} moves ${Math.abs(delta)}.`);}
}
function enabled(s:State,element:'Ice'|'Dark',mask:number){return !!(mask&(element==='Ice'?1:2))&&s.elements[element]>0;}
function claimItem(s:State,model:ItemModel,instruction:string):boolean{const i=s.items.find(i=>i.model===model&&i.status==='ready'&&!i.back&&s.itemRequests.includes(i.id));if(!i)return false;i.status=i.lost?'lost':i.spent?'spent':'ready';s.itemRequests=s.itemRequests.filter(id=>id!==i.id);s.itemUses.push({id:i.id,name:i.name,instruction});return true;}
function turnItems(s:State,play:Play){
 for(const [model,amount] of [['heal1',1],['heal3',3],['heal6',6]] as const)if(s.status.Stun===undefined&&s.hp<s.maxHp&&(amount===1||s.maxHp-s.hp>=amount||s.hp<=Math.max(2,Math.floor(s.maxHp/4)))&&claimItem(s,model,'During your turn, after start-of-turn effects: Heal '+amount+' Self.'))s.hp=heal(s.status,s.hp,s.maxHp,amount);
 if(play.itemElement&&s.elements[play.itemElement]<2&&!s.pending[play.itemElement]&&claimItem(s,'element','During your turn: infuse '+play.itemElement+'; available after this turn, not for this turn’s abilities.'))s.pending[play.itemElement]=true;
}
function runAttack(s:State,effect:Extract<Effect,{kind:'attack'}>,ctx:Context){
 const actor=ctx.actor,player=actor.kind==='player',rat=actor.kind==='rat'?s.rats[actor.index]:undefined,enemy=actor.kind==='enemy'?s.enemies[actor.index]:undefined;
 if((player&&(s.status.Disarm!==undefined||s.status.Stun!==undefined))||(rat&&(rat.status.Disarm!==undefined||rat.status.Stun!==undefined))||(enemy&&(enemy.status.Disarm!==undefined||enemy.status.Stun!==undefined)))return;
 const melee=effect.melee||effect.range===undefined;
 let amount=effect.offset?(rat?(rat.king?Math.ceil(rat.hp/2):rat.attack):enemy?.attack??0)+effect.amount:effect.amount;
 let conditions=[...(effect.conditions??[])];
 
 const augmentList=player?activeAugments(s):(rat||actor.kind==='ally')&&ctx.allowSharing&&s.active.some(a=>a.effect==='sharing')&&!s.shared?activeAugments(s):[];
 if((rat||actor.kind==='ally')&&augmentList.length)s.shared=true;
 if(player&&melee&&s.curseRound)conditions.push('Curse');
 if(melee&&augmentList.includes('withering'))conditions.push('Poison','Muddle');
 const range=effect.range??(augmentList.includes('blade')?2:1);
 const chosen=targets(s,actor,range,ctx.attackOrigin).slice(0,effect.targets??1);
 if(!chosen.length)return;
 const afterMoves:number[]=[];
 for(const boost of effect.boosts??[])if(enabled(s,boost.element,ctx.mask)){s.elements[boost.element]=0;if(boost.element==='Ice')s.iceUses++;amount+=boost.amount;conditions.push(...boost.conditions??[]);s.notes.push(`Consume ${boost.element}`);}
 for(const target of chosen){
  const targetConditions=[...conditions];
  let itemPierce=0;
  if(player&&target.shield>(effect.pierce??0)&&claimItem(s,'pierce1','Before drawing the modifier for your attack: add Pierce 1.'))itemPierce=1;
  if(player&&melee&&target.status.Wound===undefined&&claimItem(s,'wound','Before drawing the modifier for one of your melee attacks: add Wound.'))targetConditions.push('Wound');
  if(player&&melee&&claimItem(s,'curse','Before drawing the modifier for one of your melee attacks: add Curse.'))targetConditions.push('Curse');
  if(player&&melee&&s.charges>0){targetConditions.push('Stun','Curse');s.charges--;}
  ctx.last=target.id;
  let conditionPower=(effect.perCondition??0)*negatives(target.status);
  let power=amount+conditionPower;
  if(melee&&augmentList.includes('weakness'))power++;
  if(melee&&augmentList.includes('projection')){power+=negatives(target.status);conditionPower+=negatives(target.status);}
  if(rat?.conditional&&negatives(target.status)){power++;conditionPower++;}
  if(target.status.Poison!==undefined){power++;conditionPower++;}
  const status=player?s.status:rat?.status??enemy?.status??{};
  const adv=Number(effect.advantage||status.Strengthen!==undefined)-Number(status.Muddle!==undefined||(!melee&&Math.abs(target.pos-actorPos(s,actor))<=1));
  const useOwnForControl=!!enemy&&perkCount(s.perks,'controlDeck')>0&&drawResult(s,false,power,adv,false,negatives(target.status)).damage>=drawResult(s,true,power,adv,false,negatives(target.status)).damage;
  const drawn=actor.kind==='ally'?{damage:Math.max(0,power),effects:[],conditionalBonus:0}:drawResult(s,!!enemy&&!useOwnForControl,Math.max(0,power),adv,ctx.sample,negatives(target.status));
  const raw=drawn.damage;conditionPower+=drawn.conditionalBonus??0;
  const wasAlive=target.hp>0;
  const applied=hurtEnemy(s,target,Math.max(0,raw-Math.max(0,target.shield-(effect.pierce??0)-itemPierce)),actor.kind);
  if(actor.kind!=='ally')s.conditionDamage+=Math.min(applied,conditionPower);
  for(const condition of targetConditions)if(target.hp>0)addCondition(s,target,condition);
  for(const added of drawn.effects){
   if(added==='Immobilize'&&target.hp>0)addCondition(s,target,'Immobilize');
   if(added==='Ice')s.pending.Ice=true;
   if(added==='Invisible'){if(player)s.status.Invisible=s.round+1;else if(rat)rat.status.Invisible=s.round+1;}
   if(added==='controlMove'&&target.hp>0)afterMoves.push(target.id);
  }
  if(rat?.poison&&target.hp>0)addCondition(s,target,'Poison');
  if(effect.push&&target.hp>0)target.pos+=Math.sign(target.pos-actorPos(s,actor)||1)*effect.push;
  if(effect.killInvisible&&wasAlive&&target.hp<=0)s.status.Invisible=s.round+1;
  if(effect.killSplash&&target.hp<=0)runAttack(s,{kind:'attack',amount:effect.killSplash,range:1,melee:true,targets:99},{...ctx,attackOrigin:target.pos});
 }
 for(const id of afterMoves)if(s.enemies[id].hp>0){runEffects(s,[{kind:'control',range:0,sameTarget:true,effects:[{kind:'move',amount:1}]}],{...ctx,last:id});s.notes.push('Modifier: control target Move 1');}
 // Each attack ability triggers once, even when it attacks several targets.
 if(melee&&chosen.length){
  if(augmentList.includes('feedback'))runEffects(s,[{kind:'grant',action:'attack',amount:0,offset:true}],{...ctx,allowSharing:false,sharingDepth:rat||actor.kind==='ally'?1:0});
  if(augmentList.includes('scream'))healNearby(s,2,2,false,actorPos(s,actor));
  if(augmentList.includes('killer')&&ctx.last>=0){const target=s.enemies[ctx.last];if(target.hp>0){runEffects(s,[{kind:'attack',amount:3}],{...ctx,actor:{kind:'enemy',index:target.id},attackOrigin:undefined,allowSharing:false});if(enabled(s,'Dark',ctx.mask)){s.elements.Dark=0;hurtEnemy(s,target,3,'enemy');s.notes.push('Dark: controlled enemy suffers 3');}}}
 }
}
function runEffects(s:State,effects:Effect[],ctx:Context){for(const effect of effects){
 switch(effect.kind){
  case 'attack':runAttack(s,effect,ctx);break;
  case 'move':{
   let amount=effect.amount,jump=!!effect.jump;
   if(ctx.actor.kind==='player'){
    const distance=Math.min(...live(s).map(e=>Math.abs(e.pos-s.pos)),Infinity);
    if((ctx.retreat||distance-1>amount)&&claimItem(s,'move1','During your Move ability: add +1 Move.'))amount++;
    if(!jump&&s.itemUses.some(i=>s.items.find(x=>x.id===i.id)?.model==='jump'))jump=true;
    if(!jump&&claimItem(s,'jump','Before moving during your turn: gain Jump on your Move abilities this round.'))jump=true;
   }
   const before=actorPos(s,ctx.actor);moveActor(s,ctx.actor,amount,ctx.retreat,jump);
   if(effect.throughPoison)for(const e of live(s))if(e.pos>=Math.min(before,s.pos)&&e.pos<=Math.max(before,s.pos))addCondition(s,e,'Poison');
   if(effect.returnMuddle&&ctx.actor.kind==='player') {const near=live(s).filter(e=>Math.abs(e.pos-before)*2<=effect.amount);if(near.length){s.pos=before;s.moved=true;for(const e of near)addCondition(s,e,'Muddle');}}
   break;
  }
  case 'heal':healNearby(s,effect.amount,effect.range??0,effect.self);break;
  case 'status':if(effect.self){if(effect.condition==='Invisible'&&s.noMove)break;s.status[effect.condition]=s.round+1;}else for(const e of targets(s,ctx.actor,effect.range??1).slice(0,1))addCondition(s,e,effect.condition);break;
  case 'infuse':s.pending[effect.element]=true;break;
  case 'consume':if(enabled(s,effect.element,ctx.mask)){s.elements[effect.element]=0;if(effect.element==="Ice")s.iceUses++;s.notes.push(`Consume ${effect.element}`);runEffects(s,effect.effects,ctx);}break;
  case 'grant':{
   if(ctx.sharingDepth&&ctx.actor.kind==='ally')break; // This training ally has no summons of its own.
   const rats=s.rats.flatMap((r,i)=>r.hp>0&&!(ctx.sharingDepth&&ctx.actor.kind==='rat'&&ctx.actor.index===i)?[i]:[]).sort((a,b)=>{
    const reach=(i:number)=>live(s).some(e=>Math.abs(e.pos-s.rats[i].pos)<=1)?1:0;
    return effect.action==='attack'?reach(b)-reach(a)||s.rats[b].attack-s.rats[a].attack:Math.abs(s.rats[a].pos-s.pos)-Math.abs(s.rats[b].pos-s.pos);
   });const i=rats[0];if(i===undefined)break;const r=s.rats[i];
   if(effect.action==='move'){moveActor(s,{kind:'rat',index:i},effect.offset?r.move+effect.amount:effect.amount);s.notes.push(`Grant ${r.name} Move ${effect.offset?'+':''}${effect.amount}`);}else{runAttack(s,{kind:'attack',amount:effect.amount,offset:effect.offset},{...ctx,actor:{kind:'rat',index:i},attackOrigin:undefined,allowSharing:(ctx.sharingDepth??0)===0});s.notes.push(`Grant ${r.name} Attack ${effect.offset?'+':''}${effect.amount}`);}break;
  }
  case 'control':{
   let controlled=effect.sameTarget?(ctx.last>=0&&s.enemies[ctx.last].hp>0?[s.enemies[ctx.last]]:[]):targets(s,ctx.actor,effect.range);
   if(effect.adjacent)controlled=controlled.filter(e=>controlled.some(other=>other!==e&&Math.abs(e.pos-other.pos)<=1));
   controlled=controlled.slice(0,effect.count??1);ctx.controlled=controlled.map(e=>e.id);
   for(const e of controlled){s.notes.push(`Mindthief control: enemy ${e.id+1} performs only the printed granted abilities.`);runEffects(s,effect.effects,{...ctx,actor:{kind:'enemy',index:e.id},attackOrigin:undefined,allowSharing:false});if(hasAugment(s,'killer')&&enabled(s,'Dark',ctx.mask)){s.elements.Dark=0;hurtEnemy(s,e,3,'enemy');}}break;
  }
  case 'suffer':for(const i of ctx.controlled){const e=s.enemies[i];if(e.hp>0)hurtEnemy(s,e,effect.amount,'enemy');}break;
  case 'augment':break; // Activated by the half before resolving its other effects.
  case 'summon':s.rats.push({...effect.rat,maxHp:effect.rat.hp,hp:effect.rat.hp,pos:s.pos,source:-1,born:s.round,status:{}});s.notes.push(`Summon ${effect.rat.name}`);break;
  case 'takeover':{const e=targets(s,ctx.actor,effect.range).filter(e=>e.acted!==s.round)[0];if(e){e.takeover=true;s.notes.push('Reverse one enemy turn');}break;}
  case 'persistent':if(effect.effect==='charges')s.charges=4;break;
  case 'curseRound':s.curseRound=true;break;
  case 'pull':{const e=targets(s,ctx.actor,effect.range)[0];if(e)e.pos-=Math.sign(e.pos-s.pos)*Math.min(effect.amount,Math.max(0,Math.abs(e.pos-s.pos)-1));break;}
  case 'loot':break;
 }
}}
function monsterTurns(s:State,sample:boolean){for(const e of live(s)){
 if(e.status.Wound!==undefined)hurtEnemy(s,e,1,'player');if(e.hp<=0)continue;
 if(e.status.Stun===undefined){
  if(e.takeover){runAttack(s,{kind:'attack',amount:e.attack,range:e.range},{last:-1,controlled:[],mask:0,sample,actor:{kind:'enemy',index:e.id},attackOrigin:undefined,allowSharing:false});}
  else if(e.role==='support'){
   const friends=live(s).filter(other=>other!==e&&Math.abs(other.pos-e.pos)<=3);
   const injured=friends.filter(other=>other.hp<other.maxHp||other.status.Poison!==undefined||other.status.Wound!==undefined).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
   if(injured){injured.hp=heal(injured.status,injured.hp,injured.maxHp,2);s.notes.push('Enemy support heals a nearby monster');}
   else if(friends.length){const target=friends.sort((a,b)=>b.attack-a.attack)[0];addCondition(s,target,'Strengthen');s.notes.push('Enemy support strengthens a nearby monster');}
  }
  else {
   const potential:{kind:'player'|'rat'|'ally';index:number;pos:number}[]=[];
   if(s.hp>0&&s.status.Invisible===undefined)potential.push({kind:'player',index:0,pos:s.pos});
   s.rats.forEach((r,i)=>{if(r.hp>0&&r.status.Invisible===undefined)potential.push({kind:'rat',index:i,pos:r.pos});});
   s.allies.forEach((a,index)=>{if(a.hp>0)potential.push({kind:'ally',index,pos:a.pos});});
   const focusInitiative=(t:typeof potential[number])=>t.kind==='ally'?s.allies[t.index].initiative:t.kind==='rat'?s.initiative-0.1:perkCount(s.perks,'lyingLow')?Infinity:s.initiative;
   potential.sort((a,b)=>Math.abs(a.pos-e.pos)-Math.abs(b.pos-e.pos)||focusInitiative(a)-focusInitiative(b));
   const t=potential[0];if(t){const oldPos=e.pos;if(e.status.Immobilize===undefined)e.pos+=Math.sign(t.pos-e.pos)*Math.min(e.move,Math.max(0,Math.abs(t.pos-e.pos)-e.range));if(e.pos!==oldPos)s.notes.push(`Automatic enemy turn: enemy ${e.id+1} moves ${Math.abs(e.pos-oldPos)} toward its focus.`);
    if(Math.abs(t.pos-e.pos)<=e.range&&e.status.Disarm===undefined){const targetStatus=t.kind==='player'?s.status:t.kind==='rat'?s.rats[t.index].status:{};const power=e.attack+Number(targetStatus.Poison!==undefined);const amount=draw(s,true,power,Number(e.status.Strengthen!==undefined)-Number(e.status.Muddle!==undefined),sample);
     if(t.kind==='player')hurtPlayer(s,amount);else if(t.kind==='rat')s.rats[t.index].hp=Math.max(0,s.rats[t.index].hp-amount);else s.allies[t.index].hp=Math.max(0,s.allies[t.index].hp-amount);
    }
   }
  }
 }e.acted=s.round;e.takeover=false;expire(e.status,s.round);
}}
function finishInfusions(s:State){for(const element of ['Ice','Dark'] as const)if(s.pending[element]){s.elements[element]=2;s.pending[element]=false;}}
function summonTurns(s:State,sample:boolean){s.rats.forEach((r,i)=>{if(r.hp<=0||r.born>=s.round)return;if(r.status.Wound!==undefined)r.hp--;if(r.hp<=0)return;if(r.status.Stun===undefined){moveActor(s,{kind:'rat',index:i},r.move);runAttack(s,{kind:'attack',amount:0,offset:true},{last:-1,controlled:[],mask:3,sample,actor:{kind:'rat',index:i},allowSharing:true});}expire(r.status,s.round);finishInfusions(s);});}
function restPerk(s:State,sample:boolean,choice?:'Ice'|'Dark'|'none'){
 if(choice==='none')return;
 if(!perkCount(s.perks,'restControl'))return;
 const target=live(s).find(e=>Math.abs(e.pos-s.pos)<=5&&live(s).some(other=>other!==e&&Math.abs(other.pos-e.pos)<=1));
 const element=choice?(s.elements[choice]>0?choice:undefined):s.elements.Ice>0&&(s.elements.Dark<=0||hasAugment(s,'killer'))?'Ice':s.elements.Dark>0?'Dark':undefined;
 if(target&&element){s.elements[element]=0;if(element==='Ice')s.iceUses++;s.notes.push(`Rest perk: consume ${element} for controlled Attack 1`);runEffects(s,[{kind:'control',range:0,sameTarget:true,effects:[{kind:'attack',amount:1}]}],{last:target.id,controlled:[],mask:3,sample,actor:{kind:'player'},allowSharing:false});}
}
function allyTurn(s:State,config:Config,index:number){const ally=s.allies[index];if(!ally||ally.hp<=0)return;const target=live(s).sort((a,b)=>Math.abs(a.pos-ally.pos)-Math.abs(b.pos-ally.pos))[0];if(target){ally.pos+=Math.sign(target.pos-ally.pos)*Math.min(2,Math.max(0,Math.abs(target.pos-ally.pos)-1));if(Math.abs(target.pos-ally.pos)<=1)runAttack(s,{kind:'attack',amount:config.allyDamage},{last:-1,controlled:[],mask:3,sample:false,actor:{kind:'ally',index},allowSharing:true});}s.allyHp=s.allies.reduce((hp,a)=>hp+a.hp,0);s.allyPos=s.allies[0]?.pos??0;}
function halfFor(card:SimCard,side:'top'|'bottom',basic:boolean):Half{return basic?{effects:[side==='top'?{kind:'attack',amount:2}:{kind:'move',amount:2}]}:card.simulationModel![side];}
function activate(s:State,index:number,side:'top'|'bottom',half:Half){
 const aug=half.effects.find(e=>e.kind==='augment');
 if(aug?.kind==='augment'){
  const capacity=s.active.some(a=>a.effect==='domination')?2:1;
  const prior=s.active.filter(a=>a.augment);
  if(prior.length>=capacity){const old=prior[0];s.zones[old.card]=old.loss?'lost':'discard';s.active=s.active.filter(a=>a!==old);}
  const names:Record<Augment,string>={withering:"Withering Claw",weakness:"The Mind's Weakness",blade:"Psychic Blade",feedback:"Feedback Loop",scream:"Silent Scream",projection:"Psychic Projection",killer:"Phantasmal Killer"}; s.notes.push(`Activate ${names[aug.augment]}`);
 }
 if(half.active){const persistent=half.effects.find(e=>e.kind==='persistent');s.active.push({card:index,side,loss:!!half.loss,augment:aug?.kind==='augment'?aug.augment:undefined,effect:persistent?.kind==='persistent'?persistent.effect:undefined});s.zones[index]='active';}else s.zones[index]=half.loss?'lost':'discard';
}
function rest(s:State,play:Play,sample:boolean){if(play.dismiss!==undefined){const a=s.active.find(a=>a.card===play.dismiss);if(a){s.active=s.active.filter(x=>x!==a);s.zones[a.card]=a.loss?'lost':'discard';}}if(play.rest!==undefined){const eligible=(i:number)=>s.zones[i]==="discard"||s.active.some(a=>a.card===i&&!a.loss);const chosen=eligible(play.rest)?play.rest:s.zones.findIndex((_,i)=>eligible(i));if(chosen>=0){s.zones[chosen]="lost";s.active=s.active.filter(a=>a.card!==chosen);}}for(let i=0;i<s.zones.length;i++)if(s.zones[i]==='discard')s.zones[i]='hand';s.hp=heal(s.status,s.hp,s.maxHp,2);s.items=refreshAdvisorItems(s.items);s.notes.push('Long rest: chosen loss, Heal 2, refresh spent items');restPerk(s,sample,play.restElement);}
export function step(s0:State,cards:SimCard[],config:Config,play:Play,sample:boolean):State{
 const s=cloneState(s0);s.itemRequests=[...(play.itemIds??[])];s.initiative=play.initiative;s.moved=false;s.noMove=false;s.shared=false;s.curseRound=false;
 if(play.rest===undefined){s.zones[play.top]='played';s.zones[play.bottom]='played';}
 const monsterInitiative=sample?10+Math.floor(random(s,1)*80):50;
 const events=[{initiative:monsterInitiative,kind:'enemy'},...s.allies.map((a,index)=>({initiative:a.initiative,kind:'ally',index})),{initiative:play.initiative,kind:'player'}].sort((a,b)=>a.initiative-b.initiative||(a.kind==='player'?-1:1));
 for(const event of events){if(s.hp<=0)break;if(config.advisorOnly&&event.kind!=='player')continue;
  if(event.kind==='enemy'){monsterTurns(s,sample);finishInfusions(s);}else if(event.kind==='ally'){allyTurn(s,config,'index' in event?event.index:0);finishInfusions(s);}else{
   summonTurns(s,sample);
   if(s.items.some(i=>i.model==='immunities')){delete s.status.Disarm;delete s.status.Stun;delete s.status.Muddle;}
   if(s.status.Wound!==undefined)hurtPlayer(s,1);if(s.hp<=0)break;
   if(play.rest!==undefined){rest(s,play,sample);turnItems(s,play);}
   else{
    turnItems(s,play);
    const sequence:('top'|'bottom')[]=play.bottomFirst?['bottom','top']:['top','bottom'];
    const ctx:Context={last:-1,controlled:[],mask:play.consumeMask,retreat:play.retreat,sample,actor:{kind:'player'},allowSharing:false};
    for(const side of sequence){const index=side==='top'?play.top:play.bottom;let half=halfFor(cards[index],side,side==='top'?play.topDefault:play.bottomDefault);
     if(side==='bottom'&&play.bottomDefault&&s.items.some(i=>i.model==='defaultMove3'))half={effects:[{kind:'move',amount:3}]};
     if(s.status.Stun!==undefined){s.zones[index]="discard";continue;}
     activate(s,index,side,half);
     if(cards[index].name==='hidden in the shadows'&&side==='bottom'&&!play.bottomDefault){if(s.moved)continue;s.noMove=true;s.status.Invisible=s.round;continue;}
     const ratCount=s.rats.length;runEffects(s,half.effects,ctx);for(let i=ratCount;i<s.rats.length;i++)s.rats[i].source=index;
    }
   }
   expire(s.status,s.round);finishInfusions(s);
  }
 }
 for(let i=0;i<s.zones.length;i++)if(s.zones[i]==="played")s.zones[i]="discard";
 if(play.shortRest&&count(s,'discard')>=2)applyShortRest(s,sample,play.restElement);
 for(const element of ['Ice','Dark'] as const)s.elements[element]=Math.max(0,s.elements[element]-1);
 s.pending={Ice:false,Dark:false};
 for(const d of [s.playerDeck,s.enemyDeck])if(d.shuffle)shuffle(s,d,d===s.playerDeck?2:3);
 for(const rat of s.rats)if(rat.hp<=0&&rat.source>=0){s.zones[rat.source]='lost';s.active=s.active.filter(a=>a.card!==rat.source);}
 if(!live(s).length&&s.wave===0){s.wave=1;for(const e of live(s))e.pos=s.pos+3+(e.id%3);s.notes.push('Enter second training room');}
 if(play.retreat&&s.moved)s.notes.push("Reposition away from the nearest enemy");
 if(s.moved&&(s.damage-s.ratDamage)>(s0.damage-s0.ratDamage))s.mobileTurns++;
 s.round++;return s;
}
/** Upper bound on remaining action turns while current persistent cards stay active.
 * No future damage negation or loss actions; rests lose one discarded card. */
export function remainingActionTurns(s:State):number {
 let hand=count(s,'hand'),discard=count(s,'discard'),turns=0;
 for(let cycle=0;cycle<s.zones.length+1;cycle++){
  const played=Math.floor(hand/2);turns+=played;hand-=played*2;discard+=played*2;
  if(discard<2)break;hand+=discard-1;discard=0;
 }
 return turns;
}
export function potential(s:State,config:Config){
 const remaining=s.enemies.reduce((v,e)=>v+e.hp,0),rats=s.rats.filter(r=>r.hp>0);
 const turns=Math.min(4,Math.max(0,config.rounds-s.round+1));
 let setup=rats.reduce((v,r)=>v+r.hp*0.6+(r.king?Math.ceil(r.hp/2):r.attack)*turns*0.65,0);
 for(const aug of activeAugments(s))setup+=turns*(aug==='feedback'?(rats.length?2:0):aug==='weakness'?1.1:aug==='scream'?0.8:aug==='killer'?2.2:aug==='withering'?1:0.6);
 const styleUtility=(style:Config["playstyle"])=>style==="Scurry"?s.movement*2+Math.min(5,Math.min(...live(s).map(e=>Math.abs(e.pos-s.pos)),5))*0.4:style==="Melee"?s.conditionDamage*0.9:style==="Ice"?s.iceUses*1.2+s.elements.Ice*1.5:style==="Control"?s.controlledDamage*1.2:style==="Summons"?s.ratDamage*1.2+rats.reduce((v,r)=>v+r.hp*0.5,0):0;
 const styleValue=config.secondaryPlaystyle?(styleUtility(config.playstyle)+styleUtility(config.secondaryPlaystyle))/2:styleUtility(config.playstyle);
 return styleValue-remaining*1.6+s.hp*2+remainingActionTurns(s)*0.25+s.allies.reduce((hp,a)=>hp+a.hp,0)*0.25+setup+(count(s,'hand')+count(s,'discard'))*1.4+live(s).reduce((v,e)=>v+negatives(e.status)*0.6,0)+(s.hp<=0?-100:0)+(s.exhausted?-40:0);
}
function rough(effects:Effect[],s:State):number{return effects.reduce((value,e)=>value+(e.kind==='attack'?Math.max(0,e.amount)*(e.targets??1)+1:e.kind==='move'?Math.min(e.amount,Math.max(0,...live(s).map(x=>Math.abs(x.pos-s.pos)-1)))*0.8:e.kind==='summon'?17:e.kind==='augment'?s.active.some(a=>a.augment===e.augment)?-8:4:e.kind==='grant'?s.rats.some(r=>r.hp>0)?4:-8:e.kind==='control'?3+rough(e.effects,s):e.kind==='heal'?Math.min(e.amount,s.maxHp-s.hp):e.kind==='consume'?rough(e.effects,s)*0.5:e.kind==='persistent'?2:e.kind==='status'?2:e.kind==='infuse'?1:0),0);}
function halfPriority(half:Half,s:State,config:Config){
 const moves=half.effects.filter((e):e is Extract<Effect,{kind:'move'}>=>e.kind==='move');
 const scurry=config.playstyle==='Scurry'||config.secondaryPlaystyle==='Scurry';
 const pure=config.playstyle==='Scurry'&&!config.secondaryPlaystyle;
 const normal=rough(half.effects,s);
 return scurry?normal*(pure?0.1:1)+moves.reduce((n,e)=>n+e.amount,0)*(pure?5:2)+Number(moves.some(e=>e.jump))*2:normal;
}
export function plays(s:State,cards:SimCard[],config:Config):Play[]{
 const hand=s.zones.flatMap((z,i)=>z==='hand'?[i]:[]),out:Play[]=[];
 const options=(side:'top'|'bottom')=>hand.flatMap(i=>[false,true].filter(basic=>basic||config.augmentPlan===undefined||!cards[i].simulationModel![side].effects.some(e=>e.kind==='augment')||config.augmentPlan.includes(cards[i].name)).map(basic=>({i,basic,score:halfPriority(halfFor(cards[i],side,basic),s,config)-(halfFor(cards[i],side,basic).loss?Math.max(0,count(s,'hand')+count(s,'discard')-2)*0.65:0)}))).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,5);
 const masks=[0,...s.elements.Ice>0?[1]:[],...s.elements.Dark>0?[2]:[],...s.elements.Ice>0&&s.elements.Dark>0?[3]:[]];
 for(const top of options('top'))for(const bottom of options('bottom'))if(top.i!==bottom.i)for(const bottomFirst of [false,true])for(const initiative of [...new Set([+cards[top.i].initiative,+cards[bottom.i].initiative])].sort((a,b)=>a-b))for(const consumeMask of masks)for(const retreat of config.playstyle==="Scurry"||config.secondaryPlaystyle==="Scurry"||config.advisorOnly&&(config.playstyle==='Summons'||config.secondaryPlaystyle==='Summons')&&!s.rats.some(r=>r.hp>0)&&halfFor(cards[top.i],'top',top.basic).effects.some(e=>e.kind==='summon')&&halfFor(cards[bottom.i],'bottom',bottom.basic).effects.some(e=>e.kind==='move')?[false,true]:[false])out.push({top:top.i,bottom:bottom.i,topDefault:top.basic,bottomDefault:bottom.basic,bottomFirst,initiative,consumeMask,retreat});
 const discard=s.zones.flatMap((z,i)=>z==='discard'?[i]:[]);
 const recoverable=s.active.filter(a=>!a.loss).map(a=>a.card);
 if(discard.length+recoverable.length>=2)for(const i of [...discard,...recoverable])out.push({top:-1,bottom:-1,topDefault:false,bottomDefault:false,bottomFirst:false,initiative:99,consumeMask:0,rest:i});
 for(const a of s.active.filter(a=>!a.loss&&a.augment))if(discard.length>=1)for(const i of [...discard,a.card])out.push({top:-1,bottom:-1,topDefault:false,bottomDefault:false,bottomFirst:false,initiative:99,consumeMask:0,rest:i,dismiss:a.card});
 return out.flatMap(play=>{
  const available=s.items.filter(i=>i.model&&i.model!=='defaultMove3'&&i.model!=='immunities'&&!i.back&&(i.status==='ready'||play.rest!==undefined&&i.spent&&i.status!=='lost'));
  if(!available.length)return [play];
  const itemIds=available.map(i=>i.id),variants=[play,{...play,itemIds}];
  if(available.some(i=>i.model==='element'))for(const itemElement of ['Ice','Dark'] as const)if(cards.some(c=>JSON.stringify(c.simulationModel).includes(itemElement)))variants.push({...play,itemIds,itemElement});
  return variants;
 });
}
function applyShortRest(s:State,sample:boolean,element?:'Ice'|'Dark'|'none',chosen?:number){
 const d=s.zones.flatMap((z,i)=>z==='discard'?[i]:[]);if(d.length<2)return;
 const lost=chosen!==undefined&&d.includes(chosen)?chosen:d[sample?Math.floor(random(s,4)*d.length):Math.floor(d.length/2)];
 s.zones[lost]='lost';for(const i of d)if(i!==lost)s.zones[i]='hand';s.notes.push('Short rest: random discard loss');restPerk(s,sample,element);finishInfusions(s);
}
/** End-of-round choice, before elements wane. Used for live cleanup advice. */
export function finishRoundRest(s0:State,short:boolean,sample:boolean,element?:'Ice'|'Dark'|'none',chosen?:number):State{
 const s=cloneState(s0);if(short)applyShortRest(s,sample,element,chosen);
 for(const e of ['Ice','Dark'] as const)s.elements[e]=Math.max(0,s.elements[e]-1);
 s.round++;return s;
}
export function prepare(s0:State,sample:boolean):State{
 const s=cloneState(s0);
 if(count(s,'hand')>=2)return s;
 // Dismissing a non-loss Augment may make a final recovery possible.
 if(count(s,'discard')<2){const a=s.active.find(a=>!a.loss&&a.augment);if(a){s.active=s.active.filter(x=>x!==a);s.zones[a.card]='discard';s.notes.push('Dismiss Augment for recovery');}}
 if(count(s,'discard')<2){s.exhausted=s.active.filter(a=>!a.loss).length+count(s,'discard')<2;return s;}
 const d=s.zones.flatMap((z,i)=>z==='discard'?[i]:[]);
 const lost=d[sample?Math.floor(random(s,4)*d.length):Math.floor(d.length/2)];
 s.zones[lost]='lost';for(const i of d)if(i!==lost)s.zones[i]='hand';s.notes.push('Short rest: random discard loss');restPerk(s,sample);finishInfusions(s);if(count(s,'hand')<2&&count(s,'discard')+s.active.filter(a=>!a.loss).length<2)s.exhausted=true;return s;
}
export function choosePlay(s:State,cards:SimCard[],config:Config,depth=1):Play|undefined{
 const candidates=plays(s,cards,config);if(!candidates.length)return;
 const scored=candidates.map(play=>{const next=step(s,cards,config,play,false);return{play,next,value:potential(next,config)};}).sort((a,b)=>b.value-a.value);
 if(depth>1&&s.round<config.rounds)for(const candidate of scored.slice(0,3)){
  const ready=prepare(candidate.next,false);let future=potential(ready,config);
  if(!ready.exhausted&&ready.hp>0&&ready.enemies.some(e=>e.hp>0)){const next=choosePlay(ready,cards,config,1);if(next)future=potential(step(ready,cards,config,next,false),config);}
  candidate.value=0.25*candidate.value+0.75*future;
 }
 return (depth>1?scored.slice(0,3).sort((a,b)=>b.value-a.value):scored)[0].play;
}
export function simulateFight(cards:SimCard[],config:Config,seed:number,depth=1,record=false):FightResult{
 let s=startFight(cards,config,seed);const plan:PlanTurn[]=[];let rounds=0;
 while(s.round<=config.rounds&&s.hp>0&&s.enemies.some(e=>e.hp>0)){
  let ready=prepare(s,true),play:Play|undefined;
  if(count(s,'hand')<2){
   const long=choosePlay(s,cards,config,depth);
   const expected=prepare(s,false),short=expected.exhausted?undefined:choosePlay(expected,cards,config,depth);
   if(long&&(!short||potential(step(s,cards,config,long,false),config)>potential(step(expected,cards,config,short,false),config))){ready=cloneState(s);play=long;}
  }
  if(ready.exhausted){s=ready;break;}
  play??=choosePlay(ready,cards,config,depth);if(!play){s=ready;s.exhausted=true;break;}
  const next=step(ready,cards,config,play,true);rounds++;
  for(let i=0;i<s.zones.length;i++)if(s.zones[i]==='discard'&&ready.zones[i]==='lost')ready.notes.push(`Assumed short-rest loss: ${cards[i].name}`);
  if(record)plan.push({round:s.round,initiative:play.initiative,top:play.rest!==undefined?'Long rest':`${cards[play.top].name}${play.topDefault?' · Attack 2':''}`,bottom:play.rest!==undefined?`Lose ${cards[play.rest].name}`:`${cards[play.bottom].name}${play.bottomDefault?' · Move 2':''}`,order:play.bottomFirst?'Bottom → Top':'Top → Bottom',note:[...ready.notes,...next.notes],playerDamage:next.damage-next.ratDamage-(s.damage-s.ratDamage),summonDamage:next.ratDamage-s.ratDamage,hp:next.hp,rats:next.rats.filter(r=>r.hp>0).map(r=>`${r.name} ${r.hp} HP`),ice:next.elements.Ice>0,dark:next.elements.Dark>0,hand:count(next,'hand'),discard:count(next,'discard'),lost:count(next,'lost'),active:count(next,'active'),rest:play.rest!==undefined});
  s=next;
 }
 const total=s.enemies.reduce((v,e)=>v+e.maxHp,0),remaining=s.enemies.reduce((v,e)=>v+e.hp,0),win=remaining===0&&s.hp>0;
 let score=win?1+0.3*s.hp/config.hp+0.02*Math.max(0,35-rounds):0.8*(1-remaining/total)*(s.hp>0?1:0.7);
 const contribution=(style:Config["playstyle"])=>style==="Scurry"?s.movement/Math.max(1,config.rounds*4):style==="Melee"?s.conditionDamage/total:style==="Ice"?Math.min(1,s.iceUses/6):style==="Control"?s.controlledDamage/total:style==="Summons"?s.ratDamage/total:0;
 const styleContribution=config.secondaryPlaystyle?(contribution(config.playstyle)+contribution(config.secondaryPlaystyle))/2:contribution(config.playstyle);
 const mobilityScore=Math.min(1,s.movement/Math.max(1,config.rounds*4))*0.8+Number(s.hp>0)*0.15+0.05*s.hp/config.hp;
 if(config.playstyle==='Scurry'&&!config.secondaryPlaystyle)score=mobilityScore;
 else if(config.playstyle==='Scurry'||config.secondaryPlaystyle==='Scurry')score=(score+mobilityScore)/2;
 score+=0.12*styleContribution;
 return{win,survived:s.hp>0,exhausted:s.exhausted,damage:s.damage,summonDamage:s.ratDamage,controlledDamage:s.controlledDamage,conditionDamage:s.conditionDamage,iceUses:s.iceUses,mobileTurns:s.mobileTurns,movement:s.movement,rounds,hp:s.hp,score,plan};
}

export function maxScenarioRounds(handSize:number){let turns=handSize;for(let n=2;n<=handSize;n++)turns+=Math.floor(n/2);return turns;}
