'use client';
import {useEffect,useRef,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api} from '../lib/auth';
import {command,type Explanation} from '../lib/workbench';
import type {components} from '../lib/api.generated';
import type {Investments} from '../lib/market';
type Message={id:string;role:'user'|'assistant';text:string;sources?:string[]};
export function AgentChat({address,investments,initialId,storeId,storeName,preview=false}:{address:string;investments:Investments;initialId?:string|null;storeId:string;storeName:string;preview?:boolean}){
  const approved=investments.settlements.filter(s=>s.status==='APPROVED');
  const [selected,setSelected]=useState(initialId??'');
  const id=approved.some(s=>s.id===selected)?selected:'';
  const status=useQuery({queryKey:['agent-status',address],queryFn:()=>api<components['schemas']['AgentStatus']>('/api/workbench/agent/status'),enabled:!preview,retry:false});
  const topic=id?approved.find(s=>s.id===id)!:null;
  return <div className="agent-layout"><div className="chat-topic"><label className="sr-only" htmlFor="chat-topic">대화 주제</label><select id="chat-topic" value={id} onChange={e=>setSelected(e.target.value)}><option value="">{storeName} · 가게와 이용 안내</option>{approved.map(s=><option key={s.id} value={s.id}>{s.store_name} · {s.period} 내 정산</option>)}</select></div><ChatThread key={`${address}-${id||storeId}-${preview}`} path={id?`settlements/${id}/explain`:'agent/chat'} storeId={storeId} topic={topic?`${topic.store_name} ${topic.period} 정산`:storeName} enabled={!preview&&status.data?.modelCalls==='CONFIGURED'} blocked={preview?'시연 계정 예시는 읽기 전용입니다.':status.isPending?'연결 중…':'지금은 답변에 연결할 수 없습니다.'} retry={()=>void status.refetch()}/></div>;
}
function ChatThread({path,storeId,topic,enabled,blocked,retry}:{path:string;storeId:string;topic:string;enabled:boolean;blocked:string;retry:()=>void}){
  const transcript=useRef<HTMLDivElement>(null);
  const [messages,setMessages]=useState<Message[]>([]);const [question,setQuestion]=useState('');const [pending,setPending]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{if(transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight;},[messages.length,pending,error]);
  async function send(e:React.FormEvent){
    e.preventDefault();const text=question.trim();if(!enabled||pending||!text)return;
    const history=messages.slice(-2).map(m=>`${m.role==='user'?'이전 질문':'이전 답변'}: ${m.text.slice(0,70)}`).join('\n');
    const prompt=(history?`${history}\n현재 질문: `:'')+text;setMessages(m=>[...m,{id:crypto.randomUUID(),role:'user',text}]);setQuestion('');setPending(true);setError('');
    try{const answer=await command<Explanation>(path,{question:prompt.slice(0,500),...(path==='agent/chat'?{storeId}:{})});let text=answer.explanation;for(const source of answer.sourceIds){const label=source==='updish-demo-guide-v1'?'이용 안내':source===storeId?topic:source.includes('correction')?'환불 정정 자료':source.startsWith('revenue-')?'월 매출 자료':'정산 근거 자료';text=text.replaceAll(source,label);}text=text.replaceAll('SYNTHETIC_CSV','가상 CSV 예시').replaceAll('APPROVED_LEDGER','승인된 원장');setMessages(m=>[...m,{id:crypto.randomUUID(),role:'assistant',text,sources:answer.sourceIds}]);}
    catch(e){setError(e instanceof Error?e.message:'답변을 가져오지 못했습니다.');setQuestion(text);}finally{setPending(false);}
  }
  return <section className="chat-panel" aria-label="Agent 대화"><div className="chat-actions"><span>{topic}</span><button className="inline-button" disabled={pending||!messages.length} onClick={()=>{setMessages([]);setError('');setQuestion('');}}>새 대화</button></div><div ref={transcript} className="chat-transcript" role="log" aria-live="polite" aria-relevant="additions text">{!messages.length?<div className="chat-welcome"><h3>무엇을 도와드릴까요?</h3><p>가게의 매출 대조나 내 정산에 대해 물어보세요.</p></div>:messages.map(m=><article className={`chat-message ${m.role}`} key={m.id}><b>{m.role==='user'?'나':'UpDish'}</b><p>{m.text}</p>{m.sources?.length?<details><summary>참고 자료 {m.sources.length}건</summary><ul>{m.sources.map((s,i)=><li key={`${s}-${i}`}>{s==='updish-demo-guide-v1'?'UpDish 이용 안내':s===storeId?'선택한 가게 정보':s.startsWith('source-')||s.startsWith('revenue-')?'가상 CSV 대조 자료':'승인 정산·매출 근거'}</li>)}</ul></details>:null}</article>)}{pending?<p className="chat-thinking" role="status">답변을 작성하고 있어요…</p>:null}{error?<p className="error-box" role="alert">{error}</p>:null}</div><form className="chat-composer" onSubmit={e=>void send(e)}><label className="sr-only" htmlFor="agent-question">Agent에게 질문</label><textarea id="agent-question" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit();}}} rows={2} maxLength={300} disabled={!enabled||pending} value={question} onChange={e=>setQuestion(e.target.value)} placeholder={enabled?'메시지를 입력하세요…':blocked}/><button aria-label="메시지 전송" disabled={!enabled||pending||!question.trim()}>{pending?'…':'↑'}</button>{!enabled?<button type="button" className="chat-retry inline-button" onClick={retry}>연결 다시 확인</button>:null}<small>AI 답변은 원장의 근거와 함께 확인하세요.</small></form></section>;
}
