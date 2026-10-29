export type Element = 'Ice' | 'Dark';
export type Condition = 'Poison' | 'Wound' | 'Muddle' | 'Disarm' | 'Stun' | 'Immobilize' | 'Curse' | 'Invisible' | 'Strengthen';
export type Augment = 'withering' | 'weakness' | 'blade' | 'feedback' | 'scream' | 'projection' | 'killer';
export type RatSpec = { name: string; hp: number; move: number; attack: number; poison?: boolean; conditional?: boolean; king?: boolean };
export type Effect =
  | { kind:'attack'; amount:number; range?:number; targets?:number; pierce?:number; push?:number; conditions?:Condition[]; perCondition?:number; killInvisible?:boolean; killSplash?:number; designated?:boolean; melee?:boolean; offset?:boolean; advantage?:boolean; boosts?:{element:Element;amount:number;conditions?:Condition[]}[] }
  | { kind:'move'; amount:number; jump?:boolean; returnMuddle?:boolean; throughPoison?:boolean }
  | { kind:'heal'; amount:number; range?:number; self?:boolean }
  | { kind:'status'; condition:Condition; range?:number; self?:boolean }
  | { kind:'control'; range:number; count?:number; sameTarget?:boolean; adjacent?:boolean; effects:Effect[] }
  | { kind:'grant'; action:'attack'|'move'; amount:number; offset?:boolean }
  | { kind:'summon'; rat:RatSpec }
  | { kind:'augment'; augment:Augment }
  | { kind:'infuse'; element:Element }
  | { kind:'consume'; element:Element; effects:Effect[] }
  | { kind:'suffer'; amount:number }
  | { kind:'takeover'; range:number }
  | { kind:'persistent'; effect:'domination'|'sharing'|'charges' }
  | { kind:'pull'; amount:number; range:number }
  | { kind:'curseRound' }
  | { kind:'loot'; amount:number };
export type Half = { effects:Effect[]; loss?:boolean; active?:boolean; round?:boolean };
export type SimSpec = { top:Half; bottom:Half };
export type SimCard = { name:string; initiative:string; level?:string; simulationModel?:SimSpec };
export type Encounter = 'rooms'|'armor'|'ranged'|'mixed'|'volatile';
export type TacticalIntent='defensive'|'offensive'|'burst';
export type Config = { equipment?:import('../itemAdvisor').AdvisorItem[]; advisorIntent?:TacticalIntent; encounter:Encounter; rounds:number; hp:number; allyDamage:number; allyCount?:number; advisorOnly?:boolean; runs:number; seed:number; playstyle?:'Melee'|'Ice'|'Control'|'Summons'|'Scurry'; secondaryPlaystyle?:'Melee'|'Ice'|'Control'|'Summons'|'Scurry'; augmentPlan?:string[]; perks?:import('../mindthiefPerks').PerkSelections };
export type PlanTurn = { round:number; initiative:number; top:string; bottom:string; order:string; note:string[]; playerDamage:number; summonDamage:number; hp:number; rats:string[]; ice:boolean; dark:boolean; hand:number; discard:number; lost:number; active:number; rest?:boolean };
export type FightResult = { win:boolean; survived:boolean; exhausted:boolean; damage:number; summonDamage:number; controlledDamage:number; conditionDamage:number; iceUses:number; mobileTurns:number; movement:number; rounds:number; hp:number; score:number; plan:PlanTurn[] };
export type Summary = { winRate:number; winMargin:number; survival:number; damage:number; summonDamage:number; controlledDamage:number; conditionDamage:number; iceUses:number; mobileTurns:number; movement:number; rounds:number; hp:number; exhaustion:number; score:number; runs:number };
export type Comparison = { summary:Summary; delta:number; deltaMargin:number; winDelta:number; winDeltaMargin:number };
export type SimSwap = { out:string; into:string; comparison:Comparison };
export type SimulationResult = { baseline:Summary; recommended:Comparison; recommendedNames:string[]; swaps:SimSwap[]; plan:PlanTurn[]; recommendedPlan:PlanTurn[]; config:Config; testedSwaps:number; supportedCards:number; currentAugments:string[]|null; recommendedAugments:string[]|null; augmentStrategiesTested:number };
