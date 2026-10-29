import {useSyncExternalStore} from 'react';
import {flushCampaign,getSaveStatus,subscribeToSave} from './campaignStorage';
export default function SaveStatus(){const status=useSyncExternalStore(subscribeToSave,getSaveStatus);return <div className={`save-status save-${status.phase}`} role="status"><span>{status.message}</span>{(status.phase==='error'||status.phase==='browser-only')&&<button className="text-button" onClick={()=>{void flushCampaign();}}>RETRY SAVE</button>}</div>;}
