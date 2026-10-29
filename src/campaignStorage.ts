const prefix='gloomhaven-deck-companion:v2:';
const stampsKey='gloomhaven-save-timestamps';
type Entry={value:string|null;updatedAt:number};
type Snapshot={version:1;entries:Record<string,Entry>};
type SaveStatus={phase:'saving'|'saved'|'browser-only'|'error';savedAt:number;message:string};
let status:SaveStatus={phase:'saving',savedAt:0,message:'Loading saved campaign…'};
const listeners=new Set<()=>void>(),values=new Map<string,string>();
const entries:Record<string,Entry>={},dirty=new Map<string,Entry>();
let timer:ReturnType<typeof setTimeout>|undefined,inFlight:Promise<void>|undefined,serverAvailable=false;
const diskPersistenceAvailable=typeof window!=='undefined'&&['127.0.0.1','localhost'].includes(window.location.hostname);
function publish(next:SaveStatus){status=next;listeners.forEach(f=>f());}
function localWrite(key:string,value:string|null){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{/* Disk saving remains available. */}}
function remember(snapshot:Snapshot){for(const [key,entry] of Object.entries(snapshot.entries)){if(!key.startsWith(prefix))continue;if(!entries[key]||entry.updatedAt>=entries[key].updatedAt){entries[key]=entry;if(entry.value===null)values.delete(key);else values.set(key,entry.value);localWrite(key,entry.value);}}localWrite(stampsKey,JSON.stringify(Object.fromEntries(Object.entries(entries).map(([k,e])=>[k,e.updatedAt]))));}
export async function flushCampaign():Promise<void>{
 if(timer){clearTimeout(timer);timer=undefined;}
 if(inFlight){await inFlight;if(dirty.size)return flushCampaign();return;}
 if(!dirty.size)return;
 const batch=Object.fromEntries(dirty),outgoing=JSON.stringify({entries:batch});let succeeded=false;
 inFlight=(async()=>{try{
  const response=await fetch('/api/campaign',{method:'PATCH',headers:{'Content-Type':'application/json'},body:outgoing,keepalive:outgoing.length<60_000,signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw new Error('Save rejected');remember(await response.json());serverAvailable=true;succeeded=true;
  for(const [key,entry] of Object.entries(batch))if(dirty.get(key)===entry)dirty.delete(key);
  publish({phase:dirty.size?'saving':'saved',savedAt:Date.now(),message:dirty.size?'Saving…':'Saved on this computer'});
 }catch{publish({phase:serverAvailable?'error':'browser-only',savedAt:status.savedAt,message:serverAvailable?'Disk save failed — retry':'Saved in this browser; computer backup unavailable'});}})();
 await inFlight;inFlight=undefined;if(succeeded&&dirty.size)await flushCampaign();
}
export async function initializeCampaignStorage(){
 let stamps:Record<string,number>={};try{stamps=JSON.parse(localStorage.getItem(stampsKey)??'{}');for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)!;if(key.startsWith(prefix)){const value=localStorage.getItem(key)!;values.set(key,value);entries[key]={value,updatedAt:stamps[key]??0};}}}catch{}
 if(!diskPersistenceAvailable){publish({phase:'browser-only',savedAt:0,message:'Saved on this device'});return;}
 try{const response=await fetch('/api/campaign',{signal:AbortSignal.timeout(3000)});if(!response.ok)throw new Error('Save service unavailable');const snapshot:Snapshot=await response.json();for(const [key,entry] of Object.entries(entries)){const saved=snapshot.entries[key];if(!saved||entry.updatedAt>saved.updatedAt&&entry.value!==saved.value)dirty.set(key,entry);}remember(snapshot);serverAvailable=true;publish({phase:'saved',savedAt:Date.now(),message:'Saved on this computer'});if(dirty.size)await flushCampaign();}catch{publish({phase:'browser-only',savedAt:0,message:'Saved in this browser; computer backup unavailable'});}
 window.addEventListener('pagehide',()=>{if(dirty.size)void flushCampaign();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&dirty.size)void flushCampaign();});
}
function update(key:string,value:string|null){
 if((values.get(key)??null)===value)return;
 if(value===null)values.delete(key);else values.set(key,value);
 const entry={value,updatedAt:Math.max(Date.now(),(entries[key]?.updatedAt??0)+1)};entries[key]=entry;dirty.set(key,entry);localWrite(key,value);localWrite(stampsKey,JSON.stringify(Object.fromEntries(Object.entries(entries).map(([k,e])=>[k,e.updatedAt]))));
 if(!diskPersistenceAvailable){publish({phase:'browser-only',savedAt:0,message:'Saved on this device'});return;}
 publish({phase:'saving',savedAt:status.savedAt,message:'Saving…'});if(timer)clearTimeout(timer);timer=setTimeout(()=>{void flushCampaign();},1200);
}
export const campaignStorage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>update(key,value),removeItem:(key:string)=>update(key,null)};
export const subscribeToSave=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const getSaveStatus=()=>status;
