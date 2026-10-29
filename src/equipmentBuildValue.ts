import type {AdvisorItem} from './itemAdvisor';
import type {BuildCard,Style} from './mindthiefBuilds';
import type {Effect} from './simulation/types';
const own=(effects:Effect[]):Effect[]=>effects.flatMap(e=>[e,...e.kind==='consume'?own(e.effects):[]]);
/** Item bonuses reward a hand only when its actions can use the equipped effect. */
export function equipmentBuildValue(cards:BuildCard[],style:Style,equipment:AdvisorItem[]=[]){
 if(!equipment.length)return 0;
 const effects=cards.flatMap(c=>[c.simulationModel?.top,c.simulationModel?.bottom].flatMap(h=>h&&!h.loss&&!h.active?own(h.effects):[]));
 const melee=effects.filter(e=>e.kind==='attack'&&e.range===undefined).length;
 const rats=cards.some(c=>c.buildReview?.summon==='body'||c.name==='many as one');
 const conditionSetups=cards.filter(c=>(c.buildReview?.conditions??0)>0).length;
 const conditionPayoffs=cards.filter(c=>['submissive affliction','perverse edge','psychic projection'].includes(c.name)||c.simulationModel&&[c.simulationModel.top,c.simulationModel.bottom].some(h=>own(h.effects).some(e=>e.kind==='attack'&&(e.perCondition??0)>0))).length;
 const moves=effects.filter(e=>e.kind==='move').length;
 let value=0;
 for(const i of equipment){if(i.status!=='ready'||i.back)continue;
  if(i.model==='move1')value+=Math.min(3,moves)*(style==='Scurry'?1.4:0.35);
  if(i.model==='jump')value+=Math.min(3,moves)*(style==='Scurry'?1.8:0.25);
  if(i.model==='pierce1')value+=Math.min(3,melee)*0.2;
  if(i.model==='pierce3')value+=Math.min(3,melee)*0.55;
  if(i.model==='wound'||i.model==='curse'||i.model==='poison'||i.model==='poisonArea')value+=Math.min(3,melee)*0.3+Math.min(conditionPayoffs,3)*(style==='Melee'?2.4:style==='Summons'?1.2:0.35)+Number(conditionSetups>0&&conditionPayoffs>0)*(style==='Melee'?2:0.7);
  if(i.model==='element')value+=Number(effects.some(e=>e.kind==='consume'||e.kind==='attack'&&e.boosts?.length))*(style==='Ice'?1.2:0.4);
  if(i.model==='summonFilter')value+=Number(rats)*(style==='Summons'?5:style==='Melee'?0.5:0.2)+Math.min(4,melee)*(rats&&style==='Summons'?0.7:0);
  if(i.model==='summonSkeleton'||i.model==='summonWarrior'||i.model==='summonConstruct')value+=Number(rats)*(style==='Summons'?7:style==='Melee'?0.8:0.2)+Number(style==='Summons'&&melee>=2)*1.5;
  if(i.model==='summonShield')value+=Number(rats)*(style==='Summons'?4:style==='Melee'?0.5:0.2);
  if(i.model==='recoverLevel1')value+=cards.filter(c=>c.level==='1'||c.level==='1-X').length*(style==='Summons'?0.35:0.2);
 }
 return value;
}
