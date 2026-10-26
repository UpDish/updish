'use client';
import {useEffect,useId,useRef,type ReactNode} from 'react';

export function Modal({title,description,children,onClose,busy=false,wide=false}:{title:string;description?:string;children:ReactNode;onClose:()=>void;busy?:boolean;wide?:boolean}){
  const ref=useRef<HTMLDialogElement>(null);const titleId=useId(),descriptionId=useId();
  useEffect(()=>{const dialog=ref.current;if(!dialog)return;const trigger=document.activeElement;const overflow=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';return()=>{dialog.close();document.body.style.overflow=overflow;if(trigger instanceof HTMLElement&&trigger.isConnected)trigger.focus({preventScroll:true});};},[]);
  return <dialog ref={ref} className={`task-modal ${wide?'wide':''}`} aria-labelledby={titleId} aria-describedby={description?descriptionId:undefined} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} onClick={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}>
    <div className="modal-surface"><header className="modal-heading"><div><h2 id={titleId}>{title}</h2>{description?<p id={descriptionId}>{description}</p>:null}</div><button type="button" className="secondary small" disabled={busy} onClick={onClose} aria-label={`${title} 닫기`}>닫기</button></header><div className="modal-content">{children}</div></div>
  </dialog>;
}
