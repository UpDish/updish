'use client';
import {useEffect,useRef,type ReactNode} from 'react';

export function AgentDock({open,onClose,children}:{open:boolean;onClose:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const d=ref.current;if(!d||!open)return;const trigger=document.activeElement;const media=window.matchMedia('(max-width:850px)');const overflow=document.body.style.overflow;
    function show(){if(!d)return;d.close();if(media.matches){d.showModal();document.body.style.overflow='hidden';d.setAttribute('aria-modal','true');}else{d.show();document.body.style.overflow=overflow;d.setAttribute('aria-modal','false');}}
    show();media.addEventListener('change',show);return()=>{media.removeEventListener('change',show);d.close();document.body.style.overflow=overflow;if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus({preventScroll:true});};},[open]);
  return <dialog id="agent-dock" ref={ref} className="agent-dock" aria-labelledby="agent-dock-title" onCancel={e=>{if(e.target===e.currentTarget){e.preventDefault();onClose();}}} onKeyDown={e=>{if(e.key==='Escape'&&(e.target as Element).closest('dialog')===e.currentTarget){e.preventDefault();e.stopPropagation();onClose();}}}><header className="agent-dock-heading"><div><h2 id="agent-dock-title">UpDish Agent</h2><span>정산 근거 설명</span></div><button className="secondary small" onClick={onClose} aria-label="Agent 사이드바 닫기">닫기</button></header><div className="agent-dock-content">{children}</div></dialog>;
}
