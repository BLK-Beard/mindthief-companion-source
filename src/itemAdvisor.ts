/** Only complete, scoped effects from the supplied text are modeled. Never infer from a name or OCR fragment. */
export type ItemModel='move1'|'jump'|'pierce1'|'heal1'|'heal3'|'heal6'|'element'|'defaultMove3'|'immunities'|'wound'|'curse';
export type AdvisorItem={id:number;name:string;status:'ready'|'spent'|'lost';used:number;back:boolean;spent:boolean;lost:boolean;uses:number;penalty:number;model?:ItemModel};
export type ItemUse={id:number;name:string;instruction:string};
export const itemModels:Record<number,ItemModel>={1:'move1',2:'jump',5:'pierce1',6:'heal1',11:'heal3',13:'element',15:'defaultMove3',18:'immunities',23:'wound',24:'curse',37:'heal6'};
export function refreshAdvisorItems(items:AdvisorItem[]):AdvisorItem[]{return items.map(i=>i.spent&&!i.lost&&i.status!=='lost'&&!i.back?{...i,status:'ready',used:0}:i);}
/** Reserve value prevents spending consumables for a tie or a trivial payoff. Long rests regain this value for spent items. */
export function itemReserveValue(items:AdvisorItem[],intent?:string){return items.reduce((n,i)=>n+(i.model&&i.status==='ready'&&(i.spent||i.lost)?(i.model==='heal6'?3:i.model==='heal3'?2:i.model==='element'?1.7:0.8)*(i.lost?(intent==='burst'?0.7:intent==='offensive'?1.2:1.8):1):0),0);}
