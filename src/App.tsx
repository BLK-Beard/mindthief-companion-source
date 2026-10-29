import {BuildEquipment,PlayEquipment,OwnedItems} from './EquipmentPanel';
import {freshItems,refreshSpent,equipmentError,advisorEquipment} from './equipment';
import type {ItemState} from './equipment';
import {deckPlaystyles,scenarioPlaystyles as resolveScenarioPlaystyles} from './deckPlaystyles';
import {styleNames,styles} from './mindthiefBuilds';
import TurnCoach from './TurnCoach';
import ConditionSymbol from './ConditionSymbol';
import { useMemo, useState } from 'react';
import MindthiefAdvice from './MindthiefAdvice';
import SaveStatus from './SaveStatus';
import PerksPanel from './PerksPanel';
import type { PerkSelections } from './mindthiefPerks';
import { campaignStorage } from './campaignStorage';
import type { BuildReview,Style } from './mindthiefBuilds';
// The supplied per-character JSON catalogs are the source of truth for card data.
import berserker from './data/berserker.json';
import bladeswarm from './data/bladeswarm.json';
import bruiser from './data/bruiser.json';
import cragheart from './data/cragheart.json';
import doomstalker from './data/doomstalker.json';
import elementalist from './data/elementalist.json';
import mindthief from './data/mindthief.json';
import nightshroud from './data/nightshroud.json';
import plagueherald from './data/plagueherald.json';
import quartermaster from './data/quartermaster.json';
import sawbones from './data/sawbones.json';
import silentknife from './data/silentknife.json';
import soothsinger from './data/soothsinger.json';
import soultether from './data/soultether.json';
import spellweaver from './data/spellweaver.json';
import sunkeeper from './data/sunkeeper.json';
import tinkerer from './data/tinkerer.json';
import wildfury from './data/wildfury.json';

type Tab = 'Build' | 'My decks' | 'Characters' | 'Turn' | 'Guide' | 'Perks';
type AbilityCard = {
  buildReview?: BuildReview;
  name: string;
  expansion: string;
  image: string;
  level: string;
  initiative: string;
  effects?: string[];
  statusEffects?: string[];
  lost?: boolean;
  loss?: boolean;
  topLost?: boolean;
  bottomLost?: boolean;
  topLoss?: boolean;
  bottomLoss?: boolean;
  lostTop?: boolean;
  lostBottom?: boolean;
  lossActions?: Array<'top' | 'bottom'>;
  topPersistent?: boolean;
  bottomPersistent?: boolean;
  topRoundBonus?: boolean;
  bottomRoundBonus?: boolean;
  augment?: boolean;
  augmentSide?: 'top' | 'bottom';
  topExperience?: number;
  bottomExperience?: number;
  topExperienceConditional?: boolean;
  bottomExperienceConditional?: boolean;
  topElements?: ActionElements;
  bottomElements?: ActionElements;
  actionIndex?: { top: IndexedAction; bottom: IndexedAction };
  analysisModel?: CardAnalysisModel;
};
type IndexedAction = { indexed: boolean; attacks: Array<number | string> | null; moves: Array<number | string> | null; heals: Array<number | string> | null; ranges: Array<number | string> | null; statusEffects: string[] | null; statusEffectDetails?: Record<string,string>; otherEffects: string[] | null; elements: { generate: ElementName[] | null; consume: ElementName[] | null } };
type AnalysisNode = { id: string; kind: string; values?: Array<number | string>; name?: string; text?: string; element?: ElementName; sequence: number | null; parentId: string | null; relationship: 'unresolved' | 'root' | 'child'; sourceField: string; missingElementBehavior?: 'skip-linked-effect'; linkedEffectNodeId?: string | null };
type CardAnalysisModel = { schemaVersion: 1; top: AnalysisHalf; bottom: AnalysisHalf };
type AnalysisHalf = { actionIndexStatus: 'unreviewed' | 'partial' | 'complete'; reviewStatus: 'unreviewed' | 'partial' | 'complete'; structureReviewed: false; nodes: AnalysisNode[] | null; cardFlow: { printedAction: 'lost' | 'persistent-active' | 'augment-choice' | 'round-bonus' | 'unreviewed'; defaultAction: 'discard' }; elementRules: { generatedOnEndOfTurn: true; consumeIfUnavailable: 'skip-linked-effect' }; stats: { attackValues: Array<number | string> | null; attackCount: number | null; meleeAttackCount: number | null; rangedAttackCount: number | null; moveValues: Array<number | string> | null; healValues: Array<number | string> | null; shieldValues: Array<number | string> | null; pierceValues: Array<number | string> | null; pushValues: Array<number | string> | null; conditions: string[] | null; otherEffects: string[] | null; lootValues: Array<number | string> | null; experience: number | null; elementsInfused: ElementName[] | null; elementsConsumed: ElementName[] | null; summons: string[] | null; loss: boolean | null; persistent: boolean | null; augment: boolean | null; roundBonus: boolean | null } };
type CharacterData = { character: { id: string; game: string; colour: string; name: string; altName?: string; portrait?: string; backgroundImage?: string; classNotesImage?: string; classIcon?: string; perkSheet?: string; handSize: number; experienceThresholds: number[]; maxHealthByLevel: number[]; maxHealthEstimated?: boolean }; abilityCards: AbilityCard[] };
type CharacterNote = { id: string; text: string; createdAt: string; deckName?: string; round?: number };
type CharacterProfile = { ownedItems?:number[]; id: string; name: string; classId: string; level: number; experience?: number; health?: number; maxHealth?: number; gold?: number; checkmarks?: number; battleChecks?: boolean[]; perkMarks?: number; perks?: string[]; perkSelections?: PerkSelections; masteries?: string[]; notes?: string; notesEntries?: CharacterNote[]; personalQuestTitle?: string; retirementReady?: boolean; retiredAt?: string };
type DeckHistoryEntry = { id: string; round: number; initiative: number; initiativeCard: string; topCard: string; bottomCard: string; topDamage: number; bottomDamage: number; totalDamage: number; experience: number };
type SavedDeck = { equippedItems?:number[]; playstyles?:Style[]; id: string; name: string; profileId: string; classId: string; className: string; level: number; cardKeys: string[]; history?: DeckHistoryEntry[] };
type InitiativeFilter = 'All' | 'Fast' | 'Steady' | 'Late';
type EffectFilter = 'All' | 'Element create' | 'Element consume' | 'Status effect';
type EffectCategory = Exclude<EffectFilter, 'All'>;
type IndexedEffectTag = { category: EffectCategory; value: string; side: 'top' | 'bottom' | 'card'; label: string };
type ElementName = 'Fire' | 'Ice' | 'Air' | 'Earth' | 'Light' | 'Dark';
type ElementState = 'Inert' | 'Strong' | 'Waning';
type ActionElements = { generate?: ElementName[]; consume?: ElementName[] };
type ElementBoard = Record<ElementName, ElementState>;
type ScenarioState = {
  items?:ItemState[];
  playstyles?:Style[];
  advisorIntent?:'defensive'|'offensive'|'burst';
  deckId: string;
  deckName: string;
  hand: string[];
  discard: string[];
  lost: string[];
  active: string[];
  activeSides?: Record<string, 'top' | 'bottom'>;
  selected: string[];
  topCardKey: string | null;
  initiativeCardKey: string | null;
  activeAugmentKey?: string | null;
  activateAugmentKey?: string | null;
  experienceGained?: number;
  elements?: ElementBoard;
  actionOrder?: 'top-first' | 'bottom-first';
  phase?: 'select' | 'long-rest' | 'cleanup';
  longRestHeal?: boolean;
  turnHistory?: DeckHistoryEntry[];
  attackDamageTop?: number;
  attackDamageBottom?: number;
  roundActive?: string[];
  roundActiveSides?: Record<string, 'top' | 'bottom'>;
  round: number;
  damageTaken: number;
  log: string[];
};
type ShortRestChoice = { cardKey: string; rerolled: boolean; damage: number };

const characters = [berserker, bladeswarm, bruiser, cragheart, doomstalker, elementalist, mindthief, nightshroud, plagueherald, quartermaster, sawbones, silentknife, soothsinger, soultether, spellweaver, sunkeeper, tinkerer, wildfury] as CharacterData[];
const initialClassId = 'MT2';
const initialProfileId = 'character-mindthief';
const storagePrefix = 'gloomhaven-deck-companion:v2';
const initiativeFilters: InitiativeFilter[] = ['All', 'Fast', 'Steady', 'Late'];
const elementNames: ElementName[] = ['Fire', 'Ice', 'Air', 'Earth', 'Light', 'Dark'];
const emptyElementBoard: ElementBoard = { Fire: 'Inert', Ice: 'Inert', Air: 'Inert', Earth: 'Inert', Light: 'Inert', Dark: 'Inert' };
const defaultProfiles: CharacterProfile[] = [{ id: initialProfileId, name: 'My Mindthief', classId: initialClassId, level: 1 }];
function levelForExperience(experience: number, thresholds: number[]): number {
  return thresholds.reduce((level, threshold, index) => experience >= threshold ? index + 1 : level, 1);
}
const quickReferenceGroups = [
  { title: 'Conditions', items: [
    ['Poison', 'Attacks against this figure deal extra damage, and it cannot be healed. Remove when healed.'],
    ['Wound', 'Suffer damage at the start of the turn. Remove when healed.'],
    ['Immobilize', 'Cannot move. Remove at the end of the next turn.'],
    ['Disarm', 'Cannot attack. Remove at the end of the next turn.'],
    ['Stun', 'Cannot do anything but rest. Remove at the end of the next turn.'],
    ['Muddle', 'Disadvantage on attacks. Remove at the end of the next turn.'],
    ['Invisible', 'Cannot be attacked. Remove at the end of the next turn.'],
    ['Strengthen', 'Advantage on your attacks. Remove at the end of the turn.'],
  ] },
  { title: 'Other effects', items: [
    ['Curse', 'Gain a Curse attack modifier card.'],
    ['Shield', 'Reduce attack damage.'],
    ['Retaliate', 'Attackers suffer damage.'],
    ['Push', 'Force the target to move away.'],
    ['Pull', 'Force the target to move closer.'],
    ['Pierce', 'Negate the target’s Shield.'],
    ['Bless', 'Gain a Bless attack modifier card.'],
  ] },
] as const;

function getSaved<T>(key: string, fallback: T): T {
  try {
    const value = campaignStorage.getItem(`${storagePrefix}:${key}`);
    return value ? JSON.parse(value) as T : fallback;
  } catch { return fallback; }
}

