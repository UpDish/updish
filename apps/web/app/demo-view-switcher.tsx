'use client';

export type DemoView='operator'|'merchant'|'customer'|'investor';
export const demoViews:{id:DemoView;label:string}[]=[{id:'operator',label:'운영자'},{id:'merchant',label:'가게'},{id:'customer',label:'고객'},{id:'investor',label:'투자자'}];
export function DemoViewSwitcher({view,onChange}:{view:DemoView;onChange:(view:DemoView)=>void}) {
  return <details className="demo-view-switcher" onKeyDown={event=>{if(event.key==='Escape'){event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}>
    <summary>{demoViews.find(v=>v.id===view)!.label} 모드 <span aria-hidden="true">▾</span></summary>
    <div className="demo-view-options" aria-label="시연 화면 선택"><small>시연 화면 전환</small>{demoViews.map(v=><button key={v.id} aria-pressed={view===v.id} onClick={event=>{onChange(v.id);const detail=event.currentTarget.closest('details');if(detail){detail.open=false;detail.querySelector('summary')?.focus();}}}>{v.label} 화면</button>)}<p>실제 지갑·권한은 유지됩니다.</p></div>
  </details>;
}
