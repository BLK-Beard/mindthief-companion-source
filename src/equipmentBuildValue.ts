import type {AdvisorItem} from './itemAdvisor';
import type {BuildCard,Style} from './mindthiefBuilds';
import type {Effect} from './simulation/types';
const own=(effects:Effect[]):Effect[]=>effects.flatMap(e=>[e,...e.kind==='consume'?own(e.effects):[]]);
/** Small synergy bonuses, never a substitute for core playstyle or movement coverage. */
export function equipmentBuildValue(cards:BuildCard[],style:Style,equipment:AdvisorItem[]=[]){
 if(!equipment.length)return 0;
 const effects=cards.flatMap(c=>[c.simulationModel?.top,c.simulationModel?.bottom].flatMap(h=>h&&!h.loss&&!h.active?own(h.effects):[]));
 const melee=effects.filter(e=>e.kind==='attack'&&e.range===undefined).length;
 const moves=effects.filter(e=>e.kind==='move').length;
 let value=0;
 for(const i of equipment){if(i.status!=='ready'||i.back)continue;
  if(i.model==='move1')value+=Math.min(3,moves)*(style==='Scurry'?1:0.3);
  if(i.model==='pierce1')value+=Math.min(3,melee)*0.2;
  if(i.model==='wound')value+=Math.min(3,melee)*0.3+Number(melee>1&&effects.some(e=>e.kind==='attack'&&e.perCondition))*1.2;
  if(i.model==='element')value+=Number(effects.some(e=>e.kind==='consume'||e.kind==='attack'&&e.boosts?.length))*(style==='Ice'?1.2:0.4);
 }
 return value;
}