function cardKey(classId: string, name: string): string { return `${classId}:${name.toLowerCase() === "feedback loop" ? "feedback loops" : name.toLowerCase()}`; }
function titleCase(name: string): string { return name.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(/'S\b/g, "'s"); }
function publicAssetUrl(path:string):string{return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;}
function cardImageUrl(path: string): string { if(path.endsWith('gh2-soultether.jpeg'))return publicAssetUrl('asset-unavailable.svg'); const assetPath=path.startsWith('/')?path.slice(1):`assets/${path}`; return publicAssetUrl(assetPath.split('/').map(encodeURIComponent).join('/')); }
function isLevelAvailable(cardLevel: string, characterLevel: number): boolean {
  const numericLevel = Number(cardLevel);
  return Number.isFinite(numericLevel) && numericLevel > 0 ? numericLevel <= characterLevel : true;
}
function indexedEffectTags(card: AbilityCard): IndexedEffectTag[] {
  const tags: IndexedEffectTag[] = (card.statusEffects ?? []).map((value) => ({ category: 'Status effect', value, side: 'card', label: `Applies ${value}` }));
  for (const side of ['top', 'bottom'] as const) {
    const action = card.actionIndex?.[side];
    const elements = card[side === 'top' ? 'topElements' : 'bottomElements'];
    for (const value of action?.elements.generate ?? elements?.generate ?? []) tags.push({ category: 'Element create', value, side, label: `${titleCase(side)} · Creates ${value}` });
    for (const value of action?.elements.consume ?? elements?.consume ?? []) tags.push({ category: 'Element consume', value, side, label: `${titleCase(side)} · Consumes ${value}` });
    for (const value of action?.statusEffects ?? []) tags.push({ category: 'Status effect', value, side, label: `${titleCase(side)} · ${value}${action?.statusEffectDetails?.[value] ? ` · ${action.statusEffectDetails[value]}` : ""}` });
  }
  return tags;
}
function effectTags(card: AbilityCard): string[] { return [...new Set(indexedEffectTags(card).map((tag) => tag.label))]; }
function matchesEffectFilter(card: AbilityCard, filter: EffectFilter, selectedValue: string): boolean {
  if (filter === 'All') return true;
  return indexedEffectTags(card).some((tag) => tag.category === filter && (selectedValue === 'All values' || tag.value === selectedValue));
}
function isLostAction(card: AbilityCard, side: 'top' | 'bottom'): boolean {
  if (card.lost === true || card.loss === true) return true;
  if (card.lossActions?.includes(side)) return true;
  return side === 'top'
    ? card.topLost === true || card.topLoss === true || card.lostTop === true
    : card.bottomLost === true || card.bottomLoss === true || card.lostBottom === true;
}
function isInitiativeMatch(initiative: number, filter: InitiativeFilter): boolean {
  if (filter === 'Fast') return initiative <= 30;
  if (filter === 'Steady') return initiative > 30 && initiative <= 60;
  if (filter === 'Late') return initiative > 60;
  return true;
}

function savedAdvisorStyles(){
 const id=getSaved('current-character',initialProfileId);
 const selected=getSaved<Style[]>('advisor-styles:'+id,[]).filter(s=>styles.includes(s)).slice(0,2);
 if(selected.length)return selected;
 const scenario=getSaved<Record<string,ScenarioState>>('scenarios',{})[id];
 return styles.filter(s=>scenario?.deckName.toLowerCase().includes(styleNames[s].toLowerCase())).slice(0,2);
}
export default function App() {
  const [tab, setTab] = useState<Tab>('Build');
  const [mobileMoreOpen,setMobileMoreOpen]=useState(false);
  const [previewCardName, setPreviewCardName] = useState<string | null>(null);
  const [analysisDeckId, setAnalysisDeckId] = useState<string | null>(null);
  const [advisorStyle,setAdvisorStyle]=useState<Style>(()=>savedAdvisorStyles()[0]??'Melee');
  const [advisorSecondary,setAdvisorSecondary]=useState<Style|null>(()=>savedAdvisorStyles()[1]??null);
  const [profiles, setProfiles] = useState<CharacterProfile[]>(() => getSaved<CharacterProfile[]>('characters', defaultProfiles).map(item => { const thresholds = characters.find(c => c.character.id === item.classId)?.character.experienceThresholds ?? []; return { ...item, experience: item.experience ?? thresholds[Math.max(0, item.level - 1)] ?? 0 }; }));
  const [profileId, setProfileId] = useState(() => getSaved('current-character', initialProfileId));
  const [retirementCount, setRetirementCount] = useState<number>(() => getSaved('retirement-count', 0));
  const [selected, setSelected] = useState<string[]>(() => getSaved(`draft:${getSaved("current-character", initialProfileId)}`, []));
  const [savedDecks, setSavedDecks] = useState<SavedDeck[]>(() => {
    const oldDecks = getSaved<Array<Partial<SavedDeck> & Pick<SavedDeck, 'id' | 'name' | 'classId' | 'className' | 'level' | 'cardKeys'>>>('decks', []);
    return oldDecks.map((deck) => ({ ...deck, profileId: deck.profileId ?? initialProfileId })) as SavedDeck[];
  });
  const [scenarios, setScenarios] = useState<Record<string, ScenarioState>>(() => Object.fromEntries(Object.entries(getSaved<Record<string,ScenarioState>>('scenarios', {})).map(([id,scenario])=>[id,{...scenario,playstyles:resolveScenarioPlaystyles(scenario,savedDecks.find(d=>d.id===scenario.deckId))}])));
  const [filter, setFilter] = useState<InitiativeFilter>('All');
  const [augmentOnly, setAugmentOnly] = useState(false);
  const [effectFilter, setEffectFilter] = useState<EffectFilter>('All');
  const [effectValueFilter, setEffectValueFilter] = useState('All values');
  const [search, setSearch] = useState('');
  const [equipmentDrafts,setEquipmentDrafts]=useState<Record<string,number[]>>(()=>getSaved('equipment-drafts',{}));
  const [deckName, setDeckName] = useState('');
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [newCharacterClass, setNewCharacterClass] = useState(initialClassId);
  const [perkDraft, setPerkDraft] = useState('');
  const [xpToAdd, setXpToAdd] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [shortRestChoice, setShortRestChoice] = useState<ShortRestChoice | null>(null);
  const [longRestCard, setLongRestCard] = useState('');
  const [notice, setNotice] = useState('');

  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0] ?? defaultProfiles[0];
  const character = characters.find((item) => item.character.id === profile.classId) ?? characters.find((item) => item.character.id === initialClassId)!;
  const equippedItems=equipmentDrafts[profile.id]??[];
  const ownedItems=profile.ownedItems??[...new Set([...equippedItems,...savedDecks.filter(d=>d.profileId===profile.id).flatMap(d=>d.equippedItems??[]),...(scenarios[profile.id]?.items??[]).map(i=>i.id)])];
  const buildEquipment=useMemo(()=>advisorEquipment(freshItems(equippedItems.filter(id=>ownedItems.includes(id)))),[JSON.stringify(equippedItems),JSON.stringify(ownedItems)]);
  function changeEquipment(ids:number[]){const next={...equipmentDrafts,[profile.id]:ids};setEquipmentDrafts(next);campaignStorage.setItem(`${storagePrefix}:equipment-drafts`,JSON.stringify(next));}
  const level = levelForExperience(profile.experience ?? 0, character.character.experienceThresholds);
  const handSize = character.character.handSize;
  const previewCard = character.abilityCards.find(card => card.name === previewCardName) ?? null;
  const maxHealth = character.character.maxHealthByLevel[level - 1];
  const isRetired = Boolean(profile.retiredAt);
  const availableNewCharacters = characters.filter((entry) => !profiles.some((item) => item.classId === entry.character.id && !item.retiredAt));
  const createClassId = availableNewCharacters.find((entry) => entry.character.id === newCharacterClass)?.character.id ?? availableNewCharacters[0]?.character.id ?? '';
  const profileDecks = savedDecks.filter((deck) => deck.profileId === profile.id);
  const currentScenario = scenarios[profile.id] ?? null;
  const livePlaystyles=currentScenario?resolveScenarioPlaystyles(currentScenario,savedDecks.find(d=>d.id===currentScenario.deckId)):[];
  const availableCards = useMemo(() => character.abilityCards.filter((card) => isLevelAvailable(card.level, level)), [character, level]);
  const effectValueOptions = effectFilter === 'All' ? [] : [...new Set(availableCards.flatMap((card) => indexedEffectTags(card).filter((tag) => tag.category === effectFilter).map((tag) => tag.value)))].sort((a, b) => a.localeCompare(b));
  const visibleCards = useMemo(() => availableCards.filter((card) => {
    const initiative = Number(card.initiative);
    return card.name.toLowerCase().includes(search.toLowerCase()) && isInitiativeMatch(initiative, filter) && matchesEffectFilter(card, effectFilter, effectValueFilter) && (!augmentOnly || card.augment);
  }), [availableCards, augmentOnly, effectFilter, effectValueFilter, filter, search]);
  const selectedCards = character.abilityCards.filter((card) => selected.includes(cardKey(profile.classId, card.name)));
  const initiativePairs = selectedCards.flatMap((first, index) => selectedCards.slice(index + 1).map((second) => ({ first, second, fast: Math.min(Number(first.initiative), Number(second.initiative)), slow: Math.max(Number(first.initiative), Number(second.initiative)) })));
  const averageFastInitiative = initiativePairs.length ? Math.round(initiativePairs.reduce((sum, pair) => sum + pair.fast, 0) / initiativePairs.length) : null;
  const fastPairCoverage = initiativePairs.length ? Math.round(initiativePairs.filter((pair) => pair.fast <= 30).length / initiativePairs.length * 100) : 0;
  const lossActionCount = selectedCards.reduce((sum, card) => sum + Number(isLostAction(card, 'top')) + Number(isLostAction(card, 'bottom')), 0);
  const changeStyles=(style:Style,secondary:Style|null)=>{setAdvisorStyle(style);setAdvisorSecondary(secondary);campaignStorage.setItem(`${storagePrefix}:advisor-styles:${profile.id}`,JSON.stringify([style,...secondary?[secondary]:[]]));};
  const analysisDeck = profileDecks.find((deck) => deck.id === analysisDeckId) ?? null;
  const analysisCards = analysisDeck ? cardsForKeys(analysisDeck.cardKeys) : selectedCards;
  const analysisInitiativePairs = analysisCards.flatMap((first, index) => analysisCards.slice(index + 1).map((second) => ({ first, second, fast: Math.min(Number(first.initiative), Number(second.initiative)), slow: Math.max(Number(first.initiative), Number(second.initiative)) })));
  const analysisAverageInitiative = analysisCards.length ? Math.round(analysisCards.reduce((sum, card) => sum + Number(card.initiative), 0) / analysisCards.length) : null;
  const analysisAverageFast = analysisInitiativePairs.length ? Math.round(analysisInitiativePairs.reduce((sum, pair) => sum + pair.fast, 0) / analysisInitiativePairs.length) : null;
  const analysisLossCount = analysisCards.reduce((sum, card) => sum + Number(isLostAction(card, 'top')) + Number(isLostAction(card, 'bottom')), 0);
  const analysisMetadataCount = analysisCards.filter((card) => ['topLost', 'bottomLost', 'topPersistent', 'bottomPersistent', 'topRoundBonus', 'bottomRoundBonus', 'topExperience', 'bottomExperience', 'topElements', 'bottomElements'].some((key) => Object.hasOwn(card, key))).length;
  const analysisInitiativeGroups = [{ name: 'Fast · 01–30', count: analysisCards.filter((card) => Number(card.initiative) <= 30).length }, { name: 'Steady · 31–60', count: analysisCards.filter((card) => Number(card.initiative) > 30 && Number(card.initiative) <= 60).length }, { name: 'Late · 61–99', count: analysisCards.filter((card) => Number(card.initiative) > 60).length }];
  const analysisEffects = [...new Set(analysisCards.flatMap(effectTags))];
  const analysisHistory = analysisDeck?.history ?? [];
  const analysisTotalDamage = analysisHistory.reduce((sum, entry) => sum + entry.totalDamage, 0);
  const analysisDamageByAction = analysisHistory.reduce<Record<string, { plays: number; damage: number }>>((totals, entry) => { for (const [side, cardName, damage] of [['Top', entry.topCard, entry.topDamage], ['Bottom', entry.bottomCard, entry.bottomDamage]] as const) { const key = `${cardName} · ${side}`; const item = totals[key] ?? { plays: 0, damage: 0 }; totals[key] = { plays: item.plays + 1, damage: item.damage + damage }; } return totals; }, {});

  function saveProfiles(next: CharacterProfile[]) {
    setProfiles(next);
    campaignStorage.setItem(`${storagePrefix}:characters`, JSON.stringify(next));
  }
  function saveDecks(next: SavedDeck[]) {
    setSavedDecks(next);
    campaignStorage.setItem(`${storagePrefix}:decks`, JSON.stringify(next));
  }
  function saveSelection(next: string[], forProfile = profile.id) {
    setSelected(next);
    campaignStorage.setItem(`${storagePrefix}:draft:${forProfile}`, JSON.stringify(next));
  }
  function saveScenario(forProfile: string, next: ScenarioState) {
    const updated = { ...scenarios, [forProfile]: next };
    setScenarios(updated);
    campaignStorage.setItem(`${storagePrefix}:scenarios`, JSON.stringify(updated));
  }
  function updateProfile(changes: Partial<CharacterProfile>) {
    const nextChanges = { ...changes };
    if (typeof changes.experience === 'number') {
      const oldLevel = levelForExperience(profile.experience ?? 0, character.character.experienceThresholds);
      const nextLevel = levelForExperience(Math.max(0, changes.experience), character.character.experienceThresholds);
      nextChanges.experience = Math.max(0, changes.experience);
      nextChanges.level = nextLevel;
      nextChanges.perkMarks = (changes.perkMarks ?? profile.perkMarks ?? 0) + Math.max(0, nextLevel - oldLevel);
      const nextMaxHealth = character.character.maxHealthByLevel[nextLevel - 1];
      if (typeof profile.health === 'number') nextChanges.health = Math.min(profile.health, nextMaxHealth);
    }
    if(typeof changes.checkmarks === "number") { const nextChecks=Math.min(18,Math.max(0,Math.floor(changes.checkmarks))); const delta=Math.floor(nextChecks/3)-Math.floor((profile.checkmarks ?? 0)/3); if(delta<0 && (profile.perkMarks ?? 0)<-delta){setNotice("Refund allocated perk marks before removing earned checkmark groups.");return;} nextChanges.checkmarks=nextChecks;nextChanges.battleChecks=changes.battleChecks ?? Array.from({length:18},(_,i)=>i<nextChecks); nextChanges.perkMarks=(nextChanges.perkMarks ?? profile.perkMarks ?? 0)+delta; }
    saveProfiles(profiles.map((item) => item.id === profile.id ? { ...item, ...nextChanges } : item));
  }
  function selectProfile(nextId: string) {
    const nextProfile = profiles.find((item) => item.id === nextId);
    if (!nextProfile) return;
    setProfileId(nextId);
    campaignStorage.setItem(`${storagePrefix}:current-character`, JSON.stringify(nextId));
    setSelected(getSaved(`draft:${nextId}`, []));
    setEditingDeckId(null);
    setDeckName('');
    setShortRestChoice(null);
    setTab(nextProfile.retiredAt ? 'My decks' : 'Build');
    
  }
  function addPerk() {
    const perk = perkDraft.trim();
    if (!perk) return;
    updateProfile({ perks: [...(profile.perks ?? []), perk], perkMarks: Math.max(0, (profile.perkMarks ?? 0) - 1) });
    setPerkDraft('');
  }
  function removePerk(index: number) { updateProfile({ perks: (profile.perks ?? []).filter((_, perkIndex) => perkIndex !== index), perkMarks: (profile.perkMarks ?? 0) + 1 }); }
  function addCharacterNote() {
    const text = noteDraft.trim();
    if (!text) return;
    const note: CharacterNote = { id: crypto.randomUUID(), text, createdAt: new Date().toISOString(), ...(currentScenario ? { deckName: currentScenario.deckName, round: currentScenario.round } : {}) };
    updateProfile({ notesEntries: [note, ...(profile.notesEntries ?? [])] });
    setNoteDraft('');
  }
  function removeCharacterNote(id: string) { updateProfile({ notesEntries: (profile.notesEntries ?? []).filter((note) => note.id !== id) }); }
  function createCharacter() {
    const name = newCharacterName.trim();
    if (!name || !createClassId) return;
    const nextProfile = { id: crypto.randomUUID(), name, classId: createClassId, level: 1, experience: 0, perkMarks: retirementCount };
    saveProfiles([...profiles, nextProfile]);
    setProfileId(nextProfile.id);
    campaignStorage.setItem(`${storagePrefix}:current-character`, JSON.stringify(nextProfile.id));
    saveSelection([], nextProfile.id);
    setNewCharacterName('');
    setNotice(`Character “${name}” created.`);
    setTab('Build');
    
  }
  function deleteCharacter(target: CharacterProfile = profile) {
    if (!window.confirm(`Delete ${target.name}, including its saved decks and scenario? This cannot be undone.`)) return;
    const survivors = profiles.filter((item) => item.id !== target.id);
    const nextProfile = survivors.length ? survivors[0] : { id: crypto.randomUUID(), name: 'New Character', classId: initialClassId, level: 1, experience: 0, perkMarks: retirementCount };
    const nextProfiles = survivors.length ? survivors : [nextProfile];
    saveProfiles(nextProfiles);
    saveDecks(savedDecks.filter((deck) => deck.profileId !== target.id));
    const nextScenarios = { ...scenarios };
    delete nextScenarios[target.id];
    setScenarios(nextScenarios);
    campaignStorage.setItem(`${storagePrefix}:scenarios`, JSON.stringify(nextScenarios));
    campaignStorage.removeItem(`${storagePrefix}:draft:${target.id}`);
    if (target.id === profile.id) {
      setProfileId(nextProfile.id);
      campaignStorage.setItem(`${storagePrefix}:current-character`, JSON.stringify(nextProfile.id));
      setSelected(getSaved(`draft:${nextProfile.id}`, []));
      setEditingDeckId(null);
      setDeckName('');
      setShortRestChoice(null);
      setTab('Characters');
      
    }
    setNotice(`${target.name} deleted.`);
  }
  function retireCharacter() {
    if (isRetired || currentScenario || !profile.retirementReady) return;
    if (!window.confirm(`Retire ${profile.name}? This archives the character and records one retirement. During campaign downtime, also resolve the personal-quest rewards, read the class retirement section, return items, and lose the character’s gold.`)) return;
    updateProfile({ retiredAt: new Date().toISOString(), retirementReady: false });
    const nextCount = retirementCount + 1;
    setRetirementCount(nextCount);
    campaignStorage.setItem(`${storagePrefix}:retirement-count`, JSON.stringify(nextCount));
    
    setNotice(`${profile.name} retired. Create a new character to apply ${nextCount} retirement perk mark${nextCount === 1 ? '' : 's'}.`);
  }
  function adjustHealth(delta: number) {
    updateProfile({ health: Math.min(maxHealth, Math.max(0, (profile.health ?? maxHealth) + delta)) });
  }
  function toggleCard(card: AbilityCard) {
    if (isRetired) { setNotice('Retired characters are archived and cannot change or play decks.'); return; }
    const key = cardKey(profile.classId, card.name);
    if (!selected.includes(key) && selected.length >= handSize) { setNotice(`This class has a fixed hand size of ${handSize}. Remove a card before adding another.`); return; }
    saveSelection(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]);
  }
  function saveDeck() {
    if (isRetired) return;
    if(equippedItems.some(id=>!ownedItems.includes(id))){setNotice('Equip only items recorded in Character → Owned items.');return;}
    const equipmentIssue=equipmentError(equippedItems,level);if(equipmentIssue){setNotice(equipmentIssue);return;}
    const name = deckName.trim();
    if (!name || !selected.length) return;
    if (selected.length !== handSize) { setNotice(`Choose exactly ${handSize} cards for this class before saving the deck.`); return; }
    const editing = savedDecks.find((deck) => deck.id === editingDeckId && deck.profileId === profile.id);
    const cardsChanged = Boolean(editing && (editing.cardKeys.length !== selected.length || editing.cardKeys.some((key, index) => key !== selected[index])));
    const next = editing
      ? savedDecks.map((deck) => deck.id === editing.id ? { ...deck, equippedItems:[...equippedItems], name, level, cardKeys: selected, playstyles:[advisorStyle,...advisorSecondary?[advisorSecondary]:[]], ...(cardsChanged ? { history: [] } : {}) } : deck)
      : [...savedDecks, { id: crypto.randomUUID(), equippedItems:[...equippedItems], name, profileId: profile.id, classId: profile.classId, className: character.character.name, level, cardKeys: selected, playstyles:[advisorStyle,...advisorSecondary?[advisorSecondary]:[]] }];
    saveDecks(next);
    setEditingDeckId(null);
    setDeckName('');
    setNotice(editing ? `Updated “${name}”.${cardsChanged ? ' Play history cleared because the card list changed.' : ''}` : `Saved “${name}” under ${profile.name}.`);
  }
  function loadDeck(deck: SavedDeck) {
    if (isRetired) { setNotice('Retired characters are archived; their decks can be reviewed but not edited or played.'); return; }
    const chosenStyles=deckPlaystyles(deck);if(chosenStyles.length)changeStyles(chosenStyles[0],chosenStyles[1]??null);
    changeEquipment(deck.equippedItems??[]);
    saveSelection(deck.cardKeys, deck.profileId);
    setDeckName(deck.name);
    setEditingDeckId(deck.id);
    setNotice(`Editing “${deck.name}”.`);
    setTab('Build');
  }
  function removeDeck(id: string) { saveDecks(savedDecks.filter((deck) => deck.id !== id)); if (editingDeckId === id) { setEditingDeckId(null); setDeckName(''); } }
  function cardsForKeys(keys: string[]): AbilityCard[] {
    return keys.flatMap((key) => {
      const card = character.abilityCards.find((item) => cardKey(profile.classId, item.name) === key);
      return card ? [card] : [];
    });
  }
  function startScenario(deck: SavedDeck) {
    if (isRetired) { setNotice('Retired characters cannot participate in another scenario.'); return; }
    if((deck.equippedItems??[]).some(id=>!ownedItems.includes(id))){setNotice('This deck includes an item no longer owned. Edit its equipment in Build.');return;}
    const equipmentIssue=equipmentError(deck.equippedItems??[],level);if(equipmentIssue){setNotice(equipmentIssue);return;}
    const chosenStyles=deck.playstyles??styles.filter(s=>deck.name.toLowerCase().includes(styleNames[s].toLowerCase()));if(chosenStyles.length)changeStyles(chosenStyles[0],chosenStyles[1]??null);
    const next: ScenarioState = { items:freshItems(deck.equippedItems??[]),playstyles:[...chosenStyles],advisorIntent:'defensive',deckId: deck.id, deckName: deck.name, hand: [...deck.cardKeys], discard: [], lost: [], active: [], activeSides: {}, roundActive: [], roundActiveSides: {}, selected: [], topCardKey: null, initiativeCardKey: null, activeAugmentKey: null, activateAugmentKey: null, experienceGained: 0, elements: { ...emptyElementBoard }, actionOrder: 'top-first', phase: 'select', round: 1, damageTaken: maxHealth - (profile.health ?? maxHealth), turnHistory: deck.history ?? [], attackDamageTop: 0, attackDamageBottom: 0, log: [] };
    saveScenario(deck.profileId, next);
    setNotice(`Scenario started with “${deck.name}”.`);
    setTab('Turn');
  }
  function updateTurnSelection(keys: string[]) {
    const next = [...new Set(keys)].slice(0, 2);
    const top = next.includes(currentScenario?.topCardKey ?? '') ? currentScenario?.topCardKey ?? null : next[0] ?? null;
    const initiative = next.includes(currentScenario?.initiativeCardKey ?? '') ? currentScenario?.initiativeCardKey ?? null : next[0] ?? null;
    if (currentScenario) saveScenario(profile.id, { ...currentScenario, selected: next, topCardKey: top, initiativeCardKey: initiative, activateAugmentKey: null });
  }
  function endTurn() {
    if (!currentScenario || currentScenario.selected.length !== 2 || !currentScenario.initiativeCardKey) return;
    const remainingHand = currentScenario.hand.filter((key) => !currentScenario.selected.includes(key));
    const nextDiscard = [...currentScenario.discard];
    const nextLost = [...currentScenario.lost];
    const nextActive = [...currentScenario.active];
    const nextActiveSides = { ...(currentScenario.activeSides ?? {}) };
    const nextRoundActive = [...(currentScenario.roundActive ?? [])];
    const nextRoundActiveSides = { ...(currentScenario.roundActiveSides ?? {}) };
    let nextActiveAugmentKey = currentScenario.activeAugmentKey ?? null;
    const nextActiveElements = { ...emptyElementBoard, ...(currentScenario.elements ?? {}) };
    const elementsToGenerate: ElementName[] = [];
    let earnedExperience = currentScenario.experienceGained ?? 0;
    const usedNames: string[] = [];
    const otherCardKey = currentScenario.selected.find((key) => key !== currentScenario.topCardKey);
    const orderedActions = currentScenario.actionOrder === 'bottom-first'
      ? [[otherCardKey, 'bottom'], [currentScenario.topCardKey, 'top']] as const
      : [[currentScenario.topCardKey, 'top'], [otherCardKey, 'bottom']] as const;
    for (const [key, side] of orderedActions) {
      if (!key) continue;
      const card = character.abilityCards.find((item) => cardKey(profile.classId, item.name) === key);
      if (!card) continue;
      const actionExperience = side === 'top' ? card.topExperience ?? 0 : card.bottomExperience ?? 0;
      earnedExperience += actionExperience;
      const actionElements = side === 'top' ? card.topElements : card.bottomElements;
      for (const element of actionElements?.consume ?? []) {
        if (nextActiveElements[element] !== 'Inert') nextActiveElements[element] = 'Inert';
      }
      elementsToGenerate.push(...(actionElements?.generate ?? []));
      if (card.augment && card.augmentSide === side) {
        if (nextActiveAugmentKey) {
          const previousKey = nextActiveAugmentKey;
          const activeIndex = nextActive.indexOf(previousKey);
          if (activeIndex >= 0) nextActive.splice(activeIndex, 1);
          const previousCard = character.abilityCards.find((item) => cardKey(profile.classId, item.name) === previousKey);
          const previousSide = nextActiveSides[previousKey] ?? previousCard?.augmentSide ?? 'top';
          delete nextActiveSides[previousKey];
          if (previousCard && isLostAction(previousCard, previousSide)) nextLost.push(previousKey);
          else nextDiscard.push(previousKey);
        }
        if (!nextActive.includes(key)) nextActive.push(key);
        nextActiveSides[key] = side;
        nextActiveAugmentKey = key;
        usedNames.push(titleCase(card.name));
        continue;
      }
      const isLost = isLostAction(card, side);
      const isPersistent = side === 'top' ? card.topPersistent === true : card.bottomPersistent === true;
      const isRoundBonus = side === 'top' ? card.topRoundBonus === true : card.bottomRoundBonus === true;
      if (isPersistent) { nextActive.push(key); nextActiveSides[key] = side; }
      else if (isRoundBonus) { nextRoundActive.push(key); nextRoundActiveSides[key] = side; }
      else if (isLost) nextLost.push(key);
      else nextDiscard.push(key);
      usedNames.push(titleCase(card.name));
    }
    for (const element of elementsToGenerate) nextActiveElements[element] = 'Strong';
    const initiativeCard = character.abilityCards.find((card) => cardKey(profile.classId, card.name) === currentScenario.initiativeCardKey);
    const topPlayedCard = character.abilityCards.find((card) => cardKey(profile.classId, card.name) === currentScenario.topCardKey);
    const bottomPlayedCard = character.abilityCards.find((card) => cardKey(profile.classId, card.name) === otherCardKey);
    const topDamage = currentScenario.attackDamageTop ?? 0;
    const bottomDamage = currentScenario.attackDamageBottom ?? 0;
    const historyEntry: DeckHistoryEntry = { id: crypto.randomUUID(), round: currentScenario.round, initiative: Number(initiativeCard?.initiative ?? 99), initiativeCard: titleCase(initiativeCard?.name ?? ''), topCard: titleCase(topPlayedCard?.name ?? ''), bottomCard: titleCase(bottomPlayedCard?.name ?? ''), topDamage, bottomDamage, totalDamage: topDamage + bottomDamage, experience: earnedExperience - (currentScenario.experienceGained ?? 0) };
    const turnHistory = [...(currentScenario.turnHistory ?? []), historyEntry];
    const log = [`Round ${currentScenario.round}: initiative ${historyEntry.initiative}; TOP ${historyEntry.topCard} · ${topDamage} damage; BOTTOM ${historyEntry.bottomCard} · ${bottomDamage} damage${historyEntry.experience ? `; +${historyEntry.experience} XP` : ''}.`, ...currentScenario.log].slice(0, 12);
    saveDecks(savedDecks.map((deck) => deck.id === currentScenario.deckId ? { ...deck, history: [...(deck.history ?? []), historyEntry] } : deck));
    saveScenario(profile.id, { ...currentScenario, hand: remainingHand, discard: nextDiscard, lost: nextLost, active: nextActive, activeSides: nextActiveSides, roundActive: nextRoundActive, roundActiveSides: nextRoundActiveSides, activeAugmentKey: nextActiveAugmentKey, activateAugmentKey: null, experienceGained: earnedExperience, elements: nextActiveElements, turnHistory, attackDamageTop: 0, attackDamageBottom: 0, selected: [], topCardKey: null, initiativeCardKey: null, phase: 'cleanup', log });
  }
  function updateElement(element: ElementName, state: ElementState) {
    if (!currentScenario) return;
    saveScenario(profile.id, { ...currentScenario, elements: { ...emptyElementBoard, ...(currentScenario.elements ?? {}), [element]: state } });
  }
  function finishRound() {
    if (!currentScenario) return;
    const elements = { ...emptyElementBoard, ...(currentScenario.elements ?? {}) };
    for (const element of elementNames) {
      if (elements[element] === 'Strong') elements[element] = 'Waning';
      else if (elements[element] === 'Waning') elements[element] = 'Inert';
    }
    const discard = [...currentScenario.discard];
    const lost = [...currentScenario.lost];
    for (const key of currentScenario.roundActive ?? []) {
      const card = character.abilityCards.find((item) => cardKey(profile.classId, item.name) === key);
      const side = currentScenario.roundActiveSides?.[key] ?? 'top';
      if (card && isLostAction(card, side)) lost.push(key);
      else discard.push(key);
    }
    saveScenario(profile.id, { ...currentScenario, elements, discard, lost, roundActive: [], roundActiveSides: {}, phase: 'select', round: currentScenario.round + 1 });
  }
  function adjustExperience(delta: number) {
    if (!currentScenario) return;
    saveScenario(profile.id, { ...currentScenario, experienceGained: Math.max(0, (currentScenario.experienceGained ?? 0) + delta) });
  }
  function adjustDamage(delta: number) {
    if (!currentScenario) return;
    const nextDamage = Math.min(maxHealth, Math.max(0, currentScenario.damageTaken + delta));
    saveScenario(profile.id, { ...currentScenario, damageTaken: nextDamage });
    updateProfile({ health: maxHealth - nextDamage });
  }
  function beginShortRest() {
    if (!currentScenario || currentScenario.phase !== 'cleanup' || currentScenario.discard.length < 2) return;
    const cardKeyToLose = currentScenario.discard[Math.floor(Math.random() * currentScenario.discard.length)];
    setShortRestChoice({ cardKey: cardKeyToLose, rerolled: false, damage: 0 });
  }
  function rerollShortRestLoss() {
    if (!currentScenario || !shortRestChoice || shortRestChoice.rerolled) return;
    const alternatives = currentScenario.discard.filter((key) => key !== shortRestChoice.cardKey);
    if (!alternatives.length) return;
    setShortRestChoice({ cardKey: alternatives[Math.floor(Math.random() * alternatives.length)], rerolled: true, damage: 1 });
  }
  function confirmShortRest() {
    if (!currentScenario || !shortRestChoice) return;
    const returned = currentScenario.discard.filter((key) => key !== shortRestChoice.cardKey);
    const card = character.abilityCards.find((item) => cardKey(profile.classId, item.name) === shortRestChoice.cardKey);
    const log = [`Round ${currentScenario.round}: short rest; lost ${titleCase(card?.name ?? 'a card')}${shortRestChoice.damage ? ' and suffered 1 damage to redraw' : ''}.`, ...currentScenario.log].slice(0, 12);
    saveScenario(profile.id, { ...currentScenario, hand: [...currentScenario.hand, ...returned], discard: [], lost: [...currentScenario.lost, shortRestChoice.cardKey], damageTaken: currentScenario.damageTaken + shortRestChoice.damage, log });
    if (shortRestChoice.damage) adjustHealth(-1);
    setShortRestChoice(null);
  }
  function longRest() {
    if (!currentScenario || currentScenario.phase !== 'long-rest' || !longRestCard) return;
    const key = longRestCard;
    const side = currentScenario.activeSides?.[key] ?? (key === currentScenario.activeAugmentKey ? character.abilityCards.find((item) => cardKey(profile.classId, item.name) === key)?.augmentSide : undefined) ?? 'top';
    const isActive = currentScenario.active.includes(key);
    const activeCard = character.abilityCards.find((item) => cardKey(profile.classId, item.name) === key);
    if (!currentScenario.discard.includes(key) && !(isActive && activeCard && !isLostAction(activeCard, side))) return;
    const returned = currentScenario.discard.filter((item) => item !== key);
    const nextActive = currentScenario.active.filter((item) => item !== key);
    const nextActiveSides = { ...(currentScenario.activeSides ?? {}) };
    delete nextActiveSides[key];
    const card = character.abilityCards.find((item) => cardKey(profile.classId, item.name) === key);
    const healed = currentScenario.longRestHeal !== false;
    const log = [`Round ${currentScenario.round}: long rest at initiative 99; lost ${titleCase(card?.name ?? 'a card')}${healed ? '; healed up to 2 HP' : ''}; spent items refreshed.`, ...currentScenario.log].slice(0, 12);
    saveScenario(profile.id, { ...currentScenario, items:refreshSpent(currentScenario.items??[]), hand: [...currentScenario.hand, ...returned], discard: [], active: nextActive, activeSides: nextActiveSides, activeAugmentKey: currentScenario.activeAugmentKey === key ? null : currentScenario.activeAugmentKey ?? null, lost: [...currentScenario.lost, key], phase: 'cleanup', damageTaken: healed ? Math.max(0, currentScenario.damageTaken - 2) : currentScenario.damageTaken, selected: [], topCardKey: null, initiativeCardKey: null, log });
    if (healed) adjustHealth(2);
    setLongRestCard('');
  }
  function declareLongRest() {
    if (!currentScenario || currentScenario.phase !== 'select' || currentScenario.selected.length) return;
    if (restEligibleCards.length < 2) return;
    saveScenario(profile.id, { ...currentScenario, phase: 'long-rest', longRestHeal: true, selected: [], topCardKey: null, initiativeCardKey: null, activateAugmentKey: null });
    setLongRestCard('');
  }
  function cancelLongRest() {
    if (!currentScenario || currentScenario.phase !== 'long-rest') return;
    saveScenario(profile.id, { ...currentScenario, phase: 'select' });
    setLongRestCard('');
  }
  function dismissActiveCard(key: string) {
    if (!currentScenario) return;
    const card = character.abilityCards.find((item) => cardKey(profile.classId, item.name) === key);
    if (!card) return;
    const side = currentScenario.activeSides?.[key] ?? (key === currentScenario.activeAugmentKey ? card.augmentSide : undefined) ?? 'top';
    const goesLost = isLostAction(card, side);
    const activeSides = { ...(currentScenario.activeSides ?? {}) };
    delete activeSides[key];
    saveScenario(profile.id, { ...currentScenario, active: currentScenario.active.filter((item) => item !== key), activeSides, activeAugmentKey: currentScenario.activeAugmentKey === key ? null : currentScenario.activeAugmentKey ?? null, lost: goesLost ? [...currentScenario.lost, key] : currentScenario.lost, discard: goesLost ? currentScenario.discard : [...currentScenario.discard, key] });
  }
  function endScenario() {
    if (!window.confirm(`Finish this scenario and bank ${scenarios[profile.id]?.experienceGained ?? 0} XP for ${profile.name}? This ends the active scenario.`)) return;
    const scenarioXp = scenarios[profile.id]?.experienceGained ?? 0;
    const all = { ...scenarios };
    delete all[profile.id];
    setScenarios(all);
    campaignStorage.setItem(`${storagePrefix}:scenarios`, JSON.stringify(all));
    if (scenarioXp > 0) updateProfile({ experience: (profile.experience ?? 0) + scenarioXp });
    setNotice(`Scenario ended. Added ${scenarioXp} XP to ${profile.name}’s character sheet.`);
  }

  const scenarioCards = currentScenario ? {
    hand: cardsForKeys(currentScenario.hand), discard: cardsForKeys(currentScenario.discard), lost: cardsForKeys(currentScenario.lost), active: cardsForKeys(currentScenario.active), roundActive: cardsForKeys(currentScenario.roundActive ?? []),
  } : null;
  const activeRestEligible = currentScenario ? currentScenario.active.filter((key) => {
    const card = character.abilityCards.find((item) => cardKey(profile.classId, item.name) === key);
    const side = currentScenario.activeSides?.[key] ?? (key === currentScenario.activeAugmentKey ? card?.augmentSide : undefined) ?? 'top';
    return Boolean(card && !isLostAction(card, side));
  }) : [];
  const restEligibleCards = currentScenario ? [...new Set([...currentScenario.discard, ...activeRestEligible])] : [];
  const topActionCard = currentScenario?.topCardKey
    ? character.abilityCards.find((card) => cardKey(profile.classId, card.name) === currentScenario.topCardKey) ?? null
    : null;
  const bottomActionCard = currentScenario
    ? character.abilityCards.find((card) => currentScenario.selected.includes(cardKey(profile.classId, card.name)) && cardKey(profile.classId, card.name) !== currentScenario.topCardKey) ?? null
    : null;
  const plannedXp = (topActionCard?.topExperience ?? 0) + (bottomActionCard?.bottomExperience ?? 0);

  return <main className="app-shell" data-class={profile.classId} style={{ '--class-color': character.character.colour, '--class-art': `url("${cardImageUrl(character.character.backgroundImage ?? character.character.portrait ?? '')}")` } as React.CSSProperties}>
    <header className="masthead">
      <div><p className="eyebrow">GLOOMHAVEN · SECOND EDITION</p><h1>{profile.name} · {character.character.name}</h1></div>
      <div className="level-badge"><span>LEVEL</span><strong>{level}</strong></div>
    </header>
    <section className="character-panel" aria-label="Current character">
      <img className="current-class-art" src={cardImageUrl(character.character.backgroundImage ?? character.character.portrait ?? '')} alt={`${character.character.name} class portrait`} /><div className="class-field"><span className="field-label">CHARACTER</span><strong className="character-name">{profile.name}</strong><span className="class-alt-name">{character.character.name} · Level {level}{isRetired ? ' · RETIRED' : ''}</span></div><button className="switch-character-button" onClick={() => setTab("Characters")}>SWITCH</button>
    </section>
    <SaveStatus /><nav className="tabs" aria-label="Main navigation">
      {(['Turn', 'Build', 'My decks', 'Characters', 'Perks', 'Guide'] as Tab[]).map((item) => <button key={item} disabled={isRetired && (item === 'Build' || item === 'Turn')} className={tab === item ? 'tab active' : 'tab'} onClick={() => setTab(item)}>{{Build:'Build','My decks':'Decks',Characters:'Character',Analysis:'Analysis',Turn:'Play',Notes:'Notes',Guide:'Reference',Perks:'Perks'}[item]}</button>)}
      <div className="mobile-more-nav"><button className={`tab${tab==='Perks'||tab==='Guide'?' active':''}`} aria-haspopup="menu" aria-expanded={mobileMoreOpen} onClick={()=>setMobileMoreOpen(!mobileMoreOpen)}>More⌄</button>{mobileMoreOpen&&<div className="mobile-more-menu" role="menu"><button role="menuitem" onClick={()=>{setTab('Perks');setMobileMoreOpen(false);}}>Perks</button><button role="menuitem" onClick={()=>{setTab('Guide');setMobileMoreOpen(false);}}>Reference</button></div>}</div>
    </nav>
    {notice && <button className="notice-toast" onClick={() => setNotice('')}>{notice} <span>×</span></button>}

    {tab === 'Build' ? <>
      <section className="deck-summary"><div><span className="field-label">CARDS IN BUILD</span><p><strong>{selected.length} / {handSize}</strong><span>fixed class hand size</span></p></div><span className="available-count">{availableCards.length} ability cards</span></section>
      <BuildEquipment owned={ownedItems} ids={equippedItems} level={level} onChange={changeEquipment}/>
      {profile.classId === initialClassId && <MindthiefAdvice equipment={buildEquipment} journalNotes={(profile.notesEntries ?? []).map(note=>note.text)} style={advisorStyle} secondaryStyle={advisorSecondary} onStylesChange={changeStyles} perkSelections={profile.perkSelections ?? {}} maxHealth={maxHealth} onInspect={(card) => { setPreviewCardName(card.name); document.getElementById("builder-card-viewer")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }} onSwap={(out, into) => { const next = selected.map(key => key === cardKey(profile.classId, out.name) ? cardKey(profile.classId, into.name) : key); setSelected(next); saveSelection(next); setNotice(`Swapped ${titleCase(out.name)} for ${titleCase(into.name)}. Save when ready.`); }} onPropose={(cards, direction) => { if(!window.confirm(`Replace the current draft with the recommended ${direction} ten-card hand?`))return; const keys = cards.map(card => cardKey(profile.classId, card.name)); setSelected(keys); saveSelection(keys); setEditingDeckId(null); setDeckName(`Mindthief · ${direction}`); setNotice(`${direction} draft proposed. Review the cards before saving.`); }} cards={selectedCards} available={availableCards} activeAugment={character.abilityCards.find(card => cardKey(profile.classId, card.name) === currentScenario?.activeAugmentKey)?.name} />}<section className="builder-heading"><h2>Choose ability cards</h2><span>Level {level}</span></section>
      <div className="search-row"><input aria-label="Search cards" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search card names" /><a href={`https://www.gloomhavencards.com/gh2/characters/${profile.classId}`} target="_blank" rel="noreferrer">OPEN CARD BROWSER ↗</a></div>
      <div className="filters" role="group" aria-label="Filter cards by initiative and category">{initiativeFilters.map((item) => <button key={item} className={filter === item ? 'chip selected' : 'chip'} onClick={() => setFilter(item)}>{item === 'Fast' ? 'Fast ≤30' : item === 'Steady' ? 'Steady 31–60' : item === 'Late' ? 'Late ≥61' : item}</button>)}<button className={augmentOnly ? 'chip selected' : 'chip'} onClick={() => setAugmentOnly(!augmentOnly)}>Augments</button></div>
      <div className="filters effect-filters" role="group" aria-label="Filter cards by effect category"><button className={effectFilter === 'All' ? 'chip selected' : 'chip'} onClick={() => { setEffectFilter('All'); setEffectValueFilter('All values'); }}>All cards</button>{(['Element create', 'Element consume', 'Status effect'] as const).map((category) => <button key={category} className={effectFilter === category ? 'chip selected' : 'chip'} onClick={() => { setEffectFilter(category); setEffectValueFilter('All values'); }}>{category}</button>)}</div>
      {effectFilter !== 'All' && <div className="filters effect-filters effect-value-filters" role="group" aria-label={`Filter by specific ${effectFilter.toLowerCase()}`}><button className={effectValueFilter === 'All values' ? 'chip selected' : 'chip'} onClick={() => setEffectValueFilter('All values')}>{effectFilter === 'Element create' ? 'All created elements' : effectFilter === 'Element consume' ? 'All consumed elements' : 'All status effects'}</button>{effectValueOptions.map((value) => <button key={value} className={effectValueFilter === value ? 'chip selected' : 'chip'} onClick={() => setEffectValueFilter(value)}><ConditionSymbol name={value}/>{value}</button>)}{effectValueOptions.length === 0 && <span className="metadata-note">No {effectFilter.toLowerCase()} values indexed for this class yet.</span>}</div>}
      <div className="build-workspace"><section className="card-list" aria-label={`Available ${character.character.name} cards`}>
        {visibleCards.map((card) => {
          const key = cardKey(profile.classId, card.name);
          const isSelected = selected.includes(key);
          const tags = effectTags(card);
          return <div key={key} className="card-with-preview"><button onMouseEnter={() => setPreviewCardName(card.name)} onFocus={() => setPreviewCardName(card.name)} className={`ability-card${isSelected ? ' chosen' : ''}`} onClick={() => toggleCard(card)} aria-pressed={isSelected}>
            <span className="card-preview-row"><img className="card-art" src={cardImageUrl(card.image)} alt={`${titleCase(card.name)} ability card`} loading="lazy" decoding="async" /><span className="card-main"><span className="card-header"><span><span className="card-meta">{character.character.id} · LEVEL {card.level}</span><strong className="card-name">{titleCase(card.name)}</strong></span><span className="initiative"><strong>{String(Number(card.initiative)).padStart(2, '0')}</strong><small>INIT</small></span></span>
            <span className="effect-tags">{card.augment && <span className="effect-tag augment-tag">Augment · {card.augmentSide ?? 'side not recorded'}</span>}{tags.map((tag) => <span className="effect-tag" key={tag}><ConditionSymbol text={tag}/>{tag}</span>)}</span>
            {(isLostAction(card, 'top') || isLostAction(card, 'bottom')) && <span className="effect-tags">{isLostAction(card, 'top') && <span className="effect-tag loss-tag">Top action · Lost</span>}{isLostAction(card, 'bottom') && <span className="effect-tag loss-tag">Bottom action · Lost</span>}</span>}
            {tags.length === 0 && !card.augment && <span className="metadata-note">Card details unavailable here · see artwork.</span>}</span></span>
            <span className="pick-label">{isSelected ? 'IN YOUR BUILD  ✓' : 'ADD TO BUILD  +'}</span>
          </button><button className="card-inspect-button" onClick={() => { setPreviewCardName(card.name); document.getElementById("builder-card-viewer")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }} aria-label={`View ${titleCase(card.name)} details`}>VIEW CARD ↗</button></div>;
        })}
        {visibleCards.length === 0 && <p className="empty-copy">No cards match this search and filter.</p>}
      </section><aside className="build-insights"><section className="current-hand-panel"><h3>Current hand · {selectedCards.length}/{handSize}</h3>{selectedCards.length?selectedCards.map(card=>{const key=cardKey(profile.classId,card.name);return <article className="current-hand-card" key={key}><img src={cardImageUrl(card.image)} alt=""/><span><strong>{titleCase(card.name)}</strong><small>Initiative {card.initiative}{isLostAction(card,'top')||isLostAction(card,'bottom')?' · Lost action':''}</small></span><button onClick={()=>{const next=selected.filter(item=>item!==key);setSelected(next);saveSelection(next);}} aria-label={`Remove ${titleCase(card.name)} from this hand`}>×</button></article>; }):<p className="empty-copy">Cards you add appear here.</p>}</section><section id="builder-card-viewer" className="large-card-viewer" aria-label="Card viewer"><span className="field-label">CARD VIEWER</span>{previewCard ? <><h3>{titleCase(previewCard.name)}</h3><a href={cardImageUrl(previewCard.image)} target="_blank" rel="noreferrer" aria-label={`Open full-size ${titleCase(previewCard.name)}`}><img src={cardImageUrl(previewCard.image)} alt={`${titleCase(previewCard.name)} full card artwork`} /></a><p>Level {previewCard.level} · Initiative {previewCard.initiative}{previewCard.augment ? " · Passive Augment" : ""}</p><div className="effect-tags">{effectTags(previewCard).map(tag=><span className="effect-tag" key={tag}><ConditionSymbol text={tag}/>{tag}</span>)}</div>{previewCard.buildReview && <div className="reviewed-card-text"><h4>Top</h4><p>{previewCard.buildReview.top}</p><h4>Bottom</h4><p>{previewCard.buildReview.bottom}</p></div>}<small>Open the artwork for full-size details.</small><button className="text-button" onClick={() => setPreviewCardName(null)}>CLEAR VIEWER</button></> : <p>Hover over a card, focus it with Tab, or tap View Card to inspect its full artwork here.</p>}</section><div className="insight-heading"><span className="field-label">BUILD INTELLIGENCE</span><h3>{selected.length ? 'How this deck plays' : 'Start shaping your deck'}</h3><p>Review initiative pairings and action tags in your current build as you choose cards.</p></div><div className="insight-metric"><span>Cards selected</span><strong>{selected.length} / {handSize}</strong></div><div className="insight-metric"><span>Fast initiative pairs ≤30</span><strong>{initiativePairs.length ? `${fastPairCoverage}%` : '—'}</strong></div><div className="insight-metric"><span>Average faster card</span><strong>{averageFastInitiative ?? '—'}</strong></div><div className="insight-metric"><span>Lost action sides</span><strong>{lossActionCount}</strong></div><h4>Pair options</h4>{initiativePairs.length ? [...initiativePairs].sort((a, b) => a.fast - b.fast).slice(0, 5).map((pair) => <div className="insight-pair" key={`${pair.first.name}-${pair.second.name}`}><strong>{String(pair.fast).padStart(2, '0')} / {String(pair.slow).padStart(2, '0')}</strong><span>{titleCase(pair.first.name)} + {titleCase(pair.second.name)}</span></div>) : <p className="empty-copy">Select at least two cards to see turn-speed pairings.</p>}<button className="text-button" onClick={() => { setTab('Build'); requestAnimationFrame(() => { const panel=document.getElementById('build-analysis'); panel?.setAttribute('open',''); panel?.scrollIntoView({behavior:'smooth',block:'start'}); }); }}>VIEW STATS & HISTORY →</button><p className="guide-footnote">Compare the initiative pairs and action tags in this hand.</p></aside></div>
    <div className="save-deck-row">{editingDeckId && <p className="editing-deck-note">EDITING SAVED DECK · changes replace the current card list</p>}<label className="field-label" htmlFor="deck-name">{editingDeckId ? 'UPDATE DECK NAME OR CARD LIST' : `SAVE THIS LIST UNDER ${profile.name.toUpperCase()}`}</label><div><input id="deck-name" value={deckName} onChange={(event) => setDeckName(event.target.value)} placeholder={`${character.character.name} · Level ${level} build`} /><button className="save-deck-button" onClick={saveDeck} disabled={isRetired || selected.length !== handSize || !deckName.trim()}>{editingDeckId ? 'SAVE CHANGES' : 'SAVE DECK'}</button></div>{editingDeckId && <button className="text-button cancel-edit-button" onClick={() => { setEditingDeckId(null); setDeckName(''); setSelected([]); saveSelection([]); }}>CANCEL EDIT · START A NEW BUILD</button>}{selected.length !== handSize && <small className="guide-footnote">Select exactly {handSize} cards, as shown on the class mat, to save a playable deck.</small>}</div>
    <details id="build-analysis" className="build-analysis"><summary>DECK STATS & PLAY HISTORY</summary><section className="analysis-panel">
      <h2>Deck analysis · {profile.name}</h2><label className="field-label" htmlFor="analysis-deck">ANALYZE DECK</label><select id="analysis-deck" className="full-input" value={analysisDeckId ?? ''} onChange={(event) => setAnalysisDeckId(event.target.value || null)}><option value="">Current unsaved build</option>{profileDecks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name} · {deck.history?.length ?? 0} recorded turns</option>)}</select><p>{analysisDeck ? `${analysisCards.length} cards in ${analysisDeck.name}.` : analysisCards.length ? `${analysisCards.length} cards in the current build.` : 'Select cards in Build or choose one of your saved decks.'}</p>
      {analysisDeck && <><div className="guide-stat"><span>Recorded turns</span><strong>{analysisHistory.length}</strong></div><div className="guide-stat"><span>Actual damage logged</span><strong>{analysisTotalDamage}</strong></div><h3 className="subsection-title">Damage by card side</h3>{Object.keys(analysisDamageByAction).length ? Object.entries(analysisDamageByAction).sort((a, b) => b[1].damage - a[1].damage).map(([name, stats]) => <div className="guide-stat" key={name}><span>{name}</span><strong>{stats.damage} · {stats.plays} plays</strong></div>) : <p className="empty-copy">No turn history yet. Play this saved deck and record top and bottom attack damage after each turn.</p>}</>}
      <div className="guide-stat"><span>Average initiative</span><strong>{analysisAverageInitiative ?? '—'}</strong></div>
      <div className="guide-stat"><span>Average faster choice across card pairs</span><strong>{analysisAverageFast ?? '—'}</strong></div>
      {analysisInitiativePairs.length > 0 && <div className="initiative-pair-list"><h3 className="subsection-title">Initiative pair options</h3>{[...analysisInitiativePairs].sort((a, b) => a.fast - b.fast).slice(0, 6).map((pair) => <div className="initiative-pair" key={`${pair.first.name}-${pair.second.name}`}><strong>{String(pair.fast).padStart(2, '0')} / {String(pair.slow).padStart(2, '0')}</strong><span>{titleCase(pair.first.name)} + {titleCase(pair.second.name)}</span></div>)}{analysisInitiativePairs.length > 6 && <p className="guide-footnote">Showing the six quickest pairs out of {analysisInitiativePairs.length} possible pairs.</p>}</div>}
      <div className="guide-stat"><span>Augment cards in deck</span><strong>{analysisCards.filter((card) => card.augment).length}</strong></div>
      <div className="guide-stat"><span>Confirmed Lost action sides</span><strong>{analysisLossCount}</strong></div>
      <div className="guide-stat"><span>Cards with action metadata</span><strong>{analysisMetadataCount} / {analysisCards.length}</strong></div>
      {analysisInitiativeGroups.map((group) => <div className="analysis-row" key={group.name}><span>{group.name}</span><strong>{group.count}</strong><div className="bar-track"><i style={{ width: `${analysisCards.length ? (group.count / analysisCards.length) * 100 : 0}%` }} /></div></div>)}
      <h3 className="subsection-title">Status and effect mix</h3>{analysisEffects.length ? analysisEffects.map((effect) => <div className="guide-stat" key={effect}><span><ConditionSymbol text={effect}/>{effect}</span><strong>{analysisCards.filter((card) => effectTags(card).includes(effect)).length}</strong></div>) : <p className="empty-copy">Card action details are still being reviewed; see the artwork for full effects.</p>}
      <p className="guide-footnote">Damage history uses the values you record after each action.</p>
    </section></details>
    </> : tab === 'My decks' ? <section className="deck-library">
      <h2>Deck lists · {profile.name}</h2>
      {profileDecks.length ? profileDecks.map((deck) => { const history = deck.history ?? []; const damageTotal = history.reduce((sum, entry) => sum + entry.totalDamage, 0); const actions = history.reduce<Record<string, { uses: number; damage: number }>>((totals, entry) => { for (const [side, cardName, damage] of [['Top', entry.topCard, entry.topDamage], ['Bottom', entry.bottomCard, entry.bottomDamage]] as const) { const key = `${cardName} · ${side}`; const item = totals[key] ?? { uses: 0, damage: 0 }; totals[key] = { uses: item.uses + 1, damage: item.damage + damage }; } return totals; }, {}); return <article className="saved-deck-card" key={deck.id}><div className="saved-deck"><div><strong>{deck.name}</strong><span>{deck.className} · Level {deck.level} · {deck.cardKeys.length} cards · {history.length} turn records</span></div><button className="text-button" disabled={isRetired} onClick={() => loadDeck(deck)}>EDIT</button><button className="scenario-button" disabled={isRetired} onClick={() => startScenario(deck)}>PLAY</button><button className="remove-button" aria-label={`Remove ${deck.name}`} onClick={() => removeDeck(deck.id)}>×</button></div>{history.length > 0 && <details className="deck-history"><summary>ANALYTICS & TURN HISTORY · {damageTotal} DAMAGE LOGGED</summary><h4>Damage by card action</h4><div className="history-action-grid">{Object.entries(actions).sort((a, b) => b[1].damage - a[1].damage).map(([name, stats]) => <div className="history-action" key={name}><strong>{name}</strong><span>{stats.damage} damage · {stats.uses} plays</span></div>)}</div><h4>Turns played</h4><div className="history-table">{history.slice().reverse().map((entry) => <div className="history-row" key={entry.id}><span>R{entry.round} · Init {entry.initiative}</span><span><b>TOP</b> {entry.topCard} · {entry.topDamage}</span><span><b>BOTTOM</b> {entry.bottomCard} · {entry.bottomDamage}</span></div>)}</div></details>}<div className="saved-deck-card-actions"><button className="text-button" disabled={isRetired} onClick={() => loadDeck(deck)}>EDIT BUILD</button><button className="text-button" onClick={() => { setAnalysisDeckId(deck.id); setTab('Build'); requestAnimationFrame(() => { const panel=document.getElementById('build-analysis'); panel?.setAttribute('open',''); panel?.scrollIntoView({behavior:'smooth',block:'start'}); }); }}>VIEW STATS & HISTORY →</button></div></article>; }) : <p className="empty-copy">Build a card list, name it, and save it under this character.</p>}
      {savedDecks.filter((deck) => deck.profileId !== profile.id).map((deck) => <article className="saved-deck compact" key={deck.id}><div><strong>{deck.name}</strong><span>{deck.className} · {deck.cardKeys.length} cards</span></div><button className="text-button" onClick={() => selectProfile(deck.profileId)}>OPEN CHARACTER</button></article>)}
    </section> : tab === 'Characters' ? <section className="character-sheet">
      <h2>Character details</h2>
      <p>Changes save automatically on this computer: XP, derived level, gold, health, decks, and scenario progress.</p>
      <div className="character-detail-banner"><img src={cardImageUrl(character.character.backgroundImage ?? character.character.portrait ?? '')} alt={`${character.character.name} class portrait`} /><div><span className="field-label">CLASS MAT · LEVEL {level}</span><strong>{character.character.name}</strong><small>Class hand size: {handSize} cards. The class notes and game references are together in the Reference tab.</small></div></div><details className="class-reference"><summary>OPEN FULL CLASS MAT & PERK SHEET</summary><img src={cardImageUrl(character.character.portrait ?? '')} alt={`${character.character.name} full character mat`} loading="lazy" />{character.character.perkSheet && <img src={cardImageUrl(character.character.perkSheet)} alt={`${character.character.name} perk sheet reference`} loading="lazy" />}</details>
      <label className="field-label" htmlFor="current-character-name">CHARACTER NAME</label><input id="current-character-name" className="full-input" value={profile.name} onChange={(event) => updateProfile({ name: event.target.value })} />
      <div className="guide-stat"><span>Class</span><strong>{character.character.name}</strong></div>
      <div className="guide-stat"><span>Level</span><strong>{level}</strong></div>
      <div className="guide-stat"><span>Saved deck lists</span><strong>{profileDecks.length}</strong></div>
      <div className="guide-stat"><span>Fixed class hand size</span><strong>{handSize} cards</strong></div>
      <h3 className="subsection-title">Health tracker</h3><p>Maximum HP follows the {character.character.name} class mat at the current level.{character.character.maxHealthEstimated ? ' This class mat was unavailable; its low-health track is provisional.' : ''}</p><div className="health-max-readout"><span className="field-label">LEVEL {level} · MAX HP</span><strong>{maxHealth}</strong></div><div className="health-control"><button aria-label="Lose one hit point" disabled={(profile.health ?? maxHealth) <= 0} onClick={() => adjustHealth(-1)}>−</button><strong>{Math.min(profile.health ?? maxHealth, maxHealth)} / {maxHealth} HP</strong><button aria-label="Recover one hit point" disabled={(profile.health ?? maxHealth) >= maxHealth} onClick={() => adjustHealth(1)}>+</button><button className="health-reset" onClick={() => updateProfile({ health: maxHealth })}>FULL</button></div>
      <h3 className="subsection-title">Campaign progress</h3>
      <label className="field-label" htmlFor="character-xp">CUMULATIVE EXPERIENCE</label><input id="character-xp" className="full-input" type="number" min="0" value={profile.experience ?? 0} disabled={isRetired} onChange={(event) => updateProfile({ experience: Math.max(0, Number(event.target.value)) })} />
      <div className="xp-add-row"><input className="full-input" type="number" min="1" aria-label="Experience gained" placeholder="XP gained" value={xpToAdd} onChange={event => setXpToAdd(event.target.value)} /><button className="scenario-button" disabled={isRetired || !Number.isFinite(Number(xpToAdd)) || Number(xpToAdd) <= 0} onClick={() => { updateProfile({ experience: (profile.experience ?? 0) + Math.floor(Number(xpToAdd)) }); setXpToAdd(""); }}>ADD XP</button></div><div className="xp-level-track" aria-label="Cumulative experience requirements by level">{character.character.experienceThresholds.map((threshold, index) => <div className={index + 1 === level ? 'xp-level-step current' : 'xp-level-step'} key={index}><small>LEVEL {index + 1}</small><strong>{threshold}</strong><small>XP</small></div>)}</div><p className="guide-footnote">Level is derived from total XP and the class sheet scale. Level-up benefits are applied from the cumulative XP total; resolve campaign actions during City Phase downtime.</p>
      {profile.classId === initialClassId ? <p>Manage your unlocked perks and masteries in the <button className="text-button" onClick={() => setTab("Perks")}>PERKS TAB →</button>. Selected effects are used by the advisor and simulator.</p> : <>      <div className="perk-tracker"><div><span className="field-label">PERK MARKS AVAILABLE</span><strong>{profile.perkMarks ?? 0}</strong></div><button aria-label="Remove a perk mark" disabled={!profile.perkMarks} onClick={() => updateProfile({ perkMarks: Math.max(0, (profile.perkMarks ?? 0) - 1) })}>−</button><button aria-label="Add a perk mark" onClick={() => updateProfile({ perkMarks: (profile.perkMarks ?? 0) + 1 })}>+</button><small>Leveling up adds a mark. Record the perk selected below.</small></div><label className="field-label" htmlFor="perk-choice">PERK TAKEN</label><div className="perk-entry-row"><input id="perk-choice" className="full-input" value={perkDraft} onChange={(event) => setPerkDraft(event.target.value)} placeholder="Enter the perk from the class sheet" /><button className="save-deck-button" disabled={!perkDraft.trim()} onClick={addPerk}>RECORD PERK</button></div>{(profile.perks ?? []).length > 0 && <div className="perk-list">{profile.perks?.map((perk, index) => <div className="perk-row" key={`${perk}-${index}`}><span>{index + 1}. {perk}</span><button className="remove-button" aria-label={`Remove perk ${perk}`} onClick={() => removePerk(index)}>×</button></div>)}</div>}<p className="guide-footnote">Use the perk sheet reference to record choices. Perk marks and choices are saved to this character; attack modifier deck changes are not simulated.</p></>}
      <label className="field-label" htmlFor="character-gold">GOLD</label><input id="character-gold" className="full-input" type="number" min="0" value={profile.gold ?? 0} onChange={(event) => updateProfile({ gold: Math.max(0, Number(event.target.value)) })} />
      {profile.classId === initialClassId ? <div className="guide-stat"><span>Battle-goal checkmarks · {profile.checkmarks ?? 0} / 18</span><button className="text-button" onClick={() => setTab("Perks")}>MANAGE IN PERKS →</button></div> : <><label className="field-label" htmlFor="character-checkmarks">CHECKMARKS</label><input id="character-checkmarks" className="full-input" type="number" min="0" value={profile.checkmarks ?? 0} onChange={(event) => updateProfile({ checkmarks: Math.max(0, Number(event.target.value)) })} /></>}
      <label className="field-label" htmlFor="character-notes">CAMPAIGN NOTES</label><textarea id="character-notes" className="full-input character-notes" value={profile.notes ?? ''} onChange={(event) => updateProfile({ notes: event.target.value })} placeholder="Goals, reminders, campaign details…" />
      <OwnedItems key={profile.id} ids={ownedItems} disabled={isRetired} onChange={ids=>updateProfile({ownedItems:ids})}/>
      <section className="notes-panel"><div className="notes-heading"><div><span className="field-label">CHARACTER JOURNAL</span><h2>Play notes · {profile.name}</h2><p>Name cards and what worked or failed. Saved notes help tailor Build suggestions.</p></div>{currentScenario && <span className="session-tag">{currentScenario.deckName} · Round {currentScenario.round}</span>}</div><label className="field-label" htmlFor="play-note">NEW NOTE</label><textarea id="play-note" className="full-input note-composer" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="What happened? What worked? What should you try next time?" /><button className="save-deck-button note-save" disabled={!noteDraft.trim()} onClick={addCharacterNote}>SAVE NOTE{currentScenario ? ' · TAG CURRENT DECK & ROUND' : ''}</button><h3 className="subsection-title">Saved notes · {(profile.notesEntries ?? []).length}</h3>{(profile.notesEntries ?? []).length ? <div className="note-list">{profile.notesEntries?.map((note) => <article className="note-card" key={note.id}><div className="note-card-meta"><time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time>{note.deckName && <span>{note.deckName} · Round {note.round}</span>}</div><p>{note.text}</p><button className="text-button" onClick={() => removeCharacterNote(note.id)}>DELETE NOTE</button></article>)}</div> : <p className="empty-copy">No notes yet. New notes are saved to this character, with the current deck and round attached during a scenario.</p>}</section>
      <section className="retirement-panel"><h3 className="subsection-title">Personal quest & retirement</h3><label className="field-label" htmlFor="personal-quest-title">PERSONAL QUEST</label><input id="personal-quest-title" className="full-input" value={profile.personalQuestTitle ?? ''} disabled={isRetired} onChange={(event) => updateProfile({ personalQuestTitle: event.target.value })} placeholder="Optional quest title" />{isRetired ? <p className="retired-status">Retired {new Date(profile.retiredAt ?? '').toLocaleDateString()} · archived; cannot join future scenarios.</p> : <><label className="retirement-ready-option"><input type="checkbox" checked={profile.retirementReady ?? false} disabled={Boolean(currentScenario)} onChange={(event) => updateProfile({ retirementReady: event.target.checked })} /><span>The personal-quest section directs retirement, and the party is in Gloomhaven during Downtime.</span></label><button className="delete-character-button retire-character-button" disabled={!profile.retirementReady || Boolean(currentScenario)} onClick={retireCharacter}>RETIRE CHARACTER</button><p className="guide-footnote">Retirement is only during City Phase Downtime after the Personal Quest’s section instructions direct it. The game awards 2 prosperity, unlocks the indicated content, and adds a Personal Quest. Read the class retirement section, return the character’s items, and remove their gold. This app archives the character and applies retirement perk marks to your next character; resolve the campaign rewards in your campaign sheet.</p></>}</section>
      <div className="character-actions"><button className="text-button create-action" onClick={() => setTab('My decks')}>VIEW THIS CHARACTER’S DECKS →</button><button className="delete-character-button" onClick={() => deleteCharacter()}>DELETE CHARACTER</button></div>
      <section className="new-character-form"><h3>Create another character</h3><label className="field-label" htmlFor="new-character-name">CHARACTER NAME</label><input id="new-character-name" className="full-input" value={newCharacterName} onChange={(event) => setNewCharacterName(event.target.value)} placeholder="Name this character" /><label className="field-label" htmlFor="new-character-class">CLASS</label><select id="new-character-class" className="full-input" value={createClassId} onChange={(event) => setNewCharacterClass(event.target.value)}>{availableNewCharacters.map((item) => <option key={item.character.id} value={item.character.id}>{item.character.name}</option>)}</select><button className="save-deck-button create-character-button" onClick={createCharacter} disabled={!newCharacterName.trim() || !createClassId}>CREATE CHARACTER</button></section>
      <h3 className="subsection-title">Switch character</h3>
      {profiles.map((item) => { const classData = characters.find((entry) => entry.character.id === item.classId); const itemLevel = classData ? levelForExperience(item.experience ?? 0, classData.character.experienceThresholds) : 1; const itemMaxHealth = classData?.character.maxHealthByLevel[itemLevel - 1]; return <div className={`profile-row profile-row-managed${item.id === profile.id ? ' selected-profile' : ''}`} key={item.id}><button className="profile-row-open" onClick={() => selectProfile(item.id)}><span><strong>{item.name}{item.retiredAt ? ' · RETIRED' : ''}</strong><small>{classData?.character.name} · Level {itemLevel} · {savedDecks.filter((deck) => deck.profileId === item.id).length} decks · {item.health ?? itemMaxHealth}/{itemMaxHealth} HP</small></span><span>OPEN →</span></button><button className="remove-button profile-delete" aria-label={`Delete ${item.name}`} onClick={() => deleteCharacter(item)}>×</button></div>; })}
    </section> : tab === 'Perks' ? (profile.classId === initialClassId ? <PerksPanel selections={profile.perkSelections ?? {}} masteriesUnlocked={profile.masteries ?? []} availableMarks={profile.perkMarks ?? 0} checkmarks={profile.checkmarks ?? 0} checkmarkSlots={profile.battleChecks ?? Array.from({length:18},(_,i)=>i<(profile.checkmarks ?? 0))} legacy={profile.perks ?? []} retired={isRetired} onChecks={(value,slots) => updateProfile({checkmarks:value,battleChecks:slots})} onPerk={(id,index,checked) => { if(checked && (profile.perkMarks ?? 0)<=0)return; const boxes=[...(profile.perkSelections?.[id] ?? [])]; if(!!boxes[index]===checked)return; boxes[index]=checked; updateProfile({perkSelections:{...profile.perkSelections,[id]:boxes},perkMarks:(profile.perkMarks ?? 0)+(checked?-1:1)}); }} onMastery={(id,checked) => { if(!checked && (profile.perkMarks ?? 0)<=0){setNotice('Refund one allocated perk mark before removing this mastery.');return;} updateProfile({masteries:checked?[...(profile.masteries ?? []),id]:(profile.masteries ?? []).filter(m=>m!==id),perkMarks:(profile.perkMarks ?? 0)+(checked?1:-1)}); }} /> : <section><h2>Perks</h2><p>Structured perk tracking is currently available for Mindthief. Other characters retain their records in Character.</p></section>) : tab === 'Turn' ? <section className="turn-panel">
      <h2>Scenario turn tracker</h2>
      {!currentScenario ? <>
        <p>Start from one of {profile.name}’s saved deck lists. Its cards enter your hand.</p>
        {profileDecks.length ? profileDecks.map((deck) => <article className="saved-deck" key={deck.id}><div><strong>{deck.name}</strong><span>{deck.cardKeys.length} cards · {deck.className} level {deck.level}</span></div><button className="scenario-button" disabled={isRetired} onClick={() => startScenario(deck)}>START</button></article>) : <p className="empty-copy">Save a deck list first to start a scenario.</p>}
      </> : <>
        <div className="scenario-heading"><div><span className="field-label">ROUND</span><strong>{currentScenario.round}</strong></div><div><span className="field-label">SCENARIO DECK</span><strong>{currentScenario.deckName}</strong></div><div className="scenario-xp"><span className="field-label">SCENARIO XP</span><strong>{currentScenario.experienceGained ?? 0} XP</strong><div><button aria-label="Remove one experience" onClick={() => adjustExperience(-1)}>−</button><button aria-label="Add one experience" onClick={() => adjustExperience(1)}>+</button></div></div><div className="scenario-xp"><span className="field-label">HEALTH</span><strong>{Math.max(0, maxHealth - currentScenario.damageTaken)} / {maxHealth} HP</strong><div><button aria-label="Lose one hit point" onClick={() => adjustDamage(1)}>−</button><button aria-label="Recover one hit point" disabled={currentScenario.damageTaken <= 0} onClick={() => adjustDamage(-1)}>+</button></div></div><button className="scenario-button" onClick={endScenario}>FINISH · BANK XP</button></div>
        <div className="piles-grid">{[
          ['Discard', scenarioCards?.discard ?? []], ['Round bonus', scenarioCards?.roundActive ?? []], ['Active', scenarioCards?.active ?? []], ['Lost', scenarioCards?.lost ?? []],
        ].map(([name, cardsInPile]) => <div className={`pile pile-${String(name).toLowerCase().replace(' ','-')}`} key={name as string}><strong>{name as string} · {(cardsInPile as AbilityCard[]).length}</strong><div className="pile-cards">{(cardsInPile as AbilityCard[]).length ? (cardsInPile as AbilityCard[]).map((card) => <button className="pile-card" key={card.name} onClick={()=>setPreviewCardName(card.name)} aria-label={`Preview ${titleCase(card.name)}`}><img src={cardImageUrl(card.image)} alt="" loading="lazy"/><span>{titleCase(card.name)}</span></button>) : <span className="empty-copy">—</span>}</div></div>)}</div>
        {(() => { const pileCards=[...(scenarioCards?.hand??[]),...(scenarioCards?.discard??[]),...(scenarioCards?.roundActive??[]),...(scenarioCards?.active??[]),...(scenarioCards?.lost??[])]; const card=pileCards.find(c=>c.name===previewCardName); return card ? <div className="card-preview-overlay" role="presentation" onClick={event=>{if(event.target===event.currentTarget)setPreviewCardName(null);}}><section className="turn-card-viewer" role="dialog" aria-modal="true" aria-labelledby="play-card-preview-title"><div className="card-preview-heading"><span className="field-label">CARD PREVIEW</span><button className="card-preview-close" aria-label="Close card preview" onClick={()=>setPreviewCardName(null)}>CLOSE ×</button></div><h3 id="play-card-preview-title">{titleCase(card.name)}</h3><a href={cardImageUrl(card.image)} target="_blank" rel="noreferrer"><img src={cardImageUrl(card.image)} alt={`${titleCase(card.name)} full card`} /></a><p>Level {card.level} · Initiative {card.initiative}</p>{card.buildReview&&<div className="reviewed-card-text"><h4>Top</h4><p>{card.buildReview.top}</p><h4>Bottom</h4><p>{card.buildReview.bottom}</p></div>}</section></div> : null; })()}
        {(scenarioCards?.active.length ?? 0) > 0 && <section className="active-card-controls"><h3 className="subsection-title">Active bonuses</h3><p>Dismiss a persistent card to end its effect and move it to its marked pile. A non-Lost active card can then be recovered by resting if it is in your discard pile.</p>{scenarioCards?.active.map((card) => <div className="active-card-row" key={card.name}><strong>{titleCase(card.name)}</strong><span>{card.augment ? 'Augment' : 'Persistent'} · remains active through rests</span><button className="text-button" onClick={() => dismissActiveCard(cardKey(profile.classId, card.name))}>DISMISS</button></div>)}</section>}
        {currentScenario.activeAugmentKey && <div className="active-augment"><span className="field-label">ACTIVE AUGMENT · PASSIVE BENEFIT</span><strong>{titleCase(character.abilityCards.find((card) => cardKey(profile.classId, card.name) === currentScenario.activeAugmentKey)?.name ?? '')}</strong></div>}
        <PlayEquipment key={currentScenario.deckId} states={currentScenario.items??[]} onChange={(items,message)=>saveScenario(profile.id,{...currentScenario,items,log:[message,...currentScenario.log].slice(0,12)})}/>
        {profile.classId===initialClassId&&<details className="live-turn-coach"><summary>Turn advisor · cards remaining in hand</summary><p className="field-label">{livePlaystyles.map(s=>styleNames[s]).join(" + ")||"Save this deck’s playstyle in Build first."}</p><TurnCoach onIntentChange={intent=>saveScenario(profile.id,{...currentScenario,advisorIntent:intent})} cards={cardsForKeys([...new Set([...currentScenario.hand,...currentScenario.discard,...currentScenario.lost,...currentScenario.active,...(currentScenario.roundActive??[])])])} config={{encounter:'mixed',rounds:35,hp:maxHealth,allyCount:3,allyDamage:2,runs:1,seed:20261027,advisorIntent:currentScenario.advisorIntent??'defensive',playstyle:livePlaystyles[0],secondaryPlaystyle:livePlaystyles[1],equipment:advisorEquipment(currentScenario.items??[]),perks:profile.perkSelections??{}}} snapshot={{roundActive:cardsForKeys(currentScenario.roundActive??[]).map(c=>c.name),roundActiveSides:Object.fromEntries(Object.entries(currentScenario.roundActiveSides??{}).map(([key,side])=>[character.abilityCards.find(c=>cardKey(profile.classId,c.name)===key)?.name??key,side])),phase:currentScenario.phase??'select',hand:cardsForKeys(currentScenario.hand).map(c=>c.name),discard:cardsForKeys(currentScenario.discard).map(c=>c.name),lost:cardsForKeys(currentScenario.lost).map(c=>c.name),active:cardsForKeys(currentScenario.active).map(c=>c.name),activeSides:Object.fromEntries(Object.entries(currentScenario.activeSides??{}).map(([key,side])=>[character.abilityCards.find(c=>cardKey(profile.classId,c.name)===key)?.name??key,side])),hp:Math.max(0,maxHealth-currentScenario.damageTaken),round:currentScenario.round,ice:currentScenario.elements?.Ice==='Strong'?2:currentScenario.elements?.Ice==='Waning'?1:0,dark:currentScenario.elements?.Dark==='Strong'?2:currentScenario.elements?.Dark==='Waning'?1:0}} disabledReason={!livePlaystyles.length?'Set this deck’s playstyle in Build and save it before using the advisor.':shortRestChoice?'Resolve the revealed short-rest loss or redraw first.':currentScenario.phase==='long-rest'?'Resolve the declared long rest first.':currentScenario.hand.length<2&&restEligibleCards.length<2&&currentScenario.phase!=='cleanup'?'No legal card play or rest remains.':maxHealth-currentScenario.damageTaken<=0?'This character is exhausted.':undefined}/></details>}
      <section className="element-panel"><div className="element-heading"><div><span className="field-label">SHARED ELEMENT TRACKER</span><p>Tap an element to cycle Inert → Strong → Waning.</p></div></div><div className="element-grid">{elementNames.map((element) => {const value=(currentScenario.elements ?? emptyElementBoard)[element];return <button className={`element-state element-chip ${value.toLowerCase()}`} key={element} aria-label={`${element}: ${value}. Tap to cycle.`} onClick={()=>updateElement(element,({Inert:'Strong',Strong:'Waning',Waning:'Inert'} as const)[value])}><span>{element}</span><strong>{value}</strong></button>;})}</div></section>
        {(currentScenario.phase ?? 'select') === 'select' ? (currentScenario.selected.length < 2 ? <>
          <h3 className="subsection-title">Choose two cards from hand</h3>
          <div className="turn-selection-workspace"><div className="turn-card-list">{scenarioCards?.hand.map((card) => { const key = cardKey(profile.classId, card.name); const checked = currentScenario.selected.includes(key); const previewed = (scenarioCards?.hand.find(c=>c.name===previewCardName)?.name ?? scenarioCards?.hand[0]?.name) === card.name; return <div className={`turn-card${checked ? ' checked' : ''}${previewed ? ' previewed' : ''}`} key={key}><label><input type="checkbox" checked={checked} disabled={!checked && currentScenario.selected.length >= 2} onChange={() => updateTurnSelection(checked ? currentScenario.selected.filter((item) => item !== key) : [...currentScenario.selected, key])} /><span><strong>{titleCase(card.name)}</strong><small>Level {card.level} · Initiative {card.initiative}{isLostAction(card,'top')||isLostAction(card,'bottom')?' · Lost action':''}</small><small className="turn-card-action-summary">Top: {card.buildReview?.top??'See artwork'}</small><small className="turn-card-action-summary">Bottom: {card.buildReview?.bottom??'See artwork'}</small></span></label><button className="turn-card-preview-button" onClick={() => setPreviewCardName(card.name)} aria-pressed={previewed}>PREVIEW</button></div>; })}</div></div>
          {currentScenario.hand.length < 2 && restEligibleCards.length < 2 && <p className="empty-state">You do not have two cards to play or enough cards to rest. This character is exhausted.</p>}
          <button className="rest-button long-rest-declare" disabled={restEligibleCards.length < 2 || currentScenario.selected.length > 0} onClick={declareLongRest}>DECLARE LONG REST · INITIATIVE 99</button>
        </> : <>
          <h3 className="subsection-title">Set this turn</h3>
          <div className="turn-card-choices">{cardsForKeys(currentScenario.selected).map(card=>{const key=cardKey(profile.classId,card.name);const top=currentScenario.topCardKey===key;const initiative=currentScenario.initiativeCardKey===key;return <article className={`turn-card-choice${top?' is-top':''}`} key={key}><div className="turn-card-choice-heading"><img src={cardImageUrl(card.image)} alt=""/><div><strong>{titleCase(card.name)}</strong><small>Initiative {card.initiative}{initiative?' · Initiative selected':''}</small></div></div><button className={`turn-choice-button${initiative?' chosen':''}`} onClick={()=>saveScenario(profile.id,{...currentScenario,initiativeCardKey:key})}>{initiative?'INITIATIVE ✓':'USE INITIATIVE'}</button><button className={`turn-choice-button${top?' chosen':''}`} onClick={()=>saveScenario(profile.id,{...currentScenario,topCardKey:key,activateAugmentKey:null})}>{top?'TOP ACTION ✓':'USE TOP ACTION'}</button><div className="turn-choice-halves"><section><b>Top</b><p>{card.buildReview?.top??'See card artwork for this action.'}</p></section><section><b>Bottom</b><p>{card.buildReview?.bottom??'See card artwork for this action.'}</p></section></div></article>;})}</div>
          <button className="turn-choice-order" aria-label={`Swap action order. Current: ${currentScenario.actionOrder==='bottom-first'?'bottom first':'top first'}.`} onClick={()=>saveScenario(profile.id,{...currentScenario,actionOrder:currentScenario.actionOrder==='bottom-first'?'top-first':'bottom-first'})}>SWAP ORDER · {currentScenario.actionOrder==='bottom-first'?'BOTTOM FIRST':'TOP FIRST'}</button>
          <details className="optional-damage-entry"><summary>Record damage and XP</summary><div className="damage-entry-grid"><label><span className="field-label">TOP ACTION · DAMAGE DEALT</span><input className="full-input" type="number" min="0" value={currentScenario.attackDamageTop ?? 0} onChange={(event) => saveScenario(profile.id, { ...currentScenario, attackDamageTop: Math.max(0, Number(event.target.value)) })} /></label><label><span className="field-label">BOTTOM ACTION · DAMAGE DEALT</span><input className="full-input" type="number" min="0" value={currentScenario.attackDamageBottom ?? 0} onChange={(event) => saveScenario(profile.id, { ...currentScenario, attackDamageBottom: Math.max(0, Number(event.target.value)) })} /></label></div><p className="guide-footnote">Planned XP: {plannedXp}. Add conditional XP with the scenario counter.</p></details>
          <div className="played-actions">{topActionCard && <div><strong>Top · {titleCase(topActionCard.name)}</strong><span>Experience: {topActionCard.topExperienceConditional ? `${topActionCard.topExperience ?? 0}+ conditional XP` : `${topActionCard.topExperience ?? 0} XP`} · {isLostAction(topActionCard, 'top') ? 'Lost' : topActionCard.topPersistent ? 'Persistent' : topActionCard.topRoundBonus ? 'Round bonus' : 'Discard'}</span><small>{[...(topActionCard.topElements?.generate ?? []).map((item) => `Generate ${item}`), ...(topActionCard.topElements?.consume ?? []).map((item) => `Consume ${item}`)].join(' · ') || 'No element effect'}</small></div>}{bottomActionCard && <div><strong>Bottom · {titleCase(bottomActionCard.name)}</strong><span>Experience: {bottomActionCard.bottomExperienceConditional ? `${bottomActionCard.bottomExperience ?? 0}+ conditional XP` : `${bottomActionCard.bottomExperience ?? 0} XP`} · {isLostAction(bottomActionCard, 'bottom') ? 'Lost' : bottomActionCard.bottomPersistent ? 'Persistent' : bottomActionCard.bottomRoundBonus ? 'Round bonus' : 'Discard'}</span><small>{[...(bottomActionCard.bottomElements?.generate ?? []).map((item) => `Generate ${item}`), ...(bottomActionCard.bottomElements?.consume ?? []).map((item) => `Consume ${item}`)].join(' · ') || 'No element effect'}</small></div>}<p>Planned XP: <strong>{plannedXp}</strong>. Add conditional XP with +.</p></div>
          <p className="turn-hint">The other selected card supplies its bottom action. Playing an Augment action automatically equips it; it replaces your previous active Augment.</p>
          <button className="save-deck-button turn-primary" onClick={endTurn}>END TURN · DISCARD OR LOSE CARDS</button>
          <button className="text-button" onClick={() => updateTurnSelection([])}>CANCEL CARD SELECTION</button>
        </>) : (currentScenario.phase ?? 'select') === 'long-rest' ? <section className="rest-panel"><h3 className="subsection-title">Long rest · Initiative 99</h3><p>This is your whole turn. Choose one eligible card to lose; other cards in your discard return to hand. Active bonuses stay active unless selected, and never return to hand automatically.</p><label className="field-label" htmlFor="long-rest-card">CARD TO LOSE</label><select id="long-rest-card" className="full-input" value={longRestCard} onChange={(event) => setLongRestCard(event.target.value)}><option value="">Choose from discard or non-Lost active</option>{restEligibleCards.map((key) => { const fromActive = activeRestEligible.includes(key); return <option key={key} value={key}>{titleCase(character.abilityCards.find((card) => cardKey(profile.classId, card.name) === key)?.name ?? key)} · {fromActive ? 'Active' : 'Discard'}</option>; })}</select><label className="rest-heal-option"><input type="checkbox" checked={currentScenario.longRestHeal !== false} onChange={(event) => saveScenario(profile.id, { ...currentScenario, longRestHeal: event.target.checked })} />Apply Heal 2 Self</label><div className="rest-actions"><button className="save-deck-button" disabled={!longRestCard} onClick={longRest}>RESOLVE LONG REST</button><button className="text-button" onClick={cancelLongRest}>CANCEL</button></div><p className="guide-footnote">Long rest heals 2 HP (tracked here as damage reduction) and refreshes spent items.</p></section> : <section className="rest-panel"><h3 className="subsection-title">End of round</h3>{!shortRestChoice ? currentScenario.discard.length >= 2 ? <button className="rest-button" onClick={beginShortRest}>SHORT REST · DRAW RANDOM LOSS</button> : <p className="empty-copy">Short rest needs at least 2 cards in your discard pile. Active bonuses do not count for short rest.</p> : <div className="rest-choice"><span className="field-label">RANDOM CARD REVEALED · {shortRestChoice.rerolled ? 'REDRAWN' : 'FIRST DRAW'}</span><p><strong>{titleCase(character.abilityCards.find((card) => cardKey(profile.classId, card.name) === shortRestChoice.cardKey)?.name ?? 'a card')}</strong> goes to your Lost pile. Every other card in your discard returns to your hand.</p>{!shortRestChoice.rerolled && <><p>Want to keep it? Suffer 1 damage to lose a different random discard card instead. You may do this once per short rest; you cannot choose which replacement card is lost.</p><button className="text-button" onClick={rerollShortRestLoss}>SUFFER 1 DAMAGE · DRAW DIFFERENT RANDOM CARD</button></>}<button className="save-deck-button" onClick={confirmShortRest}>CONFIRM THIS LOSS</button></div>}<button className="turn-primary save-deck-button" disabled={Boolean(shortRestChoice)} onClick={finishRound}>FINISH ROUND · ADVANCE ELEMENTS</button></section>}
        {currentScenario.log.length > 0 && <section className="turn-log"><h3 className="subsection-title">Recent turns</h3>{currentScenario.log.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}</section>}
      </>}
    </section> : <section className="guide-panel">
      <h2>Reference · {character.character.name}</h2><p>Class notes, status definitions, and gameplay rules in one place.</p>
      <section className="reference-class-notes"><div><span className="field-label">CLASS NOTES · {handSize} CARD HAND</span><p>Quick reference cropped from this class’s mat.</p></div>{character.character.classNotesImage ? <img className="class-notes-image" src={cardImageUrl(character.character.classNotesImage)} alt={`${character.character.name} class notes and rules reference`} /> : <p className="empty-state">A class notes image is not available for this class in the supplied source data yet.</p>}<a className="class-source-link" href={`https://www.gloomhavencards.com/gh2/characters/${profile.classId}`} target="_blank" rel="noreferrer">OPEN CLASS DETAILS ↗</a></section>
      <h3 className="quick-reference-title">Statuses & effects</h3><p>Use this player reference to check what each condition or ability effect does and when it clears.</p>
      {quickReferenceGroups.map((group) => <section className="quick-reference-group" key={group.title}><h3>{group.title}</h3><div className="status-grid">{group.items.map(([name, description]) => <article className="status-item" key={name}><strong><ConditionSymbol name={name}/>{name}</strong><span>{description}</span></article>)}</div></section>)}
      <section className="status-reference"><h3>Resting & card recovery</h3><p><strong>Short rest · End of round.</strong> Requires at least two cards in your discard pile. Randomly lose one; return the rest from discard to hand. You may take 1 damage once to redraw a different random loss.</p><p><strong>Long rest · Declare during card selection.</strong> It replaces your turn and uses initiative 99. Lose one eligible card, return the remaining discard cards to hand, optionally Heal 2 Self, and refresh spent items.</p><p><strong>Active augments and persistent cards.</strong> They stay active through a rest and do not return to hand automatically. A non-Lost active card counts toward long-rest eligibility and can be chosen as the card to lose. Dismiss it to its discard pile first if you want a later rest to return it to hand. Lost active cards are not eligible.</p><a href="https://github.com/mikkelam/gloomhaven-2e-dump/blob/main/gloomhaven_output/gloomhaven-2e-rulebook/gloomhaven-2e-rulebook.md" target="_blank" rel="noreferrer">Gloomhaven 2e rulebook text ↗</a><a href="https://cephalofairgames.github.io/gloomhaven2e-faq/" target="_blank" rel="noreferrer">Cephalofair’s Gloomhaven 2e FAQ ↗</a></section>
    </section>}
    <footer>Gloomhaven Second Edition · {character.character.name} · {characters.length} classes loaded</footer>
  </main>;
}


