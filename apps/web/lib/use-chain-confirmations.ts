'use client';

import {useEffect,useRef} from 'react';
import {command,type Job} from './workbench';

// Reconcile only already-submitted hashes. This hook never prepares or sends a transaction.
export function useChainConfirmations(enabled:boolean,jobs:Job[]|undefined,onRefresh:()=>Promise<void>){
  const checking=useRef(false);
  useEffect(()=>{
    const pending=(jobs??[]).filter(job=>job.tx_hash&&!['SAFE','FAILED'].includes(job.status));
    if(!enabled||!pending.length)return;
    let cancelled=false;
    const timer=window.setInterval(async()=>{
      if(cancelled||checking.current||document.visibilityState!=='visible')return;
      checking.current=true;
      try{
        for(const job of pending){
          if(cancelled)break;
          try{await command<Job>(`jobs/${job.id}/check`);}catch{/* Keep the last known state and the manual receipt check. */}
        }
        if(!cancelled)await onRefresh();
      }finally{checking.current=false;}
    },30_000);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[enabled,jobs,onRefresh]);
}
