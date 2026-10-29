import {itemModels} from './itemAdvisor';
import type {AdvisorItem} from './itemAdvisor';
import catalog from './data/items.json';
export type Item = {id:number;name:string;slot:string;spent:boolean;lost:boolean;uses:number;backUses:number;flip:boolean;penalty:number;text:string|null;backText:string|null};
export const items = catalog as Item[];
export type ItemState = {id:number;status:'ready'|'spent'|'lost';used:number;back:boolean};
export const slotNames:Record<string,string>={head:'Head',body:'Body',legs:'Feet',onehand:'One hand',twohand:'Two hands',small:'Small item'};
export function freshItems(ids:number[]):ItemState[]{return [...new Set(ids)].filter(id=>items.some(i=>i.id===id)).map(id=>({id,status:'ready',used:0,back:false}));}
export function equipmentError(ids:number[],level:number):string|undefined {
 const equipped=items.filter(i=>ids.includes(i.id));
 for(const slot of ['head','body','legs'])if(equipped.filter(i=>i.slot===slot).length>1)return `Only one ${slotNames[slot].toLowerCase()} item fits.`;
 if(equipped.reduce((n,i)=>n+(i.slot==='twohand'?2:i.slot==='onehand'?1:0),0)>2)return 'Only two hands are available.';
 if(equipped.filter(i=>i.slot==='small').length>Math.ceil(level/2))return `Small item limit: ${Math.ceil(level/2)}. Item-specific capacity exceptions await verified effects.`;
}
export function useItem(state:ItemState):ItemState {
 const item=items.find(i=>i.id===state.id);if(!item||state.status!=='ready')return state;
 const used=state.used+1,limit=(state.back?item.backUses:item.uses)||1;
 if(used<limit)return {...state,used};
 if(item.flip)return {...state,used:0,back:!state.back};
 return {...state,used:0,status:item.lost?'lost':item.spent?'spent':'ready'};
}
export function refreshSpent(states:ItemState[]):ItemState[]{return states.map(state=>{const item=items.find(i=>i.id===state.id);return item?.spent&&!item.lost&&!item.flip&&state.status!=='lost'?{...state,status:'ready',used:0}:state;});}

export function advisorEquipment(states:ItemState[]):AdvisorItem[]{return states.flatMap(s=>{const i=items.find(i=>i.id===s.id);return i?[{...s,name:i.name,spent:i.spent,lost:i.lost,uses:i.uses,penalty:i.penalty,model:itemModels[i.id]}]:[];});}
